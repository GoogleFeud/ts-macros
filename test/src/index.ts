import { $$kindof, Var } from "../../src";
import { SyntaxKind } from "typescript";

function $num(name: string|number, variable?: Var)  {
    if ($$kindof!(name) === SyntaxKind.StringLiteral || $$kindof!(name) === SyntaxKind.Identifier) variable = "Hi";
    else variable = 10;
    if ((variable + "e") === "Hie") 5;
    else if (variable === 10) 10;
    else 15;
} 

$num!("Hello")
$num!(25)
const variable = 30;
$num!(variable);