
import { expect } from "chai";
const { $$inline } = require("../../../../dist/index");


function $ToTernary(label: any) : void {
    label.condition ? $$inline!(label.then, []) : $$inline!(label.else, []);
}

describe("If label marker", () => {

    it("To transpile to the correct statement", () => {
        let value: string = "test";
        $ToTernary:
        if (value === "test") value = "other";
        else value = "other2";
        expect(value).to.be.equal("other");
    });

});