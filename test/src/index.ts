import { } from "../../dist";

function $doSmth3(obj: { a: { b: [{c: Array<string>}] }}, ...nums: Array<number>) {
    +[[obj.a.b[0].c], (str: string) => str + nums];
}

const a = 44;


$doSmth3!({a: { b: [{c: ["A", "B", "C", "D", "E"]}]}}, 1, 2, 3, 4)