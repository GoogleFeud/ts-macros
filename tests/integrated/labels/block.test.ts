import { expect } from "chai";
const { $$inline } = require("../../../../dist/index");

function $TrySilence(info: any) {
    try {
        $$inline!(info.statement, []);
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