import { expect } from "chai";

const { $$inline } = require("../../../../dist/index");

describe("$$inlineFunc", () => {
  it("Inline the function and replace the arguments", () => {
    expect($$inline!((a, b) => a + b, [1, 5])).to.be.equal(6);
    expect(
      $$inline!(
        (a: Array<string>, b: string) => a.push(b),
        [["a", "b", "c"], "d"]
      )
    ).to.be.deep.equal(4);
  });

  it("Wrap the function in an IIFE", () => {
    expect(
      $$inline!(
        (a, b) => {
          let acc = 0;
          for (let i = a; i < b; i++) {
            acc += i;
          }
          return acc;
        },
        [1, 10]
      )
    ).to.be.equal(45);
  });
});
