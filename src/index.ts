/* eslint-disable @typescript-eslint/no-explicit-any */

import * as ts from "typescript";
import { MacroMap } from "./macroMap";
import { MacroTransformer } from "./transformer";

const macros = new MacroMap();

export default (program: ts.Program): ts.TransformerFactory<ts.Node> => ctx => {
    const typeChecker = program.getTypeChecker();
    const transformer = new MacroTransformer(ctx, typeChecker, macros);
    return firstNode => {
        return transformer.run(firstNode as ts.SourceFile);
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
// eslint-disable-next-line @typescript-eslint/ban-types
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
 * Checks if `val` is included in the array literal, OR checks if a substring is a string.
 */
export declare function $$includes<T>(arr: Array<T>, val: T) : boolean;
export declare function $$includes(arr: string, val: string) : boolean;

/**
 * Slices a string literal OR an array literal.
 */
export declare function $$slice<T>(str: Array<T>, start?: number, end?: number) : Array<T>;
export declare function $$slice(str: string, start?: number, end?: number) : string;

/**
 * Turns the string to code.
 */
export declare function $$ts<T = unknown>(code: string) : T;

/**
 * "Escapes" the code inside the arrow function by placing it in the parent block. This macro **cannot** be used outside any blocks.
 * 
 * @example
 * ```ts --Macro
 * function $try(resultObj: any) {
 *   $$escape!(() => {
 *       const res = resultObj;
 *       if (res.is_err()) {
 *           return res;
 *       }
 *   });
 *   return $$ident!("res").result;
 * }
 * 
 * {
 *   const result = $try!({ value: 123 });
 * }
 * ```
 * ```ts --Result
 *  const res = { value: 123 };
 *  if (res.is_err()) {
 *       return res;
 *  }
 *  const a = res.result;
 * ```
 */
export declare function $$escape(code: () => void) : void;

export type Accumulator = number & { __marker?: "Accumulator" };
declare const var_sym: unique symbol;
// eslint-disable-next-line @typescript-eslint/ban-types
export type Var = (null | undefined | string | number | {} | typeof var_sym) & { __marker?: "Var" };
export type Save<T> = T & { __marker?: "Save" }