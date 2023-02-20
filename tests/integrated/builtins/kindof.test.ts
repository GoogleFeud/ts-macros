import ts from "typescript";
import { expect } from "chai";

const { $$kindof } = require("../../../../dist/index");

describe("$$kindof", () => {
  it("Expand to the correct node kind", () => {
    expect($$kindof!([1, 2, 3])).to.be.equal(
      ts.SyntaxKind.ArrayLiteralExpression
    );
    expect($$kindof!(() => 1)).to.be.equal(ts.SyntaxKind.ArrowFunction);
    expect($$kindof!(123)).to.be.equal(ts.SyntaxKind.NumericLiteral);
    expect($$kindof!(expect)).to.be.equal(ts.SyntaxKind.Identifier);
  });
});
