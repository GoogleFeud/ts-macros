import { expect } from "chai";
const { $$i } = require("../../../../dist/index");

describe("$$i", () => {
    
    it("To be -1 when outside of repetition", () => {
        expect($$i!()).to.be.equal(-1);
    });

    it("To be the index of repetitions", () => {
        function $test(array: Array<string>) {
            +["+", [array], (el: string) => el + $$i!()];
        }

        expect($test!(["a", "b", "c"])).to.be.equal("a0b1c2");
    });

});