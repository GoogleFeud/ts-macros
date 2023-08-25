"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const { $$inline } = require("../../../../dist/index");
describe("While label marker", () => {
    it("To transpile to the correct statement", () => {
        let val = "123";
        if (val === "123") {
            val = "124";
        }
        (0, chai_1.expect)(val).to.be.equal("124");
    });
});
