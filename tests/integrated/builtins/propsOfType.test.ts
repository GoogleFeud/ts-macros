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

    type Complex = {
        foo: {
            bar1: { a: number, b: string },
            bar2: { c: number, d: string },
            bar3: { e: number, f: string }
        }
    }

    function $test2<K extends keyof Complex, T extends keyof Complex[K]>(key1: K, key2: T, element: number = 0) {
        $$propsOfType!<Complex[K][T]>()[element]
    }

    it("Should work with complex type", () => {
        expect($test2!("foo", "bar1"), "a");
        expect($test2!("foo", "bar1", 1), "b");
        expect($test2!("foo", "bar3"), "e");
        expect($test2!("foo", "bar2", 1), "d");
    });

});