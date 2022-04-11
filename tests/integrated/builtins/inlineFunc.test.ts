
import ts from "typescript";
import { expect } from "chai";

const { $$inlineFunc } = require("../../../../dist/index");

describe("$$inlineFunc", () => {
    
    it("Inline the function and replace the arguments", () => {
        expect($$inlineFunc!((a, b) => a + b, 1, 5)).to.be.equal(6);
        expect($$inlineFunc!((a: Array<string>, b: string) => a.push(b), ["a", "b", "c"], "d")).to.be.deep.equal(4);
    });

    it("Wrap the function in an IIFE", () => {
        expect($$inlineFunc!((a, b) => {
            let acc = 0;
            for (let i=a; i < b; i++) {
                acc += i;
            }
            return acc;
        }, 1, 10)).to.be.equal(45);
    });

});
