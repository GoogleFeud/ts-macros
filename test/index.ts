/* eslint-disable */

function $doubleNum(num: number) {
    num * 2
}

function $doubleAll(...nums: Array<number>) {
    +["[]", (nums: number) => $doubleNum!(nums)];
}

console.log($doubleAll!(1, 2, 3, 4, 5));