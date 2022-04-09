import { } from "../../dist";

function $add(calls: Array<Function>) {
   +["()", [calls], (callFn: Function) => callFn()];
}

const fnA = () => console.log(1);
$add!([fnA, () => console.log("B")]);