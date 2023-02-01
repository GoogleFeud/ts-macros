import { expect } from "chai";
const { $$ts } = require("../../../../dist/index");

function $noop(_: any): void {
}
function $noop1(_: any): void {
}
function $noop2(_: any): void {
}

describe("None macro js labels", () => {

    it("none macro label not excluded from source", () => {
        let value = "some";
        patch: {
            value = "ot";
            break patch;
        }
        $patch: {
            value += "her";
            break $patch;
        }
        expect(value).to.be.equal("other");
    });

    it("macro labels processed in none macro labeled blocks", () => {
        let value = "some";
        patch: {
            value = ($$ts!('() => "other"'))();
            break patch;
        }
        expect(value).to.be.equal("other");
    });

    it("process macros in macro labeled expression", () => {
        let value = "some";
        $noop: value = ($$ts!('() => "other"'))();
        expect(value).to.be.equal("other");
    });

    it("process macros in deep macro labeled expression", () => {
        let value = "some";
        $noop: 
        $noop1: 
        $noop2: 
        value = ($$ts!('() => "other"'))();
        expect(value).to.be.equal("other");
    });

});