/* eslint-disable */


function $test(...a: Array<number>) : void {
    //@ts-expect-error
    +("+")(a)
}

function $test2(a: any, b: any) {
    1 + 2;
}