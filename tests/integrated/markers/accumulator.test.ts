import { expect } from "chai";

type Accumulator = number & { __marker?: "Accumulator" };

describe("Accumulator marker", () => {
  function $test(acc: Accumulator = 4) {
    return acc;
  }

  it("Return the right amount", () => {
    expect($test!()).to.be.equal(4);
    expect($test!()).to.be.equal(5);
    expect($test!()).to.be.equal(6);
  });
});
