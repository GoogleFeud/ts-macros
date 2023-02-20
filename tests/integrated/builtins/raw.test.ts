import { expect } from "chai";
const { $$raw } = require("../../../../dist/index");

describe("$$raw", () => {
  function $test(a: string | Array<number>): string | Array<number> {
    return $$raw!((ctx, a) => {
      if (ctx.ts.isStringLiteral(a)) return a;
      else if (ctx.ts.isArrayLiteralExpression(a))
        return ctx.factory.createStringLiteral(
          a.elements
            .filter((el) => ctx.ts.isNumericLiteral(el))
            .map((n) => n.text)
            .join("")
        );
      else return ctx.factory.createNull();
    });
  }

  it("To run the raw code", () => {
    expect($test!("hello")).to.be.equal("hello");
    expect($test!([1, 2, 3, 4, 5])).to.be.deep.equal("12345");
    const str = "abc";
    expect($test!(str)).to.be.deep.equal(null);
  });
});
