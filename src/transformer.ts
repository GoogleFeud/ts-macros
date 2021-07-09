
import * as ts from "typescript";

export interface MacroParam {
    spread: boolean,
    start: number,
    name: string,
    defaultVal?: ts.Expression,
    optional: boolean
}


export interface Macro {
    params: Array<MacroParam>,
    body?: ts.FunctionBody
}

export class MacroTransformer {
    macros: Map<string, Macro>
    context: ts.TransformationContext
    currentMacro?: Macro
    currentArgs?: ts.NodeArray<ts.Expression>
    repeat?: number
    constructor(context: ts.TransformationContext) {
        this.macros = new Map();
        this.context = context;
    }

    run(node: ts.Node) : ts.Node {
        return ts.visitEachChild(node, this.visitor.bind(this), this.context);
    }

    visitor(node: ts.Node) : ts.Node | Array<ts.Node> | undefined {
        if (ts.isFunctionDeclaration(node) && ts.getNameOfDeclaration(node)?.getText().startsWith("$")) {
            const params: Array<MacroParam> = [];
            for (let i=0; i < node.parameters.length; i++) {
                const param = node.parameters[i];
                params.push({
                    spread: Boolean(param.dotDotDotToken),
                    start: i,
                    name: param.name.getText(),
                    defaultVal: param.initializer,
                    optional: Boolean(param.questionToken)
                });
            }
            this.macros.set(ts.getNameOfDeclaration(node)!.getText(), {
                params,
                body: node.body
            });
            return undefined;
        }

        if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && ts.isNonNullExpression(node.expression.expression)) {
            const exp = node.expression;
            const macro = this.macros.get((exp.expression as ts.NonNullExpression).expression.getText());
            if (!macro || !macro.body) return this.context.factory.createNull();
            this.currentMacro = macro;
            this.currentArgs = exp.arguments;
            const res = ts.visitEachChild(macro.body, this.unwrapMacroVisitor.bind(this), this.context).statements;
            delete this.currentMacro;
            delete this.currentArgs;
            return [...res];
        }

        if (ts.isCallExpression(node) && ts.isNonNullExpression(node.expression)) {
            const macro = this.macros.get(node.expression.expression.getText());
            if (!macro || !macro.body) return this.context.factory.createNull();
            this.currentMacro = macro;
            this.currentArgs = node.arguments;
            //@ts-expect-error
            const res = ts.visitEachChild(macro.body, this.unwrapMacroVisitor.bind(this), this.context).statements[0].expression;
            delete this.currentMacro;
            delete this.currentArgs;
            return res;
        }
        return ts.visitEachChild(node, this.visitor.bind(this), this.context);
    }

    unwrapMacroVisitor(node: ts.Node) : ts.Node|Array<ts.Node>|undefined {
        if (ts.isIdentifier(node) && this.currentMacro!.params.some(p => p.name === node.text)) {
            const index = this.currentMacro!.params.findIndex(p => p.name === node.text);
            const paramMacro = this.currentMacro!.params[index];
            if (this.repeat !== undefined && paramMacro.spread) {
                const arg = this.currentArgs![this.repeat + paramMacro.start];
                if (!arg) {
                    delete this.repeat;
                    return this.context.factory.createNull();
                }
                this.repeat++;
                return arg;
            }
            if (paramMacro.spread) return this.context.factory.createArrayLiteralExpression(this.currentArgs!.slice(paramMacro.start));
            return this.currentArgs![index] || this.currentMacro!.params[index].defaultVal || this.context.factory.createNull();
        }
        else if (ts.isExpressionStatement(node)) {
            if (ts.isPrefixUnaryExpression(node.expression) && node.expression.operator === 39 && ts.isParenthesizedExpression(node.expression.operand)) {
                const repeatedParam = this.currentMacro!.params.find(p => p.spread);
                if (!repeatedParam) return this.context.factory.createNull();
                const fn = node.expression.operand.expression;
                if (!fn || !ts.isArrowFunction(fn) || !fn.body) throw new Error("Missing repeat function");
                if (fn.parameters.length) throw new Error("Repeat function cannot contain arguments");
                const newBod = [];
                this.repeat = 0;
                while (this.currentArgs!.length > (this.repeat + repeatedParam.start)) {
                    const t = ts.visitEachChild(fn.body, this.unwrapMacroVisitor.bind(this), this.context);
                    if ("statements" in t) newBod.push(...t.statements);
                    else newBod.push(t);
                }
                return newBod;
            }
        }
        return ts.visitEachChild(node, this.unwrapMacroVisitor.bind(this), this.context);
    }


}
