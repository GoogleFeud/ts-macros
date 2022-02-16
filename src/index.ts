
import * as ts from "typescript";
import { MacroTransformer } from "./transformer";

export default (program: ts.Program): ts.TransformerFactory<ts.Node> => ctx => {
    const dir = program.getCurrentDirectory();
    const typeChecker = program.getTypeChecker();
    return firstNode => {
        return new MacroTransformer(dir, ctx, typeChecker).run(firstNode as ts.SourceFile);
    };
};

/**
 * Loads an env file from the provided path, or from the base directory of your project (aka where package.json is). 
 * The macro loads the enviourment variables in the output AND while typescript is transpiling your code. 
 * This means expressions like `process.env.SOME_CONFIG_OPTION` in macro bodies will be replaced with the literal value of the enviourment variable.
 * This macro requires you have the dotenv module installed. It doesn't come with the library by default.
 * 
 * @example
 * ```ts --Macro
 * import { $$loadEnv } from "ts-macros";
 * $$loadEnv!();
 *
 *  function $multiply(num: number) : number {
 *      process.env.TRIPLE === "yes" ? num * 3 : num * 2;
 *  }
 *
 *  [$multiply!(1), $multiply!(2), (3).$multiply!()];
 * ```
 * ```js --Result
 * require("dotenv").config();
 * [3, 6, 9];
 * ```
 * ``` --Env
 * TRIPLE=yes
 * ```
 */
export declare function $$loadEnv(path?: string) : void;

/**
 * Loads a JSON object and puts all properties in the `process.env` object.
 * Since that object can only contain strings, it's not recommended to put arrays or other complex objects inside the JSON. Works the same way as `$$loadEnv`. 
 * This macro only loads the properties inside the JSON during the transpilation process - you won't find the properties if you run the transpiled code.
 * 
 * @example
 * ```ts --Macro
 *  import { $$loadJSONAsEnv } from "ts-macros";
 *  $$loadJSONAsEnv!("config.json");
 *
 *   function $debug(exp: unknown) : void {
 *       if (process.env.debug === "true") console.log(exp);
 *   }
 *
 *   $debug!(1 + 1);
 * ```
 * ```js --Result
 *  // Empty!
 * ```
 * ```json --Env
 * { debug: false }
 * ```
 */
export declare function $$loadJSONAsEnv(path: string) : void;

/**
 * Inlines an arrow function literal.
 * @param func The arrow function literal to inline
 * @param params Any expression to replace the function's arguments
 * 
 * @example
 * ```ts
 * import { $$inlineFunc } from "ts-macros";
 * 
 * $$inlineFunc!((a, b) => a + b, 5, 10 + 5);
 * // Transpiles to 20
 * ``` 
 */
export declare function $$inlineFunc<R = any>(func: Function, ...params: Array<unknown>) : R;
/**
 * Returns the `kind` of the expression.
 * @param ast Any expression
 * 
 * @example
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

/**
 * Throws an error during transpilation.
 */
export declare function $$err(str: string) : void;

/**
 * Adds an import at the beginning of the file.
 */
export declare function $$import(source: string, items: undefined|string|Array<string>, star?: boolean) : void;

export type AsRest<T extends Array<unknown>> = T | (T & { __marker: "AsRest" });
export type Accumulator = number | (number & { __marker: "Accumulator" });

declare const var_sym: unique symbol
export type Var = null | undefined | string | number | {} | typeof var_sym;