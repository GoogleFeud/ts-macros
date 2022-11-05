---
name: Chaining Macros
order: 2
---

# Chaining macros

Macros can also be **chained** with any javascript expression. This doesn't sit well with the typescript compiler, so you'll have to create types for the macros yourself by creating custom types. Here's an example of a vector data type, except the inner data of the vector is completely hidden - macros are used to abstract away the underlying data source - the array. As you can see, there's no trace of the `Vector` in the compiled code.

```ts --Macros
export namespace Vector {
    export function $new(): Vector {
        return [0, 0] as unknown as Vector;
    }
}

export interface Vector {
    $x(): number;
    $y(): number;
    $add(x?: number, y?: number): Vector;
}

export function $data(v: Vector) : [number, number] {
    return v as unknown as [number, number];
}

export function $x(v: Vector): number {
    return $data!(v)[0];
}

export function $y(v: Vector): number {
    return $data!(v)[1];
}

export function $add(v: Vector, x?: number, y?: number) : Vector {
    return [$data!(v)[0] + (x || 0), $data!(v)[1] + (y || 0)] as unknown as Vector;
}

const myVec = Vector.$new!();
const addedVec = myVec.$add!(1, 2);
console.log(addedVec.$x!(), addedVec.$y!(), $asVec!([1, 2]).$x!());
```
```ts --Result
const myVec = [0, 0];
const addedVec = [myVec[0] + (1), myVec[1] + (2)];
console.log(addedVec[0], addedVec[1], 1);
```

## Macro resolution

The ts-macros transformer keeps tracks of macros using their unique **symbol**. Since you must declare the type for the macros yourself (see the `Vector` example above), the macro function declaration and the type declaration do not share a symbol, so the transformer needs another way to see which macro you're really trying to call. 

This is why the transformer compares the types of the parameters from the macro call site to all macros of the same name. Two types are considered equal if the type of the argument is **assignable** to the macro parameter type. For example:

```ts
// ./A
function $create(name: string, age: number) { ... }
// ./B
function $create(id: string, createdAt: number) { ... }
```

These two macros are perfectly fine, it's ok that they're sharing a name, the transformer can still differenciate them when they're used like this:

```ts
import { $create } from "./A";
import { $create as $create2 } from "./B";

$create!("Google", 44); // Valid
$create2!("123", Date.now()) // Valid
```

**However**, when either of the macros get used in chaining, the transformer is going to raise an error, because both macros have the exact same parameter types, in the exact same order - `string`, `number`.

The only ways to fix this are to either:

- Rename one of the macros
- Switch the order of the parameters
- Possibly brand one of the types