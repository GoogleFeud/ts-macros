import { AsRest } from "../../dist";

function $doSmth(obj: AsRest<Array<number>>) {
    +["+", () => obj]
}

const a = 44;
$doSmth!([1, 2, 3, 4, 5, a]);