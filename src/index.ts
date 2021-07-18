
import * as ts from "typescript";
import { MacroTransformer } from "./transformer";

export default (program: ts.Program): ts.TransformerFactory<ts.Node> => ctx => {
    const dir = program.getCurrentDirectory();
    return firstNode => {
        return new MacroTransformer(dir, ctx).run(firstNode);
    };
};

export function $$loadEnv(path?: string) {
    /* Native implementation */
}

export function $$loadJSONAsEnv(path: string) {
    /* Native implementation */
}

export function $$inlineFunc(func: Function) {
    /* Native implementation */
}

//@ts-expect-error
export function $$kindof(ast: unknown) : number {
    /* Native implementation */
}