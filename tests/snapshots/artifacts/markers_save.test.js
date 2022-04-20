"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
describe("Save marker", () => {
    it("Return the right amount", () => {
        let thing_1 = 343;
        (0, chai_1.expect)((() => {
            thing_1 = 1;
            return thing_1;
        })()).to.be.equal(1);
        let thing_2 = 11;
        (0, chai_1.expect)((() => {
            thing_2 = 0;
            return thing_2;
        })()).to.be.equal(0);
        let thing_3 = 11;
        (0, chai_1.expect)(thing_3).to.be.equal(11);
    });
});
