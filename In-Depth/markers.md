---
name: Markers
order: 6
---

# Markers

`Markers` make macro parameters behave differently. They don't alter the parameter's type, but it's behaviour.

## AsRest

You can mark a parameter with the AsRest marker. The parameter will act exactly like a rest parameter, but instead of separating all values of the parameter with a comma, you put them all in an array. This way you can have multiple repetition arguments.

```ts --Macro
import { AsRest } from "ts-macros"

// This wouldn't work if the type was just Array<number>
function $random(nums: AsRest<Array<number>>) : Array<number> {
    +["[]", () => nums * Math.random() << 0]
} 
```
```ts --Call
$random!([1, 2, 3]);
```
```ts --Result
[1 * Math.random() << 0, 2 * Math.random() << 0, 3 * Math.random() << 0]
```

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

