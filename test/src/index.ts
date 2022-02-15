import { $$kindof } from "../../src";
import { SyntaxKind } from "typescript";

function $myMacro(user: Record<string, any>, arr: Array<number>) {
    user.object.personal.age + user["object"]["personal"]["age"] + arr[0];
}

$myMacro!({
    object: { personal: { age: 33 }}
}, [33]);