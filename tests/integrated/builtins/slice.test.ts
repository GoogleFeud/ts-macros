import { expect } from "chai";
import ts from "typescript";
const { $$slice, $$kindof } = require("../../../../dist/index");

describe("$$slice", () => {
  function $test(a: string | Array<number>): string | Array<number> {
    if ($$kindof!(a) === ts.SyntaxKind.StringLiteral) return $$slice!(a, 0, 4);
    else if ($$kindof!(a) === ts.SyntaxKind.ArrayLiteralExpression)
      return $$slice!(a, -2);
    else return "";
  }

  it("To return the slice", () => {
    expect($test!("hello")).to.be.equal("hell");
    expect($test!([1, 2, 3, 4, 5])).to.be.deep.equal([4, 5]);
  });
});
