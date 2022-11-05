---
name: Expanding macros
order: 3
---

# Expanding macros

Every macro **expands** into the code that it contains. How it'll expand depends entirely on how the macro is used. Javascript has 3 main constructs: `Expression`, `ExpressionStatement` and `Statement`. Since macro calls are plain function calls, macros can never be used as a statement.

|> Expanded macros are **always** hygienic!

## ExpressionStatement

If a macro is an `ExpressionStatement`, then it's going to be "flattened" - the macro call will literally be replaced by the macro body, but all the new declared variables will have their names changed to a unique name.

```ts --Macro
function $map<T, R>(arr: Array<T>, cb: (el: T) => R) : Array<R> {
    const array = arr; 
    const res = [];
    for (let i=0; i < array.length; i++) {
       res.push(cb(array[i]));
    }
    return res;
}
```
```ts --Call
$map!([1, 2, 3], (num) => num * 2); // This is an ExpressionStatement
```
```js --Result
const array_1 = [1, 2, 3];
const res_1 = [];
for (let i_1 = 0; i_1 < array_1.length; i_1++) {
    res_1.push(((num) => num * 2)(array_1[i_1]));
}
array_1;
```

You may have noticed that the return statement got omitted from the final result. `return` will be removed **only** if the macro is ran in the global scope. Anywhere else and `return` will be there.

## Expression

Expanding inside an expression can do two different things depending on the what the macro expands to.

### Single expression

If the macro expands to a single expression, then the macro call is directly replaced with the expression.

```ts --Macro
function $push(array: Array<number>, ...nums: Array<number>) : number {
    return +["()", (nums: number) => array.push(nums)];
}
```
```ts --Call
const arr: Array<number> = [];
const newSize = $push!(arr, 1, 2, 3);
```
```js --Result
const arr = [];
const newSize = (arr.push(1), arr.push(2), arr.push(3));
```

`return` gets removed if the macro is used as an expression.

### Multiple expressions

If the macro expands to multiple expressions, or has a statement inside it's body, then the body is wrapped inside an IIFE (Immediately Invoked function expression) and the last expression gets returned automatically.

```ts --Macro
function $push(array: Array<number>, ...nums: Array<number>) : number {
    +[(nums: number) => array.push(nums)];
}
```
```ts --Call
const arr: Array<number> = [];
const newSize = $push!(arr, 1, 2, 3);
```
```js --Result
const arr = [];
const newSize = (() => {
    arr.push(1)
    arr.push(2)
    return arr.push(3);
})();
```

#### Escaping the IIFE

If you want part of the code to be ran **outside** of the IIFE (for example you want to `return`, or `yield`, etc.) you can use the [[$$escape]] built-in macro. For example, here's a fully working macro which expands to a completely normal if statement, but it can be used as an expression:

```ts --Macro
function $if<T>(comparison: any, then: () => T, _else?: () => T) {
    return $$escape!(() => {
        var val;
        if ($$kindof!(_else) === ts.SyntaxKind.ArrowFunction) {
            if (comparison) {
                val = $$escape!(then);
            } else {
                val = $$escape!(_else!);
            }
        } else {
            if (comparison) {
                val = $$escape!(then);
            }
        }
        return val;
    });
}
```
```ts --Call
const variable: number = 54;
console.log($if!<string>(1 === variable, () => {
    console.log("variable is 1");
    return "A";
}, () => {
    console.log("variable is not 1");
    return "B";
}));
```
```ts --Result
const variable = 54;
var val_1;
if (1 === variable) {
    // Do something...
    console.log("variable is 1");
    val_1 = "A";
}
else {
    console.log("variable is not 1");
    val_1 = "B";
}
console.log(val_1);
```