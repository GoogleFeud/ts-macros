import { AsRest } from "../../src";

function $random(...nums: Array<number>) {
    +["[]", (nums: number) => nums * Math.random() << 0] // The [] separator puts everything in an array
}

$random!(1, 2, 3);