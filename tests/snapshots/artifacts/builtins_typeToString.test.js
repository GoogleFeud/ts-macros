"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const { $$slice } = require("../../../../dist/index");
describe("$$typeToString", () => {
    it("Should stringify the type", () => {
        (0, chai_1.expect)("string").to.be.equal("string");
        (0, chai_1.expect)(false).to.be.equal(false);
        (0, chai_1.expect)(true).to.be.equal(true);
    });
});
