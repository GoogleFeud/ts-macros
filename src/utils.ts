/* eslint-disable @typescript-eslint/no-non-null-assertion */
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

export function toBinaryExp(transformer: MacroTransformer, body: Array<ts.Expression | ts.Statement>, id: number) : ts.Expression {
    let last;
    for (const element of body.map(m => ts.isExpressionStatement(m) ? m.expression : (m as ts.Expression))) {
        if (!last) last = element;
        else last = transformer.context.factory.createBinaryExpression(last, id, element);
    }
    return ts.visitNode(last, transformer.boundVisitor) as ts.Expression;
}

export function getRepetitionParams(rep: ts.ArrayLiteralExpression) : {
    separator?: string,
    literals: Array<ts.Expression>,
    function: ts.ArrowFunction
} {
    const res: { separator?: string, literals: Array<ts.Expression>, function?: ts.ArrowFunction} = { literals: [] };
    const firstElement = rep.elements[0];
    if (ts.isStringLiteral(firstElement)) res.separator = firstElement.text;
    else if (ts.isArrayLiteralExpression(firstElement)) res.literals.push(...firstElement.elements);
    else if (ts.isArrowFunction(firstElement)) res.function = firstElement;

    const secondElement = rep.elements[1];
    if (secondElement) {
        if (ts.isArrayLiteralExpression(secondElement)) res.literals.push(...secondElement.elements);
        else if (ts.isArrowFunction(secondElement)) res.function = secondElement;
    }

    const thirdElement = rep.elements[2];
    if (thirdElement && ts.isArrowFunction(thirdElement)) res.function = thirdElement;

    if (!res.function) throw new Error("Repetition must include arrow function.");
    return res as ReturnType<typeof getRepetitionParams>;
}

export class MacroError {
    constructor(callSite: ts.Node, msg: string) {
        // Just throw a regular error if the transformer is running in the browser
        if (!ts.sys || typeof process !== "object") throw new Error(msg);
        console.error(ts.formatDiagnosticsWithColorAndContext([{
            category: ts.DiagnosticCategory.Error,
            code: 8000,
            file: callSite.getSourceFile(),
            start: callSite.pos,
            length: callSite.end - callSite.pos,
            messageText: msg
        }], {
            getNewLine: () => "\r\n",
            getCurrentDirectory: ts.sys.getCurrentDirectory,
            getCanonicalFileName: (fileName) => fileName
        }));
        process.exit();
    }
}

export function getNameFromProperty(obj: ts.PropertyName) : string|undefined {
    if (ts.isIdentifier(obj) || ts.isStringLiteral(obj) || ts.isPrivateIdentifier(obj) || ts.isNumericLiteral(obj)) return obj.text;
    else return undefined;
}

export function getNameFromBindingName(obj: ts.BindingName) : string|undefined {
    if (ts.isIdentifier(obj)) return obj.text;
    return;
}

export function isStatement(obj: ts.Node) : obj is ts.Statement {
    return obj.kind >= ts.SyntaxKind.Block && obj.kind <= ts.SyntaxKind.DebuggerStatement;
}

export function createObject(record: Record<string, ts.Expression|ts.Statement|undefined>) : ts.ObjectLiteralExpression {
    const assignments = [];
    for (const key in record) {
        const obj = record[key];
        assignments.push(ts.factory.createPropertyAssignment(key, 
            obj ? isStatement(obj) ? ts.factory.createArrowFunction(undefined, undefined, [], undefined, undefined, ts.isBlock(obj) ? obj : ts.factory.createBlock([obj])) : obj : ts.factory.createIdentifier("undefined")
        ));
    }
    return ts.factory.createObjectLiteralExpression(assignments);
}

export function primitiveToNode(primitive: unknown) : ts.Expression {
    if (typeof primitive === "string") return ts.factory.createStringLiteral(primitive);
    else if (typeof primitive === "number") return ts.factory.createNumericLiteral(primitive);
    else if (typeof primitive === "boolean") return primitive ? ts.factory.createTrue() : ts.factory.createFalse();
    else if (primitive === null) return ts.factory.createNull();
    else if (Array.isArray(primitive)) return ts.factory.createArrayLiteralExpression(primitive.map(p => primitiveToNode(p)));
    else {
        const assignments: Array<ts.PropertyAssignment> = [];
        for (const key in (primitive as Record<string, unknown>)) {
            assignments.push(ts.factory.createPropertyAssignment(key, primitiveToNode((primitive as Record<string, unknown>)[key])));
        }
        return ts.factory.createObjectLiteralExpression(assignments);
    }
}

export function resolveAliasedSymbol(checker: ts.TypeChecker, sym?: ts.Symbol) : ts.Symbol | undefined {
    if (!sym) return;
    while ((sym.flags & ts.SymbolFlags.Alias) !== 0) {
        const newSym = checker.getAliasedSymbol(sym);
        if (newSym.name === "unknown") return sym;
        sym = newSym;
    }
    return sym;
}