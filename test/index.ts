/* eslint-disable */

function $inc(value: number) {
    value + 1;
}

function $contains(value: number, ...possible: Array<number>) {
    +["||", (possible: unknown) => $inc!(value) === possible];
}

$contains!(1, 1, 2, 3, 4, 5);