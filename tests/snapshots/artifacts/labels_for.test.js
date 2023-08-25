"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const { $$inline, $$define } = require("../../../../dist/index");
describe("For label marker", () => {
    it("To transpile to the correct statement", () => {
        const arr = [1, 3, 4, 5, 6];
        const arr2 = [];
        let i = 2;
        let j = 10;
        while (i < arr.length) {
            arr2.push(i);
            i++;
        }
        (0, chai_1.expect)(arr2).to.be.deep.equal([2, 3, 4]);
        (0, chai_1.expect)(j).to.be.equal(10);
    });
});
