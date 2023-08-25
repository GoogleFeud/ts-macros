import { expect } from "chai";
const { $$inline } = require("../../../../dist/index");


function $DeWhile(info: any) {
    if (info.condition) {
        $$inline!(info.statement, []);
    }
}

describe("While label marker", () => {

    it("To transpile to the correct statement", () => {
        let val: string = "123";
        $DeWhile:
        while (val === "123") {
            val = "124";
        }
        expect(val).to.be.equal("124");
    });

});