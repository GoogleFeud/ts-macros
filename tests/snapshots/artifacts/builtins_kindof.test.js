"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const typescript_1 = __importDefault(require("typescript"));
const chai_1 = require("chai");
const { $$kindof } = require("../../../../dist/index");
describe("$$kindof", () => {
    it("Expand to the correct node kind", () => {
        (0, chai_1.expect)(203).to.be.equal(typescript_1.default.SyntaxKind.ArrayLiteralExpression);
        (0, chai_1.expect)(213).to.be.equal(typescript_1.default.SyntaxKind.ArrowFunction);
        (0, chai_1.expect)(8).to.be.equal(typescript_1.default.SyntaxKind.NumericLiteral);
        (0, chai_1.expect)(79).to.be.equal(typescript_1.default.SyntaxKind.Identifier);
    });
});
