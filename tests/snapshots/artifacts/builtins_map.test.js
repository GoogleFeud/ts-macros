"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const typescript_1 = __importDefault(require("typescript"));
const { $$map, $$kindof, $$text, $$ident } = require("../../../../dist/index");
describe("$$map", () => {
    function log() {
        return 123;
    }
    function debug() {
        return "abc";
    }
    it("To correctly replace the identifiers", () => {
        (0, chai_1.expect)(debug()).to.be.equal("abc");
        (0, chai_1.expect)((() => {
            return log() + 1;
        })()).to.be.equal(124);
    });
});
