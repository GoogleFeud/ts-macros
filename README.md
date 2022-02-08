# ts-macros

`ts-macros` is a typescript transformer which makes it possible to create **function** macros in typescript! The macros are very similar to rust's `macro_types!` and are just as powerful!

All macro names must start with a dollar sign (`$`) and must be declared using the `function` keyword. Macros can then be called just like a normal function, but with a `!` after it's name: `macro!(params)`.

**Example:**

```ts
function $contains(value: unknown, ...possible: Array<unknown>) {
    +["||", (possible: unknown) => value === possible];
}

const searchItem = "google";
console.log($contains!(searchItem, "erwin", "tj")); 
// Transpiles to: console.log(searchItem === "erwin" || searchItem === "tj")
```

## Usage

### Install

```
npm i ts-macros
```

You must use the `ttypescript` package in order to use this. 

```
npm i ttypescript
```

After that put this in your tsconfig.json:

```js
"compilerOptions": {
//... other options
"plugins": [
        { "transform": "ts-macros" }
]
}
```

Then transpile your code with `ttsc`.

## ts-macros in depth

### Repetitions

*Syntax:* `+[separator?, () => codeToRepeat]`

Repetitions without separators cannot be used as `Expressions`. If a **rest parameter** is used in a repetition, it gets replaced by the value at the current repetition index, but if it's used outside of a repetition, then it's replaced by an array literal containing all the values. It's also possible to have repetitions inside repetitions.

**Example:**

```ts
function $random(...nums) {
    +["[]", () => nums * Math.random() << 0] // The [] separator puts everything in an array
}

$random!(1, 2, 3); // Transpiles to: [1 * Math.random() << 0, 2 * Math.random() << 0, 3 * Math.random() << 0]
```

#### Available separators

- `[]` - Puts all the values in an array
- `+` - Adds all the values
- `-` - Subtracts all the values
- `*` - Multiplies all the values
- `,` - Separates all expressions with a `,`
- `||` 
- `&&`

### Macro parameters

Initially, all parameters are **literally** replaced, for example, when you pass an array literal (`[1, 2, 3]`) to a macro, all uses of that parameter will be replaced with that EXACT array literal:

```ts
function $loop(arr: Array<number>, cb: (element: number) => void) {
    for (let i=0; i < arr.length; i++) {
        cb(arr[i]);
    }
}

$loop!([1, 2, 3, 4, 5], (el) => console.log(el)); 
//Transpiles to:
for (let i = 0; i < [1, 2, 3, 4, 5].length; i++) {
    ((el) => console.log(el))([1, 2, 3, 4, 5][i]);
}
```

To avoid this, you can do something called parameter overwriting: (you can use let and const as well!)

```ts
function $loop(arr: Array<number>, cb: (element: number) => void) {
    var arr = arr;
    for (let i=0; i < arr.length; i++) {
        cb(arr[i]);
    }
}

$loop!([1, 2, 3, 4, 5], (el) => console.log(el)); 
//Transpiles to:
var arr = [1, 2, 3, 4, 5];
for (let i = 0; i < arr.length; i++) {
    ((el) => console.log(el))(arr[i]);
}
```

### Hygiene

The macros are **always** hygienic!

Javascript has 3 main constructs: `Expression`, `ExpressionStatement` and `Statement`. Macro calls can never be `Statement`s, but:

**If a macro call is a `ExpressionStatement`, then it's going to get "flattened" - the macro call will literally be replaced by the macro body, but all the new declared variables will have their names changed to a unique name.**

```ts
function $map(arr, cb) {
   const array = arr; 
   const res = [];
   for (let i=0; i < array.length; i++) {
      res.push(cb(array[i]);
   }
}

$map!([1, 2, 3], (num) => num * 2); // This is an ExpressionStatement

// Transpiles to:
const array_1 = [1, 2, 3];
const res_1 = [];
for (let i_1 = 0; i_1 < array_1.length; i_1++) {
    res.push(((item) => item * 2)(array_1[i_1], i_1));
}
```

**If a macro call is in an `Expression` and it's body expands to a single expression then the call is replaced by the expression.**
```ts
function $push( ...nums: Array<number>) {
    +["[]", (nums: number) => nums * Math.random() << 0]
}

const rngNums = $push!(1, 2, 3); // Macro call is an expression here
// Transpiles to:
const rngNums = [1 * Math.random() << 0, 2 * Math.random() << 0, 3 * Math.random() << 0];
```

**If a macro call is in an `Expression` and it's body contains **more** than a single expression, or contains a `Statement`, then the body is wrapped in an IIFE, and the last expression will be returned.**
```ts
function $push(array: Array<number>, ...nums: Array<number>) {
    +[(nums: number) => array.push(nums)];
}

const arr: Array<number> = [];
const newSize = $push!(arr, 1, 2, 3);
// Transpiles to:
const arr = [];
const newSize = (() => {
    arr.push(1)
    arr.push(2)
    return arr.push(3);
})();
```

### Markers

`Markers` make macro parameters behave differently. They don't alter the parameter's type, but it's **behaviour**. 

#### `AsRest` 

You can mark a parameter with the `AsRest` marker. The parameter will act exactly like a rest parameter, but instead of separating all values of the parameter with a comma, you put them all in an array. This way you can have multiple repetition arguments. 

**Example:**
```ts
import { AsRest } from "ts-macros"

// This wouldn't work if the type was just Array<number>
function $random(nums: AsRest<Array<number>>) : Array<number> {
    +["[]", () => nums * Math.random() << 0]
} 

$random!([1, 2, 3]); // Transpiles to: [1 * Math.random() << 0, 2 * Math.random() << 0, 3 * Math.random() << 0]
```

#### `Accumulator`

A parameter which increments every time the macro is called. You can only have one accumulator parameter per macro.

**Example:**
```ts
import { Accumulator } from "ts-macros"

function $num(acc: Accumulator = 0) : Array<number> {
    acc;
} 

$num!(); // 0
$num!(); // 1
$num!(); // 2
```

#### `Var`

Acts like a variable. You can save any expression into it, and when you reference it the saved expression is inserted.

**Example:**
```ts
import { Var, $$kindof } from "ts-macros";
import { SyntaxKind } from "typescript";
function $num(name: string|number, variable?: Var<string|number>)  {
    if ($$kindof!(name) === SyntaxKind.StringLiteral || $$kindof!(name) === SyntaxKind.Identifier) variable = "Hi";
    else variable = 10;
    name + (variable as string);
} 

$num!("Hello") // "Hello" + "Hi"
$num!(25) // 25 + 10
const variable = 30; 
$num!(variable); // variable + "Hi"
```

### Strings as identifiers

If a parameter (or a repetition parameter) is a string literal, and a class / enum / function has the **exact** same name, then the name of the class is going to replaced with the contents of the string.

```ts
function $createClasses(values: AsRest<Array<number>>, ...names: Array<string>) {
    +[() => {
        class names {
            static value = values
        }
    }]
}

$createClasses!([1, 2], "A", "B"); 
// Transpiles to:
/*
class A {
}
A.value = 1;
class B {
}
B.value = 2;
*/
```

### Return in macros

`return` is allowed in macros, but you should only call the macro in functions so javascript doesn't throw an error.

```ts
function $sendAndReturn(message) {
    ctx.send(message);
    return false;
}

function handle(ctx) {
    // Some other code
    $sendAndReturn!();
}
```

### Calling other macros inside macros

Calling other macros is possible!

```ts
function $doubleNum(num) {
    num * 2
}

function $doubleAll(...nums) {
    +["[]", () => $doubleNum!(nums)];
}

$doubleAll!(1, 2, 3, 4, 5); // Transpiles to [2, 4, 6, 8, 10];
```

### If statements and ternary operators in macros

If the condition of a ternary operator / if statement inside a macro is one of the macro parameters, or an expression which can be simplified to a literal value, the entire ternary operation / if statement is going to be replaced:

```ts
function $test(double, ...nums) {
    +["[]", () => nums * (double ? 2:1)]
}

function $test2(double, ...nums) {
    if (double) +["[]", () => nums * 2];
    else +["[]", () => nums];
}

$test!(true, 1, 2, 3); // Transpiles to: [2, 4, 6]
$test2!(true, 1, 2, 3); // // Transpiles to: [2, 4, 6]

const val = false;
$test!(val, 1, 2, 3) // Transpiles to: [1, 2, 3]
```

You can also use the OR and AND operators in if statements because those get simplified as well.

### Comparing literals

```ts
function $cmp(a) {
    a === "google";
}

$cmp!("google"); // Transpiles to: true
$cmp!("tj"); // Transpiles to: false
```

### Adding / subtracting / multiplying / dividing literals

Number literals will automatically be added / subtracted / multiplied / divided.

```ts
function $add(...nums: Array<number>) {
    +["+", (nums: number) => nums];
} 

$add!(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15); // Transpiles to 120
```

### Chaining macros

It's possible to chain macros with any javascript object you want.

```ts
function $doubleNum(number: number) : number|void {
    number * number
}

(5).$doubleNum!(); // Transpiles to: 25
const someNum = 10;
someNum.$doubleNum!(); // Transpiles to: 100
```

### Exporting macros

You don't have to export macros in order to use them but it's recommended to do so to please the typescript compiler. Macro names are unqiue and if you have two macros with the same name inside your project, you'll get an "Macro X is already defined" error.

```ts
// Inside macros.ts
export function $calc(type: string, ...nums: Array<number>) : number|void {
    type === "+" ? +["+", (nums: number) => nums] :
    type === "-" ? +["-", (nums: number) => nums] : 
    type === "*" ? +["*", (nums: number) => nums] : 0;
}
```

```ts
// Inside index.ts
import {$calc} from "./macros";

const num = $calc!("*", 1, 2, 3, 4, 5); 
// Transpiles to: 
const num = 120;
```

### Macros inside macros

Not recommended, but possible. The inner-macros don't have access to any previous arguments, and you can call the macros even outside the macro it's defined in.

```ts
function $contains(value: number, ...possible: Array<number>) {
    function $inc(value: number) {
        value + 1;
    }
    +["||", (possible: unknown) => $inc!(value) === possible];
}

console.log($contains!(1, 1, 2, 3, 4, 5, 6, 7, 8)); 
console.log($inc!(4));
```

### Built-in macros

This library has a few built-in macros which utilize the lib's optimizing capabilities. 

**Important:** Built-in macros cannot be used with the dot notation `.`.

#### $$loadEnv(path?: string)

Loads an `env` file from the provided path, or from the base directory of your project (aka where `package.json` is). The macro loads the enviourment variables in the output AND while typescript is transpiling your code. This means expressions like `process.env.SOME_CONFIG_OPTION` in macro bodies will be replaced with the literal value of the enviourment variable.

**This macro requires you have the `dotenv` module installed. It doesn't come with the library by default.**

`.env`:
```
TRIPLE=yes
```

`index.ts`:
```ts
import { $$loadEnv } from "ts-macros";
$$loadEnv!();

function $multiply(num: number) : number {
    process.env.TRIPLE === "yes" ? num * 3 : num * 2;
}

[$multiply!(1), $multiply!(2), (3).$multiply!()];
```

`index.js`:
```js
require("dotenv").config();
[3, 6, 9];
```

#### $$loadJSONAsEnv(path: string)

Loads a JSON object and puts all properties in the `process.env` object. Since that object can only contain strings, it's not recommended to put arrays or other complex objects inside the JSON. Works the same way as `$$loadEnv`. This macro only loads the properties inside the JSON during the transpilation process - you won't find the properties if you run the transpiled code.

`config.json`:
```
{ debug: false }
```

`index.ts`:
```ts
import { $$loadJSONAsEnv } from "ts-macros";
$$loadJSONAsEnv!("config.json");

function $debug(exp: unknown) : void {
    if (process.env.debug === "true") console.log(exp);
}

$debug!(1 + 1);
```

`index.js`:
```js
```

#### $$kindof(ast: any) 

Expands to the `kind` of the AST node.

`index.ts`:
```ts
import {$$kindof} from "ts-macros";
import * as ts from "typescript"
function $doSomethingBasedOnTypeOfParam(param: unknown) {
    if ($$kindof!(param) === ts.SyntaxKind.ArrayLiteralExpression) "Provided value is an array literal!";
    else if ($$kindof!(param) === ts.SyntaxKind.ArrowFunction) "Provided value is an arrow function!";
    else if ($$kindof!(param) === ts.SyntaxKind.CallExpression) "Provided value is a function call!";
}
$doSomethingBasedOnTypeOfParam!([1, 2, 3]);
$doSomethingBasedOnTypeOfParam!(console.log(1));
$doSomethingBasedOnTypeOfParam!(() => 1 + 1);
```

`index.js`:
```js
"Provided value is an array literal!";
"Provided value is a function call!";
"Provided value is an arrow function!";
```

#### $$inlineFunc(func: ArrowFunction, ...argReplacements: Array<any>) 

Inlines the provided arrow function, replacing any argument occurrences with the corresponding values inside the `argReplacements` array.

`index.ts`:
```ts
import { $$inlineFunc, $$kindof } from "ts-macros";
function $map(arr: Array<number>, cb: Function) {
    if ($$kindof!(arr) === 200) var arr = arr; // Only declare a variable if the `arr` argument is an array literal
    const res = [];
    for (let i=0; i < arr.length; i++) {
       res.push($$inlineFunc!(cb, arr[i]));
    }
    res
}
console.log($map!([1, 2, 3, 4, 5], (num: number) => num * 2));
```

`index.js`:
```js
console.log((() => {
    var arr = [1, 2, 3, 4, 5];
    const res = [];
    for (let i = 0; i < arr.length; i++) {
        res.push(arr[i] * 2);
    }
    return res;
})());

```

#### $$const(varname: string, initializer: any)

Creates a const variable with the provided name and initializer. This is **not** hygienic, use it when you want to create a variable and know it's name. 

`index.ts`:
```ts
import { $$const } from "../../dist";

$$const!("abc", 123);
```

`index.js`:
```js
const abc = 123;
```

#### $$i()

If this macro is called in a repetition, it's going to return the number of the current iteration. If it's called outside, it's going to return `-1`.

`index.ts`
```ts
import { $$i } from "../../dist";

function $arr(...els: Array<number>) {
    +["[]", (els: number) => els + $$i!()];
}

$arr!(1, 2, 3);
```

`index.js`:
```js
[1, 3, 5]
```

#### $$length(arrLiteral: Array<any>)

Gets the length of an array literal.

`index.ts`
```ts
import { $$arr } from "../../dist";

function $arr(...els: Array<number>) {
    $$length!(els);
}

$arr!(1, 2, 3, 4, 5);
```

`index.js`
```js
5
```

#### $$ident(str: string)

Turns a string literal into an identifier.

`index.ts`
```ts
import { $$ident } from "../../dist";

function $identifier(str: string) {
    $$ident!(str);
}

$identifier!("Hello");
```

`index.js`
```js
Hello
```