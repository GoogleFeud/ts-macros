import { expect } from "chai";
const { $$inlineFunc } = require("../../../../dist/index");

function $TrySilence(info: any) {
    try {
        $$inlineFunc!(info.statement);
    } catch(err) {};
}

describe("Block label marker", () => {

    it("To transpile to the correct statement", () => {
        expect(() => {
            $TrySilence:
            {
                throw new Error("This shouldn't throw!");
            }
        }).to.not.throw();
    });

});