"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const typescript_1 = __importDefault(require("typescript"));
const { $$inlineFunc, $$kindof, $$define } = require("../../../../dist/index");
describe("ForIter label marker", () => {
    it("To transpile to the correct statement", () => {
        const arr = [1, 3, 4, 5, 6];
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
            const el = arr[i];
            sum += el;
        }
        (0, chai_1.expect)(sum).to.be.deep.equal(19);
    });
});
