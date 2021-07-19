import { $$inlineFunc } from "../../dist";
import { performance } from "perf_hooks";

function $map(arr: Array<number>, cb: Function) {
    const array = arr;
    const len = array.length;
    const res = [];
    for (let i=0; i < len; i++) {
       res.push($$inlineFunc!(cb, array[i]));
       //res.push(cb(array[i]));
    }
    res
}

const arrayToBeUsed = Array.from({length: 1000}, (_, index) => index + 1);


let before = performance.now();
const res1 = arrayToBeUsed.map(num => num * 2);
console.log(`Default: ${performance.now() - before}`)

before = performance.now();
//@ts-expect-error
const res = arrayToBeUsed.$map!((num: number) => num * 2);
console.log(`Macro: ${performance.now() - before}`);