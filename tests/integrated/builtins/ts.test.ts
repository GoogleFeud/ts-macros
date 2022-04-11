import { expect } from "chai";
const { $$ts } = require("../../../../dist/index");

describe("$$ts", () => {
    
    it("To turn the string into code", () => {
        expect($$ts!("() => 123")()).to.be.equal(123);
    });

});