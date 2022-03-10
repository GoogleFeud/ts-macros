import ts = require("typescript");
import { $$parentKind } from "../../dist";

//$$parentKind!();

function $isMacroCalledInsideFunction() {
    $$parentKind!(ts.SyntaxKind.FunctionDeclaration) || $$parentKind!(ts.SyntaxKind.ArrowFunction)
}

(() => {
    $isMacroCalledInsideFunction!();
})();

$isMacroCalledInsideFunction!();

function test() {
    return [$isMacroCalledInsideFunction!(), 2, 3];
}