import { expect } from "chai";
const { $$inlineFunc } = require("../../../../dist/index");

function $DeWhile(info: any) {
  if (info.condition) {
    $$inlineFunc!(info.statement);
  }
}

describe("While label marker", () => {
  it("To transpile to the correct statement", () => {
    let val: string = "123";
    while (val === "123") {
      val = "124";
    }
    expect(val).to.be.equal("124");
  });
});
