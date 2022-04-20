import { expect } from "chai";
const { $$includes } = require("../../../../dist/index");

describe("$$includes", () => {
    
    it("To return true when the substring is there", () => {
        expect($$includes!("Hello World", "World")).to.be.equal(true);
    });

    it("To return false when the substring is not there", () => {
        expect($$includes!("Hello World", "Google")).to.be.equal(false);
    });

    it("To return true when the item is there", () => {
        expect($$includes!([1, 2, 3, 4, "wow"], "wow")).to.be.equal(true);
    });

    it("To return false when the item is not there", () => {
        expect($$includes!([1, 2, 3, 4, 5], 6)).to.be.equal(false);
    });

});