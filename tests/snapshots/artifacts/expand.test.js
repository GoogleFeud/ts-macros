"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
describe("Macro expand", () => {
  it("IIFE in expressions", () => {
    const arr = [1, 2, 3];
    (0, chai_1.expect)(
      (() => {
        arr.push(4);
        arr.push(5);
        return arr.push(6);
      })()
    ).to.be.equal(6);
  });
  it("Inlined in expression statements", () => {
    const arr = [1, 2, 3];
    arr.push(1);
    arr.push(2);
    arr.push(3);
    (0, chai_1.expect)(arr).to.be.deep.equal([1, 2, 3, 1, 2, 3]);
  });
  it("Inlined in expressions", () => {
    const arr = [1, 2, 3];
    (0, chai_1.expect)((arr.push(4), arr.push(5), arr.push(6))).to.be.equal(6);
  });
});
