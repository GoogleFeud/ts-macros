"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const { $$inline } = require("../../../../dist/index");
describe("If label marker", () => {
    it("To transpile to the correct statement", () => {
        let value = "test";
        value === "test" ? value = "other" : value = "other2";
        (0, chai_1.expect)(value).to.be.equal("other");
    });
});
