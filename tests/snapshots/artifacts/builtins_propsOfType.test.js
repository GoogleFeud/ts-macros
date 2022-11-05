"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const { $$slice } = require("../../../../dist/index");
describe("$$propsOfType", () => {
    it("To return the properties", () => {
        (0, chai_1.expect)(["a", "b"]).to.be.deep.equal(["a", "b"]);
        (0, chai_1.expect)((() => {
            const parameter = { a: 123, __b: "Hello" };
            delete parameter["__b"];
            return parameter;
        })()).to.be.deep.equal({ a: 123 });
    });
    it("Should work with complex type", () => {
        (0, chai_1.expect)("a", "a");
        (0, chai_1.expect)("b", "b");
        (0, chai_1.expect)("e", "e");
        (0, chai_1.expect)("d", "d");
    });
});
