
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

/**
 * Inlines an arrow function literal.
 * @param func The arrow function literal to inline
 * @param params Any expression to replace the function's arguments
 * 
 * Example:
 * ```ts
 * import { $$inlineFunc } from "ts-macros";
 * 
 * $$inlineFunc!((a, b) => a + b, 5, 10 + 5);
 * // Transpiles to 5 + 10 + 5
 * ``` 
 */
export declare function $$inlineFunc<R = any>(func: Function, ...params: Array<unknown>) : R;
/**
 * Returns the `kind` of the expression.
 * @param ast Any expression
 * 
 * Example:
 * ```ts
 * import { $$kindof } from "ts-macros";
 * import * as ts from "typescript";
 * 
 * console.log($$kindof!([1]) === ts.SyntaxKind.ArrayLiteralExpression);
 * // Transpiles to console.log(true)
 * ```
 */
export declare function $$kindof(ast: unknown) : number;

/**
 * Create a const variable that will not get it's name changed after expanding. This is **not** hygienic.
 * @param varname The name of the variable
 * @param initializer Any expression
 */
export declare function $$const(varname: string, initializer: unknown) : number;

/**
 * If used in repetition, returns the current iteration. If used outside, returns -1.
 */
export declare function $$i() : number;

/**
 * Gets the length of an array literal.
 */
export declare function $$length(arr: Array<any>) : number;

/**
 * Turns a string to an identifier.
 */
export declare function $$ident(str: string) : any;

export type AsRest<T extends Array<unknown>> = T | (T & { __marker: "AsRest" });
export type Accumulator = number | (number & { __marker: "Accumulator" });