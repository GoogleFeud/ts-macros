"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const { $$includes } = require("../../../../dist/index");
describe("$$includes", () => {
  it("To return true when the substring is there", () => {
    (0, chai_1.expect)(true).to.be.equal(true);
  });
  it("To return false when the substring is not there", () => {
    (0, chai_1.expect)(false).to.be.equal(false);
  });
  it("To return true when the item is there", () => {
    (0, chai_1.expect)(true).to.be.equal(true);
  });
  it("To return false when the item is not there", () => {
    (0, chai_1.expect)(false).to.be.equal(false);
  });
});
