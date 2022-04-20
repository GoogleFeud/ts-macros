"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const typescript_1 = __importDefault(require("typescript"));
const { $$kindof } = require("../../../../dist/index");
;
describe("Var marker", () => {
    it("Return the right expression", () => {
        (0, chai_1.expect)("number").to.be.equal("number");
        (0, chai_1.expect)("string").to.be.equal("string");
        (0, chai_1.expect)("array").to.be.equal("array");
    });
});
