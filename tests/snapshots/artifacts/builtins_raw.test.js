"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const { $$raw } = require("../../../../dist/index");
describe("$$raw", () => {
    it("To run the raw code", () => {
        (0, chai_1.expect)("hello").to.be.equal("hello");
        (0, chai_1.expect)("12345").to.be.deep.equal("12345");
        const str = "abc";
        (0, chai_1.expect)(null).to.be.deep.equal(null);
    });
});
