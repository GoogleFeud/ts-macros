"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const { $$inline } = require("../../../../dist/index");
describe("$$inlineFunc", () => {
    it("Inline the function and replace the arguments", () => {
        (0, chai_1.expect)(1 + 5).to.be.equal(6);
        (0, chai_1.expect)(["a", "b", "c"].push("d")).to.be.deep.equal(4);
    });
    it("Wrap the function in an IIFE", () => {
        (0, chai_1.expect)((() => {
            let acc = 0;
            for (let i = 1; i <
                10; i++) {
                acc += i;
            }
            return acc;
        })()).to.be.equal(45);
    });
});
