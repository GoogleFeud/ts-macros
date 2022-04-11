import { expect } from "chai";

export type Save<T> = T & { __marker?: "Save" }

describe("Save marker", () => {

    function $test(value: string, thing: Save<number>) {
        if (value === "yes") thing = 1;
        else if (value === "no") thing = 0;
        return thing;
    }
    
    it("Return the right amount", () => {
        expect($test!("yes", 343)).to.be.equal(1);
        expect($test!("no", 11)).to.be.equal(0);
        expect($test!("maybe", 11)).to.be.equal(11);
    });

});