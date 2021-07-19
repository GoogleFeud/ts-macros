import { $$inlineFunc, $$kindof } from "../../dist";
function $map(arr: Array<number>, cb: Function) {
    if ($$kindof!(arr) === 200) var arr = arr; // Only declare a variable if the `arr` argument is an array literal
    const res = [];
    for (let i=0; i < arr.length; i++) {
       res.push($$inlineFunc!(cb, arr[i]));
    }
    res
}

console.log($map!([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], (number: number) => number * 2));