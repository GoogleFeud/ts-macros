import { expect } from "chai";
const { $$ident } = require("../../../../dist/index");

describe("$$ident", () => {
  const Hello = 123;

  it("To turn the string into the right identifier", () => {
    expect($$ident!("Hello")).to.be.equal(123);
  });
});
