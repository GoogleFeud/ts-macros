import * as ts from "typescript";
import { MacroTransformer } from "./transformer";

export function flattenBody(body: ts.ConciseBody) : Array<ts.Node> {
    if ("statements" in body) return [...body.statements];
    return [body];
}

export function wrapExpressions(exprs: Array<ts.Statement>) : ts.Expression {
    let last = exprs.pop()!;
    if (ts.isExpressionStatement(last)) last = ts.factory.createReturnStatement(last.expression);
    else if (!(last.kind > ts.SyntaxKind.EmptyStatement && last.kind < ts.SyntaxKind.DebuggerStatement)) last = ts.factory.createReturnStatement(last as unknown as ts.Expression);
    return ts.factory.createImmediatelyInvokedArrowFunction([...exprs, last as ts.Statement]);
} 

export function toBinaryExp(transformer: MacroTransformer, body: Array<ts.Expression | ts.Statement>, id: number) {
    let last;
    for (const element of body.map(m => ts.isExpressionStatement(m) ? m.expression : (m as ts.Expression))) {
        if (!last) last = element;
        else last = transformer.context.factory.createBinaryExpression(last, id, element);
    }
    return ts.visitNode(last, transformer.boundVisitor) as ts.Expression;
}