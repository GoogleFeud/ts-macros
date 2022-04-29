---
name: Markers
order: 6
---

# Markers

`Markers` make macro parameters behave differently. They don't alter the parameter's type, but it's behaviour.

## Accumulator

A parameter which increments every time the macro is called. You can only have one accumulator parameter per macro.

```ts --Macro
import { Accumulator } from "ts-macros"

function $num(acc: Accumulator = 0) : Array<number> {
    acc;
}
```
```ts --Call
$num!();
$num!();
$num!();
```
```ts --Result
0
1
2
```

## Var

Acts like a variable. You can save any expression into it, and when you reference it the saved expression is inserted instead.

```ts --Macro
import { Var, $$kindof } from "ts-macros";
import { SyntaxKind } from "typescript";

function $num(name: string|number, variable?: Var<string|number>) : string  {
    if ($$kindof!(name) === SyntaxKind.StringLiteral || $$kindof!(name) === SyntaxKind.Identifier) variable = "Hi";
    else variable = 10;
    return name + (variable as string);
} 
```
```ts --Call
$num!("Hello");
$num!(25);
const variable = 30; 
$num!(variable);
```
```js --Result
"HelloHi";
35;
const variable = 30;
"30Hi";
```

## Save

Saves the provided expression in a hygienic variable. This guarantees that the parameter will expand to an identifier. The declaration statement is also not considered part of the expanded code.

```ts --Macro
function $map(arr: Save<Array<number>>, cb: Function) : Array<number> {
    const res = [];
    for (let i=0; i < arr.length; i++) {
        res.push($$inlineFunc!(cb, arr[i]));
    }
    return $$ident!("res");
}
```
```ts --Call
{
    const mapResult = $map!([1, 2, 3, 4, 5], (n) => console.log(n));
}
```
```ts --Result
{
    let arr_1 = [1, 2, 3, 4, 5];
    const mapResult = (() => {
        const res = [];
        for (let i = 0; i < arr_1.length; i++) {
            res.push(console.log(arr_1[i]));
        }
        return res;
    })();
}
```