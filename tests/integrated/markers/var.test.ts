import { expect } from "chai";
import ts from "typescript";
const { $$kindof } = require("../../../../dist/index");;

declare const var_sym: unique symbol;
// eslint-disable-next-line @typescript-eslint/ban-types
export type Var = (null | undefined | string | number | {} | typeof var_sym) & { __marker?: "Var" };


describe("Var marker", () => {

    function $test(thing: any, variable: Var = "unknown") {
        if ($$kindof!(thing) === ts.SyntaxKind.NumericLiteral) variable = "number";
        else if ($$kindof!(thing) === ts.SyntaxKind.StringLiteral) variable = "string";
        else if ($$kindof!(thing) === ts.SyntaxKind.ArrayLiteralExpression) variable = "array";
        return variable;
    }
    
    it("Return the right expression", () => {
        expect($test!(1)).to.be.equal("number");
        expect($test!("Hello")).to.be.equal("string");
        expect($test!([1])).to.be.equal("array");
    });

});