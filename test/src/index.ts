import { $$includes, $$err } from "../../dist";


///console.log($$includes!(123, 3));

$$includes!([1, 2, "abc", 4, "de"], 123);

$$err!("Test");