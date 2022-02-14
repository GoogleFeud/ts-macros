import { $$kindof } from "../../src";
import { SyntaxKind } from "typescript";

function $myMacro(user: Record<string, any>) {
    user.object.personal.age + user["object"]["personal"]["age"];
}

$myMacro!({
    object: { personal: { age: 33 }}
});