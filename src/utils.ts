/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as ts from "typescript";
import { MacroParam, MacroTransformer } from "./transformer";

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

export function MacroError(callSite: ts.Node, msg: string) : void {
    MacroErrorWrapper(callSite.pos, callSite.end - callSite.pos, msg, callSite.getSourceFile());
    process.exit();
}

export function MacroErrorWrapper(start: number, end: number, msg: string, file: ts.SourceFile) : void {
    if (!ts.sys || typeof process !== "object") throw new Error(msg);
    console.error(ts.formatDiagnosticsWithColorAndContext([{
        category: ts.DiagnosticCategory.Error,
        code: 8000,
        file,
        start,
        length: end,
        messageText: msg
    }], {
        getNewLine: () => "\r\n",
        getCurrentDirectory: ts.sys.getCurrentDirectory,
        getCanonicalFileName: (fileName) => fileName
    }));
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

export function fnBodyToString(checker: ts.TypeChecker, fn: { body?: ts.ConciseBody | undefined }) : string {
    if (!fn.body) return "";
    const includedFns = new Set<string>();
    let code = "";
    const visitor = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
            const signature = checker.getResolvedSignature(node);
            if (signature && 
                signature.declaration && 
                (ts.isFunctionDeclaration(signature.declaration) ||
                ts.isArrowFunction(signature.declaration) ||
                ts.isFunctionExpression(signature.declaration)    
                )) {
                const name = signature.declaration.name ? signature.declaration.name.text : ts.isIdentifier(node.expression) ? node.expression.text : undefined;
                if (!name || includedFns.has(name)) return;
                code += `function ${name}(${signature.parameters.map(p => p.name).join(",")}){${fnBodyToString(checker, signature.declaration)}}`;
                includedFns.add(name);
            }
            ts.forEachChild(node, visitor);
        } 
        else ts.forEachChild(node, visitor);
    };
    ts.forEachChild(fn.body, visitor);
    return code + ts.transpile((fn.body.original || fn.body).getText());
}


export function tryRun(fn: (...args: Array<unknown>) => void, args: Array<unknown> = []) : any {
    try {
        return fn(...args);
    } catch(err: unknown) {
        if (err instanceof Error) {
            const { line, col } = (err.stack || "").match(/<anonymous>:(?<line>\d+):(?<col>\d+)/)?.groups || {};
            const lineNum = line ? (+line - 1) : 0;
            const colNum = (col ? (+col - 1) : 0);
            const file = ts.createSourceFile("comptime", fn.toString(), ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS);
            const startLoc = ts.getPositionOfLineAndCharacter(file, lineNum, colNum);
            let node: ts.Node = file;
            const visitor = (visitedNode: ts.Node) => {
                if (visitedNode.pos === startLoc) node = visitedNode;
                else ts.forEachChild(visitedNode, visitor);
            };
            ts.forEachChild(file, visitor);
            MacroErrorWrapper(node.pos, node.end - node.pos, err.message, file);
        } else throw err;
    }
}

export function macroParamsToArray<T>(params: Array<MacroParam>, values: Array<T>) : Array<T|Array<T>> {
    const result = [];
    for (let i=0; i < params.length; i++) {
        if (params[i].spread) result.push(values.slice(i));
        else result.push(values[i]);
    }
    return result;
}

export function resolveTypeWithTypeParams(providedType: ts.Type, typeParams: ts.TypeParameter[], replacementTypes: ts.Type[]) : ts.Type {
    // Access type
    if ("indexType" in providedType && "objectType" in providedType) {
        const indexType = resolveTypeWithTypeParams((providedType as any).indexType as ts.Type, typeParams, replacementTypes);
        const objectType = resolveTypeWithTypeParams((providedType as any).objectType as ts.Type, typeParams, replacementTypes);
        const foundType = indexType.isTypeParameter() ? replacementTypes[typeParams.findIndex(t => t === indexType)] : indexType;
        if (!foundType || !foundType.isLiteral()) return providedType;
        const realType = objectType.getProperty(foundType.value.toString());
        if (!realType) return providedType;
        return providedType.checker.getTypeOfSymbol(realType);
    }
    // Conditional type
    else if ("checkType" in providedType && "extendsType" in providedType) {
        const checkType = resolveTypeWithTypeParams((providedType as any).checkType as ts.Type, typeParams, replacementTypes);
        const extendsType = resolveTypeWithTypeParams((providedType as any).extendsType as ts.Type, typeParams, replacementTypes);
        const trueType = resolveTypeWithTypeParams((providedType as any).resolvedTrueType as ts.Type, typeParams, replacementTypes);
        const falseType = resolveTypeWithTypeParams((providedType as any).resolvedFalseType as ts.Type, typeParams, replacementTypes);
        if (providedType.checker.isTypeAssignableTo(checkType, extendsType)) return trueType;
        else return falseType;
    } else if (providedType.isTypeParameter()) return replacementTypes[typeParams.findIndex(t => t === providedType)] || providedType;
    return providedType;
}

export function resolveTypeArguments(checker: ts.TypeChecker, call: ts.CallExpression) : ts.Type[] {
    const sig = checker.getResolvedSignature(call);
    if (!sig || !sig.mapper) return [];
    switch (sig.mapper.kind) {
    case ts.TypeMapKind.Simple:
        return [sig.mapper.target];
    case ts.TypeMapKind.Array:
        return sig.mapper.targets?.filter(t => t) || [];
    default:
        return [];
    }
}