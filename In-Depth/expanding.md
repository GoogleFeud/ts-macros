---
name: Expanding macros
order: 2
---

# Expanding macros

Every macro **expands** into the code that it contains. How it'll expand depends entirely on how the macro is used. This page covers all the ways a macro can be expanded. Javascript has 3 main constructs: `Expression`, `ExpressionStatement` and `Statement`. Since macro calls are plain function calls, macros can never be used as a statement, but...

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
    return +[",", (nums: number) => array.push(nums)];
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

If the macro expands to multiple expressions, or has a statement inside it's body, then the body is wrapped inside an IIFE (Immediately Invoked function expression) and the last expression gets returned.

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