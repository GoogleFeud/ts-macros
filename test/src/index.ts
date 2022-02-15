import { Var, $$kindof } from "../../dist";
import { SyntaxKind } from "typescript";
function $num(name: string|number, variable?: Var)  {
    if ($$kindof!(name) === SyntaxKind.StringLiteral || $$kindof!(name) === SyntaxKind.Identifier) variable = "Hi";
    else variable = 10;
    name + (variable as string);
} 

$num!("Hello") // "Hello" + "Hi"
$num!(25) // 25 + 10
const variable = 30; 
$num!(variable); // variable + "Hi"