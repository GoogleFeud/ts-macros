
import * as ts from "typescript";

export interface MacroParam {
    spread: boolean,
    name: string,
    defaultVal: ts.Expression
}


export interface Macro {
    params: Array<MacroParam>,
    body: ts.FunctionBody
}

export class MacroTransformer {
    macros: Map<string, Macro>
    context: ts.TransformationContext
    constructor(context: ts.TransformationContext) {
        this.macros = new Map();
        this.context = context;
    }

    run(node: ts.Node) : ts.Node {
        return ts.visitEachChild(node, this.extractMacros.bind(this), this.context);
    }

    extractMacros(node: ts.Node) : ts.Node {
        if (ts.isFunctionDeclaration(node) && ts.getNameOfDeclaration(node)?.getText().startsWith("$")) {
            const name = ts.getNameOfDeclaration(node)!.getText().slice(1);
            console.log(`Found macro declaration with name "${name}"`);
        }
        return node;
    }

    findAndReplaceMacros(node: ts.Node) : ts.Node {
        return node;
    }

}