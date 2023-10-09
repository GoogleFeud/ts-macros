/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as ts from "typescript";
import { ComptimeFunction, MacroParam, MacroTransformer } from "./transformer";

export const NO_LIT_FOUND = Symbol("NO_LIT_FOUND");

export function flattenBody(body: ts.ConciseBody) : Array<ts.Statement> {
    if ("statements" in body) {
        return [...body.statements];
    }
    return [ts.factory.createExpressionStatement(body)];
}

export function isMacroIdent(ident: ts.MemberName) : boolean {
    return ident.text[0] === "$";
}

export function hasBit(flags: number, bit: number) : boolean {
    return (flags & bit) !== 0;
}

export function wrapExpressions(exprs: Array<ts.Statement>) : ts.Expression {
    let last = exprs.pop()!;
    if (!last) return ts.factory.createNull();
    if (exprs.length === 0 && ts.isReturnStatement(last)) return last.expression || ts.factory.createIdentifier("undefined");
    if (ts.isExpressionStatement(last)) last = ts.factory.createReturnStatement(last.expression);
    else if (!(last.kind > ts.SyntaxKind.EmptyStatement && last.kind < ts.SyntaxKind.DebuggerStatement)) last = ts.factory.createReturnStatement(last as unknown as ts.Expression);
    return ts.factory.createImmediatelyInvokedArrowFunction([...exprs, last as ts.Statement]);
} 

export function toBinaryExp(transformer: MacroTransformer, body: Array<ts.Node>, id: number) : ts.Expression {
    let last;
    for (const element of body.map(m => ts.isExpressionStatement(m) ? m.expression : (m as ts.Expression))) {
        if (!last) last = element;
        else last = transformer.context.factory.createBinaryExpression(last, id, element);
    }
    return ts.visitNode(last, transformer.boundVisitor) as ts.Expression;
}

export interface RepetitionData {
    separator?: string,
    literals: Array<ts.Expression>,
    fn: ts.ArrowFunction,
    indexTypes: ts.Type[]
}

export function getRepetitionParams(checker: ts.TypeChecker, rep: ts.ArrayLiteralExpression) : RepetitionData {
    const res: Partial<RepetitionData> = { literals: [] };
    const firstElement = rep.elements[0];
    if (ts.isStringLiteral(firstElement)) res.separator = firstElement.text;
    else if (ts.isArrayLiteralExpression(firstElement)) res.literals!.push(...firstElement.elements);
    else if (ts.isArrowFunction(firstElement)) res.fn = firstElement;

    const secondElement = rep.elements[1];
    if (secondElement) {
        if (ts.isArrayLiteralExpression(secondElement)) res.literals!.push(...secondElement.elements);
        else if (ts.isArrowFunction(secondElement)) res.fn = secondElement;
    }

    const thirdElement = rep.elements[2];
    if (thirdElement && ts.isArrowFunction(thirdElement)) res.fn = thirdElement;
    if (!res.fn) throw new MacroError(rep, "Repetition must include arrow function.");

    res.indexTypes = (res.fn.typeParameters || []).map(arg => checker.getTypeAtLocation(arg));

    return res as RepetitionData;
}

export class MacroError extends Error {
    start: number;
    length: number;
    rawMsg: string;
    constructor(callSite: ts.Node, msg: string) {
        const start = callSite.pos;
        const length = callSite.end - callSite.pos;
        super(ts.formatDiagnosticsWithColorAndContext([{
            category: ts.DiagnosticCategory.Error,
            code: 8000,
            file: callSite.getSourceFile(),
            start,
            length,
            messageText: msg
        }], {
            getNewLine: () => "\r\n",
            getCurrentDirectory: () => "unknown directory",
            getCanonicalFileName: (fileName) => fileName
        }));
        this.start = start;
        this.length = length;
        this.rawMsg = msg;
    }
}

export function genDiagnosticFromMacroError(sourceFile: ts.SourceFile, err: MacroError) : ts.Diagnostic {
    return {
        code: 8000,
        start: err.start,
        length: err.length,
        messageText: err.rawMsg,
        file: sourceFile,
        category: ts.DiagnosticCategory.Error
    };
}

export function getNameFromProperty(obj: ts.PropertyName) : string|undefined {
    if (ts.isIdentifier(obj) || ts.isStringLiteral(obj) || ts.isPrivateIdentifier(obj) || ts.isNumericLiteral(obj)) return obj.text;
    else return undefined;
}

export function createObjectLiteral(record: Record<string, ts.Expression|ts.Statement|undefined>) : ts.ObjectLiteralExpression {
    const assignments = [];
    for (const key in record) {
        const obj = record[key];
        assignments.push(ts.factory.createPropertyAssignment(key, 
            obj ? ts.isStatement(obj) ? ts.factory.createArrowFunction(undefined, undefined, [], undefined, undefined, ts.isBlock(obj) ? obj : ts.factory.createBlock([obj])) : obj : ts.factory.createIdentifier("undefined")
        ));
    }
    return ts.factory.createObjectLiteralExpression(assignments);
}

export function primitiveToNode(primitive: unknown) : ts.Expression {
    if (primitive === null) return ts.factory.createNull();
    else if (primitive === undefined) return ts.factory.createIdentifier("undefined");
    else if (typeof primitive === "string") return ts.factory.createStringLiteral(primitive);
    else if (typeof primitive === "number") return ts.factory.createNumericLiteral(primitive);
    else if (typeof primitive === "boolean") return primitive ? ts.factory.createTrue() : ts.factory.createFalse();
    else if (Array.isArray(primitive)) return ts.factory.createArrayLiteralExpression(primitive.map(p => primitiveToNode(p)));
    else {
        const assignments: Array<ts.PropertyAssignment> = [];
        for (const key in (primitive as Record<string, unknown>)) {
            assignments.push(ts.factory.createPropertyAssignment(ts.factory.createStringLiteral(key), primitiveToNode((primitive as Record<string, unknown>)[key])));
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

export function fnBodyToString(checker: ts.TypeChecker, fn: { body?: ts.ConciseBody | undefined }, compilerOptions?: ts.CompilerOptions) : string {
    if (!fn.body) return "";
    const includedFns = new Set<string>();
    let code = "";
    const visitor = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
            const signature = checker.getResolvedSignature(node);
            if (signature && 
                signature.declaration &&
                signature.declaration !== fn &&
                signature.declaration.parent.parent !== fn &&
                (ts.isFunctionDeclaration(signature.declaration) ||
                ts.isArrowFunction(signature.declaration) ||
                ts.isFunctionExpression(signature.declaration)    
                )) {
                const name = signature.declaration.name ? signature.declaration.name.text : ts.isIdentifier(node.expression) ? node.expression.text : undefined;
                if (!name || includedFns.has(name)) return;
                includedFns.add(name);
                code += `function ${name}(${signature.parameters.map(p => p.name).join(",")}){${fnBodyToString(checker, signature.declaration, compilerOptions)}}`;
            }
            ts.forEachChild(node, visitor);
        } 
        else ts.forEachChild(node, visitor);
    };
    ts.forEachChild(fn.body, visitor);
    return code + ts.transpile((fn.body.original || fn.body).getText(), compilerOptions);
}

export function tryRun(contentStartNode: ts.Node, comptime: ComptimeFunction, args: Array<unknown> = [], additionalMessage?: string) : any {
    try {
        return comptime(...args);
    } catch(err: unknown) {
        if (err instanceof Error) {
            throw new MacroError(contentStartNode, (additionalMessage || "") + err.message);
        } else throw err;
    }
}

export function macroParamsToArray<T>(params: Array<MacroParam>, values: Array<T>) : Array<T|Array<T>> {
    const result = [];
    for (let i=0; i < params.length; i++) {
        if (params[i].spread) result.push(values.slice(i));
        else if (!values[i] && params[i].defaultVal) result.push(params[i].defaultVal as T);
        else result.push(values[i]);
    }
    return result;
}

export function resolveTypeWithTypeParams(providedType: ts.Type, typeParams: ts.TypeParameter[], replacementTypes: ts.Type[]) : ts.Type {
    const checker = providedType.checker;
    // Access type
    if ("indexType" in providedType && "objectType" in providedType) {
        const indexType = resolveTypeWithTypeParams((providedType as any).indexType as ts.Type, typeParams, replacementTypes);
        const objectType = resolveTypeWithTypeParams((providedType as any).objectType as ts.Type, typeParams, replacementTypes);
        const foundType = indexType.isTypeParameter() ? replacementTypes[typeParams.findIndex(t => t === indexType)] : indexType;
        if (!foundType || !foundType.isLiteral()) return providedType;
        const realType = objectType.getProperty(foundType.value.toString());
        if (!realType) return providedType;
        return checker.getTypeOfSymbol(realType);
    }
    // Conditional type
    else if ("checkType" in providedType && "extendsType" in providedType && "resolvedTrueType" in providedType && "resolvedFalseType" in providedType) {
        const checkType = resolveTypeWithTypeParams((providedType as any).checkType as ts.Type, typeParams, replacementTypes);
        const extendsType = resolveTypeWithTypeParams((providedType as any).extendsType as ts.Type, typeParams, replacementTypes);
        const trueType = resolveTypeWithTypeParams((providedType as any).resolvedTrueType as ts.Type, typeParams, replacementTypes);
        const falseType = resolveTypeWithTypeParams((providedType as any).resolvedFalseType as ts.Type, typeParams, replacementTypes);
        if (checker.isTypeAssignableTo(checkType, extendsType)) return trueType;
        else return falseType;
    }
    else if (providedType.isIntersection()) {
        const symTable = new Map();
        for (const unresolvedType of providedType.types) {
            const resolved = resolveTypeWithTypeParams(unresolvedType, typeParams, replacementTypes);
            for (const prop of resolved.getProperties()) {
                symTable.set(prop.name, prop);
            }
        }
        return checker.createAnonymousType(undefined, symTable, [], [], []);
    }
    else if (providedType.isUnion()) {
        const newType = {...providedType};
        newType.types = newType.types.map(t => resolveTypeWithTypeParams(t, typeParams, replacementTypes));
        return newType;
    }
    else if (providedType.isTypeParameter()) return replacementTypes[typeParams.findIndex(t => t === providedType)] || providedType;
    //@ts-expect-error Private API
    else if (providedType.resolvedTypeArguments) {
        const newType = {...providedType};
        //@ts-expect-error Private API
        newType.resolvedTypeArguments = providedType.resolvedTypeArguments.map(arg => resolveTypeWithTypeParams(arg, typeParams, replacementTypes));
        return newType;
    }
    else if (providedType.getCallSignatures().length) {
        const newType = {...providedType};
        const originalCallSignature = providedType.getCallSignatures()[0];
        const callSignature = {...originalCallSignature};
        callSignature.resolvedReturnType = resolveTypeWithTypeParams(originalCallSignature.getReturnType(), typeParams, replacementTypes);
        callSignature.parameters = callSignature.parameters.map(p => {
            if (!p.valueDeclaration || !(p.valueDeclaration as ts.ParameterDeclaration).type) return p;
            const newParam = checker.createSymbol(p.flags, p.escapedName);
            //@ts-expect-error Private API
            newParam.type = resolveTypeWithTypeParams(checker.getTypeAtLocation((p.valueDeclaration as ts.ParameterDeclaration).type as ts.Node), typeParams, replacementTypes);
            return newParam;
        });
        //@ts-expect-error Private API
        newType.callSignatures = [callSignature];
        return newType;
    }
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

/**
 * When a macro gets called, no matter if it's built-in or not, it must expand to a valid expression.
 * If the macro expands to multiple statements, it gets wrapped in an IIFE.
 * This helper function does the opposite, it de-expands the expanded valid expression to an array
 * of statements.
 */
export function deExpandMacroResults(nodes: Array<ts.Statement>) : [Array<ts.Statement>, ts.Node?] {
    const cloned = [...nodes];
    const lastNode = cloned[nodes.length - 1];
    if (!lastNode) return [nodes];
    if (ts.isReturnStatement(lastNode)) {
        const expression = (cloned.pop() as ts.ReturnStatement).expression;
        if (!expression) return [nodes];
        if (ts.isCallExpression(expression) && ts.isParenthesizedExpression(expression.expression) && ts.isArrowFunction(expression.expression.expression)) {
            const flattened = flattenBody(expression.expression.expression.body);
            let last: ts.Node|undefined = flattened.pop();
            if (last && ts.isReturnStatement(last) && last.expression) last = last.expression;
            return [[...cloned, ...flattened], last];
        }
        else return [cloned, expression];
    }
    return [cloned, cloned[cloned.length - 1]];
}

export function normalizeFunctionNode(checker: ts.TypeChecker, fnNode: ts.Expression) : ts.FunctionLikeDeclaration | undefined {
    if (ts.isArrowFunction(fnNode) || ts.isFunctionExpression(fnNode) || ts.isFunctionDeclaration(fnNode)) return fnNode;
    const origin = checker.getSymbolAtLocation(fnNode);
    if (origin && origin.declarations?.length) {
        const originDecl = origin.declarations[0];
        if (ts.isFunctionLikeDeclaration(originDecl)) return originDecl;
        else if (ts.isVariableDeclaration(originDecl) && originDecl.initializer && ts.isFunctionLikeDeclaration(originDecl.initializer)) return originDecl.initializer;
    }
}

export function expressionToStringLiteral(exp: ts.Expression) : ts.Expression {
    if (ts.isParenthesizedExpression(exp)) return expressionToStringLiteral(exp.expression);
    else if (ts.isStringLiteral(exp)) return exp;
    else if (ts.isIdentifier(exp)) return ts.factory.createStringLiteral(exp.text);
    else if (ts.isNumericLiteral(exp)) return ts.factory.createStringLiteral(exp.text);
    else if (exp.kind === ts.SyntaxKind.TrueKeyword) return ts.factory.createStringLiteral("true");
    else if (exp.kind === ts.SyntaxKind.FalseKeyword) return ts.factory.createStringLiteral("false");
    else return ts.factory.createStringLiteral("null");
}

/**
 * If you attempt to get the type of a synthetic node literal (string literals like "abc", numeric literals like 3.14, etc.),
 * the default `checker.getTypeAtLocation` method will return the `never` type. This fixes that issue.
 */
export function getTypeAtLocation(checker: ts.TypeChecker, node: ts.Node) : ts.Type {
    if (node.pos === -1) {
        if (ts.isStringLiteral(node)) return checker.getStringLiteralType(node.text);
        else if (ts.isNumericLiteral(node)) return checker.getNumberLiteralType(+node.text);
        else if (ts.isTemplateExpression(node)) return checker.getStringType();
        else return checker.getTypeAtLocation(node);
    }
    return checker.getTypeAtLocation(node);
}

export function getGeneralType(checker: ts.TypeChecker, type: ts.Type) : ts.Type {
    if (type.isStringLiteral()) return checker.getStringType();
    else if (type.isNumberLiteral()) return checker.getNumberType();
    else if (hasBit(type.flags, ts.TypeFlags.BooleanLiteral)) return checker.getBooleanType();
    else return type;
}

export class MapArray<K, V> extends Map<K, V[]> {
    constructor() {
        super();
    }

    push(key: K, value: V) : void {
        const arr = this.get(key);
        if (!arr) this.set(key, [value]);
        else arr.push(value);
    }

    transferKey(oldKey: K, newKey: K) : void {
        const returned = this.deleteAndReturn(oldKey);
        if (!returned) return;
        this.set(newKey, returned);
    }

    deleteAndReturn(key: K) : V[] | undefined {
        const returned = this.get(key);
        this.delete(key);
        return returned;
    }

    deleteEntry(toBeDeleted: V) : void {
        for (const [, arr] of this) {
            const ind = arr.indexOf(toBeDeleted);
            if (ind === -1) continue;
            arr.splice(ind, 1);
        }
    }

    clearArray(key: K) : void {
        const arr = this.get(key);
        if (arr) arr.length = 0;
    }

} 