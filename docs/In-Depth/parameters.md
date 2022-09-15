---
name: Parameters
order: 2
---

# Macro parameters

By default, all parameters are replaced **literally** when the macro is expanding. For examle, if you pass an array literal to a macro, all uses of that parameter will be replaced with the EXACT array literal:

```ts --Macro
function $loop(arr: Array<number>, cb: (element: number) => void) {
    for (let i=0; i < arr.length; i++) {
        cb(arr[i]);
    }
}
```
```ts --Call
$loop!([1, 2, 3, 4, 5], (el) => console.log(el)); 
```
```ts --Result
for (let i = 0; i < [1, 2, 3, 4, 5].length; i++) {
    ((el) => console.log(el))([1, 2, 3, 4, 5][i]);
}
```

To avoid this, you can assign the literal to a variable, or use the [[Save]] marker.

```ts --Macro
function $loop(arr: Array<number>, cb: (element: number) => void) {
    const array = arr;
    for (let i=0; i < array.length; i++) {
        cb(array[i]);
    }
}
```
```ts --Call
$loop!([1, 2, 3, 4, 5], (el) => console.log(el));
```
```ts --Result
const array_1 = [1, 2, 3, 4, 5];
for (let i_1 = 0; i_1 < array_1.length; i_1++) {
    ((el) => console.log(el))(array_1[i_1]);
}
```