import { expect } from "chai";
import ts from "typescript";
const { $$inlineFunc, $$kindof, $$define } = require("../../../../dist/index");

function $NormalizeFor(info: any) : void {
    if ($$kindof!(info.initializer) === ts.SyntaxKind.Identifier) {
        for (let i=0; i < info.iterator.length; i++) {
            $$define!(info.initializer, info.iterator[i]);
            $$inlineFunc!(info.statement);
        }
    }
}

describe("ForIter label marker", () => {

    it("To transpile to the correct statement", () => {
        const arr = [1, 3, 4, 5, 6];

        let sum = 0;
        $NormalizeFor:
        for (const el of arr) {
            sum += el;
        }
        expect(sum).to.be.deep.equal(19);
    });

});