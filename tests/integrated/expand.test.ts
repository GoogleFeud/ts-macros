
import { expect } from "chai";

describe("Macro expand", () => {
    
    function $push<T>(array: T[], ...elements: Array<T>) {
        +[(elements: T) => {
            array.push(elements);
        }];
    }

    it("IIFE in expressions", () => {
        const arr = [1, 2, 3];
        expect($push!(arr, 4, 5, 6)).to.be.equal(6);
    });

    it("Inlined in expression statements", () => {
        const arr = [1, 2, 3];
        $push!(arr, 1, 2, 3);
        expect(arr).to.be.deep.equal([1, 2, 3, 1, 2, 3]);
    });

    function $push2<T>(array: T[], ...elements: Array<T>) {
        +["()", (elements: T) => {
            array.push(elements);
        }];
    }

    it("Inlined in expressions", () => {
        const arr = [1, 2, 3];
        expect($push2!(arr, 4, 5, 6)).to.be.equal(6);
    });


});
