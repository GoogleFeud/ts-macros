"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const typescript_1 = __importDefault(require("typescript"));
const { $$slice, $$kindof } = require("../../../../dist/index");
describe("$$slice", () => {
    it("To return the slice", () => {
        (0, chai_1.expect)("hell").to.be.equal("hell");
        (0, chai_1.expect)([4, 5]).to.be.deep.equal([4, 5]);
    });
});
