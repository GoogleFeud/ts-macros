import { expect } from "chai";
const { $$slice } = require("../../../../dist/index");

declare function $$typeToString<T>() : string;

describe("$$typeToString", () => {

    function $test<T>(a: unknown) {
        if (typeof a !== $$typeToString!<T>()) return false;
        else return true;
    } 
    
    it("Should stringify the type", () => {
        expect($$typeToString!<string>()).to.be.equal("string");
        expect($test!<string>(123)).to.be.equal(false);
        expect($test!<boolean>(true)).to.be.equal(true);
    });

});