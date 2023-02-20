---
name: Markers
order: 7
---

# Markers

`Markers` make macro parameters behave differently. They don't alter the parameter's type, but it's behaviour.

## Accumulator

A parameter which increments every time the macro is called. You can only have one accumulator parameter per macro.

```ts --Macro
import { Accumulator } from "ts-macros";

function $num(acc: Accumulator = 0): Array<number> {
  acc;
}
```

```ts --Call
$num!();
$num!();
$num!();
```

```ts --Result
0;
1;
2;
```

## Save

Saves the provided expression in a hygienic variable. This guarantees that the parameter will expand to an identifier. The declaration statement is also not considered part of the expanded code.

```ts --Macro
function $map(arr: Save<Array<number>>, cb: Function): Array<number> {
  const res = [];
  for (let i = 0; i < arr.length; i++) {
    res.push($$inline!(cb, [arr[i]]));
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
