import { $$i, AsRest } from "../../dist";

function $doSmth(obj: Array<number>) {
    console.log(+["+", [obj], (thing: number) => thing]);
    console.log(+[[obj], (thing: number) => thing]);
    +[[obj, ["A", "B", "C"]], (thing: number) => {
        const a = thing + $$i!();
    }]
}

function $doSmth2(...obj: Array<number>) {
    //console.log(+["+", [obj], (thing: number) => thing]);
    //console.log(+[[obj], (thing: number) => thing])
    const a = +["+", () => obj]
}

const a = 44;
$doSmth!([1, 2, 3, 4, 5, a]);
$doSmth2!(1, 2, 3, 4, 5, a);