import { expect } from "chai";
const { $$const } = require("../../../../dist/index");

describe("$$const", () => {
    
    it("Define a constant", () => {
        $$const!("testVar", 123);
        //@ts-expect-error Should be correct
        expect(testVar).to.be.equal(123);
        $$const!("testVar1", (a, b) => a + b);
        //@ts-expect-error Should be correct
        expect(testVar1(1, 10)).to.be.equal(11);
    });

});
