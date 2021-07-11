/* eslint-disable */
/* @ts-ignore */

function $contains(value: number, ...possible: Array<number>) {
    function $inc(value: number) {
        value + 1;
    }
    +["||", (possible: unknown) => $inc!(value) === possible];
}

console.log($contains!(1, 1, 2, 3, 4, 5, 6, 7, 8)); 