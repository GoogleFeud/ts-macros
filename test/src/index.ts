import type { AsRest } from "../../src";

function $test(classNames: AsRest<Array<string>>, ...names: Array<string>) {
    const test = names;
    +[() => {
        function classNames() {
            return +["[]", () => names]
        }
    }]
}

$test!(["A", "B", "C"], "a", "b", "c", "d");

function $random(nums: AsRest<Array<number>>) {
    +["[]", (nums: number) => nums * Math.random() << 0]
} 

$random!([1, 2, 3]); // Transpiles to: [1 * Math.random() << 0, 2 * Math.random() << 0, 3 * Math.random() << 0]

//@ts-expect-error asss
function $test2(thing: string) {
    //@ts-expect-error asss
    const thing = 5;
}

$test2!("aaaa");