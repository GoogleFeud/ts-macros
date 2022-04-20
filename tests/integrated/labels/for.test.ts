
import { expect } from "chai";
const { $$inlineFunc, $$define } = require("../../../../dist/index");


function $ForToWhile(info: any) {
    if (info.initializer.variables) {
        +[[info.initializer.variables], (variable: [string, any]) => {
            $$define!(variable[0], variable[1], true)
        }];
    }
    else info.initializer.expression;
    while(info.condition) {
        $$inlineFunc!(info.statement);
        info.increment;
    }
}

describe("For label marker", () => {

    it("To transpile to the correct statement", () => {
        const arr = [1, 3, 4, 5, 6];
        const arr2: Array<number> = [];

        $ForToWhile:
        for (let i=2, j=10; i < arr.length; i++) {
            arr2.push(i);
        }
        expect(arr2).to.be.deep.equal([2, 3, 4]);
        //@ts-expect-error
        expect(j).to.be.equal(10);
    });

});