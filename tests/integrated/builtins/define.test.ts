import { expect } from "chai";
const { $$define } = require("../../../../dist/index");

describe("$$define", () => {
  it("Define a constant", () => {
    $$define!("testVar", 123);
    //@ts-expect-error Should be correct
    expect(testVar).to.be.equal(123);
    $$define!("testVar1", (a, b) => a + b);
    //@ts-expect-error Should be correct
    expect(testVar1(1, 10)).to.be.equal(11);
  });
});
