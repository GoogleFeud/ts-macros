
import { expect } from "chai";
const { $$inlineFunc } = require("../../../../dist/index");


function $ToTernary(label: any) : void {
    label.condition ? $$inlineFunc!(label.then) : $$inlineFunc!(label.else);
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