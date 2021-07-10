
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

export class MacroTransformer {
    macros: Map<string, Macro>
    context: ts.TransformationContext
    macroStack: Array<Macro>
    argsStack: Array<ts.NodeArray<ts.Expression>>
    repeat?: number
    boundVisitor: ts.Visitor
    constructor(context: ts.TransformationContext) {
        this.macros = new Map();
        this.context = context;
        this.boundVisitor = this.visitor.bind(this);
        this.macroStack = [];
        this.argsStack = [];
    }

    run(node: ts.Node): ts.Node {
        return ts.visitEachChild(node, this.visitor.bind(this), this.context);
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
            const exp = node.expression;
            const macro = this.macros.get((exp.expression as ts.NonNullExpression).expression.getText());
            if (!macro || !macro.body) return this.context.factory.createNull();
            this.argsStack.push(this.argsStack.length ? ts.visitNodes(node.expression.arguments, this.boundVisitor):node.expression.arguments);
            this.macroStack.push(macro);
            const res = ts.visitEachChild(macro.body, this.boundVisitor, this.context).statements;
            this.macroStack.pop();
            this.argsStack.pop();
            return [...res];
        }

        if (ts.isCallExpression(node) && ts.isNonNullExpression(node.expression)) {
            const macro = this.macros.get(node.expression.expression.getText());
            if (!macro || !macro.body) return this.context.factory.createNull();
            this.argsStack.push(this.argsStack.length ? ts.visitNodes(node.arguments, this.boundVisitor):node.arguments);
            this.macroStack.push(macro);
            const res = ts.visitEachChild(macro.body, this.boundVisitor, this.context).statements[0];
            this.macroStack.pop();
            this.argsStack.pop();
            return res;
        }

        if (this.macroStack.length) {
            const currentMacro = this.macroStack[this.macroStack.length - 1];
            const currentArgs = this.argsStack[this.argsStack.length - 1];
            if (ts.isIdentifier(node) && currentMacro.params.some(p => p.name === node.text)) {
                const index = currentMacro.params.findIndex(p => p.name === node.text);
                const paramMacro = currentMacro.params[index];
                if (this.repeat !== undefined && paramMacro.spread) {
                    const arg = currentArgs[this.repeat + paramMacro.start];
                    if (!arg) {
                        delete this.repeat;
                        return this.context.factory.createNull();
                    }
                    return arg;
                }
                if (paramMacro.spread) return this.context.factory.createArrayLiteralExpression(currentArgs.slice(paramMacro.start));
                return currentArgs[index] || currentMacro!.params[index].defaultVal || this.context.factory.createNull();
            }

            else if (ts.isExpressionStatement(node)) {
                if (ts.isPrefixUnaryExpression(node.expression) && node.expression.operator === 39 && ts.isArrayLiteralExpression(node.expression.operand)) {
                    const repeatedParam = currentMacro!.params.find(p => p.spread);
                    if (!repeatedParam) return this.context.factory.createNull();
                    let separator;
                    let fn;
                    if (node.expression.operand.elements.length) {
                        separator = node.expression.operand.elements[0];
                        if (!separator || !ts.isStringLiteral(separator)) throw new Error("Repetition separator must be a string literal");
                        separator = separator.text;
                        fn = node.expression.operand.elements[1];
                    } else fn = node.expression.operand.elements[0];
                    if (!fn || !ts.isArrowFunction(fn) || !fn.body) throw new Error("Missing repeat function");
                    const newBod = [];
                    this.repeat = 0;
                    while (currentArgs!.length > (this.repeat + repeatedParam.start)) {
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
                if (fn.parameters.length !== 1) throw new Error("Repeat functions must include the parameter to repeat"); 
                const repeatedParam = currentMacro!.params.find(p => p.spread)!;
                const newBod = [];
                this.repeat = 0;
                while (currentArgs!.length > (this.repeat + repeatedParam.start)) {
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


function toBinaryExp(transformer: MacroTransformer, body: Array<ts.Expression | ts.Statement>, id: number) {
    let last;
    //@ts-expect-error
    for (const element of body.map(m => m.expression || m)) {
        if (!last) last = element;
        else last = transformer.context.factory.createBinaryExpression(last, id, element);
    }
    return last;
}

const separators: Record<string, (transformer: MacroTransformer, body: Array<ts.Expression | ts.Statement>) => ts.Expression> = {
    "[]": (transformer, body) => {
        //@ts-expect-error
        return transformer.context.factory.createArrayLiteralExpression(body.map(m => m.expression || m));
    },
    "+": (transformer, body) => toBinaryExp(transformer, body, 39),
    "-": (transformer, body) => toBinaryExp(transformer, body, 40),
    "*": (transformer, body) => toBinaryExp(transformer, body, 41),
    ".": (transformer, body) => {
        let last;
        //@ts-expect-error
        for (const element of body.map(m => m.expression || m)) {
            if (!last) last = element;
            else last = transformer.context.factory.createElementAccessExpression(last, element);
        }
        return last;
    },
    ",": (transformer, body) => toBinaryExp(transformer, body, 27)
}