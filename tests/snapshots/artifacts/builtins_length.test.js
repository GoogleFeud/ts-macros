"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const { $$length } = require("../../../../dist/index");
describe("$$length", () => {
  it("To return the length of the array literal", () => {
    (0, chai_1.expect)(3).to.be.equal(3);
    (0, chai_1.expect)(10).to.be.equal(10);
  });
});
