import { expect } from "chai";
const { $$slice } = require("../../../../dist/index");

declare function $$propsOfType<T>() : Array<string>;

describe("$$propsOfType", () => {

    function $test<T>(param: T) {
        const parameter = param;
        +[[$$propsOfType!<T>()], (name: string) => {
            if ($$slice!(name, 0, 2) === "__") delete parameter[name];
        }]
        return parameter;
    }
    
    it("To return the properties", () => {
        expect($$propsOfType!<{a: string, b: number}>()).to.be.deep.equal(["a", "b"]);
        expect($test!<{a: number, __b: string}>({a: 123, __b: "Hello"})).to.be.deep.equal({a: 123});
    });

});