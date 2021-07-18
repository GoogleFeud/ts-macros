function $test(double: boolean, ...nums: Array<number>)  {
    +["[]", (nums: number) => nums * (double ? 2:1)]
}

function $test2(double: boolean, ...nums: Array<number>) {
    if (double) +["[]", (nums: number) => nums * 2];
    else +["[]", () => nums];
}

$test!(true, 1, 2, 3); // Transpiles to: [2, 4, 6]
$test2!(true, 1, 2, 3); // // Transpiles to: [2, 4, 6]

const val = false;
$test!(val, 1, 2, 3) // Transpiles to: [1 * (val ? 2:1), 2 * (val ? 2:1), 3 * (val ? 2:1)]