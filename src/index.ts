/* eslint-disable @typescript-eslint/no-explicit-any */

import * as ts from "typescript";
import { MacroMap } from "./macroMap";
import { MacroTransformer } from "./transformer";

export const macros = new MacroMap();

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
 * Reads the contents of the specified file and expands to them. If the `parseJSON` argument is set to true, then the contents get parsed to JSON and then expanded.
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
export declare function $$readFile(path: string, parseJSON?: false) : string;
export declare function $$readFile<T = Record<string, unknown>>(path: string, parseJSON?: boolean) : T;

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
 * Expands to a let / const declaration list. The "varname" is **not** hygienic.
 * @param varname The name of the variable
 * @param initializer Any expression
 */
export declare function $$define(varname: string, initializer: unknown, let?: boolean) : number;

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
export declare function $$escape(code: () => void) : any;


/**
 * Returns the name of all properties of the type in an array.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export declare function $$propsOfType<T>() : Array<string>;

/**
 * Turns the type into a string.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export declare function $$typeToString<T>() : string;

export type Accumulator = number & { __marker?: "Accumulator" };
declare const var_sym: unique symbol;
// eslint-disable-next-line @typescript-eslint/ban-types
export type Var = (null | undefined | string | number | {} | typeof var_sym) & { __marker?: "Var" };
export type Save<T> = T & { __marker?: "Save" }

export const enum LabelKinds {
    If,
    ForIter,
    For,
    While,
    Block
}

export interface IfLabel {
    kind: LabelKinds.If
    condition: any,
    then: any,
    else: any
}

export interface ForIterLabel {
    kind: LabelKinds.ForIter,
    type: "in" | "of",
    /**
     * Guaranteed to be an expression. Will expand to an identifier if a declaration is used as the initializer:
     * ```ts
     * // identifier "item"
     * for (const item of ...) { ... }
     * 
     * // Expression "item.value"
     * for (item.value of ...) { ... }
     * ```
     */
    initializer: any,
    iterator: any,
    statement: any
}

export interface ForLabel {
    kind: LabelKinds.For,
    /**
     * If a declaration is used, `variables` will be filled with each variable declaration (it's name and it's initializer). If any expression is used, or if the expression is missing,
     * then `expression` will be set.
     */
    initializer: {
        expression?: any,
        variables?: Array<[variableName: string, initializer: any]>
    },
    condition: any,
    increment: any,
    statement: any
}

export interface WhileLabel {
    kind: LabelKinds.While,
    do: boolean,
    condition: any,
    statement: any
}

export interface BlockLabel {
    kind: LabelKinds.Block,
    statement: any
}

export type Label = IfLabel | ForIterLabel | ForLabel | WhileLabel | BlockLabel;