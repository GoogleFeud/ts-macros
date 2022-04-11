import { expect } from "chai";
const { $$length } = require("../../../../dist/index");

describe("$$length", () => {

    function $test(arr: Array<number>) {
        return $$length!(arr);
    }
    
    it("To return the length of the array literal", () => {
        expect($test!([1, 2, 3])).to.be.equal(3);
        expect($test!([1, 2, 3, 4, 5, 6, 7, 8, 9, 0])).to.be.equal(10);
    });

});