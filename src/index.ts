/* eslint-disable @typescript-eslint/no-explicit-any */

import * as ts from "typescript";
import { MacroExpand, MacroTransformer } from "./transformer";

export const macros = new Map();

export interface TsMacrosConfig {
    noComptime?: boolean
}

export default (program: ts.Program, config?: TsMacrosConfig): ts.TransformerFactory<ts.Node> => ctx => {
    const typeChecker = program.getTypeChecker();
    const transformer = new MacroTransformer(ctx, typeChecker, macros, config);
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
 * @category Built-in Macros
 */
export declare function $$loadEnv(path?: string) : void;

/**
 * Reads the contents of the specified file and expands to them. If the `parseJSON` argument is set to true, then the contents get parsed to JSON and then expanded.
 * 
 * @example
 * ```ts --Macro
 * function $log(...contents: Array<unknown>) : void {
 *     if ($$readFile!<{debug: boolean}>("./test/config.json", true).debug) console.log(+[[contents], (content) => content]);
 * }
 * ```
 * ```js --Call
 * $log!("Hello", "World!");
 * ```
 * ```js --Result
 *  console.log("Hello", "World!");
 * ```
 * ```json --Env
 * { "debug": true }
 * ```
 * @category Built-in Macros
 */
export declare function $$readFile(path: string, parseJSON?: false) : string;
export declare function $$readFile<T = Record<string, unknown>>(path: string, parseJSON?: boolean) : T;

/**
 * Inlines the provided arrow function, replacing any argument occurrences with the corresponding values inside the `argReplacements` array.
 * @param func The arrow function literal to inline
 * @param params Any expression to replace the function's arguments
 * 
 * @example
 * ```ts --Macro
 * import { $$inlineFunc } from "ts-macros";
 * import * as ts from "typescript"
 * 
 * function $map(arr: Save<Array<number>>, cb: Function) : Array<number> {
 *     const res = [];
 *     for (let i=0; i < arr.length; i++) {
 *        res.push($$inlineFunc!(cb, arr[i]));
 *     }
 *     return res;
 * }
 * ```
 * ```ts --Call
 * console.log($map!([1, 2, 3, 4, 5], (num: number) => num * 2));
 * ```
 * ```js --Result
 * console.log((() => {
 *     var arr = [1, 2, 3, 4, 5];
 *     const res = [];
 *     for (let i = 0; i < arr.length; i++) {
 *         res.push(arr[i] * 2);
 *     }
 *     return res;
 * })());
 * ```
 * @category Built-in Macros
 * @deprecated
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export declare function $$inlineFunc<R = any>(func: Function, ...params: Array<unknown>) : R;

/**
 * Inlines the provided function, replacing any argument occurances with the corresponding values inside the `params` array, and executes the code. 
 * 
 * If the function consists of a single expression, the call to `$$inline` expands to that expression, otherwise it expands to an IIFE. Passing any value
 * to the `doNotCall` parameter will make it so it always expands to an arrow function, so the code will NEVER be executed. 
 * 
 * @example
 * ```ts --Macro
 * function $map<T>(arr: Save<Array<T>>, cb: (item: T) => T) : Array<T> {
 *     const res = [];
 *     for (let i=0; i < arr.length; i++) {
 *        res.push($$inline!(cb, [arr[i]]));
 *     }
 *     return res;
 * }
 * ```
 * ```ts --Call
 * console.log($map!([1, 2, 3, 4, 5], (num: number) => num * 2));
 * ```
 * @param func The function to inline
 * @param params An array literal with the argument values
 * @param doNotCall If any value is passed, this macro will always expand to an arrow function with the new code inside of it.
 * 
 * @category Built-in Macros
 */
export declare function $$inline<F extends (...args: any) => any>(func: F, params: Parameters<F>, doNotCall: any) : () => ReturnType<F>;
export declare function $$inline<F extends (...args: any) => any>(func: F, params: Parameters<F>) : ReturnType<F>;
/**
 * Returns the `kind` of the expression.
 * @param ast Any expression
 * 
 * @example
 * ```ts --Macro
 * import {$$kindof} from "ts-macros";
 * import * as ts from "typescript"
 * 
 * function $doSomethingBasedOnTypeOfParam(param: unknown) {
 *     if ($$kindof!(param) === ts.SyntaxKind.ArrayLiteralExpression) "Provided value is an array literal!";
 *     else if ($$kindof!(param) === ts.SyntaxKind.ArrowFunction) "Provided value is an arrow function!";
 *     else if ($$kindof!(param) === ts.SyntaxKind.CallExpression) "Provided value is a function call!";
 * }
 * ```
 * ```ts --Call
 * $doSomethingBasedOnTypeOfParam!([1, 2, 3]);
 * $doSomethingBasedOnTypeOfParam!(console.log(1));
 * $doSomethingBasedOnTypeOfParam!(() => 1 + 1);
 * ```
 * ```js --Result
 * "Provided value is an array literal!";
 * "Provided value is a function call!";
 * "Provided value is an arrow function!";
 * ```
 * @category Built-in Macros
 */
export declare function $$kindof(ast: unknown) : number;

/**
 * Creates a const variable with the provided name and initializer. This is not hygienic, use it when you want to create a variable and know it's name.
 * @param varname The name of the variable
 * @param initializer Any expression
 * 
 * @example
 * ```ts --Usage
 * import { $$const } from "ts-macros";
 * 
 * $$const!("abc", 123);
 * ```
 * ```js --Result
 * const abc = 123;
 * ```
 * @category Built-in Macros
 */
export declare function $$define(varname: string, initializer: unknown, let?: boolean) : number;

/**
 * If this macro is called in a repetition, it's going to return the number of the current iteration. If it's called outside, it's going to return `-1`.
 * 
 * @example
 * ```ts --Macro
 * import { $$i } from "ts-macros";
 * 
 * function $arr(...els: Array<number>) {
 *    +["[]", [els], (element: number) => element + $$i!()];
 * }
 * ```
 * ```ts --Call
 * $arr!(1, 2, 3);
 * ```
 * ```ts --Result
 * [1, 3, 5]
 * ```
 * @category Built-in Macros
 */
export declare function $$i() : number;

/**
 * Gets the length of an array or a string literal.
 * 
 * @example
 * ```ts --Macro
 * import { $$arr } from "ts-macros";
 * 
 * function $arr(...els: Array<number>) {
 *     $$length!(els);
 * }
 * ```
 * ```ts --Call
 * $arr!(1, 2, 3, 4, 5);
 * ```
 * ```ts --Result
 * 5
 * ```
 * @category Built-in Macros
 */
export declare function $$length(arr: Array<any>|string) : number;

/**
 * Turns a string literal into an identifier. 
 * 
 * ```ts --Usage
 * import { $$ident } from "ts-macros";
 * 
 * const Hello = "World";
 * console.log($$ident!("Hello"));
 * ```
 * ```js --Result
 * const Hello = "World";
 * console.log(Hello);
 * ```
 * @category Built-in Macros
 */
export declare function $$ident(str: string) : any;

/**
 * Throws an error during transpilation.
 * 
 * @param str - The error to throw.
 * @category Built-in Macros
 */
export declare function $$err(str: string) : void;

/**
 * Checks if `val` is included in the array literal / string.
 * 
 * ```ts --Call
 * $$includes!([1, 2, 3], 2);
 * $$includes!("HellO!", "o");
 * ```
 * ```ts --Result
 * true;
 * false;
 * ```
 * @category Built-in Macros
 */
export declare function $$includes<T>(arr: Array<T>, val: T) : boolean;
export declare function $$includes(arr: string, val: string) : boolean;

/**
 * Slices a string literal or an array literal.
 * ```ts --Call
 * $$slice!("Hello", 0, 2);
 * $$slice!([1, 2, 3, 4], 2);
 * $$slice!([1, 2, 3, 4], -1);
 * ```
 * ```ts --Result
 * "He";
 * [3, 4];
 * [4];
 * ```
 * @category Built-in Macros
 */
export declare function $$slice<T>(str: Array<T>, start?: number, end?: number) : Array<T>;
export declare function $$slice(str: string, start?: number, end?: number) : string;

/**
 * Turns the provided string into code. You should use this only when you can't accomplish something with other macros.
 * 
 * ```ts --Macro
 * type ClassInfo = { name: string, value: string };
 * 
 * export function $makeClasses(...info: Array<ClassInfo>) {
 *     +[(info: ClassInfo) => {
 *         $$ts!(`
 *           class ${info.name} {
 *                 constructor() {
 *                     this.value = ${info.value}
 *                 }
 *             }
 *         `);
 *     }];
 * }
 * ```
 * ```ts --Call
 * $makeClasses!({name: "ClassA", value: "1"}, {name: "ClassB", value: "2"})
 * ```
 * ```ts --Result
 * class ClassA {
 *    constructor() {
 *         this.value = 1;
 *     }
 * }
 * class ClassB {
 *    constructor() {
 *         this.value = 2;
 *     }
 * }
 * ```
 * @category Built-in Macros
 */
export declare function $$ts<T = unknown>(code: string) : T;

/**
 * "Escapes" the code inside the arrow function by placing it in the parent block.
 * If the last statement inside the arrow function is a return statement, the escape
 * macro itself will expand to the returned expression.
 * 
 * @example
 * ```ts --Macro
 * function $try(resultObj: any) {
 *    return $$escape!(() => {
 *       const res = resultObj;
 *       if (res.is_err()) {
 *           return res;
 *       }
 *       return res.result;
 *   });
 * }
 *
 * const result = $try!({ value: 123 });
 * ```
 * ```ts --Result
 *  const res = { value: 123 };
 *  if (res.is_err()) {
 *       return res;
 *  }
 *  const a = res.result;
 * ```
 * @category Built-in Macros
 */
export declare function $$escape<T>(code: () => T) : T;


/**
 * Expands to an array with all the properties of a type.
 * 
 * ```ts --Call
 * console.log($$propsOfType!<{a: string, b: number}>());
 * ```
 * ```ts --Result
 * console.log(["a", "b"]);
 * ```
 * @category Built-in Macros
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export declare function $$propsOfType<T>() : Array<string>;

/**
 * Turns a type to a string literal.
 * 
 * ```ts --Call
 * console.log($$typeToString!<[string, number]>());
 * ```
 * ```ts --Result
 * console.log("[string, number]")
 * ```
 * @category Built-in Macros
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export declare function $$typeToString<T>(
    /**
     * If provided, literals like "abc" will turn to "String", 123 to "Number", "true" to "Boolean", etc.
     * **The first letter of the type will ALWAYS be uppercase if this argument is set to true.**   
     * **Objects and tuples do not get simplified to Object / Array.**
     */
    simplify?: boolean,
    /**
     * If provided, the "null" and "undefined" types will be ignored, so "string | undefined" will turn to "string".
     */
    nonNull?: boolean
) : string;

/**
 * This macro allows you to run typescript code during transpilation. It should only be used as an expression statement, because it expands to nothing. Additionally, you **cannot** use macros inside the arrow function's body.
 * 
 * ```ts
 * $$comptime!(() => {
 * // This will be logged when you're transpiling the code
 * console.log("Hello World!");
 * });
 * ```
 * 
 * If this macro is used inside a function (can be any type of function - arrow function, function declaration, constructor, method, getter, setter, etc.), it will be ran for every **visible** call to the function (so if the function is called inside a loop or an interval, the arrow function will be called once).
 * 
 * ```ts
 * class User {
 * 
 *     send(message: string) {
 *        $$comptime!(() => {
 *             console.log("User#send was called somewhere!");
 *         });
 *     }
 * }
 * 
 * const me = new User();
 * me.send(); // Logs "User#send was called somewhere!" during transpilation
 * me.send(); // And again...
 * me.send(); // And again...
 * 
 * for (let i=0; i < 10; i++) {
 *     me.send(); // And again... only once though!
 * }
 * ```
 * 
 * Also, you can access the function's parameters as long as they are **literals**:
 * 
 * ```ts
 * const greet = (name: string) => {
 *     $$comptime!(() => {
 *         console.log(`Hello ${name}`);
 *     });
 * }
 * 
 * greet("Michael"); // Logs "Hello Michael" during transpilation
 * let name: string = "Bella";
 * greet(name); // Logs "Hello undefined"
 * ```
 * 
 * Remember, this works only with literals like `"ABC"`, `34`, `true`, `[1, 2, 3]`, `{a: 1, b: 2}`.
 * 
 * You can also call other functions within it, but the functions must not have use any outside variables. 
 * 
 * This macro is especially useful when you want to validate a function argument during compile-time:
 * 
 * ```ts
 * function send(msg: string) {
 *    $$comptime!(() => {
 *         if (!msg.startsWith("C")) console.log("Message must start with C.");
 *     });
 * }
 * 
 * send("ABC")
 * ```
 * @category Built-in Macros
 */
export declare function $$comptime(fn: () => void) : void;

export interface RawContext {
    ts: typeof ts,
    factory: ts.NodeFactory,
    transformer: MacroTransformer,
    checker: ts.TypeChecker,
    thisMacro: MacroExpand,
    error: (node: ts.Node, message: string) => void
}

/**
 * Allows you to interact with the raw typescript AST by passing an arrow function which will be invoked
 * during the transpilation process, much like the [[$$comptime]] macro, except this macro gives you
 * access to the parameters as AST nodes, not actual values.
 * 
 * This macro can only be used inside other macros, and the parameters of the arrow function should
 * match the macro's, except in AST form. The only exception to this are rest operators, those get
 * turned into an array of expressions.
 * 
 * The first parameter of the function is a [[RawContext]], which gives you access to the everything
 * exported by typescript so you don't have to import it.
 * 
 * Use the high-level tools provided by ts-macros if possible - they're easier to read and understand,
 * they're more concise and most importantly you won't be directly using the typescript API which changes
 * frequently.
 * 
 * @example
 * ```ts
 * import * as ts from "typescript";
 * // raw version
 * function $addNumbers(...numbers: Array<number>) {
 *   return $$raw!((ctx: RawContext, numsAst: Array<ts.Expression>) => {
 *     return numsAst.slice(1).reduce((exp, num) => ctx.factory.createBinaryExpression(exp, ctx.ts.SyntaxKind.PlusToken, num), numsAst[0]);
 *  });
 * }
 * 
 * // ts-macros version
 * function $addNumbers(...numbers: Array<number>) {
 *  return +["+", [numbers], (num) => num]
 * }
 * ```
 * @category Built-in Macros
 */
export declare function $$raw<T>(fn: (ctx: RawContext, ...args: any[]) => ts.Node | ts.Node[] | undefined) : T;

/**
 * Expands to a string literal of the expression. If the transformation is not possible, it expands to `undefined`.
 * 
 * Expressions that can be transformed:
 * 
 * - string literals
 * - identifiers
 * - numeric literals
 * - true / false
 * - undefined
 * - null
 * 
 * @category Built-in Macros
 */
export declare function $$text(exp: any) : string;

/**
 * Stores the expression `value` in `key`. Storage is **not** persistent,
 * it won't stay across macro calls.
 * 
 * @category Built-in Macros
 * @deprecated
 */
export declare function $$setStore(key: string, value: any) : void;

/**
 * Expands to the stored expression at `key`. If a key hasn't been found,
 * it will expand to `null`.
 * 
 * @category Built-in Macros
 * @deprecated
 */
export declare function $$getStore<T>(key: string) : T;


/**
 * Separates the passed expression to individual nodes, and expands to an array literal with the nodes inside of it.
 * 
 * **Doesn't work on expressions which can contain statements, such as function expressions.**
 * 
 * @example
 * ```ts --Macro
 * // Stringifies the passed expression without using any typescript API
 * function $stringify(value: any) : string {
 *   // Store the array literal in a macro variable
 *   const $decomposed = $$decompose!(value);
 *   if ($$kindof!(value) === ts.SyntaxKind.PropertyAccessExpression) return $stringify!($decomposed[0]) + "." + $stringify!($decomposed[1]);
 *   else if ($$kindof!(value) === ts.SyntaxKind.CallExpression) return $stringify!($decomposed[0]) + "(" + (+["+", [$$slice!($decomposed, 1)], (part: any) => {
 *       const $len = $$length!($decomposed) - 2;
 *       return $stringify!(part) + ($$i!() === $len ? "" : ", ");
 *   }] || "") + ")";
 *   else if ($$kindof!(value) === ts.SyntaxKind.StringLiteral) return "\"" + value + "\"";
 *   else return $$text!(value);
 * }
 * ```
 * ```ts --Call
 * $stringify!(console.log(1, 2, console.log(3)));
 * ```
 * ```ts --Result
 * "console.log(1, 2, console.log(3))";
 * ```
 * @category Built-in Macros
 */
export declare function $$decompose(exp: any) : any[];

/**
 * Goes over all nodes of an expression and all it's children recursively, calling `mapper` for each node and replacing it
 * with the result of the function, much like `Array#map`.
 * 
 * If `mapper` expands to `null` or nothing, the node doesn't get replaced.
 * 
 * The first parameter of the mapper function is the expression that's currently being visited, and the second
 * parameter is the **kind** of the expression.
 * 
 * @example
 * ```ts --Macro
 * function $$replaceIdentifiers(exp: any, identifier: string, replaceWith: string) : any {
 *  return $$map!(exp, (value, kind) => {
 *     if (kind === ts.SyntaxKind.Identifier && $$text!(value) === identifier) return $$ident!(replaceWith);
 *  });
 * }
 * ```
 * ```ts --Call
 * $$replaceIdentifiers!(console.log(1), "log", "debug");
 * const fn = $$replaceIdentifiers!((arr: number[]) => {
 *   for (const item of arr) {
 *      console.info(item);
 *   }
 * }, "console", "logger");
 * ```
 * ```ts --Result
 * console.debug(1);
 * const fn = (arr) => {
 *   for (const item of arr) {
 *       logger.info(item);
 *   }
 * };
 * ```
 * @category Built-in Macros
 */
export declare function $$map<T>(exp: T, mapper: (value: any, kind: number) => any) : T;


/**
 * Checks if type `T` is assignable to type `K`.
 * 
 * @category Built-in Macros
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export declare function $$typeAssignableTo<T, K>() : boolean;

/**
 * A parameter which increments every time the macro is called. You can only have one accumulator parameter per macro.
 * 
 * ```ts --Macro
 * import { Accumulator } from "ts-macros"
 * 
 * function $num(acc: Accumulator = 0) : Array<number> {
 *     acc;
 * }
 * ```
 * ```ts --Call
 * $num!();
 * $num!();
 * $num!();
 * ```
 * ```ts --Result
 * 0
 * 1
 * 2
 * ```
 */
export type Accumulator = number & { __marker?: "Accumulator" };

/**
 * Saves the provided expression in a hygienic variable. This guarantees that the parameter will expand to an identifier. The declaration statement is also not considered part of the expanded code.
 * 
 * ```ts --Macro
 * function $map(arr: Save<Array<number>>, cb: Function) : Array<number> {
 *     const res = [];
 *     for (let i=0; i < arr.length; i++) {
 *         res.push($$inlineFunc!(cb, arr[i]));
 *     }
 *     return $$ident!("res");
 * }
 * ```
 * ```ts --Call
 * {
 *     const mapResult = $map!([1, 2, 3, 4, 5], (n) => console.log(n));
 * }
 * ```
 * ```ts --Result
 * {
 *     let arr_1 = [1, 2, 3, 4, 5];
 *     const mapResult = (() => {
 *         const res = [];
 *         for (let i = 0; i < arr_1.length; i++) {
 *             res.push(console.log(arr_1[i]));
 *         }
 *         return res;
 *     })();
 * }
 * ```
 */
export type Save<T> = T & { __marker?: "Save" };

export type EmptyDecorator = (...props: any) => void;

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