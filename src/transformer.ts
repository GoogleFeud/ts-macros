/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as ts from "typescript";
import nativeMacros from "./nativeMacros";
import { wrapExpressions, toBinaryExp, getRepetitionParams, MacroError, getNameFromProperty, isStatement, resolveAliasedSymbol, tryRun, deExpandMacroResults } from "./utils";
import { binaryActions, binaryNumberActions, unaryActions, labelActions } from "./actions";
import { TsMacrosConfig } from ".";

export const enum MacroParamMarkers {
    None,
    Accumulator,
    Save
}

export interface MacroParam {
    spread: boolean,
    marker: MacroParamMarkers,
    start: number,
    name: string,
    defaultVal?: ts.Expression,
    realName?: ts.Identifier
}

export interface Macro {
    name: string,
    params: Array<MacroParam>,
    typeParams: Array<ts.TypeParameterDeclaration>,
    body?: ts.FunctionBody
}

export interface MacroExpand {
    macro: Macro,
    call?: ts.CallExpression,
    args: ts.NodeArray<ts.Expression>,
    defined: Map<string, ts.Identifier>,
    /**
    * The item which has the decorator
    */
    target?: ts.Node,
    store: Record<string, ts.Expression>
}

export interface MacroRepeat {
    index: number,
    repeatNames: Array<string>,
    elementSlices: Array<Array<ts.Expression>>
}

export interface MacroTransformerBuiltinProps {
    optimizeEnv?: boolean
}

export type ComptimeFunction = (...params: Array<unknown>) => void;

export type MacroMap = Map<ts.Symbol, Macro>;

export const NO_LIT_FOUND = Symbol("NO_LIT_FOUND");

export class MacroTransformer {
    context: ts.TransformationContext;
    macroStack: Array<MacroExpand>;
    repeat: Array<MacroRepeat>;
    boundVisitor: ts.Visitor;
    props: MacroTransformerBuiltinProps;
    checker: ts.TypeChecker;
    macros: MacroMap;
    escapedStatements: Array<Array<ts.Statement>>;
    comptimeSignatures: Map<ts.Node, ComptimeFunction>;
    config: TsMacrosConfig;
    constructor(context: ts.TransformationContext, checker: ts.TypeChecker, macroMap: MacroMap, config?: TsMacrosConfig) {
        this.context = context;
        this.boundVisitor = this.visitor.bind(this);
        this.repeat = [];
        this.macroStack = [];
        this.escapedStatements = [];
        this.props = {};
        this.checker = checker;
        this.macros = macroMap;
        this.comptimeSignatures = new Map();
        this.config = config || {};
    }

    run(node: ts.SourceFile): ts.Node {
        if (node.isDeclarationFile) return node;
        const statements: Array<ts.Statement> = [];
        this.addEscapeScope();
        for (const stmt of node.statements) {
            const res = this.visitor(stmt) as Array<ts.Statement> | ts.Statement | undefined;
            this.saveAndClearEscapedStatements(statements);
            if (res) {
                if (Array.isArray(res)) statements.push(...res);
                else statements.push(res);
            }
        }
        this.removeEscapeScope();
        return ts.factory.updateSourceFile(node, statements);
    }

    visitor(node: ts.Node): ts.VisitResult<ts.Node> {
        if (ts.isFunctionDeclaration(node) && node.name && !node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.DeclareKeyword) && node.name.getText().startsWith("$")) {
            if (!node.body) return node;
            const sym = this.checker.getSymbolAtLocation(node.name);
            if (!sym) return node; //todo maybe error - require node traversed
            if (this.macros.has(sym)) return;
            const macroName = sym.name;
            const params: Array<MacroParam> = [];
            for (let i = 0; i < node.parameters.length; i++) {
                const param = node.parameters[i];
                if (!ts.isIdentifier(param.name)) throw MacroError(param, "You cannot use deconstruction patterns in macros.");
                const marker = this.getMarker(param);
                params.push({
                    spread: Boolean(param.dotDotDotToken),
                    marker,
                    start: i,
                    name: param.name.text,
                    defaultVal: param.initializer || (param.questionToken ? ts.factory.createIdentifier("undefined") : undefined)
                });
            }
            this.macros.set(sym, {
                name: macroName,
                params,
                body: node.body,
                typeParams: (node.typeParameters as unknown as Array<ts.TypeParameterDeclaration>)|| []
            });
            return;
        }

        if (ts.isBlock(node)) {
            const statements: Array<ts.Statement> = [];
            this.addEscapeScope();
            for (const stmt of node.statements) {
                const res = this.visitor(stmt) as Array<ts.Statement> | ts.Statement | undefined;
                this.saveAndClearEscapedStatements(statements);
                if (res) {
                    if (Array.isArray(res)) statements.push(...res);
                    else statements.push(res);
                }
            }
            this.removeEscapeScope();
            return ts.factory.updateBlock(node, statements);
        }

        // Check for macro calls in labels
        if (ts.isLabeledStatement(node)) {
            const macro = this.findMacroByName(node.label);
            if (macro && macro.body) {
                let statementNode = node.statement;
                const results = [];
                if (ts.isLabeledStatement(statementNode)) {
                    const labelRes = this.visitor(node.statement);
                    if (!labelRes) return node;//todo maybe error - require node traversed
                    else if (Array.isArray(labelRes)) {
                        const foundStmt = labelRes.findIndex(node => labelActions[node.kind]);
                        if (foundStmt === -1) return node;//todo maybe error - require node traversed
                        results.push(...labelRes.filter((_item, ind) => ind !== foundStmt));
                        statementNode = labelRes[foundStmt] as ts.Statement;
                    }
                    else statementNode = ts.visitNode(node.statement, this.boundVisitor);
                }
                const labelAction = labelActions[statementNode.kind];
                if (labelAction) {
                    this.macroStack.push({
                        macro,
                        call: undefined,
                        args: ts.factory.createNodeArray([labelAction(statementNode)]),
                        defined: new Map(),
                        store: {}
                    });
                    results.push(...ts.visitEachChild(macro.body, this.boundVisitor, this.context).statements);
                    const acc = macro.params.find(p => p.marker === MacroParamMarkers.Accumulator);
                    if (acc) acc.defaultVal = ts.factory.createNumericLiteral(+(acc.defaultVal as ts.NumericLiteral).text + 1);
                    this.macroStack.pop();
                    return results;
                }
            }
        }

        if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && ts.isNonNullExpression(node.expression.expression)) {
            if (ts.isNonNullExpression(node.expression.expression)) {
                const statements = this.runMacro(node.expression, node.expression.expression.expression);
                if (!statements) return;
                const prepared = this.makeHygienic(ts.factory.createNodeArray(statements)) as unknown as Array<ts.Statement>;
                if (prepared.length && ts.isReturnStatement(prepared[prepared.length - 1]) && ts.isSourceFile(node.parent)) {
                    const exp = prepared.pop() as ts.ReturnStatement;
                    if (exp.expression) prepared.push(ts.factory.createExpressionStatement(exp.expression));
                }
                else return prepared;
            }
        }

        if (ts.canHaveDecorators(node) && ts.getDecorators(node)?.length) {
            const decorators = ts.getDecorators(node)!;
            let prev;
            const extra = [];
            for (let i=decorators.length - 1; i >= 0; i--) {
                const decorator = decorators[i];
                if (ts.isCallExpression(decorator.expression) && ts.isNonNullExpression(decorator.expression.expression)) {
                    const res = this.runMacro(decorator.expression, decorator.expression.expression.expression, prev || decorator.parent);
                    if (res && res.length) {
                        const [deExpanded, last] = deExpandMacroResults(res);
                        if (last) prev = ts.visitNode(last, this.boundVisitor);
                        extra.push(...deExpanded);
                    }
                }
            }
            return [...(extra as Array<ts.Node>), (prev as ts.Node)];
        }

        if (ts.isCallExpression(node)) {
            if (ts.isNonNullExpression(node.expression)) {
                const statements = this.runMacro(node, node.expression.expression) as unknown as Array<ts.Statement>|undefined;
                if (!statements || !statements.length) return ts.factory.createNull(); 
                let last = statements.pop()!;
                if (statements.length === 0) {
                    if (ts.isReturnStatement(last) || ts.isExpressionStatement(last)) return last.expression;
                    else if (!isStatement(last)) return last;
                }
                if (ts.isExpressionStatement(last)) last = ts.factory.createReturnStatement(last.expression);
                else if (!isStatement(last)) last = ts.factory.createReturnStatement(last);
                return ts.factory.createCallExpression(
                    ts.factory.createParenthesizedExpression(
                        ts.factory.createArrowFunction(undefined, undefined, [], undefined, undefined, ts.factory.createBlock([...statements, last], true))
                    ),
                    undefined, undefined);
            } else this.callComptimeFunction(node);
        }

        if (ts.isNewExpression(node)) this.callComptimeFunction(node);

        // If this is true then we're in the context of a macro call
        if (this.macroStack.length) {
            const { macro, args, store } = this.getLastMacro()!;

            // Detects property / element access and tries to remove it if possible
            if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
                if (ts.isPropertyAccessExpression(node) && this.props.optimizeEnv && node.expression.getText() === "process.env") {
                    const value = process.env[node.name.text];
                    if (!value) return node;
                    return ts.factory.createStringLiteral(value);
                } else {
                    let exp: ts.Expression = ts.visitNode(node.expression, this.boundVisitor);
                    while (ts.isParenthesizedExpression(exp)) exp = exp.expression;
                    if (ts.isObjectLiteralExpression(exp)) {
                        const name = ts.isPropertyAccessExpression(node) ? getNameFromProperty(node.name) : this.getNumberFromNode(ts.visitNode(node.argumentExpression, this.boundVisitor));
                        if (!name) return node;//todo maybe error - require node traversed
                        const prop = exp.properties.find(p => p.name && (getNameFromProperty(p.name) === name));
                        if (prop && ts.isPropertyAssignment(prop)) return prop.initializer;
                        return ts.factory.createPropertyAccessExpression(exp, name.toString()); 
                    } else if (ts.isArrayLiteralExpression(exp)) {
                        if (!ts.isElementAccessExpression(node)) return ts.factory.createPropertyAccessExpression(exp, node.name);
                        const nameNode = ts.visitNode(node.argumentExpression, this.boundVisitor);
                        const name = this.getNumberFromNode(nameNode);
                        if (name !== undefined && exp.elements[name]) return exp.elements[name];
                        return ts.factory.createElementAccessExpression(exp, nameNode);
                    }
                }
            }

            else if (ts.isAsExpression(node)) return ts.visitNode(node.expression, this.boundVisitor);
            else if (ts.isNonNullExpression(node)) return ts.visitNode(node.expression, this.boundVisitor);
            else if (ts.isNumericLiteral(node)) return ts.factory.createNumericLiteral(node.text);
            else if (ts.isStringLiteral(node)) return ts.factory.createStringLiteral(node.text);
            else if (ts.isRegularExpressionLiteral(node)) return ts.factory.createRegularExpressionLiteral(node.text);
            else if (ts.isTemplateHead(node)) return ts.factory.createTemplateHead(node.text, node.rawText, node.templateFlags);
            else if (ts.isTemplateMiddle(node)) return ts.factory.createTemplateMiddle(node.text, node.rawText, node.templateFlags);
            else if (ts.isTemplateTail(node)) return ts.factory.createTemplateTail(node.text, node.rawText, node.templateFlags);

            // Detects use of a macro parameter and replaces it with a literal
            else if (ts.isIdentifier(node)) {
                if (store[node.text]) return store[node.text];
                const paramMacro = this.getMacroParam(node.text, macro, args);
                if (!paramMacro) return node;
                if (ts.isStringLiteral(paramMacro) && (ts.isClassDeclaration(node.parent) || ts.isEnumDeclaration(node.parent) || ts.isFunctionDeclaration(node.parent))) return ts.factory.createIdentifier(paramMacro.text);
                if (ts.isIdentifier(paramMacro)) return paramMacro;
                return ts.visitNode(paramMacro, this.boundVisitor);
            }

            else if (ts.isVariableStatement(node)) {
                const leftovers = [];
                for (const varNode of node.declarationList.declarations) {
                    if (ts.isIdentifier(varNode.name) && varNode.name.text.startsWith("$")) {
                        store[varNode.name.text] = ts.visitNode(varNode.initializer, this.boundVisitor) || ts.factory.createIdentifier("undefined");
                    } else {
                        leftovers.push(ts.visitNode(varNode, this.boundVisitor));
                    }
                }
                if (leftovers.length) return ts.factory.createVariableStatement(node.modifiers, ts.factory.createVariableDeclarationList(leftovers, node.declarationList.flags));
                else return undefined;
            }
            
            else if (ts.isArrayLiteralExpression(node) && node.elements.some(t => ts.isSpreadElement(t))) {
                const elements = [];
                for (const element of node.elements) {
                    if (ts.isSpreadElement(element)) {
                        const visited = ts.visitNode(element.expression, this.boundVisitor);
                        if (ts.isArrayLiteralExpression(visited)) elements.push(...visited.elements);
                        else elements.push(ts.visitNode(element, this.boundVisitor));
                    }
                    else elements.push(ts.visitNode(element, this.boundVisitor));
                }
                return ts.factory.createArrayLiteralExpression(elements);
            }

            // Detects a ternary expression and tries to remove it if possible
            else if (ts.isConditionalExpression(node)) {
                const param = ts.visitNode(node.condition, this.boundVisitor);
                const res = this.getBoolFromNode(param);
                if (res === false) return ts.visitNode(node.whenFalse, this.boundVisitor);
                else if (res === true) return ts.visitNode(node.whenTrue, this.boundVisitor);
                else return ts.factory.createConditionalExpression(param, undefined, ts.visitNode(node.whenTrue, this.boundVisitor), undefined, ts.visitNode(node.whenFalse, this.boundVisitor));
            }

            // Detects an if statement and tries to remove it if possible
            else if (ts.isIfStatement(node) && !ts.isParenthesizedExpression(node.expression)) {
                const condition = ts.visitNode(node.expression, this.boundVisitor);
                const res = this.getBoolFromNode(condition);
                if (res === true) {
                    const res = ts.visitNode(node.thenStatement, this.boundVisitor);
                    if (res && ts.isBlock(res)) return [...res.statements];
                    return res;
                }
                else if (res === false) {
                    if (!node.elseStatement) return undefined;
                    const res = ts.visitNode(node.elseStatement, this.boundVisitor);
                    if (res && ts.isBlock(res)) return [...res.statements];
                    return res;
                }
                return ts.factory.createIfStatement(condition, ts.visitNode(node.thenStatement, this.boundVisitor), ts.visitNode(node.elseStatement, this.boundVisitor));
            }

            // Detects a binary operation and tries to remove it if possible
            else if (ts.isBinaryExpression(node)) {
                const op = node.operatorToken.kind;
                const left: ts.Expression = ts.visitNode(node.left, this.boundVisitor);
                const right: ts.Expression = ts.visitNode(node.right, this.boundVisitor);
                const leftVal = this.getLiteralFromNode(left);
                const rightVal = this.getLiteralFromNode(right);
                if (leftVal === NO_LIT_FOUND || rightVal === NO_LIT_FOUND) return ts.factory.createBinaryExpression(left, op, right);
                if (binaryNumberActions[op] && typeof leftVal === "number" && typeof rightVal === "number") return binaryNumberActions[op](leftVal, rightVal);
                else return binaryActions[op]?.(left, right, leftVal, rightVal) ?? ts.factory.createBinaryExpression(left, op, right);
            }

            // Detects a typeof expression and tries to remove it if possible
            else if (ts.isTypeOfExpression(node)) {
                const visitedNode = ts.visitNode(node.expression, this.boundVisitor);
                const val = this.getLiteralFromNode(visitedNode);
                if (val === NO_LIT_FOUND) return visitedNode;
                return ts.factory.createStringLiteral(typeof val);
            }

            // Detects a repetition
            else if (ts.isExpressionStatement(node) && ts.isPrefixUnaryExpression(node.expression) && node.expression.operator === 39 && ts.isArrayLiteralExpression(node.expression.operand)) {
                const { separator, function: fn, literals} = getRepetitionParams(node.expression.operand);
                return this.execRepetition(fn, args, macro, literals, separator);
            }
            else if (ts.isPrefixUnaryExpression(node)) {
                if (node.operator === 39 && ts.isArrayLiteralExpression(node.operand)) {
                    const { separator, function: fn, literals} = getRepetitionParams(node.operand);
                    if (!separator) throw MacroError(node, "Repetition separator must be included if a repetition is used as an expression.");
                    return this.execRepetition(fn, args, macro, literals, separator, true);
                } else {
                    // Detects a unary expression and tries to remove it if possible
                    const op = node.operator;
                    const value: ts.Expression = ts.visitNode(node.operand, this.boundVisitor);
                    const val = this.getLiteralFromNode(value);
                    if (val === NO_LIT_FOUND) return node;
                    return unaryActions[op]?.(val) || value;
                }
            }
            else if (ts.isCallExpression(node)) {
                const repNodeIndex = node.arguments.findIndex(arg => ts.isPrefixUnaryExpression(arg) && arg.operator === 39 && ts.isArrayLiteralExpression(arg.operand));
                if (repNodeIndex !== -1) {
                    const repNode = (node.arguments[repNodeIndex] as ts.PrefixUnaryExpression).operand as ts.ArrayLiteralExpression;
                    const { separator, function: fn, literals} = getRepetitionParams(repNode);
                    if (!separator) {
                        const newBod = this.execRepetition(fn, args, macro, literals, separator, true);
                        const finalArgs = [];
                        for (let i=0; i < node.arguments.length; i++) {
                            if (i === repNodeIndex) finalArgs.push(...newBod);
                            else finalArgs.push(node.arguments[i]);
                        }
                        return ts.visitNode(ts.factory.createCallExpression(node.expression, node.typeArguments, finalArgs as Array<ts.Expression>), this.boundVisitor);
                    }
                }
            }
        }
        return ts.visitEachChild(node, this.boundVisitor, this.context);
    }

    execRepetition(fn: ts.ArrowFunction, args: ts.NodeArray<ts.Node>, macro: Macro, elements: Array<ts.Expression>, separator?: string, wrapStatements?: boolean) : Array<ts.Node> {
        const newBod = [];
        const repeatNames = fn.parameters.map(p => p.name.getText());
        const elementSlices: Array<Array<ts.Expression>> = Array.from({length: repeatNames.length}, () => []);
        for (let i=0; i < elements.length; i++) {
            const lit = elements[i];
            const resolved = ts.visitNode(lit, this.boundVisitor);
            if (ts.isArrayLiteralExpression(resolved)) elementSlices[i % repeatNames.length].push(...resolved.elements);
        }
        const ind = this.repeat.push({
            index: 0,
            elementSlices,
            repeatNames
        }) - 1;

        const totalLoopsNeeded = Math.max(...elementSlices.map(s => s.length));
        for (; this.repeat[ind].index < totalLoopsNeeded; this.repeat[ind].index++) {
            if ("statements" in fn.body) {
                if (wrapStatements) newBod.push(wrapExpressions(fn.body.statements.map(node => ts.visitNode(node, this.boundVisitor))));
                else {
                    for (const stmt of fn.body.statements) {
                        const res = this.boundVisitor(stmt);
                        if (res) {
                            if (Array.isArray(res)) newBod.push(...res as ts.Statement[]);
                            else newBod.push(res as ts.Statement);
                        }
                    }
                }
            }
            else {
                const res = ts.visitNode(fn.body, this.boundVisitor);
                newBod.push(res);
            }
        }
        this.repeat.pop();
        return separator && separators[separator] ? [separators[separator](this, newBod)] : newBod;
    }

    getMacroParam(name: string, macro: Macro, params: ts.NodeArray<ts.Node>) : ts.Node|undefined {
        const index = macro.params.findIndex(p => p.name === name);
        if (index === -1) {
            for (const repeat of this.repeat) {
                const repeatNameIndex = repeat.repeatNames.indexOf(name);
                if (repeatNameIndex !== -1) {
                    const repeatCollection = repeat.elementSlices[repeatNameIndex];
                    if (repeatCollection.length <= repeat.index) return ts.factory.createNull();
                    else return repeatCollection[repeat.index];
                }
            }
            return;
        }
        const paramMacro = macro.params[index];
        if (paramMacro.realName) return paramMacro.realName;
        if (paramMacro.spread) {
            const spreadItems = params.slice(paramMacro.start) as Array<ts.Expression>;
            if (spreadItems.length === 1 && ts.isSpreadElement(spreadItems[0])) return spreadItems[0].expression;
            else return ts.factory.createArrayLiteralExpression(params.slice(paramMacro.start) as Array<ts.Expression>);
        }
        return params[paramMacro.start] || paramMacro.defaultVal;
    }

    runMacro(call: ts.CallExpression, name: ts.Expression, target?: ts.Node) : Array<ts.Statement>|undefined {
        const args = call.arguments;
        let macro, normalArgs;
        if (ts.isPropertyAccessExpression(name)) {
            const symofArg = resolveAliasedSymbol(this.checker, this.checker.getSymbolAtLocation(name.expression));
            if (symofArg && (symofArg.flags & ts.SymbolFlags.Namespace) !== 0) return this.runMacro(call, name.name);
            const possibleMacros = this.findMacroByTypeParams(name, call);
            if (!possibleMacros.length) throw MacroError(call, `No possible candidates for "${name.name.getText()}" call`);
            else if (possibleMacros.length > 1) throw MacroError(call, `More than one possible candidate for "${name.name.getText()}" call`);
            else macro = possibleMacros[0];
            const newArgs = ts.factory.createNodeArray([ts.visitNode(name.expression, this.boundVisitor), ...call.arguments]);
            normalArgs = this.macroStack.length ? ts.visitNodes(newArgs, this.boundVisitor) : newArgs;
        } else {
            const nativeMacro = nativeMacros[name.getText()];
            if (nativeMacro) {
                const macroResult = nativeMacro.call(nativeMacro.preserveParams ? args : ts.visitNodes(args, this.boundVisitor), this, call);
                if (!macroResult) return undefined;
                if (Array.isArray(macroResult)) return macroResult as Array<ts.Statement>;
                return [ts.factory.createExpressionStatement(macroResult as ts.Expression)];
            }
            macro = this.macros.get(resolveAliasedSymbol(this.checker, this.checker.getSymbolAtLocation(name))!);
            normalArgs = this.macroStack.length ? ts.visitNodes(args, this.boundVisitor) : args;
        }
        if (!macro || !macro.body) {
            const calledSym = resolveAliasedSymbol(this.checker, this.checker.getSymbolAtLocation(name));
            if (calledSym?.declarations?.length) {
                this.boundVisitor(calledSym.declarations[0]);
                return this.runMacro(call, name, target);
            } else {
                return;
            }
        }
        this.macroStack.push({
            macro,
            args: normalArgs,
            call: call,
            target,
            defined: new Map(),
            store: {}
        });
        const pre = [];
        for (let i=0; i < macro.params.length; i++) {
            const param = macro.params[i];
            if (param.marker === MacroParamMarkers.Save) {
                const value = param.spread ? ts.factory.createArrayLiteralExpression(normalArgs.slice(param.start)) : (normalArgs[param.start] || param.defaultVal);
                if (!ts.isIdentifier(value)) {
                    param.realName = ts.factory.createUniqueName(param.name);
                    pre.push(ts.factory.createVariableDeclaration(param.realName, undefined, undefined, value));
                }
            }
        }
        if (pre.length) this.escapeStatement(ts.factory.createVariableStatement(undefined, ts.factory.createVariableDeclarationList(pre, ts.NodeFlags.Let)) as unknown as ts.Statement);
        const result = ts.visitEachChild(macro.body, this.boundVisitor, this.context).statements;
        const acc = macro.params.find(p => p.marker === MacroParamMarkers.Accumulator);
        if (acc) acc.defaultVal = ts.factory.createNumericLiteral(+(acc.defaultVal as ts.NumericLiteral).text + 1);
        this.macroStack.pop();
        return [...result];
    }


    makeHygienic(statements: ts.NodeArray<ts.Statement>) : ts.NodeArray<ts.Statement> {
        const defined = this.getLastMacro()?.defined || new Map();

        const makeBindingElementHygienic = (name: ts.BindingName) : ts.BindingName => {
            if (ts.isIdentifier(name)) {
                const newName = ts.factory.createUniqueName(name.text);
                defined.set(name.text, newName);
                return newName;
            }
            else if (ts.isArrayBindingPattern(name)) return ts.factory.createArrayBindingPattern(name.elements.map(el => ts.isBindingElement(el) ? ts.factory.createBindingElement(el.dotDotDotToken, el.propertyName, makeBindingElementHygienic(el.name), ts.visitNode(el.initializer, visitor)) : el));
            else if (ts.isObjectBindingPattern(name)) return ts.factory.createObjectBindingPattern(name.elements.map(el => ts.factory.createBindingElement(el.dotDotDotToken, el.propertyName, makeBindingElementHygienic(el.name), ts.visitNode(el.initializer, visitor))));
            else return name;
        };

        const visitor = (node: ts.Node) : ts.Node => {
            if (ts.isVariableDeclaration(node) && node.pos !== -1) {
                return ts.factory.updateVariableDeclaration(node, makeBindingElementHygienic(node.name), undefined, undefined, ts.visitNode(node.initializer, visitor));
            }
            else if (ts.isIdentifier(node)) {
                if (node.parent && ts.isPropertyAccessExpression(node.parent) && node.parent.expression !== node) return node;
                else return defined.get(node.text) || node;
            }
            else return ts.visitEachChild(node, visitor, this.context);
        };
        return ts.visitNodes(ts.factory.createNodeArray(statements), visitor);
    }

    getMarker(param: ts.ParameterDeclaration) : MacroParamMarkers {
        if (!param.type) return MacroParamMarkers.None;
        const type = this.checker.getTypeAtLocation(param.type).getProperty("__marker");
        if (!type) return MacroParamMarkers.None;
        const typeOfMarker = (this.checker.getTypeOfSymbol(type) as ts.Type).getNonNullableType();
        if (!typeOfMarker.isStringLiteral()) return MacroParamMarkers.None;
        switch(typeOfMarker.value) {
        case "Accumulator": return MacroParamMarkers.Accumulator;
        case "Save": return MacroParamMarkers.Save;
        default: return MacroParamMarkers.None;
        }
    }

    callComptimeFunction(node: ts.CallExpression | ts.NewExpression) : void {
        // Handle comptime signatures
        if (this.comptimeSignatures.size) {
            const signature = this.checker.getResolvedSignature(node);
            if (signature && signature.declaration) {
                const func = this.comptimeSignatures.get(signature.declaration);
                if (func) {
                    tryRun(func, node.arguments?.map(arg => {
                        const lit = this.getLiteralFromNode(arg, false, true, true);
                        if (lit === NO_LIT_FOUND) return undefined;
                        else return lit;
                    }) || []);
                }
            }
        }
    }

    getNumberFromNode(node: ts.Expression) : number|undefined {
        if (ts.isParenthesizedExpression(node)) return this.getNumberFromNode(node.expression);
        if (ts.isNumericLiteral(node)) return +node.text;
        const type = this.checker.getTypeAtLocation(node);
        if (type.isNumberLiteral()) return type.value;
        //@ts-expect-error Private API
        if (type.intrinsicName === "null") return 0;
    }

    getStringFromNode(node?: ts.Expression, handleIdents = false, handleTemplates = false) : string | undefined {
        if (!node) return;
        const lit = this.getLiteralFromNode(node, handleIdents, handleTemplates);
        if (typeof lit === "string") return lit;
        return undefined;
    }

    getLiteralFromNode(node: ts.Expression, handleIdents = false, handleTemplates = false, handleObjects = false) : unknown {
        if (ts.isParenthesizedExpression(node)) return this.getLiteralFromNode(node.expression);
        else if (ts.isAsExpression(node)) return this.getLiteralFromNode(node.expression);
        else if (ts.isNumericLiteral(node)) return +node.text;
        else if (ts.isStringLiteral(node)) return node.text;
        else if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
        else if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
        else if (node.kind === ts.SyntaxKind.NullKeyword) return null;
        else if (ts.isIdentifier(node)) {
            if (node.text === "undefined") return undefined;
            else if (handleIdents) return node.text;
        }
        else if (handleTemplates && ts.isTemplateExpression(node)) {
            let res = node.head.text;
            for (const span of node.templateSpans) {
                const lit = this.getLiteralFromNode(ts.visitNode(span.expression, this.boundVisitor));
                res += (lit as string || "").toString() + span.literal.text;
            }
            return res;
        }
        else if (handleObjects && ts.isObjectLiteralExpression(node)) {
            const obj: Record<string, unknown> = {};
            for (const prop of node.properties) {
                if (!ts.isPropertyAssignment(prop) || !prop.initializer) continue;
                const name = prop.name && getNameFromProperty(prop.name);
                if (!name) continue;
                obj[name] = this.getLiteralFromNode(prop.initializer, handleIdents, handleTemplates, handleObjects);
            }
            return obj;
        } 
        else if (handleObjects && ts.isArrayLiteralExpression(node)) return node.elements.map(el => this.getLiteralFromNode(el, handleIdents, handleTemplates, handleObjects));
        const type = this.checker.getTypeAtLocation(node);
        if (type.isNumberLiteral()) return type.value;
        else if (type.isStringLiteral()) return type.value;
        //@ts-expect-error Private API
        else if (type.value) return type.value;
        //@ts-expect-error Private API
        else if (type.intrinsicName === "false") return false;
        //@ts-expect-error Private API
        else if (type.intrinsicName === "true") return true;
        //@ts-expect-error Private API
        else if (type.intrinsicName === "undefined") return undefined;
        //@ts-expect-error Private API
        else if (type.intrinsicName === "null") return null;
        else return NO_LIT_FOUND;
    }

    getBoolFromNode(node: ts.Expression|undefined) : boolean|undefined {
        if (!node) return undefined;
        if (node.kind === ts.SyntaxKind.FalseKeyword || node.kind === ts.SyntaxKind.NullKeyword) return false;
        else if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
        else if (ts.isNumericLiteral(node)) {
            if (node.text === "0") return false;
            return true;
        }
        else if (ts.isStringLiteral(node)) {
            if (node.text === "") return false;
            return true;
        }
        else if (ts.isArrayLiteralExpression(node) || ts.isObjectLiteralElement(node)) return true;
        else if (ts.isIdentifier(node) && node.text === "undefined") return false;
        const type = this.checker.getTypeAtLocation(node);
        if (type.isNumberLiteral()) {
            if (type.value === 0) return false;
            return true;
        }
        else if (type.isStringLiteral()) {
            if (type.value === "") return false;
            return true;
        }
        else if (type.getCallSignatures().length) return true;
        //@ts-expect-error Private API
        else if (type.intrinsicName === "false") return false;
        //@ts-expect-error Private API
        else if (type.intrinsicName === "true") return true;
        //@ts-expect-error Private API
        else if (type.intrinsicName === "undefined") return false;
        //@ts-expect-error Private API
        else if (type.intrinsicName === "null") return false;
        return undefined;
    }

    getTypeParam(type: ts.Type) : ts.Type | undefined {
        const lastMacroCall = this.getLastMacro();
        if (!lastMacroCall) return;
        const resolvedTypeParameterIndex = lastMacroCall.macro.typeParams.findIndex(arg => this.checker.getTypeAtLocation(arg) === type);
        if (resolvedTypeParameterIndex === -1) return;
        if (lastMacroCall.call) {
            const resolvedTypeParam = lastMacroCall.call.typeArguments?.[resolvedTypeParameterIndex];
            if (!resolvedTypeParam) return this.checker.getResolvedSignature(lastMacroCall.call)?.getTypeParameterAtPosition(resolvedTypeParameterIndex);

            return this.checker.getTypeAtLocation(resolvedTypeParam);
        }
    }

    findMacroByTypeParams(prop: ts.PropertyAccessExpression, call: ts.CallExpression) : Array<Macro> {
        const name = prop.name.getText();
        const firstType = this.checker.getTypeAtLocation(prop.expression);
        const restTypes = call.arguments.map((exp) => this.checker.getTypeAtLocation(exp));
        const macros = [];
        mainLoop:
        for (const [sym, macro] of this.macros) {
            // If the names are different, continue to the next macro
            if (macro.name !== name) continue;
            const fnType = this.checker.getTypeOfSymbolAtLocation(sym, sym.valueDeclaration!).getCallSignatures()[0];
            const fnArgs = fnType.parameters.map(p => {
                const type = this.checker.getTypeOfSymbolAtLocation(p, p.valueDeclaration!);
                // Treat type parameters as their constraint or any if there is none
                if (type.isTypeParameter()) return type.getConstraint() || this.checker.getAnyType();
                else return type;
            });
            const firstArg = fnArgs.shift()!;
            // If the first parameter matches type
            if (this.checker.isTypeAssignableTo(firstType, firstArg)) {
                // Check if the rest of the parameters match
                for (let i=0; i < fnArgs.length; i++) {
                    // If the parameter is spread, do not compare, it will be done afterwards
                    if (macro.params[i + 1].spread) break;
                    // If the macro call is missing a parameter
                    // and that parameter is NOT optional and does NOT have a default value
                    // continue to the next macro
                    if (!restTypes[i]) {
                        if (fnArgs[i].getDefault() || fnArgs[i] !== fnArgs[i].getNonNullableType()) continue;
                        else continue mainLoop;
                    }
                    if (!this.checker.isTypeAssignableTo(restTypes[i], fnArgs[i])) continue mainLoop;
                }
                // If the macro call has more arguments than the macro declaration
                if (restTypes.length > fnArgs.length) {
                    // If the last parameter of the function is a spread parameter, check if the rest of the
                    // passed values match the type, otherwise return
                    let argType = this.checker.getTypeArguments(fnArgs[fnArgs.length - 1] as ts.TypeReference)[0];
                    if (argType.isTypeParameter()) argType = argType.getConstraint() || this.checker.getAnyType();
                    if (macro.params[macro.params.length - 1].spread) {
                        for (let i=fnArgs.length - 1; i < restTypes.length; i++) {
                            if (!this.checker.isTypeAssignableTo(restTypes[i], argType)) continue mainLoop;
                        }
                    } else continue;
                }
                macros.push(macro);
            }
        }
        return macros;
    }

    findMacroByName(node: ts.Identifier): Macro | undefined {
        if (!node.text.startsWith("$")) return undefined;
        const foundMacros = [];
        for (const [, macro] of this.macros) {
            if (macro.name === node.text) foundMacros.push(macro);
        }
        if (foundMacros.length > 1) throw MacroError(node, `More than one macro with the name ${node.text} exists.`);
        return foundMacros[0];
    }

    getLastMacro() : MacroExpand|undefined {
        return this.macroStack[this.macroStack.length - 1];
    }

    saveAndClearEscapedStatements(into: Array<ts.Statement>) : void {
        into.push(...this.escapedStatements[this.escapedStatements.length - 1]);
        this.escapedStatements[this.escapedStatements.length - 1].length = 0;
    }

    escapeStatement(...statements: Array<ts.Statement>) : void {
        this.escapedStatements[this.escapedStatements.length - 1].push(...statements);
    }

    removeEscapeScope() : void {
        this.escapedStatements.pop();
    }

    addEscapeScope() : void {
        this.escapedStatements.push([]);
    }

    addComptimeSignature(sym: ts.Node, fn: string, args: Array<string>) : ComptimeFunction {
        if (this.comptimeSignatures.has(sym)) return this.comptimeSignatures.get(sym) as ComptimeFunction;
        const comptime = new Function(...args, fn) as (...args: Array<unknown>) => void;
        this.comptimeSignatures.set(sym, comptime);
        return comptime;
    }

    strToAST(str: string) : ts.NodeArray<ts.Statement> {
        const file = ts.createSourceFile("", str, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
        const uniquelize: (node: ts.Node) => ts.Node = (node: ts.Node) => {
            if (ts.isNumericLiteral(node)) return ts.factory.createNumericLiteral(node.text);
            else if (ts.isStringLiteral(node)) return ts.factory.createStringLiteral(node.text);
            else if (ts.isRegularExpressionLiteral(node)) return ts.factory.createRegularExpressionLiteral(node.text);
            else if (ts.isIdentifier(node)) return ts.factory.createIdentifier(node.text);
            else return ts.visitEachChild(node, uniquelize, this.context);
        };
        return ts.visitEachChild(file, uniquelize, this.context).statements;
    }

}

const separators: Record<string, (transformer: MacroTransformer, body: Array<ts.Expression | ts.Statement>) => ts.Expression> = {
    "[]": (_transformer, body) => ts.factory.createArrayLiteralExpression(body.map(m => ts.isExpressionStatement(m) ? m.expression : (m as ts.Expression))),
    "+": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.PlusToken),
    "-": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.MinusToken),
    "*": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.AsteriskToken),
    "||": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.BarBarToken),
    "&&": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.AmpersandAmpersandToken),
    "()": (transformer, body) => ts.factory.createParenthesizedExpression(toBinaryExp(transformer, body, ts.SyntaxKind.CommaToken))
};