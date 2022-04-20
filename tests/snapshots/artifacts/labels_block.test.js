"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const { $$inlineFunc } = require("../../../../dist/index");
describe("Block label marker", () => {
    it("To transpile to the correct statement", () => {
        (0, chai_1.expect)(() => {
            try {
                throw new Error("This shouldn't throw!");
            }
            catch (err) { }
            ;
        }).to.not.throw();
    });
});
