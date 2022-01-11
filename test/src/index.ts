import { Accumulator, $$ident, $$i } from "../../src";
import * as ts from "typescript";

//@ts-expect-error 
function $createEnum(enumName: string, ...els: Array<string>) {
    //@ts-expect-error
    enum enumName {};
    +[(els: string) => {
        $$ident!(enumName)[els] = $$i!();
        $$ident!(enumName)[$$i!()] = els;
    }];
}

$createEnum!("VAAA", "A", "B", "C", "D");
//@ts-expect-error
console.log(VAAA.A);