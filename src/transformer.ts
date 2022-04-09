
import * as ts from "typescript";
import nativeMacros from "./nativeMacros";
import { flattenBody, wrapExpressions, toBinaryExp } from "./utils";

const MACROS = new Map<string, Macro>();

export interface MacroParam {
    spread: boolean,
    asRest?: boolean,
    isAccumulator?: boolean,
    var?: boolean,
    start: number,
    name: string,
    defaultVal?: ts.Expression
}

export interface Macro {
    name: string,
    params: Array<MacroParam>,
    body?: ts.FunctionBody
}

export interface MacroExpand {
    macro: Macro,
    args: ts.NodeArray<ts.Expression>
}

export interface MacroTransformerBuiltinProps {
    optimizeEnv?: boolean
}

const NO_LIT_FOUND = Symbol("NO_LIT_FOUND");

export class MacroTransformer {
    context: ts.TransformationContext
    macroStack: Array<MacroExpand>
    repeat: Array<number>
    boundVisitor: ts.Visitor
    dirname: string
    props: MacroTransformerBuiltinProps
    checker: ts.TypeChecker
    imports: Array<ts.ImportDeclaration>
    constructor(dirname: string, context: ts.TransformationContext, checker: ts.TypeChecker) {
        this.dirname = dirname;
        this.context = context;
        this.boundVisitor = this.visitor.bind(this);
        this.repeat = [];
        this.macroStack = [];
        this.props = {};
        this.checker = checker;
        this.imports = [];
    }

    run(node: ts.SourceFile): ts.Node {
        if (node.isDeclarationFile) return node;
        const newSource = ts.visitEachChild(node, this.boundVisitor, this.context);
        return ts.factory.updateSourceFile(newSource, [
            ...this.imports,
            ...newSource.statements
        ]);
    }

    visitor(node: ts.Node): ts.VisitResult<ts.Node> {
        if (ts.isFunctionDeclaration(node) && !node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.DeclareKeyword) && ts.getNameOfDeclaration(node)?.getText().startsWith("$")) {
            const macroName = ts.getNameOfDeclaration(node)!.getText();
            if (MACROS.has(macroName)) throw new Error(`Macro ${macroName} is already defined.`);
            const params: Array<MacroParam> = [];
            for (let i = 0; i < node.parameters.length; i++) {
                const param = node.parameters[i];
                if (!ts.isIdentifier(param.name)) throw new Error("You cannot use deconstruction patterns in macros.");
                params.push({
                    spread: Boolean(param.dotDotDotToken),
                    asRest: this.isValidMarker("AsRest", param),
                    isAccumulator: this.isValidMarker("Accumulator", param),
                    var: this.isValidMarker("Var", param),
                    start: i,
                    name: param.name.getText(),
                    defaultVal: param.initializer
                });
            }
            MACROS.set(macroName, {
                name: macroName,
                params,
                body: node.body
            });
            return undefined;
        }

        if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && ts.isNonNullExpression(node.expression.expression)) {
            const chain = node.expression.expression as ts.NonNullExpression;
            let macro;
            let args;
            if (ts.isPropertyAccessExpression(chain.expression)) {
                macro = MACROS.get(chain.expression.name.text); 
                const newArgs = ts.factory.createNodeArray([ts.visitNode(chain.expression.expression, this.boundVisitor), ...node.expression.arguments]);
                args = this.macroStack.length ? ts.visitNodes(newArgs, this.boundVisitor) : newArgs;
            } else {
                if (nativeMacros[chain.expression.getText()]) return nativeMacros[chain.expression.getText()](ts.visitNodes(node.expression.arguments, this.boundVisitor), this);
                macro = MACROS.get(chain.expression.getText());
                args = this.macroStack.length ? ts.visitNodes(node.expression.arguments, this.boundVisitor) : node.expression.arguments;
            }
            if (!macro || !macro.body) return ts.factory.createNull();
            this.macroStack.push({
                macro,
                args
            })
            const defined = new Map<string, ts.Identifier>();
            const visitor = (node: ts.Node) : ts.Node => {
                if (ts.isVariableDeclaration(node) && node.pos !== -1) {
                    const newName = ts.factory.createUniqueName(node.name.getText());
                    defined.set(node.name.getText(), newName);
                    return ts.factory.updateVariableDeclaration(node, newName, undefined, undefined, node.initializer);
                }
                else if (ts.isIdentifier(node) && defined.has(node.text)) return defined.get(node.text)!;
                return ts.visitEachChild(node, visitor, this.context);
            };
            const res = ts.visitNodes(ts.visitEachChild(macro.body, this.boundVisitor, this.context).statements, visitor).concat();
            if (res.length && ts.isReturnStatement(res[res.length - 1]) && ts.isSourceFile(node.parent)) {
                const exp = res.pop() as ts.ReturnStatement;
                if (exp.expression) res.push(ts.factory.createExpressionStatement(exp.expression));
            }
            const acc = macro.params.find(p => p.isAccumulator);
            if (acc) acc.defaultVal = ts.factory.createNumericLiteral(+(acc.defaultVal as ts.NumericLiteral).text + 1);
            this.macroStack.pop();
            return res;
        }

        if (ts.isCallExpression(node) && ts.isNonNullExpression(node.expression)) {
            let macro;
            let args;
            if (ts.isPropertyAccessExpression(node.expression.expression)) {
                macro = MACROS.get(node.expression.expression.name.text); 
                const newArgs = ts.factory.createNodeArray([ts.visitNode(node.expression.expression.expression, this.boundVisitor), ...node.arguments]);
                args = this.macroStack.length ? ts.visitNodes(newArgs, this.boundVisitor) : newArgs;
            } else {
                if (nativeMacros[node.expression.expression.getText()]) return nativeMacros[node.expression.expression.getText()](ts.visitNodes(node.arguments, this.boundVisitor), this);
                macro = MACROS.get(node.expression.expression.getText());
                args = this.macroStack.length ? ts.visitNodes(node.arguments, this.boundVisitor) : node.arguments;
            }
            if (!macro || !macro.body) return ts.factory.createNull();
            this.macroStack.push({
                macro,
                args
            });
            const res = [...ts.visitEachChild(macro.body, this.boundVisitor, this.context).statements];
            const acc = macro.params.find(p => p.isAccumulator);
            if (acc) acc.defaultVal = ts.factory.createNumericLiteral(+(acc.defaultVal as ts.NumericLiteral).text + 1);
            this.macroStack.pop();
            let last = res.pop()!;
            if (res.length === 0) {
                if (ts.isReturnStatement(last) || ts.isExpressionStatement(last)) return last.expression;
                else return last;
            }
            if (!ts.isReturnStatement(last)) last = ts.factory.createReturnStatement(ts.isExpressionStatement(last) ? last.expression:(last as unknown as ts.Expression));
            return ts.factory.createCallExpression(
                ts.factory.createParenthesizedExpression(
                    ts.factory.createArrowFunction(undefined, undefined, [], undefined, undefined, ts.factory.createBlock([...res, last], true))
                ),
                undefined, undefined)
        }

        // If this is true then we're in the context of a macro call
        if (this.macroStack.length) {
            const {macro, args } = this.macroStack[this.macroStack.length - 1];

            // Detects property / element access and tries to remvoe it if possible
            if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
                if (ts.isPropertyAccessExpression(node) && this.props.optimizeEnv && node.expression.getText() === "process.env") {
                    const value = process.env[node.name.text];
                    if (!value) return node;
                    return ts.factory.createStringLiteral(value);
                } else {
                    let accessChain: ts.PropertyAccessExpression|ts.ElementAccessExpression = node;
                    let firstIdentifier: string|undefined;
                    while (accessChain) {
                        if (ts.isIdentifier(accessChain.expression)) {
                            firstIdentifier = accessChain.expression.text;
                            break;
                        } else if (ts.isPropertyAccessExpression(accessChain.expression) || ts.isElementAccessExpression(accessChain.expression)) {
                            accessChain = accessChain.expression;
                        } else break;
                    }
                    if (firstIdentifier) {
                        const arg = this.getMacroParam(firstIdentifier, macro, args);
                        if (arg && (ts.isObjectLiteralExpression(arg) || ts.isArrayLiteralExpression(arg))) {
                            let parent: ts.Node = accessChain;
                            let value: ts.Node | undefined = arg;
                            while (value && (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent))) {
                                let parentVal: string|number = "";
                                if (ts.isPropertyAccessExpression(parent)) parentVal = parent.name.text;
                                else if (ts.isElementAccessExpression(parent)) {
                                    const num = this.getNumberFromNode(parent.argumentExpression);
                                    if (num === undefined) return arg;
                                    parentVal = num;
                                }
                                if (ts.isObjectLiteralExpression(value)) {
                                    value = value.properties.find(prop => prop.name?.getText() === parentVal);
                                    if (value && ts.isPropertyAssignment(value)) value = value.initializer;
                                    else return arg;
                                    parent = parent.parent;
                                } else if (ts.isArrayLiteralExpression(value)) {
                                    value = value.elements[parentVal as number];
                                    parent = parent.parent;
                                } 
                                else return arg;
                            }
                            if (value) return value;
                        }
                    }
                }
            }

            // Detects use of a macro parameter and replaces it with a literal
            if (ts.isIdentifier(node) && !ts.isParameter(node.parent) && macro.params.some(p => p.name === node.text)) {
                const index = macro.params.findIndex(p => p.name === node.text)
                const paramMacro = macro.params[index];
                if (this.repeat.length && paramMacro.spread) {
                    const arg = args[this.repeat[this.repeat.length - 1] + paramMacro.start];
                    if (!arg) return ts.factory.createNull();
                    if (ts.isStringLiteral(arg) && (ts.isClassDeclaration(node.parent) || ts.isEnumDeclaration(node.parent) || ts.isFunctionDeclaration(node.parent))) return ts.factory.createIdentifier(arg.text);
                    return arg;
                }
                else if (this.repeat.length && paramMacro.asRest) {
                    const arg = (args[paramMacro.start] as ts.ArrayLiteralExpression).elements[this.repeat[this.repeat.length - 1]];
                    if (!arg) return undefined;
                    if (ts.isStringLiteral(arg) && (ts.isClassDeclaration(node.parent) || ts.isEnumDeclaration(node.parent) || ts.isFunctionDeclaration(node.parent))) return ts.factory.createIdentifier(arg.text);
                    return arg;
                }
                if (paramMacro.spread) return ts.factory.createArrayLiteralExpression(args.slice(paramMacro.start));
                if (args[index]) {
                    if (ts.isStringLiteral(args[index]) && (ts.isClassDeclaration(node.parent) || ts.isEnumDeclaration(node.parent) || ts.isFunctionDeclaration(node.parent))) return ts.factory.createIdentifier((args[index] as ts.StringLiteral).text);
                    if (ts.isIdentifier(args[index])) return args[index];
                    return ts.visitNode(args[index], this.boundVisitor);
                } else return macro!.params[index].defaultVal || ts.factory.createNull();
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
            else if (ts.isIfStatement(node)) {
                const condition = ts.visitNode(node.expression, this.boundVisitor);
                const res = this.getBoolFromNode(condition);
                if (res === true) return ts.visitNode(node.thenStatement, this.boundVisitor);
                else if (res === false) {
                    if (!node.elseStatement) return undefined;
                    return ts.visitNode(node.elseStatement, this.boundVisitor);
                }
                else return ts.factory.createIfStatement(condition, ts.visitNode(node.thenStatement, this.boundVisitor), ts.visitNode(node.elseStatement, this.boundVisitor));
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
                else return binaryActions[op]?.(left, right, leftVal, rightVal) || ts.factory.createBinaryExpression(left, op, right);
            }

            // Detects a unary expression and tries to remove it if possible
            else if (ts.isPrefixUnaryExpression(node)) {
                const op = node.operator;
                const value: ts.Expression = ts.visitNode(node.operand, this.boundVisitor);
                const val = this.getLiteralFromNode(value);
                if (val === NO_LIT_FOUND) return value;
                return unaryActions[op]?.(val) || value;
            }

            // Detects a repetition
            else if (ts.isExpressionStatement(node)) {
                if (ts.isBinaryExpression(node.expression) && node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.expression.left)) {
                    const inner = node.expression;
                    const param = macro.params.find(p => p.name === (inner.left as ts.Identifier).text);
                    if (!param || !param.var) return ts.visitEachChild(node, this.boundVisitor, this.context);
                    param.defaultVal = ts.visitNode(inner.right, this.boundVisitor);
                    return undefined;
                }
                else if (ts.isPrefixUnaryExpression(node.expression) && node.expression.operator === 39 && ts.isArrayLiteralExpression(node.expression.operand)) {
                    let separator;
                    let fn: ts.ArrowFunction;
                    if (node.expression.operand.elements.length) {
                        separator = node.expression.operand.elements[0];
                        if (!ts.isStringLiteral(separator)) {
                            fn = separator as ts.ArrowFunction;
                            separator = undefined;
                        } else {
                            separator = separator.text;
                            fn = node.expression.operand.elements[1] as ts.ArrowFunction;
                        }
                    } else throw new Error("Missing code to repeat");
                    if (!ts.isArrowFunction(fn) || !fn.body) throw new Error("Missing repeat function");
                    return this.execRepetition(fn, args, macro, separator);
                }
            } else if (ts.isPrefixUnaryExpression(node) && node.operator === 39 && ts.isArrayLiteralExpression(node.operand)) {
                let separator: string | ts.Expression = node.operand.elements[0];
                if (!separator || !ts.isStringLiteral(separator)) throw new Error("Repetition separator must be a string literal.");
                separator = separator.text;
                const fn = node.operand.elements[1];
                if (!fn || !ts.isArrowFunction(fn) || !fn.body) throw new Error("Missing repeat function.");
                return this.execRepetition(fn, args, macro, separator, true);
            } else if (ts.isCallExpression(node) && node.arguments.some(arg => ts.isPrefixUnaryExpression(arg) && arg.operator === 39 && ts.isArrayLiteralExpression(arg.operand))) {
                const repNodeIndex = node.arguments.findIndex(arg => ts.isPrefixUnaryExpression(arg) && arg.operator === 39 && ts.isArrayLiteralExpression(arg.operand));
                const repNode = (node.arguments[repNodeIndex] as ts.PrefixUnaryExpression).operand as ts.ArrayLiteralExpression;
                let separator;
                let fn: ts.ArrowFunction;
                if (repNode.elements.length) {
                    separator = repNode.elements[0];
                    if (!ts.isStringLiteral(separator)) {
                        fn = separator as ts.ArrowFunction;
                        separator = undefined;
                    } else {
                        separator = separator.text;
                        fn = repNode.elements[1] as ts.ArrowFunction;
                    }
                } else throw new Error("Missing code to repeat");
                if (!ts.isArrowFunction(fn) || !fn.body) throw new Error("Missing repeat function");
                const newBod = this.execRepetition(fn, args, macro, separator, true);
                if (!separator) {
                    const finalArgs = [];
                    for (let i=0; i < node.arguments.length; i++) {
                        if (i === repNodeIndex) finalArgs.push(...newBod);
                        else finalArgs.push(node.arguments[i]);
                    }
                    return ts.visitNode(ts.factory.createCallExpression(node.expression, node.typeArguments, finalArgs as Array<ts.Expression>), this.boundVisitor);
                }
                else return newBod;
            }
            return ts.visitEachChild(node, this.boundVisitor, this.context);
        }
        return ts.visitEachChild(node, this.boundVisitor, this.context);
    }

    execRepetition(fn: ts.ArrowFunction, args: ts.NodeArray<ts.Node>, macro: Macro, separator?: string, wrapStatements?: boolean) : Array<ts.Node> {
        const newBod = [];
        const ind = this.repeat.push(0) - 1;
        const totalLoopsNeeded = this.getTotalLoops(flattenBody(fn.body), args, macro.params);
        for (; this.repeat[ind] < totalLoopsNeeded; this.repeat[ind]++) {
            if ("statements" in fn.body) {
                if (wrapStatements) newBod.push(wrapExpressions(fn.body.statements.map(node => ts.visitNode(node, this.boundVisitor))));
                else {
                    for (const stmt of fn.body.statements) {
                        const res = ts.visitNode(stmt, this.boundVisitor);
                        newBod.push(res);
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
        if (index === -1) return;
        const paramMacro = macro.params[index];
        if (this.repeat.length) {
            if (paramMacro.spread) return params[this.repeat[this.repeat.length - 1] + paramMacro.start];
            else if (paramMacro.asRest) return (params[paramMacro.start] as ts.ArrayLiteralExpression).elements[this.repeat[this.repeat.length - 1]];
        } else {
            if (paramMacro.spread) return ts.factory.createArrayLiteralExpression(params.slice(paramMacro.start) as Array<ts.Expression>);
            return params[paramMacro.start];
        }
    }

    isValidMarker(marker: string, param: ts.ParameterDeclaration) : boolean {
        if (!param.type) return false;
        const type = this.checker.getTypeAtLocation(param.type).getProperty("__marker");
        if (!type) return false;
        //@ts-expect-error Internal API
        const typeOfMarker = (this.checker.getTypeOfSymbol(type) as ts.Type).getNonNullableType();
        return typeOfMarker.isStringLiteral() && typeOfMarker.value === marker; 
    }

    getTotalLoops(statements: Array<ts.Node>, args: ts.NodeArray<ts.Node>, params: Array<MacroParam>) : number {
        let total = 0;
        const cb = (node: ts.Node): ts.Node|undefined => {
            if (ts.isPrefixUnaryExpression(node) && node.operator === 39 && ts.isArrayLiteralExpression(node.operand)) return node;
            else if (ts.isIdentifier(node)) {
                const param = params.find(p => p.name === node.text);
                if (!param) return node;
                if (param.asRest) total += Math.abs(total - (args[param.start] as ts.ArrayLiteralExpression).elements.length);
                else if (param.spread) total += Math.abs(total - (args.length - param.start));
                return node;
            }
            else return ts.visitEachChild(node, cb, this.context);
        }
        for (const stmt of statements) {
            cb(stmt);
        }
        return total;
    }

    getNumberFromNode(node: ts.Expression) : number|undefined {
        if (ts.isParenthesizedExpression(node)) return this.getNumberFromNode(node.expression);
        if (ts.isNumericLiteral(node)) return +node.text;
        const type = this.checker.getTypeAtLocation(node);
        if (type.isNumberLiteral()) return type.value;
    }

    getLiteralFromNode(node: ts.Expression) : unknown|typeof NO_LIT_FOUND {
        if (ts.isParenthesizedExpression(node)) return this.getLiteralFromNode(node.expression);
        else if (ts.isAsExpression(node)) return this.getLiteralFromNode(node.expression);
        if (ts.isNumericLiteral(node)) return +node.text;
        if (ts.isStringLiteral(node)) return node.text;
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

    getBoolFromNode(node: ts.Expression) : boolean|undefined {
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
        const type = this.checker.getTypeAtLocation(node);
        if (type.isNumberLiteral()) {
            if (type.value === 0) return false;
            return true;
        }
        else if (type.isStringLiteral()) {
            if (type.value === "") return false;
            return true;
        }
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

}

const separators: Record<string, (transformer: MacroTransformer, body: Array<ts.Expression | ts.Statement>) => ts.Expression> = {
    "[]": (_transformer, body) => {
        return ts.factory.createArrayLiteralExpression(body.map(m => ts.isExpressionStatement(m) ? m.expression : (m as ts.Expression)));
    },
    "+": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.PlusToken),
    "-": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.MinusToken),
    "*": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.AsteriskToken),
    "||": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.BarBarToken),
    "&&": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.AmpersandAmpersandToken),
    ",": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.CommaToken),
}

const binaryNumberActions: Record<number, (left: number, right: number) => ts.Expression> = {
    [ts.SyntaxKind.MinusToken]: (left: number, right: number) => ts.factory.createNumericLiteral(left + right),
    [ts.SyntaxKind.AsteriskToken]: (left: number, right: number) => ts.factory.createNumericLiteral(left * right),
    [ts.SyntaxKind.SlashToken]: (left: number, right: number) => ts.factory.createNumericLiteral(left / right),
    [ts.SyntaxKind.LessThanToken]: (left: number, right: number) => left < right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.LessThanEqualsToken]: (left: number, right: number) => left <= right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.GreaterThanToken]: (left: number, right: number) => left > right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.GreaterThanEqualsToken]: (left: number, right: number) => left >= right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.AmpersandToken]: (left: number, right: number) => ts.factory.createNumericLiteral(left & right),
    [ts.SyntaxKind.BarToken]: (left: number, right: number) => ts.factory.createNumericLiteral(left | right),
    [ts.SyntaxKind.CaretToken]: (left: number, right: number) => ts.factory.createNumericLiteral(left ^ right),
    [ts.SyntaxKind.PercentToken]: (left: number, right: number) => ts.factory.createNumericLiteral(left % right)
}

const binaryActions: Record<number, (origLeft: ts.Expression, origRight: ts.Expression, left: unknown, right: unknown) => ts.Expression|undefined> = {
    [ts.SyntaxKind.PlusToken]: (_origLeft: ts.Expression, _origRight: ts.Expression, left: unknown, right: unknown) => {
        if (typeof left === "string" || typeof right === "string") return ts.factory.createStringLiteral(left as string + right);
        else if (typeof left === "number" || typeof right === "number") return ts.factory.createNumericLiteral(left as number + (right as number));
    },
    [ts.SyntaxKind.EqualsEqualsEqualsToken]: (_origLeft: ts.Expression, _origRight: ts.Expression, left: unknown, right: unknown) => left === right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.EqualsEqualsToken]: (_origLeft: ts.Expression, _origRight: ts.Expression, left: unknown, right: unknown) => left == right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.AmpersandAmpersandToken]: (origLeft: ts.Expression, origRight: ts.Expression, left: unknown, right: unknown) => {
        if (left && right) return origRight;
        if (!left) return origLeft;
        if (!right) return origRight;
    },
    [ts.SyntaxKind.BarBarToken]: (origLeft: ts.Expression, origRight: ts.Expression, left: unknown, right: unknown) => {
        if (left) return origLeft;
        else if (right) return origRight;
        else return origRight;
    }
}

const unaryActions: Record<number, (val: unknown) => ts.Expression|undefined> = {
    [ts.SyntaxKind.ExclamationToken]: (val: unknown) => !val ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.MinusToken]: (val: unknown) => {
        if (typeof val !== "number") return;
        return ts.factory.createNumericLiteral(-val);
    },
    [ts.SyntaxKind.TildeToken]: (val: unknown) => {
        if (typeof val !== "number") return;
        return ts.factory.createNumericLiteral(~val);
    }
}