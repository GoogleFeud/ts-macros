"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const typescript_1 = __importDefault(require("typescript"));
const { $$decompose, $$kindof, $$text, $$length, $$i, $$slice } = require("../../../../dist/index");
describe("$$decompose", () => {
    it("To stringify the expression", () => {
        (0, chai_1.expect)("console.log(123)").to.be.equal("console.log(123)");
        (0, chai_1.expect)("console.log(1, true, console.log(\"Hello\"))").to.be.equal("console.log(1, true, console.log(\"Hello\"))");
    });
});
