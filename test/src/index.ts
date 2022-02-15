import { $$import } from "../../dist";
import * as ts from "typescript";

$$import!("../", ["A", "B"], true);

//@ts-expect-error
console.log(A, B);