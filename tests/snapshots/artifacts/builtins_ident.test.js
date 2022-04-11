"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const { $$ident } = require("../../../../dist/index");
describe("$$ident", () => {
    const Hello = 123;
    it("To turn the string into the right identifier", () => {
        (0, chai_1.expect)(Hello).to.be.equal(123);
    });
});
