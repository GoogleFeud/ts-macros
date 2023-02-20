import { expect } from "chai";
const { $$slice } = require("../../../../dist/index");

declare function $$typeToString<T>(): string;

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

  type Foo = {
    foo: boolean;
    bar: Bar;
  };

  type Mar = {
    a: "foo";
    b: "bar";
  };

  type Bar = number;

  function $test2<K extends keyof Mar>(key: K) {
    return $$typeToString!<Foo[Mar[K extends "a" ? "b" : "a"]]>();
  }

  it("Should work with complex type", () => {
    expect($test2!("a")).to.equal("number");
    expect($test2!("b")).to.equal("boolean");
  });
});
