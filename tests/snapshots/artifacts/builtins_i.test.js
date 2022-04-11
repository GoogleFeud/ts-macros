"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const { $$i } = require("../../../../dist/index");
describe("$$i", () => {
    it("To be -1 when outside of repetition", () => {
        (0, chai_1.expect)(-1).to.be.equal(-1);
    });
    it("To be the index of repetitions", () => {
        (0, chai_1.expect)("a0b1c2").to.be.equal("a0b1c2");
    });
});
