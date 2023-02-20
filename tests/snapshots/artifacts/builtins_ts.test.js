"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const { $$ts } = require("../../../../dist/index");
describe("$$ts", () => {
  it("To turn the string into code", () => {
    (0, chai_1.expect)((() => 123)()).to.be.equal(123);
  });
});
