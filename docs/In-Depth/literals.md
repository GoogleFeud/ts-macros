---
name: Literals
order: 6
---

# Literals

Literals in ts-macros are **very** powerful. When you use literals in macros, ts-macros is able to completely remove those literls and give you the final result. For example, adding two numeric literals:

```ts --Macro
function $add(numA: number, numB: number) : number {
    return numA + numB;
}
```
```ts --Call
$add!(5, 10);
```
```ts --Result
15
```

This works for almost all binary and unary operators.

## Logic

If the condition of an if statement / ternary expression is a literal, then the entire condition will be removed and only the resulting code will be expanded.

```ts --Macro
function $log(multiply: boolean, number: number) {
    console.log(multiply ? number * 2 : number);
}

// If version
function $log(multiply: boolean, number: number) {
    if (multiply) console.log(number * 2);
    else console.log(number);
}
```
```ts --Call
$log!(false, 10);
$log!(true, 15);
```
```ts --Result
console.log(10);
console.log(30);
```

## Object / Array access

Accessing object / array literals also get replaced with the literal. You can prevent this by wrapping the object / array in paranthesis.

```ts --Macro
function $add(param1: {
    user: { name: string }
}, arr: [number, string]) {
    return param1.user.name + arr[0] + arr[1];
}
```
```ts --Call
$add!({
    user: { name: "Google" }
}, [22, "Feud"]);
```
```js --Result
"Google22Feud";
```

## String parameters as identifiers

If a **string literal** parameter is used as a class / function / enum declaration, then the parameter name will be repalced with the contents inside the literal.

```ts --Macro
function $createClasses(values: Array<string>, ...names: Array<string>) {
    +[[values, names], (val, name) => {
        class name {
            static value = val
        }
    }]
}
```
```ts --Call
$createClasses!(["A", "B", "C"], "A", "B", "C")
```
```js --Result
class A {
}
A.value = "A";
class B {
}
B.value = "B";
class C {
}
C.value = "C";
```

## Spread expression

You can concat array literals with the spread syntax, like you do in regular javascript:

```ts --Macro
function $concatArrayLiterals(a: Array<number>, b: Array<number>) : Array<number> {
    return [...a, ...b];
}
```
```ts --Call
$concatArrayLiterals!([1, 2, 3], [4, 5, 6]);
```
```ts --Result
[1, 2, 3, 4, 5, 6];
```