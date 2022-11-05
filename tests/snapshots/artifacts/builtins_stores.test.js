"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const { $$getStore, $$setStore } = require("../../../../dist/index");
describe("$$getStore and $$setStore", () => {
    it("Save and retrieve", () => {
        (0, chai_1.expect)([]).to.be.instanceOf(Array);
        (0, chai_1.expect)(null).to.be.equal(null);
    });
});
