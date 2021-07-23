
function $test(a: string) {
    if (a === "hello") console.log(true);
    else console.log(false);
}

const a = "hello";

$test!(a);