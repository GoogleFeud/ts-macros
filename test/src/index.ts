import { AsRest, $$kindof, $$const } from "../../src";
import * as ts from "typescript";

class Test {
    readonly debug = true;
    constructor(debug: boolean) {
        //this.debug = debug;
    } 
}

function $log(cl: Test, msg: string) {
    if (cl.debug) console.log(msg);
}


const myTest = new Test(false);

$log!(myTest, "Hello World!");