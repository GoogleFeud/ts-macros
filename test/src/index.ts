import { $$includes } from "../../dist";

function $test(a: number, b: Array<number>) {
    +[[b], (num: number) => num * a];
}
///console.log($$includes!(123, 3));

console.log($test!(2, [1, 2, 3]));
$test!(2, [1, 2, 3]);