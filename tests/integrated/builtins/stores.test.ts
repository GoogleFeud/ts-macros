import { expect } from "chai";
const { $$getStore, $$setStore } = require("../../../../dist/index");

describe("$$getStore and $$setStore", () => {
  function $test(key: string, search: number, nums: Array<[number, any]>) {
    +[
      [nums],
      (pair: [number, any]) => {
        if (pair[0] === search) $$setStore!(key, pair[1]);
      },
    ];
    return $$getStore!(key);
  }

  it("Save and retrieve", () => {
    expect(
      $test!("a", 3, [
        [1, "Hello"],
        [11, {}],
        [3, []],
      ])
    ).to.be.instanceOf(Array);
    expect(
      $test!("a", 12, [
        [1, "Hello"],
        [11, {}],
        [3, []],
      ])
    ).to.be.equal(null);
  });
});
