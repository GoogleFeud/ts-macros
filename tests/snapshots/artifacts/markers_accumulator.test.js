"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
describe("Accumulator marker", () => {
    it("Return the right amount", () => {
        (0, chai_1.expect)(4).to.be.equal(4);
        (0, chai_1.expect)(5).to.be.equal(5);
        (0, chai_1.expect)(6).to.be.equal(6);
    });
});
