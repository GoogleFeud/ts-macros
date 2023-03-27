---
name: Chaining macros
order: 3
---

# Chaining macros

Let's create a simple macro which takes any possible value and compares it with other values of the same type:

```ts
function $contains<T>(value: T, ...possible: Array<T>) {
    return +["||", [possible], (item: T) => value === item];
}
```

We can call the above macro like a normal funcion, except with an exclamation mark (`!`) after it's name:

```ts
const searchItem = "google";
$contains!(searchItem, "erwin", "tj");
```

This is one way to call a macro, however, the ts-macros transformer allows you to also call the macro as if it's a property of a value - this way the value becomes the first argument to the macro:

```ts
searchItem.$contains!("erwin", "tg");
// Same as: $contains!(searchItem, "erwin", "tj");
```

If we try to transpile this code, typescript is going to give us a `TypeError` - `$contains` is not a member of type `String`. When you're calling the macro like a normal function, typescript and the transformer are able to trace it to it's definition thanks to it's `symbol`. They're internally connected, so the transpiler is always going to be able to find the macro.

When we try to chain a macro to a value, neither the transpiler or the transformer are able to trace back the identifier `$contains` to a function definiton. The transformer fixes this by going through each macro it knows with the name `$contains` and checking if the types of the parameters of the macro match the types of the passed arguments. To fix the typescript error we can either put a `//@ts-expect-error` comment above the macro call or modify the `String` type via ambient declarations:

```ts
declare global {
    interface String {
        $contains(...possible: Array<string>) : boolean;
    }
}
```

Now if we run the code above in the [playground](https://googlefeud.github.io/ts-macros/playground/?code=KYDwDg9gTgLgBAbwL4G4BQaAmwDGAbAQymDgHM8IAjAvRNOBuASwDsZgoAzAnEgZRhRWpOozFwAJDghsCrAM4AKAHSrI8+U0p5gALjgBBKFAIBPADzzBwgHwBKOPsoQIOgi3Rikab2k4BXFhwYJhlJaVkFcwAVG0UANxp-PThogBo4VWV1TW0UoxMLWIcEekZiGH8oFjgAagBtACIAH2bGjPqcrR0AXQzFJnYAW31ohwBeGzhEvGS4cYXmYZ70XwirOHlgIhwACwBJYfm4RtIXcmBG9C2dg+HlKRkYORZ5AEJFRo4Ad1Z2k5gpEadhQQA) we aren't going to get any errors and the code will transpile correctly!

## Transparent types

On paper this sounds like a nice quality of life feature, but you can use it for something quite powerful - transparent types. You are able to completely hide away a data source behind a type which in reality doesn't represent anything, and use macros to access the data source. Below are some ideas on how these transparent types could be used.

### Vector type

A a `Vector` type which in reality is just an array with two elements inside of it (`[x, y]`):

```ts --Macros
// This represent s our data source - the array.
interface Vector {
    $x(): number;
    $y(): number;
    $data(): [number, number];
    $add(x?: number, y?: number): Vector;
}

// Namespaces allow us to store macros
namespace Vector {
    // Macro for creating a new Vector
    export function $new(): Vector {
        return [0, 0] as unknown as Vector;
    }

    // Macro which transforms the transparent type to the real type
    export function $data(v: Vector) : [number, number] {
        return v as unknown as [number, number];
    }

    export function $x(v: Vector) : number {
        return $data!(v)[0];
    }
    
    export function $y(v: Vector) : number {
        return $data!(v)[1];
    }

    export function $add(v: Vector, x?: number, y?: number) : Vector {
        const $realData = $data!(v);
        return [$realData[0] + (x || 0), $realData[1] + (y || 0)] as unknown as Vector;
    }
}
```
```ts --Call
const myVector = Vector.$new!().$add!(1).$add!(undefined, 10);
console.log(myVector.$x!(), myVector.$y!());
```
```ts --Result
const myVector = [1, 10];
console.log(myVector[0], myVector[1]);
```

### Iterator type

An iterator transparent type which allows us to use chaining for methods like `$map` and `$filter`, which expand to a single for loop when the iterator is collected with `$collect`. Here the `Iter` type isn't actually going to be used as a value in the code, instead it's just going to get passed to the `$map`, `$filter` and `$collect` macros.

`$next` is not actually a macro but an arrow function which is going to contain all the code inside the for loop. `$map` and `$filter` modify this arrow function by adding their own logic inside of it after the old body of the function, and the `$collect` macro inlines the body function in the for loop.

```ts --Macros
interface Iter<T> {
    _arr: T[],
    $next(item: any) : T,
    $map<K>(mapper: (item: T) => K) : Iter<K>,
    $filter(fn: (item: T) => boolean) : Iter<T>,
    $collect() : T[]
}

namespace Iter {

    export function $new<T>(array: T[]) : Iter<T> {
        return {
            _arr: array,
            $next: (item) => {}
        } as Iter<T>;
    }

    export function $map<T, K>(iter: Iter<T>, mapper: (item: T) => K) : Iter<K> {
        return {
            _arr: iter._arr,
            $next: (item) => {
                $$inline!(iter.$next, [item]);
                item = $$escape!($$inline!(mapper, [item], true));
            }
        } as unknown as Iter<K>;
    }

    export function $filter<T>(iter: Iter<T>, func: (item: T) => boolean) : Iter<T> {
        return {
            _arr: iter._arr,
            $next: (item) => {
                $$inline!(iter.$next, [item]);
                if (!$$escape!($$inline!(func, [item], true))) $$ts!("continue");
            }
        } as Iter<T>;
    }

    export function $collect<T>(iter: Iter<T>) : T[] {
        return $$escape!(() => {
            const array = iter._arr;
            const result = [];
            for (let i=0; i < array.length; i++) {
                let item = array[i];
                $$inline!(iter.$next, [item]);
                result.push(item);
            }
            return result;
        });
    }
}
```
```ts --Call
const arr = Iter.$new!([1, 2, 3]).$map!(m => m * 2).$filter!(el => el % 2 === 0).$collect!();
```
```ts --Result
const array_1 = [1, 2, 3];
const result_1 = [];
for (let i_1 = 1; i_1 < array_1.length; i_1++) {
    let item_1 = array_1[i_1];
    item_1 = item_1 * 2;
    if (!(item_1 % 2 === 0))
        continue;
    result_1.push(item_1);
}
const myIter = arr;
```

## Details on macro resolution

The ts-macros transformer keeps tracks of macros using their unique **symbol**. Since you must declare the type for the macros yourself via ambient declarations, the macro function declaration and the type declaration do not share a symbol, so the transformer needs another way to see which macro you're really trying to call. 

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