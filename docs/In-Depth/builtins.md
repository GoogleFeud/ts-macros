---
name: Built-in macros
order: 7
---

# Built-in macros

ts-docs provides you with a lot of useful built-in macros which you can use inside macros.

|> Important: You cannot chain built-in macros!

## $$loadEnv

Loads an env file from the provided path, or from the base directory of your project (aka where `package.json` is). The macro loads the enviourment variables in the output AND while typescript is transpiling your code. This means expressions like `process.env.SOME_CONFIG_OPTION` in macro bodies will be replaced with the literal value of the enviourment variable.

```ts --Macro
import { $$loadEnv } from "ts-macros";
$$loadEnv!();

function $multiply(num: number) : number {
    process.env.TRIPLE === "yes" ? num * 3 : num * 2;
}

[$multiply!(1), $multiply!(2), (3).$multiply!()];
```
```js --Result
require("dotenv").config();
[3, 6, 9];
```
``` --Env
TRIPLE=yes
```

## $$loadJSONAsEnv

Loads a JSON object and puts all properties in the process.env object. Since that object can only contain strings, it's not recommended to put arrays or other complex objects inside the JSON. Works the same way as [[$$loadEnv]]. This macro only loads the properties inside the JSON during the transpilation process - you won't find the properties if you run the transpiled code.

```ts --Macro
import { $$loadJSONAsEnv } from "ts-macros";
$$loadJSONAsEnv!("config.json");

function $debug(exp: unknown) : void {
    if (process.env.debug === "true") console.log(exp);
}

$debug!(1 + 1);
```
```js --Result
// Empty!
```
```json --Env
{ debug: false }
```

## $$kindof

Expands to the `kind` of the AST node. Useful for when you want to do something which depends on what the provided argument is.

```ts --Macro
import {$$kindof} from "ts-macros";
import * as ts from "typescript"

function $doSomethingBasedOnTypeOfParam(param: unknown) {
    if ($$kindof!(param) === ts.SyntaxKind.ArrayLiteralExpression) "Provided value is an array literal!";
    else if ($$kindof!(param) === ts.SyntaxKind.ArrowFunction) "Provided value is an arrow function!";
    else if ($$kindof!(param) === ts.SyntaxKind.CallExpression) "Provided value is a function call!";
}
```
```ts --Call
$doSomethingBasedOnTypeOfParam!([1, 2, 3]);
$doSomethingBasedOnTypeOfParam!(console.log(1));
$doSomethingBasedOnTypeOfParam!(() => 1 + 1);
```
```js --Result
"Provided value is an array literal!";
"Provided value is a function call!";
"Provided value is an arrow function!";
```

## $$inlineFunc

Inlines the provided arrow function, replacing any argument occurrences with the corresponding values inside the `argReplacements` array.

```ts --Macro
import { $$inlineFunc, $$kindof } from "ts-macros";
import * as ts from "typescript"

function $map(arr: Array<number>, cb: Function) : Array<number> {
    if ($$kindof!(arr) !== ts.SyntaxKind.Identifier) var arr = arr; // Only declare a variable if the `arr` argument is not a variable
    const res = [];
    for (let i=0; i < arr.length; i++) {
       res.push($$inlineFunc!(cb, arr[i]));
    }
    return res;
}
```
```ts --Call
console.log($map!([1, 2, 3, 4, 5], (num: number) => num * 2));
```
```js --Result
console.log((() => {
    var arr = [1, 2, 3, 4, 5];
    const res = [];
    for (let i = 0; i < arr.length; i++) {
        res.push(arr[i] * 2);
    }
    return res;
})());
```

## $$const

Creates a const variable with the provided name and initializer. This is not hygienic, use it when you want to create a variable and know it's name.

```ts --Usage
import { $$const } from "ts-macros";

$$const!("abc", 123);
```
```js --Result
const abc = 123;
```

## $$i

If this macro is called in a repetition, it's going to return the number of the current iteration. If it's called outside, it's going to return `-1`.

```ts --Macro
import { $$i } from "ts-macros";

function $arr(...els: Array<number>) {
    +["[]", (els: number) => els + $$i!()];
}
```
```ts --Call
$arr!(1, 2, 3);
```
```ts --Result
[1, 3, 5]
```

## $$length

Gets the length of an array literal.

```ts --Macro
import { $$arr } from "ts-macros";

function $arr(...els: Array<number>) {
    $$length!(els);
}
```
```ts --Call
$arr!(1, 2, 3, 4, 5);
```
```ts --Result
5
```

## $$ident

Turns a string literal into an identifier.

```ts --Usage
import { $$ident } from "ts-macros";

const Hello = "World";
console.log($$ident!("Hello"));
```
```js --Result
const Hello = "World";
console.log(Hello);
```

## $$panic

Throws an error during transpilation.

```ts --Macro
import { $$panic, $$kindof } from "ts-macros";
import * as ts from "typescript";

function $$send<T>(msg: string, obj: T) {
    if ($$kindof!(msg) !== ts.SyntaxKind.StringLiteral) $$panic!("Expected string literal, found something else.");
    // Other stuff
} 
```
```ts --Call
$$send!(123, {});
```
``` --Result
Error: In macro $$send: Expected string literal, found something else.
```