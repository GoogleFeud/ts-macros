"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const { $$const } = require("../../../../dist/index");
describe("$$const", () => {
    it("Define a constant", () => {
        const testVar = 123;
        (0, chai_1.expect)(testVar).to.be.equal(123);
        const testVar1 = (a, b) => a + b;
        (0, chai_1.expect)(testVar1(1, 10)).to.be.equal(11);
    });
});
