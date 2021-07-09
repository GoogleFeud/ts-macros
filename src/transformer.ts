
import * as ts from "typescript";

export interface MacroParam {
    spread: boolean,
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
    constructor(context: ts.TransformationContext) {
        this.macros = new Map();
        this.context = context;
    }

    run(node: ts.Node) : ts.Node {
        return ts.visitEachChild(node, this.extractMacroDeclarations.bind(this), this.context);
    }

    extractMacroDeclarations(node: ts.Node) : ts.Node | undefined {
        if (ts.isFunctionDeclaration(node) && ts.getNameOfDeclaration(node)?.getText().startsWith("$")) {
            const params: Array<MacroParam> = [];
            for (const param of node.parameters) {
                params.push({
                    spread: Boolean(param.dotDotDotToken),
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
        if (ts.isCallExpression(node) && ts.isNonNullExpression(node.expression) && this.macros.has(node.expression.expression.getText())) {
            console.log(`Found a macro call: ${node.expression.expression.getText()}`)
        }
        return ts.visitEachChild(node, this.extractMacroDeclarations.bind(this), this.context);
    }

}