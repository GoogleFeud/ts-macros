"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const { $$ts } = require("../../../../dist/index");
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
        (0, chai_1.expect)(value).to.be.equal("other");
    });
    it("macro labels processed in none macro labeled blocks", () => {
        let value = "some";
        patch: {
            value = (() => "other")();
            break patch;
        }
        (0, chai_1.expect)(value).to.be.equal("other");
    });
    it("process macros in macro labeled expression", () => {
        let value = "some";
        $noop: value = (() => "other")();
        (0, chai_1.expect)(value).to.be.equal("other");
    });
    it("process macros in deep macro labeled expression", () => {
        let value = "some";
        $noop: $noop1: $noop2: value = (() => "other")();
        (0, chai_1.expect)(value).to.be.equal("other");
    });
});
