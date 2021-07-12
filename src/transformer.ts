
import * as ts from "typescript";

export interface MacroParam {
    spread: boolean,
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
}

export class MacroTransformer {
    macros: Map<string, Macro>
    context: ts.TransformationContext
    macroStack: Array<MacroExpand>
    repeat?: number
    boundVisitor: ts.Visitor
    constructor(context: ts.TransformationContext) {
        this.macros = new Map();
        this.context = context;
        this.boundVisitor = this.visitor.bind(this);
        this.macroStack = [];
    }

    run(node: ts.Node): ts.Node {
        return ts.visitEachChild(node, this.boundVisitor, this.context);
    }

    visitor(node: ts.Node): ts.Node | Array<ts.Node> | undefined {
        if (ts.isFunctionDeclaration(node) && ts.getNameOfDeclaration(node)?.getText().startsWith("$")) {
            const params: Array<MacroParam> = [];
            for (let i = 0; i < node.parameters.length; i++) {
                const param = node.parameters[i];
                params.push({
                    spread: Boolean(param.dotDotDotToken),
                    start: i,
                    name: param.name.getText(),
                    defaultVal: param.initializer
                });
            }
            const macroName = ts.getNameOfDeclaration(node)!.getText();
            this.macros.set(macroName, {
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
                macro = this.macros.get(chain.expression.name.text); 
                const newArgs = this.context.factory.createNodeArray([ts.visitNode(chain.expression.expression, this.boundVisitor), ...node.expression.arguments]);
                args = this.macroStack.length ? ts.visitNodes(newArgs, this.boundVisitor) : newArgs;
            } else {
                macro = this.macros.get(chain.expression.getText());
                args = this.macroStack.length ? ts.visitNodes(node.expression.arguments, this.boundVisitor) : node.expression.arguments;
            }
            if (!macro || !macro.body) return this.context.factory.createNull();
            this.macroStack.push({
                macro,
                args
            })
            const res = ts.visitEachChild(macro.body, this.boundVisitor, this.context).statements;
            this.macroStack.pop();
            return [...res];
        }

        if (ts.isCallExpression(node) && ts.isNonNullExpression(node.expression)) {
            let macro;
            let args;
            if (ts.isPropertyAccessExpression(node.expression.expression)) {
                macro = this.macros.get(node.expression.expression.name.text); 
                const newArgs = this.context.factory.createNodeArray([ts.visitNode(node.expression.expression.expression, this.boundVisitor), ...node.arguments]);
                args = this.macroStack.length ? ts.visitNodes(newArgs, this.boundVisitor) : newArgs;
            } else {
                macro = this.macros.get(node.expression.expression.getText());
                args = this.macroStack.length ? ts.visitNodes(node.arguments, this.boundVisitor) : node.arguments;
            }
            if (!macro || !macro.body) return this.context.factory.createNull();
            this.macroStack.push({
                macro,
                args,
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
            const {macro, args} = this.macroStack[this.macroStack.length - 1];

            if (ts.isIdentifier(node) && macro.params.some(p => p.name === node.text)) {
                const index = macro.params.findIndex(p => p.name === node.text);
                const paramMacro = macro.params[index];
                if (this.repeat !== undefined && paramMacro.spread) {
                    const arg = args[this.repeat + paramMacro.start];
                    if (!arg) {
                        delete this.repeat;
                        return this.context.factory.createNull();
                    }
                    return arg;
                }
                if (paramMacro.spread) return this.context.factory.createArrayLiteralExpression(args.slice(paramMacro.start));
                return args[index] || macro!.params[index].defaultVal || this.context.factory.createNull();
            }

            else if (ts.isConditionalExpression(node)) {
                const param = ts.visitNode(node.condition, this.boundVisitor);
                if (param.kind === ts.SyntaxKind.FalseKeyword || param.kind === ts.SyntaxKind.NullKeyword) return ts.visitNode(node.whenFalse, this.boundVisitor);
                const text = param.getText();
                if (text === "false" || text === "undefined" || text === "null" || text === "0") return ts.visitNode(node.whenFalse, this.boundVisitor);
                if (text === "true" || ts.isNumericLiteral(param) || ts.isStringLiteral(param)) return ts.visitNode(node.whenTrue, this.boundVisitor);
                return this.context.factory.createConditionalExpression(param, undefined, node.whenTrue, undefined, node.whenFalse);
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
                        let left = ts.visitNode(node.left, this.boundVisitor);
                        let right = ts.visitNode(node.right, this.boundVisitor);
                        const num = isNumericLiteral(left);
                        const num2 = isNumericLiteral(right);
                        if (num && num2) return this.context.factory.createNumericLiteral(+num.text + +num2.text);
                        return this.context.factory.createBinaryExpression(left, ts.SyntaxKind.PlusToken, right);
                    }
                    case ts.SyntaxKind.AsteriskToken: {
                        let left: ts.Expression = ts.visitNode(node.left, this.boundVisitor);
                        let right: ts.Expression = ts.visitNode(node.right, this.boundVisitor);
                        const num = isNumericLiteral(left);
                        const num2 = isNumericLiteral(right);
                        if (num && num2) return this.context.factory.createNumericLiteral(+num.text * +num2.text);
                        return this.context.factory.createBinaryExpression(left, ts.SyntaxKind.AsteriskToken, right);
                    }
                    case ts.SyntaxKind.MinusToken: {
                        let left: ts.Expression = ts.visitNode(node.left, this.boundVisitor);
                        let right: ts.Expression = ts.visitNode(node.right, this.boundVisitor);
                        const num = isNumericLiteral(left);
                        const num2 = isNumericLiteral(right);
                        if (num && num2) return this.context.factory.createNumericLiteral(+num.text - +num2.text);
                        return this.context.factory.createBinaryExpression(left, ts.SyntaxKind.AsteriskToken, right);
                    }
                    case ts.SyntaxKind.SlashToken: {
                        let left: ts.Expression = ts.visitNode(node.left, this.boundVisitor);
                        let right: ts.Expression = ts.visitNode(node.right, this.boundVisitor);
                        const num = isNumericLiteral(left);
                        const num2 = isNumericLiteral(right);
                        if (num && num2) return this.context.factory.createNumericLiteral(+num.text / +num2.text);
                        return this.context.factory.createBinaryExpression(left, ts.SyntaxKind.AsteriskToken, right);
                    }
                }
            }

            else if (ts.isExpressionStatement(node)) {
                if (ts.isPrefixUnaryExpression(node.expression) && node.expression.operator === 39 && ts.isArrayLiteralExpression(node.expression.operand)) {
                    const repeatedParam = macro!.params.find(p => p.spread);
                    if (!repeatedParam) return this.context.factory.createNull();
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
                    this.repeat = 0;
                    while (args!.length > (this.repeat + repeatedParam.start)) {
                        if ("statements" in fn.body) newBod.push(...ts.visitEachChild(fn.body, this.boundVisitor, this.context).statements);
                        else newBod.push(ts.visitNode(fn.body, this.boundVisitor));
                        this.repeat++;
                    }
                    return separator && separators[separator] ? separators[separator](this, newBod) : newBod;
                }
            } else if (ts.isPrefixUnaryExpression(node) && node.operator === 39 && ts.isArrayLiteralExpression(node.operand)) {
                let separator: string | ts.Expression = node.operand.elements[0];
                if (!separator || !ts.isStringLiteral(separator)) throw new Error("Repetition separator must be a string literal");
                separator = separator.text;
                const fn = node.operand.elements[1];
                if (!fn || !ts.isArrowFunction(fn) || !fn.body) throw new Error("Missing repeat function");
                const repeatedParam = macro!.params.find(p => p.spread)!;
                const newBod = [];
                this.repeat = 0;
                while (args!.length > (this.repeat + repeatedParam.start)) {
                    if ("statements" in fn.body) newBod.push(...ts.visitEachChild(fn.body, this.boundVisitor, this.context).statements);
                    else newBod.push(ts.visitNode(fn.body, this.boundVisitor));
                    this.repeat++;
                }
                return separator && separators[separator] ? separators[separator](this, newBod) : newBod;
            }

            return ts.visitEachChild(node, this.boundVisitor, this.context);
        }
        return ts.visitEachChild(node, this.boundVisitor, this.context);
    }

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