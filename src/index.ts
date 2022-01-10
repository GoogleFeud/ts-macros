
import * as ts from "typescript";
import { MacroTransformer } from "./transformer";

export default (program: ts.Program): ts.TransformerFactory<ts.Node> => ctx => {
    const dir = program.getCurrentDirectory();
    const typeChecker = program.getTypeChecker();
    return firstNode => {
        return new MacroTransformer(dir, ctx, typeChecker).run(firstNode as ts.SourceFile);
    };
};


export declare function $$loadEnv(path?: string) : void;
export declare function $$loadJSONAsEnv(path: string) : void;
export declare function $$inlineFunc<R = any>(func: Function, ...params: Array<unknown>) : R;
export declare function $$kindof(ast: unknown) : number;
export declare function $$const(varname: string, initializer: unknown) : number;

export type AsRest<T extends Array<unknown>> = T | (T & { __marker: "AsRest" });
export type Accumulator = number | (number & { __marker: "Accumulator" });