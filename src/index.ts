
import * as ts from "typescript";
import { MacroTransformer } from "./transformer";

export default (program: ts.Program): ts.TransformerFactory<ts.Node> => ctx => {
    const dir = program.getCurrentDirectory();
    return firstNode => {
        return new MacroTransformer(dir, ctx).run(firstNode);
    };
};


export declare function $$loadEnv(path?: string) : void;
export declare function $$loadJSONAsEnv(path: string) : void;
export declare function $$inlineFunc(func: Function, ...params: Array<unknown>) : void;
export declare function $$kindof(ast: unknown) : number;