import { expect } from "chai";
import ts from "typescript";
const { $$decompose, $$kindof, $$text, $$length, $$i, $$slice } = require("../../../../dist/index");

describe("$$decompose", () => {
    function $stringify(value: any): string {
        const $decomposed = $$decompose!(value);
        if ($$kindof!(value) === ts.SyntaxKind.PropertyAccessExpression) return $stringify!($decomposed[0]) + "." + $stringify!($decomposed[1]);
        else if ($$kindof!(value) === ts.SyntaxKind.CallExpression) return $stringify!($decomposed[0]) + "(" + (+["+", [$$slice!($decomposed, 1)], (part: any) => {
            const $len = $$length!($decomposed) - 2;
            return $stringify!(part) + ($$i!() === $len ? "" : ", ");
        }] || "") + ")";
        else if ($$kindof!(value) === ts.SyntaxKind.StringLiteral) return "\"" + value + "\"";
        else return $$text!(value);
    }

    it("To stringify the expression", () => {
        expect($stringify!(console.log(123))).to.be.equal("console.log(123)");
        expect($stringify!(console.log(1, true, console.log("Hello")))).to.be.equal("console.log(1, true, console.log(\"Hello\"))");
    });

});