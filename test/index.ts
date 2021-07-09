/* eslint-disable */


function $random(...nums: Array<number>) {
    +["+", () => (nums as unknown as number) + (nums as unknown as number)] // The [] separator puts everything in an array
}

$random!(1, 2, 3); // Transpiles to: [1 * Math.random() << 0, 2 * Math.random() << 0, 3 * Math.random() << 0]