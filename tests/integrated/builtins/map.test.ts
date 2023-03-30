import { expect } from "chai";
import ts from "typescript";
const { $$map, $$kindof, $$text, $$ident } = require("../../../../dist/index");

describe("$$map", () => {

    function log() {
        return 123;
    }
    
    function debug() {
        return "abc";
    }

    function $replace(exp: any, identifier: any, replaceWith: any) {
        return $$map!(exp, (value) => {
            if ($$kindof!(value) === ts.SyntaxKind.Identifier && $$text!(value) === identifier) return $$ident!(replaceWith);
        });
    }
    
    it("To correctly replace the identifiers", () => {
        expect($replace!(log(), "log", "debug")).to.be.equal("abc");
        expect($replace!(() => {
            return debug() + 1;
        }, "debug", "log")()).to.be.equal(124);
    });

});