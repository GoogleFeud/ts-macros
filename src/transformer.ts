/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as ts from "typescript";
import nativeMacros from "./nativeMacros";
import { wrapExpressions, toBinaryExp, getRepetitionParams, MacroError, getNameFromProperty, isStatement, resolveAliasedSymbol, tryRun, deExpandMacroResults, resolveTypeArguments, resolveTypeWithTypeParams, hasBit } from "./utils";
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
    node: ts.ParameterDeclaration,
    defaultVal?: ts.Expression,
    realName?: ts.Identifier
}

export interface Macro {
    name: string,
    params: Array<MacroParam>,
    node: ts.FunctionDeclaration,
    typeParams: Array<ts.TypeParameterDeclaration>,
    body?: ts.FunctionBody,
    namespace?: ts.ModuleDeclaration
}

export interface MacroExpand {
    macro: Macro,
    call?: ts.Expression,
    args: ts.NodeArray<ts.Expression>,
    defined: Map<string, ts.Identifier>,
    /**
    * The item which has the decorator
    */
    target?: ts.Node,
    store: Map<string, ts.Expression>
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

export interface MacroTransformerHooks {
    beforeRegisterMacro?: (transformer: MacroTransformer, symbol: ts.Symbol, macro: Macro) => void,
    beforeCallMacro?: (transformer: MacroTransformer, macro: Macro, expand: MacroExpand) => void,
    beforeFileTransform?: (transformer: MacroTransformer, sourceFile: ts.SourceFile) => void
}

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
    hooks: MacroTransformerHooks;
    constructor(context: ts.TransformationContext, checker: ts.TypeChecker, macroMap: MacroMap, config?: TsMacrosConfig, hooks?: MacroTransformerHooks) {
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
        this.hooks = hooks || {};
    }

    run(node: ts.SourceFile): ts.SourceFile {
        if (node.isDeclarationFile) return node;
        this.hooks.beforeFileTransform?.(this, node);
        const statements: Array<ts.Statement> = [];
        this.addEscapeScope();

        for (const stmt of node.statements) {
            if (ts.isImportDeclaration(stmt) && stmt.importClause && !stmt.importClause.isTypeOnly) {
                if (stmt.importClause.namedBindings && ts.isNamedImports(stmt.importClause.namedBindings)) {
                    const filtered = stmt.importClause.namedBindings.elements.filter(el => {
                        if (el.isTypeOnly) return this.config.keepImports;
                        const sym = resolveAliasedSymbol(this.checker, this.checker.getSymbolAtLocation(el.name));
                        if (!sym) return true;
                        if (this.macros.has(sym) || nativeMacros[sym.name]) return false;
                        else if ((hasBit(sym.flags, ts.SymbolFlags.Interface) && !hasBit(sym.flags, ts.SymbolFlags.Class)) || hasBit(sym.flags, ts.SymbolFlags.ConstEnum) || hasBit(sym.flags, ts.SymbolFlags.TypeAlias)) return this.config.keepImports;
                        else return true;
                    });
                    if (filtered.length) statements.push(ts.factory.updateImportDeclaration(stmt, stmt.modifiers, ts.factory.createImportClause(stmt.importClause.isTypeOnly, undefined, ts.factory.createNamedImports(filtered)), stmt.moduleSpecifier, stmt.assertClause));
                    continue;
                }
                else if (!stmt.importClause.namedBindings && stmt.importClause.name) {
                    const sym = resolveAliasedSymbol(this.checker, this.checker.getSymbolAtLocation(stmt.importClause.name));
                    if (!sym || !this.macros.has(sym)) statements.push(stmt);
                    continue;
                }
            }

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

    expectExpression(node: ts.Node) : ts.Expression {
        const visited = ts.visitNode(node, this.boundVisitor);
        if (!visited || !ts.isExpression(node)) throw new MacroError(node, "Expected an expression.");
        return visited as ts.Expression;
    }

    expectStatement(node: ts.Node) : ts.Statement {
        const visited = ts.visitNode(node, this.boundVisitor);
        if (!visited || !isStatement(visited)) throw new MacroError(node, "Expected a statement.");
        return visited as ts.Statement;
    }

    maybeStatement(node?: ts.Node) : ts.Statement | undefined {
        if (!node) return;
        const visited = ts.visitNode(node, this.boundVisitor);
        if (!visited) return undefined;
        if (!isStatement(visited)) throw new MacroError(node, "Expected a statement.");
        return visited as ts.Statement;
    }

    expect<T extends ts.Node = ts.Node>(node: T, kind: ts.SyntaxKind) : T {
        const visited = ts.visitNode(node, this.boundVisitor);
        if (!visited || visited.kind !== kind) throw new MacroError(node, `Expected SyntaxKind ${kind}.`);
        return visited as T;
    }

    visitor(node: ts.Node): ts.VisitResult<ts.Node|undefined> {
        if (ts.isFunctionDeclaration(node) && node.name && !node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.DeclareKeyword) && node.name.getText().startsWith("$")) {
            if (!node.body) return node;
            const sym = this.checker.getSymbolAtLocation(node.name);
            if (!sym) return node;
            if (this.macros.has(sym)) return;
            const macroName = sym.name;
            const params: Array<MacroParam> = [];
            for (let i = 0; i < node.parameters.length; i++) {
                const param = node.parameters[i];
                if (!ts.isIdentifier(param.name)) throw new MacroError(param, "You cannot use deconstruction patterns in macros.");
                const marker = this.getMarker(param);
                params.push({
                    spread: Boolean(param.dotDotDotToken),
                    marker,
                    start: i,
                    name: param.name.text,
                    node: param,
                    defaultVal: param.initializer || (param.questionToken ? ts.factory.createIdentifier("undefined") : undefined)
                });
            }

            const macro = {
                name: macroName,
                params,
                body: node.body,
                typeParams: (node.typeParameters as unknown as Array<ts.TypeParameterDeclaration>)|| [],
                node,
                namespace: ts.isModuleBlock(node.parent) ? node.parent.parent : undefined
            };

            this.hooks.beforeRegisterMacro?.(this, sym, macro);
            this.macros.set(sym, macro);
            return;
        }

        if (ts.isModuleDeclaration(node) && node.body) {
            const bod = ts.visitNode(node.body, this.boundVisitor) as ts.ModuleBlock;
            if (!bod.statements.length) return;
            else return ts.factory.updateModuleDeclaration(node, node.modifiers, node.name, bod);
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
            const macro = this.findMacroByName(node.label, node.label.text);
            if (!macro || !macro.body) return;
            let statementNode = node.statement;
            const results = [];
            if (ts.isLabeledStatement(statementNode)) {
                const labelRes = this.visitor(node.statement);
                if (!labelRes) return node;
                else if (Array.isArray(labelRes)) {
                    const foundStmt = labelRes.findIndex(node => labelActions[node.kind]);
                    if (foundStmt === -1) return node;
                    results.push(...labelRes.filter((_item, ind) => ind !== foundStmt));
                    statementNode = labelRes[foundStmt] as ts.Statement;
                }
                else statementNode = this.expectStatement(node.statement);
            }
            const labelAction = labelActions[statementNode.kind];
            if (!labelAction) return node;
            this.macroStack.push({
                macro,
                call: undefined,
                args: ts.factory.createNodeArray([labelAction(statementNode)]),
                defined: new Map(),
                store: new Map()
            });
            results.push(...ts.visitEachChild(macro.body, this.boundVisitor, this.context).statements);
            const acc = macro.params.find(p => p.marker === MacroParamMarkers.Accumulator);
            if (acc) acc.defaultVal = ts.factory.createNumericLiteral(+(acc.defaultVal as ts.NumericLiteral).text + 1);
            this.macroStack.pop();
            return results;
        }

        if (ts.isExpressionStatement(node)) {
            if (ts.isCallExpression(node.expression) && ts.isNonNullExpression(node.expression.expression)) {
                const statements = this.runMacroFromCallExpression(node.expression, node.expression.expression.expression);
                if (!statements) return node;
                return this.expandMacroResults(statements, node.parent);
            }
            else if (ts.isTaggedTemplateExpression(node.expression) && ts.isNonNullExpression(node.expression.tag)) {
                const statements = this.runMacroFromTemplateExpression(node.expression, node.expression.tag.expression);
                if (!statements) return node;
                return this.expandMacroResults(statements, node.parent);
            }
        }

        if (ts.canHaveDecorators(node) && ts.getDecorators(node)?.length) {
            const decorators = ts.getDecorators(node)!;
            let prev;
            const extra = [];
            for (let i=decorators.length - 1; i >= 0; i--) {
                const decorator = decorators[i];
                if (ts.isCallExpression(decorator.expression) && ts.isNonNullExpression(decorator.expression.expression)) {
                    const res = this.runMacroFromCallExpression(decorator.expression, decorator.expression.expression.expression, prev || decorator.parent);
                    if (res && res.length) {
                        const [deExpanded, last] = deExpandMacroResults(res);
                        if (last) prev = ts.visitNode(last, this.boundVisitor);
                        extra.push(...deExpanded);
                    }
                }
            }
            if (prev) return [...(extra as Array<ts.Node>), (prev as ts.Node)];
        }

        if (ts.isCallExpression(node)) {
            if (ts.isNonNullExpression(node.expression)) {
                const statements = this.runMacroFromCallExpression(node, node.expression.expression);
                if (!statements) return node;
                else if (!statements.length) return ts.factory.createNull();
                else return this.expandMacroResults(statements);
            }
            else this.callComptimeFunction(node);
        }

        if (ts.isTaggedTemplateExpression(node) && ts.isNonNullExpression(node.tag)) {
            const statements = this.runMacroFromTemplateExpression(node, node.tag.expression);
            if (!statements || !statements.length) return ts.factory.createNull(); 
            return this.expandMacroResults(statements);
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
                    let exp = this.expectExpression(node.expression);
                    while (ts.isParenthesizedExpression(exp)) exp = exp.expression;
                    if (ts.isObjectLiteralExpression(exp)) {
                        const name = ts.isPropertyAccessExpression(node) ? getNameFromProperty(node.name) : this.getNumberFromNode(this.expectExpression(node.argumentExpression));
                        if (!name) return node;
                        const prop = exp.properties.find(p => p.name && (getNameFromProperty(p.name) === name));
                        if (prop && ts.isPropertyAssignment(prop)) return prop.initializer;
                        return ts.factory.createPropertyAccessExpression(exp, name.toString()); 
                    } else if (ts.isArrayLiteralExpression(exp)) {
                        if (!ts.isElementAccessExpression(node)) return ts.factory.createPropertyAccessExpression(exp, node.name);
                        const nameNode = this.expectExpression(node.argumentExpression);
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
                if (store.has(node.text)) {
                    const value = store.get(node.text) as ts.Expression;
                    if (ts.isStringLiteral(value) && (ts.isDeclaration(node.parent) || ts.isPropertyAccessExpression(node.parent))) return ts.factory.createIdentifier(node.text);
                    return value;
                }
                const paramMacro = this.getMacroParam(node.text, macro, args);
                if (!paramMacro) return node;
                if (ts.isIdentifier(paramMacro)) return paramMacro;
                return ts.visitNode(paramMacro, this.boundVisitor);
            }

            else if (ts.isVariableStatement(node)) {
                const leftovers: ts.VariableDeclaration[] = [];
                for (const varNode of node.declarationList.declarations) {
                    if (ts.isIdentifier(varNode.name) && varNode.name.text.startsWith("$")) {
                        store.set(varNode.name.text, varNode.initializer ? this.expectExpression(varNode.initializer) : ts.factory.createIdentifier("undefined"));
                    } else {
                        leftovers.push(this.expect(varNode, ts.SyntaxKind.VariableDeclaration));
                    }
                }
                if (leftovers.length) return ts.factory.createVariableStatement(node.modifiers, ts.factory.createVariableDeclarationList(leftovers, node.declarationList.flags));
                else return undefined;
            }
            
            else if (ts.isArrayLiteralExpression(node) && node.elements.some(t => ts.isSpreadElement(t))) {
                const elements = [];
                for (const element of node.elements) {
                    if (ts.isSpreadElement(element)) {
                        const visited = this.expectExpression(element.expression);
                        if (ts.isArrayLiteralExpression(visited)) elements.push(...visited.elements);
                        else elements.push(this.expectExpression(element));
                    }
                    else elements.push(this.expectExpression(element));
                }
                return ts.factory.createArrayLiteralExpression(elements);
            }

            // Detects a ternary expression and tries to remove it if possible
            else if (ts.isConditionalExpression(node)) {
                const param = this.expectExpression(node.condition);
                const res = this.getBoolFromNode(param);
                if (res === false) return ts.visitNode(node.whenFalse, this.boundVisitor);
                else if (res === true) return ts.visitNode(node.whenTrue, this.boundVisitor);
                else return ts.factory.createConditionalExpression(param, undefined, this.expectExpression(node.whenTrue), undefined, this.expectExpression(node.whenFalse));
            }

            // Detects an if statement and tries to remove it if possible
            else if (ts.isIfStatement(node) && !ts.isParenthesizedExpression(node.expression)) {
                const condition = this.expectExpression(node.expression);
                const res = this.getBoolFromNode(condition);
                if (res === true) {
                    const res = this.expectStatement(node.thenStatement);
                    if (res && ts.isBlock(res)) return [...res.statements];
                    return res;
                }
                else if (res === false) {
                    if (!node.elseStatement) return undefined;
                    const res = ts.visitNode(node.elseStatement, this.boundVisitor);
                    if (res && ts.isBlock(res)) return [...res.statements];
                    return res;
                }
                return ts.factory.createIfStatement(condition, this.expectStatement(node.thenStatement), node.elseStatement ? this.expectStatement(node.elseStatement) : undefined);
            }

            // Detects a binary operation and tries to remove it if possible
            else if (ts.isBinaryExpression(node)) {
                const op = node.operatorToken.kind;
                const left = this.expectExpression(node.left);
                const right = this.expectExpression(node.right);
                const leftVal = this.getLiteralFromNode(left);
                const rightVal = this.getLiteralFromNode(right);
                if (leftVal === NO_LIT_FOUND || rightVal === NO_LIT_FOUND) return ts.factory.createBinaryExpression(left, op, right);
                if (binaryNumberActions[op] && typeof leftVal === "number" && typeof rightVal === "number") return binaryNumberActions[op](leftVal, rightVal);
                else return binaryActions[op]?.(left, right, leftVal, rightVal) ?? ts.factory.createBinaryExpression(left, op, right);
            }

            // Detects a typeof expression and tries to remove it if possible
            else if (ts.isTypeOfExpression(node)) {
                const visitedNode = this.expectExpression(node.expression);
                const val = this.getLiteralFromNode(visitedNode);
                if (val === NO_LIT_FOUND) return ts.factory.updateTypeOfExpression(node, visitedNode);
                return ts.factory.createStringLiteral(typeof val);
            }

            // Detects a repetition
            else if (ts.isExpressionStatement(node) && ts.isPrefixUnaryExpression(node.expression) && node.expression.operator === ts.SyntaxKind.PlusToken && ts.isArrayLiteralExpression(node.expression.operand)) {
                const { separator, function: fn, literals} = getRepetitionParams(node.expression.operand);
                return this.execRepetition(fn, literals, separator);
            }
            else if (ts.isPrefixUnaryExpression(node)) {
                if (node.operator === ts.SyntaxKind.PlusToken && ts.isArrayLiteralExpression(node.operand)) {
                    const { separator, function: fn, literals} = getRepetitionParams(node.operand);
                    if (!separator) throw new MacroError(node, "Repetition separator must be included if a repetition is used as an expression.");
                    return this.execRepetition(fn, literals, separator, true);
                } else {
                    // Detects a unary expression and tries to remove it if possible
                    const op = node.operator;
                    const value = this.expectExpression(node.operand);
                    const val = this.getLiteralFromNode(value);
                    if (val === NO_LIT_FOUND) return ts.factory.createPrefixUnaryExpression(node.operator, value);
                    return unaryActions[op]?.(val) || value;
                }
            }
            else if (ts.isCallExpression(node)) {
                const repNodeIndex = node.arguments.findIndex(arg => ts.isPrefixUnaryExpression(arg) && arg.operator === ts.SyntaxKind.PlusToken && ts.isArrayLiteralExpression(arg.operand));
                if (repNodeIndex !== -1) {
                    const repNode = (node.arguments[repNodeIndex] as ts.PrefixUnaryExpression).operand as ts.ArrayLiteralExpression;
                    const { separator, function: fn, literals} = getRepetitionParams(repNode);
                    if (!separator) {
                        const newBod = this.execRepetition(fn, literals, separator, true);
                        const finalArgs = [];
                        for (let i=0; i < node.arguments.length; i++) {
                            if (i === repNodeIndex) finalArgs.push(...newBod);
                            else finalArgs.push(node.arguments[i]);
                        }
                        return ts.visitNode(ts.factory.createCallExpression(node.expression, node.typeArguments, finalArgs as Array<ts.Expression>), this.boundVisitor);
                    }
                }
            }         
            return ts.visitEachChild(node, this.boundVisitor, this.context);
        }
        return ts.visitEachChild(node, this.boundVisitor, this.context);
    }

    execRepetition(fn: ts.ArrowFunction, elements: Array<ts.Expression>, separator?: string, wrapStatements?: boolean) : Array<ts.Node> {
        const newBod: Array<ts.Node> = [];
        const repeatNames = fn.parameters.map(p => p.name.getText());
        const elementSlices: Array<Array<ts.Expression>> = Array.from({length: repeatNames.length}, () => []);
        
        let totalLoopsNeeded = 0;

        for (let i=0; i < elements.length; i++) {
            const lit = elements[i];
            const resolved = this.expectExpression(lit);
            if (ts.isArrayLiteralExpression(resolved)) {
                if (resolved.elements.length > totalLoopsNeeded) totalLoopsNeeded = resolved.elements.length;
                elementSlices[i % repeatNames.length].push(...resolved.elements);
            }
        }

        if (!totalLoopsNeeded) return [ts.factory.createNull()];
        
        const ind = this.repeat.push({
            index: 0,
            elementSlices,
            repeatNames
        }) - 1;


        for (; this.repeat[ind].index < totalLoopsNeeded; this.repeat[ind].index++) {
            newBod.push(...this.transformFunction(fn, wrapStatements));
        }
        this.repeat.pop();
        return separator && separators[separator] ? [separators[separator](this, newBod)] : newBod;
    }

    transformFunction(fn: ts.FunctionLikeDeclaration, wrapStatements?: boolean) : Array<ts.Node> {
        if (!fn.body) return [];
        const newBod: ts.Node[] = [];
        if ("statements" in fn.body) {
            if (wrapStatements) newBod.push(wrapExpressions(fn.body.statements.map(node => this.maybeStatement(node)).filter(el => el) as ts.Statement[]));
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
            const res = this.expectExpression(fn.body);
            newBod.push(res);
        }
        return newBod;
    }

    getMacroParam(name: string, macro: Macro, params: ts.NodeArray<ts.Node>) : ts.Node|undefined {
        const index = macro.params.findIndex(p => p.name === name);
        if (index === -1) {
            for (let i=this.repeat.length - 1; i >= 0; i--) {
                const repeat = this.repeat[i];
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

    runMacroFromTemplateExpression(call: ts.TaggedTemplateExpression, name: ts.Expression) : Array<ts.Statement>|undefined {
        const macro = this.macros.get(resolveAliasedSymbol(this.checker, this.checker.getSymbolAtLocation(name))!);
        if (!macro || !ts.isTemplateExpression(call.template)) return;
        const strings: ts.StringLiteral[] = [ts.factory.createStringLiteral(call.template.head.text)], expressions: ts.Expression[] = [];
        for (const span of call.template.templateSpans) {
            expressions.push(this.expectExpression(span.expression));
            strings.push(ts.factory.createStringLiteral(span.literal.text));
        }
        return this.execMacro(macro, ts.factory.createNodeArray([ts.factory.createArrayLiteralExpression(strings), ...expressions]), call);
    }

    runMacroFromCallExpression(call: ts.CallExpression, name: ts.Expression, target?: ts.Node) : Array<ts.Statement>|undefined {
        const args = call.arguments;
        let macro, normalArgs: ts.NodeArray<ts.Expression>;
        if (ts.isPropertyAccessExpression(name)) {
            const symofArg = resolveAliasedSymbol(this.checker, this.checker.getSymbolAtLocation(name.expression));
            if (symofArg && hasBit(symofArg.flags, ts.SymbolFlags.Namespace)) return this.runMacroFromCallExpression(call, name.name);
            const possibleMacros = this.findMacroByTypeParams(name, call);
            if (!possibleMacros.length) throw new MacroError(call, `No possible candidates for "${name.name.getText()}" call`);
            else if (possibleMacros.length > 1) throw new MacroError(call, `More than one possible candidate for "${name.name.getText()}" call`);
            else macro = possibleMacros[0];
            const newArgs = ts.factory.createNodeArray([this.expectExpression(name.expression), ...call.arguments]);
            normalArgs = this.macroStack.length ? ts.factory.createNodeArray(newArgs.map(arg => this.expectExpression(arg))) : newArgs;
        } else {
            const nativeMacro = nativeMacros[name.getText()];
            if (nativeMacro) {
                const macroResult = nativeMacro.call(nativeMacro.preserveParams ? args : ts.factory.createNodeArray(args.map(arg => this.expectExpression(arg))), this, call);
                if (!macroResult) return [];
                else if (Array.isArray(macroResult)) return macroResult as Array<ts.Statement>;
                else if (ts.isStatement(macroResult as ts.Node)) return [macroResult as ts.Statement];
                return [ts.factory.createExpressionStatement(macroResult as ts.Expression)];
            }
            macro = this.macros.get(resolveAliasedSymbol(this.checker, this.checker.getSymbolAtLocation(name))!);
            normalArgs = this.macroStack.length ? ts.factory.createNodeArray(args.map(arg => this.expectExpression(arg))) : args;
        }
        if (!macro || !macro.body) {
            const calledSym = resolveAliasedSymbol(this.checker, this.checker.getSymbolAtLocation(name));
            if (calledSym?.declarations?.length && !this.boundVisitor(calledSym.declarations[0])) return this.runMacroFromCallExpression(call, name, target);
            else return;
        }
        return this.execMacro(macro, normalArgs, call, target);
    }

    execMacro(macro: Macro, args: ts.NodeArray<ts.Expression>, call: ts.Expression, target?: ts.Node) : ts.Statement[] {
        const macroExpand = { macro, args, call, target, defined: new Map(), store: new Map() };
        this.hooks.beforeCallMacro?.(this, macro, macroExpand);
        this.macroStack.push(macroExpand);
        const pre = [];
        for (let i=0; i < macro.params.length; i++) {
            const param = macro.params[i];
            if (param.marker === MacroParamMarkers.Save) {
                const value = param.spread ? ts.factory.createArrayLiteralExpression(args.slice(param.start) as ts.Expression[]) : (args[param.start] || param.defaultVal) as ts.Expression;
                if (!ts.isIdentifier(value)) {
                    param.realName = ts.factory.createUniqueName(param.name);
                    pre.push(ts.factory.createVariableDeclaration(param.realName, undefined, undefined, value));
                }
            }
        }
        if (pre.length) this.escapeStatement(ts.factory.createVariableStatement(undefined, ts.factory.createVariableDeclarationList(pre, ts.NodeFlags.Let)) as unknown as ts.Statement);
        const result = ts.visitEachChild(macro.body, this.boundVisitor, this.context)!.statements;
        const acc = macro.params.find(p => p.marker === MacroParamMarkers.Accumulator);
        if (acc) acc.defaultVal = ts.factory.createNumericLiteral(+(acc.defaultVal as ts.NumericLiteral).text + 1);
        this.macroStack.pop();
        return [...result];
    }

    expandMacroResults(statements: ts.Statement[], parent?: ts.Node) : ts.Node | ts.Node[] | undefined {
        if (parent) {
            const prepared = this.makeHygienic(statements);
            if (prepared.length && ts.isReturnStatement(prepared[prepared.length - 1]) && ts.isSourceFile(parent)) {
                const exp = prepared.pop() as ts.ReturnStatement;
                if (exp.expression) prepared.push(ts.factory.createExpressionStatement(exp.expression));
            }
            return prepared;
        } else {
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
        }
    }

    makeHygienic(statements: ts.Statement[]) : ts.Statement[] {
        const defined = this.getLastMacro()?.defined || new Map();

        const makeBindingElementHygienic = (name: ts.BindingName) : ts.BindingName => {
            if (ts.isIdentifier(name)) {
                const newName = ts.factory.createUniqueName(name.text);
                defined.set(name.text, newName);
                return newName;
            }
            else if (ts.isArrayBindingPattern(name)) return ts.factory.createArrayBindingPattern(name.elements.map(el => ts.isBindingElement(el) ? ts.factory.createBindingElement(el.dotDotDotToken, el.propertyName, makeBindingElementHygienic(el.name), el.initializer ? this.expectExpression(el.initializer) : undefined) : el));
            else if (ts.isObjectBindingPattern(name)) return ts.factory.createObjectBindingPattern(name.elements.map(el => ts.factory.createBindingElement(el.dotDotDotToken, el.propertyName, makeBindingElementHygienic(el.name), el.initializer ? this.expectExpression(el.initializer) : undefined)));
            else return name;
        };

        const visitor = (node: ts.Node) : ts.Node => {
            if (ts.isVariableDeclaration(node) && node.pos !== -1) {
                return ts.factory.updateVariableDeclaration(node, makeBindingElementHygienic(node.name), undefined, undefined, node.initializer ? visitor(this.expectExpression(node.initializer)) as ts.Expression : undefined);
            }
            else if (ts.isIdentifier(node)) {
                if (node.parent && ts.isPropertyAccessExpression(node.parent) && node.parent.expression !== node) return node;
                else return defined.get(node.text) || node;
            }
            else return ts.visitEachChild(node, visitor, this.context);
        };
        return statements.map(stmt => visitor(stmt) as ts.Statement);
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
        if (this.comptimeSignatures.size) {
            const signature = this.checker.getResolvedSignature(node);
            if (signature && signature.declaration) {
                const func = this.comptimeSignatures.get(signature.declaration);
                if (func) {
                    tryRun(node, func, node.arguments?.map(arg => {
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
                const lit = this.getLiteralFromNode(this.expectExpression(span.expression));
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

    resolveTypeArgumentOfCall(macroCall: ts.CallExpression, typeIndex: number) : ts.Type | undefined {
        if (!macroCall.typeArguments || !macroCall.typeArguments[typeIndex]) return;
        const type = this.checker.getTypeAtLocation(macroCall.typeArguments[typeIndex]);
        const lastMacroCall = this.getLastMacro();
        if (!lastMacroCall) return type;
        if (type.isTypeParameter()) {
            const resolvedTypeParameterIndex = lastMacroCall.macro.typeParams.findIndex(arg => this.checker.getTypeAtLocation(arg) === type);
            if (resolvedTypeParameterIndex === -1) return;
            if (lastMacroCall.call && ts.isCallExpression(lastMacroCall.call)) {
                const resolvedTypeParam = lastMacroCall.call.typeArguments?.[resolvedTypeParameterIndex];
                if (!resolvedTypeParam) return resolveTypeArguments(this.checker, lastMacroCall.call)[resolvedTypeParameterIndex];
                return this.checker.getTypeAtLocation(resolvedTypeParam);
            } else return;
        } else {
            const allParams = lastMacroCall.macro.typeParams.map(p => this.checker.getTypeAtLocation(p));
            const replacementTypes = resolveTypeArguments(this.checker, lastMacroCall.call as ts.CallExpression);
            return resolveTypeWithTypeParams(type, allParams, replacementTypes);
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
            const fnTypeParams = macro.typeParams.map(p => this.checker.getTypeAtLocation(p));
            const anyArray = fnTypeParams.map(p => p.getConstraint() || this.checker.getAnyType());
            const fnArgs = fnTypeParams.length ? fnType.parameters.map(p => resolveTypeWithTypeParams(this.checker.getTypeOfSymbolAtLocation(p, p.valueDeclaration!), fnTypeParams, anyArray)) : fnType.parameters.map(p => this.checker.getTypeOfSymbolAtLocation(p, p.valueDeclaration!));
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

    findMacroByName(node: ts.Node, name: string) : Macro|undefined {
        const foundMacros = [];
        for (const [, macro] of this.macros) {
            if (macro.name === name) foundMacros.push(macro);
        }
        if (foundMacros.length > 1) throw new MacroError(node, `More than one macro with the name ${name} exists.`);
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
        const uniquelize: (node: ts.Node) => ts.Node = (node: ts.Node) => ts.factory.cloneNode(ts.visitEachChild(node, uniquelize, this.context));
        return ts.visitEachChild(file, uniquelize, this.context).statements;
    }

}

const separators: Record<string, (transformer: MacroTransformer, body: Array<ts.Node>) => ts.Expression> = {
    "[]": (_transformer, body) => ts.factory.createArrayLiteralExpression(body.map(m => ts.isExpressionStatement(m) ? m.expression : (m as ts.Expression))),
    "+": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.PlusToken),
    "-": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.MinusToken),
    "*": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.AsteriskToken),
    "||": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.BarBarToken),
    "&&": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.AmpersandAmpersandToken),
    "()": (transformer, body) => ts.factory.createParenthesizedExpression(toBinaryExp(transformer, body, ts.SyntaxKind.CommaToken)),
    ".": (_, body) => {
        let last = body[0] as ts.Expression;
        for (let i=1; i < body.length; i++) {
            const el = body[i] as ts.Expression;
            if (ts.isIdentifier(el)) last = ts.factory.createPropertyAccessExpression(last, el);
            else last = ts.factory.createElementAccessExpression(last, el);
        }
        return last;
    },
    "{}": (transformer, body) => {
        return ts.factory.createObjectLiteralExpression(body.filter(el => ts.isArrayLiteralExpression(el)).map((el) => {
            const arr = el as ts.ArrayLiteralExpression;
            if (arr.elements.length < 2) return ts.factory.createPropertyAssignment("undefined", ts.factory.createIdentifier("undefined"));
            const string = transformer.getStringFromNode(arr.elements[0], false, true);
            if (!string) return ts.factory.createPropertyAssignment("undefined", ts.factory.createIdentifier("undefined"));
            return ts.factory.createPropertyAssignment(string, arr.elements[1]);
        }));
    }
};

