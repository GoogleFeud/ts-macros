
import * as ts from "typescript";
import nativeMacros from "./nativeMacros";

const MACROS = new Map<string, Macro>();

export interface MacroParam {
    spread: boolean,
    asRest?: boolean,
    start: number,
    name: string,
    defaultVal?: ts.Expression
}

export interface Macro {
    params: Array<MacroParam>,
    body?: ts.FunctionBody
}

export interface MacroExpand {
    macro: Macro,
    args: ts.NodeArray<ts.Expression>,
    declaredParams: Set<string>
}

export interface MacroTransformerBuiltinProps {
    optimizeEnv?: boolean
}

export class MacroTransformer {
    context: ts.TransformationContext
    macroStack: Array<MacroExpand>
    repeat: Array<number>
    boundVisitor: ts.Visitor
    dirname: string
    props: MacroTransformerBuiltinProps
    checker: ts.TypeChecker
    constructor(dirname: string, context: ts.TransformationContext, checker: ts.TypeChecker) {
        this.dirname = dirname;
        this.context = context;
        this.boundVisitor = this.visitor.bind(this);
        this.repeat = [];
        this.macroStack = [];
        this.props = {};
        this.checker = checker;
    }

    run(node: ts.SourceFile): ts.Node {
        if (node.isDeclarationFile) return node;
        return ts.visitEachChild(node, this.boundVisitor, this.context);
    }

    visitor(node: ts.Node): ts.Node | Array<ts.Node> | undefined {
        if (ts.isFunctionDeclaration(node) && ts.getNameOfDeclaration(node)?.getText().startsWith("$")) {
            const macroName = ts.getNameOfDeclaration(node)!.getText();
            if (MACROS.has(macroName)) throw new Error(`Macro ${macroName} is already defined.`);
            const params: Array<MacroParam> = [];
            for (let i = 0; i < node.parameters.length; i++) {
                const param = node.parameters[i];
                if (!ts.isIdentifier(param.name)) throw new Error("You cannot use deconstruction patterns in macros.");
                params.push({
                    spread: Boolean(param.dotDotDotToken),
                    asRest: this.isValidMarker("AsRest", param),
                    start: i,
                    name: param.name.getText(),
                    defaultVal: param.initializer
                });
            }
            MACROS.set(macroName, {
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
                const newArgs = this.context.factory.createNodeArray([ts.visitNode(chain.expression.expression, this.boundVisitor), ...node.expression.arguments]);
                args = this.macroStack.length ? ts.visitNodes(newArgs, this.boundVisitor) : newArgs;
            } else {
                if (nativeMacros[chain.expression.getText()]) return nativeMacros[chain.expression.getText()](ts.visitNodes(node.expression.arguments, this.boundVisitor), this);
                macro = MACROS.get(chain.expression.getText());
                args = this.macroStack.length ? ts.visitNodes(node.expression.arguments, this.boundVisitor) : node.expression.arguments;
            }
            if (!macro || !macro.body) return this.context.factory.createNull();
            this.macroStack.push({
                macro,
                args,
                declaredParams: new Set()
            })
            const defined = new Map<string, ts.Identifier>();
            const visitor = (node: ts.Node) : ts.Node => {
                if (ts.isVariableDeclaration(node)) {
                    const newName = this.context.factory.createUniqueName(node.name.getText());
                    defined.set(node.name.getText(), newName);
                    return this.context.factory.updateVariableDeclaration(node, newName, undefined, undefined, node.initializer);
                }
                else if (ts.isIdentifier(node) && defined.has(node.text)) return defined.get(node.text)!;
                return ts.visitEachChild(node, visitor, this.context);
            };
            const res = ts.visitNodes(ts.visitEachChild(macro.body, this.boundVisitor, this.context).statements, visitor);
            this.macroStack.pop();
            return [...res];
        }

        if (ts.isCallExpression(node) && ts.isNonNullExpression(node.expression)) {
            let macro;
            let args;
            if (ts.isPropertyAccessExpression(node.expression.expression)) {
                macro = MACROS.get(node.expression.expression.name.text); 
                const newArgs = this.context.factory.createNodeArray([ts.visitNode(node.expression.expression.expression, this.boundVisitor), ...node.arguments]);
                args = this.macroStack.length ? ts.visitNodes(newArgs, this.boundVisitor) : newArgs;
            } else {
                if (nativeMacros[node.expression.expression.getText()]) return nativeMacros[node.expression.expression.getText()](ts.visitNodes(node.arguments, this.boundVisitor), this);
                macro = MACROS.get(node.expression.expression.getText());
                args = this.macroStack.length ? ts.visitNodes(node.arguments, this.boundVisitor) : node.arguments;
            }
            if (!macro || !macro.body) return this.context.factory.createNull();
            this.macroStack.push({
                macro,
                args,
                declaredParams: new Set()
            });
            const res = [...ts.visitEachChild(macro.body, this.boundVisitor, this.context).statements];
            this.macroStack.pop();
            let last = res.pop()!;
            if (res.length === 0) return ts.isExpressionStatement(last) ? last.expression:last;
            if (!ts.isReturnStatement(last)) last = this.context.factory.createReturnStatement(ts.isExpressionStatement(last) ? last.expression:(last as unknown as ts.Expression));
            return this.context.factory.createCallExpression(
                this.context.factory.createParenthesizedExpression(
                    this.context.factory.createArrowFunction(undefined, undefined, [], undefined, undefined, this.context.factory.createBlock([...res, last], true))
                ),
                undefined, undefined)
        }

        if (this.macroStack.length) {
            const {macro, args, declaredParams} = this.macroStack[this.macroStack.length - 1];

            if (this.props.optimizeEnv && ts.isPropertyAccessExpression(node) && node.expression.getText() === "process.env") {
                const value = process.env[node.name.text];
                if (!value) return node;
                return this.context.factory.createStringLiteral(value);
            } 

            if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name) && macro.params.some(p => p.name === (node.name as ts.Identifier).text)) {
                const val = ts.visitNode(node.initializer, this.boundVisitor);
                declaredParams.add(node.name.text);
                return this.context.factory.updateVariableDeclaration(node, node.name, undefined, undefined, val);
            }

            if (ts.isIdentifier(node) && !ts.isParameter(node.parent) && macro.params.some(p => p.name === node.text)) {
                if (declaredParams.has(node.text)) return node;
                const index = macro.params.findIndex(p => p.name === node.text);
                const paramMacro = macro.params[index];
                if (this.repeat.length && paramMacro.spread) {
                    const arg = args[this.repeat[this.repeat.length - 1] + paramMacro.start];
                    if (!arg) return this.context.factory.createNull();
                    if (ts.isStringLiteral(arg) && (ts.isClassDeclaration(node.parent) || ts.isEnumDeclaration(node.parent) || ts.isFunctionDeclaration(node.parent))) return this.context.factory.createIdentifier(arg.text);
                    return arg;
                }
                else if (this.repeat.length && paramMacro.asRest) {
                    const arg = (args[paramMacro.start] as ts.ArrayLiteralExpression).elements[this.repeat[this.repeat.length - 1]];
                    if (!arg) return undefined;
                    if (ts.isStringLiteral(arg) && (ts.isClassDeclaration(node.parent) || ts.isEnumDeclaration(node.parent) || ts.isFunctionDeclaration(node.parent))) return this.context.factory.createIdentifier(arg.text);
                    return arg;
                }
                if (paramMacro.spread) return this.context.factory.createArrayLiteralExpression(args.slice(paramMacro.start));
                if (args[index]) {
                    if (ts.isStringLiteral(args[index]) && (ts.isClassDeclaration(node.parent) || ts.isEnumDeclaration(node.parent) || ts.isFunctionDeclaration(node.parent))) return this.context.factory.createIdentifier((args[index] as ts.StringLiteral).text);
                    if (ts.isIdentifier(args[index])) return args[index];
                    return ts.visitNode(args[index], this.boundVisitor);
                } else return (macro!.params[index].defaultVal || this.context.factory.createNull());
            }

            else if (ts.isConditionalExpression(node)) {
                const param = ts.visitNode(node.condition, this.boundVisitor);
                if (isTruthy(param)) return ts.visitNode(node.whenTrue, this.boundVisitor);
                if (isFalsey(param)) return ts.visitNode(node.whenFalse, this.boundVisitor);
                return this.context.factory.createConditionalExpression(param, undefined, ts.visitNode(node.whenTrue, this.boundVisitor), undefined, ts.visitNode(node.whenFalse, this.boundVisitor));
            }

            else if (ts.isIfStatement(node)) {
                const condition = ts.visitNode(node.expression, this.boundVisitor);
                if (isFalsey(condition)) {
                    if (!node.elseStatement) return undefined;
                    return ts.visitNode(node.elseStatement, this.boundVisitor);
                }
                if (isTruthy(condition)) return ts.visitNode(node.thenStatement, this.boundVisitor);
                return this.context.factory.createIfStatement(condition, ts.visitNode(node.thenStatement, this.boundVisitor), ts.visitNode(node.elseStatement, this.boundVisitor));
            }

            else if (ts.isBinaryExpression(node)) {
                switch (node.operatorToken.kind) {
                    case ts.SyntaxKind.EqualsEqualsEqualsToken: 
                    case ts.SyntaxKind.EqualsEqualsToken:  {
                        const left = ts.visitNode(node.left, this.boundVisitor);
                        const right = ts.visitNode(node.right, this.boundVisitor);
                        if (!left || !right || !ts.isLiteralExpression(left) || !ts.isLiteralExpression(right)) return this.context.factory.createBinaryExpression(left, node.operatorToken.kind, right);
                        return this.context.factory.createToken(left.text === right.text ? ts.SyntaxKind.TrueKeyword : ts.SyntaxKind.FalseKeyword);
                    }
                    case ts.SyntaxKind.PlusToken: {
                        const left = ts.visitNode(node.left, this.boundVisitor);
                        const right = ts.visitNode(node.right, this.boundVisitor);
                        const num = isNumericLiteral(left);
                        const num2 = isNumericLiteral(right);
                        if (num && num2) return this.context.factory.createNumericLiteral(+num.text + +num2.text);
                        return this.context.factory.createBinaryExpression(left, ts.SyntaxKind.PlusToken, right);
                    }
                    case ts.SyntaxKind.AsteriskToken: {
                        const left: ts.Expression = ts.visitNode(node.left, this.boundVisitor);
                        const right: ts.Expression = ts.visitNode(node.right, this.boundVisitor);
                        const num = isNumericLiteral(left);
                        const num2 = isNumericLiteral(right);
                        if (num && num2) return this.context.factory.createNumericLiteral(+num.text * +num2.text);
                        return this.context.factory.createBinaryExpression(left, ts.SyntaxKind.AsteriskToken, right);
                    }
                    case ts.SyntaxKind.MinusToken: {
                        const left: ts.Expression = ts.visitNode(node.left, this.boundVisitor);
                        const right: ts.Expression = ts.visitNode(node.right, this.boundVisitor);
                        const num = isNumericLiteral(left);
                        const num2 = isNumericLiteral(right);
                        if (num && num2) return this.context.factory.createNumericLiteral(+num.text - +num2.text);
                        return this.context.factory.createBinaryExpression(left, ts.SyntaxKind.AsteriskToken, right);
                    }
                    case ts.SyntaxKind.SlashToken: {
                        const left: ts.Expression = ts.visitNode(node.left, this.boundVisitor);
                        const right: ts.Expression = ts.visitNode(node.right, this.boundVisitor);
                        const num = isNumericLiteral(left);
                        const num2 = isNumericLiteral(right);
                        if (num && num2) return this.context.factory.createNumericLiteral(+num.text / +num2.text);
                        return this.context.factory.createBinaryExpression(left, ts.SyntaxKind.AsteriskToken, right);
                    }
                    case ts.SyntaxKind.BarBarToken: {
                        const left: ts.Expression = ts.visitNode(node.left, this.boundVisitor);
                        const right: ts.Expression = ts.visitNode(node.right, this.boundVisitor);
                        const isFalseyLeft = isFalsey(left);
                        const isFalseyRight = isFalsey(right);
                        const isTruthyLeft = isTruthy(left);
                        const isTruthyRight = isTruthy(right);
                        if ( (!isFalseyLeft && !isTruthyLeft) || (!isFalseyRight && !isTruthyRight) ) return ts.visitEachChild(node, this.boundVisitor, this.context);
                        if (!isTruthyLeft) return right;
                        return left;
                    }
                    case ts.SyntaxKind.AmpersandAmpersandToken: {
                        const left: ts.Expression = ts.visitNode(node.left, this.boundVisitor);
                        const right: ts.Expression = ts.visitNode(node.right, this.boundVisitor);
                        const isFalseyLeft = isFalsey(left);
                        const isFalseyRight = isFalsey(right);
                        const isTruthyLeft = isTruthy(left);
                        const isTruthyRight = isTruthy(right);
                        if ( (!isFalseyLeft && !isTruthyLeft) || (!isFalseyRight && !isTruthyRight) ) return ts.visitEachChild(node, this.boundVisitor, this.context);
                        if (isFalseyLeft) return left;
                        if (isFalseyRight) return right;
                        return right;
                    }
                }
            }

            else if (ts.isExpressionStatement(node)) {
                if (ts.isPrefixUnaryExpression(node.expression) && node.expression.operator === 39 && ts.isArrayLiteralExpression(node.expression.operand)) {
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
                    const newBod = [];
                    const ind = this.repeat.push(0) - 1;
                    const totalLoopsNeeded = this.getTotalLoops(flattenBody(fn.body), args, macro.params);
                    for (; this.repeat[ind] < totalLoopsNeeded; this.repeat[ind]++) {
                        if ("statements" in fn.body) {
                            for (const stmt of fn.body.statements) {
                                const res = ts.visitNode(stmt, this.boundVisitor);
                                newBod.push(res);
                            }
                        }
                        else {
                            const res = ts.visitNode(fn.body, this.boundVisitor);
                            newBod.push(res);
                        }
                    }
                    this.repeat.pop();
                    return separator && separators[separator] ? separators[separator](this, newBod) : newBod;
                }
            } else if (ts.isPrefixUnaryExpression(node) && node.operator === 39 && ts.isArrayLiteralExpression(node.operand)) {
                let separator: string | ts.Expression = node.operand.elements[0];
                if (!separator || !ts.isStringLiteral(separator)) throw new Error("Repetition separator must be a string literal.");
                separator = separator.text;
                const fn = node.operand.elements[1];
                if (!fn || !ts.isArrowFunction(fn) || !fn.body) throw new Error("Missing repeat function.");
                const newBod = [];
                const ind = this.repeat.push(0) - 1;
                const totalLoopsNeeded = this.getTotalLoops(flattenBody(fn.body), args, macro.params);
                for (; this.repeat[ind] < totalLoopsNeeded; this.repeat[ind]++) {
                    if ("statements" in fn.body) {
                        for (const stmt of fn.body.statements) {
                            const res = ts.visitNode(stmt, this.boundVisitor);
                            newBod.push(res);
                        }
                    }
                    else {
                        const res = ts.visitNode(fn.body, this.boundVisitor);
                        newBod.push(res);
                    }
                }
                this.repeat.pop();
                return separator && separators[separator] ? separators[separator](this, newBod) : newBod;
            }

            return ts.visitEachChild(node, this.boundVisitor, this.context);
        }
        return ts.visitEachChild(node, this.boundVisitor, this.context);
    }

    isValidMarker(marker: string, param: ts.ParameterDeclaration) : boolean {
        if (!param.type) return false;
        const symbol = this.checker.getTypeAtLocation(param.type).aliasSymbol;
        if (!symbol || symbol.name !== marker || !symbol.declarations || !symbol.declarations.length) return false;
        return symbol.declarations[0].getSourceFile().fileName.includes("ts-macros");
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

}

function flattenBody(body: ts.ConciseBody) : Array<ts.Node> {
    if ("statements" in body) return [...body.statements];
    return [body];
}

function isFalsey(node: ts.Node) : boolean {
    return node.kind === ts.SyntaxKind.FalseKeyword || node.kind === ts.SyntaxKind.NullKeyword || ts.isIdentifier(node) && node.text === "undefined" || ts.isNumericLiteral(node) && node.text === "0" || ts.isStringLiteral(node) && node.text === "";
}

function isTruthy(node: ts.Node) : boolean {
    return node.kind === ts.SyntaxKind.TrueKeyword || ts.isStringLiteral(node) && node.text !== "" || ts.isNumericLiteral(node) && node.text !== "0";
}

function isNumericLiteral(node: ts.Expression) : ts.NumericLiteral|false {
    if (ts.isParenthesizedExpression(node)) return isNumericLiteral(node.expression);
    if (ts.isNumericLiteral(node)) return node;
    return false;
}

function toBinaryExp(transformer: MacroTransformer, body: Array<ts.Expression | ts.Statement>, id: number) {
    let last;
    for (const element of body.map(m => ts.isExpressionStatement(m) ? m.expression : (m as ts.Expression))) {
        if (!last) last = element;
        else last = transformer.context.factory.createBinaryExpression(last, id, element);
    }
    return ts.visitNode(last, transformer.boundVisitor) as ts.Expression;
}

const separators: Record<string, (transformer: MacroTransformer, body: Array<ts.Expression | ts.Statement>) => ts.Expression> = {
    "[]": (transformer, body) => {
        return transformer.context.factory.createArrayLiteralExpression(body.map(m => ts.isExpressionStatement(m) ? m.expression : (m as ts.Expression)));
    },
    "+": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.PlusToken),
    "-": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.MinusToken),
    "*": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.AsteriskToken),
    "||": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.BarBarToken),
    "&&": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.AmpersandAmpersandToken),
    ",": (transformer, body) => toBinaryExp(transformer, body, ts.SyntaxKind.CommaToken)
}