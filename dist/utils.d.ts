import * as ts from "typescript";
import { ComptimeFunction, MacroParam, MacroTransformer } from "./transformer";
export declare const NO_LIT_FOUND: unique symbol;
export declare function flattenBody(body: ts.ConciseBody): Array<ts.Statement>;
export declare function isMacroIdent(ident: ts.MemberName): boolean;
export declare function hasBit(flags: number, bit: number): boolean;
export declare function wrapExpressions(exprs: Array<ts.Statement>): ts.Expression;
export declare function toBinaryExp(transformer: MacroTransformer, body: Array<ts.Node>, id: number): ts.Expression;
export interface RepetitionData {
    separator?: string;
    literals: Array<ts.Expression>;
    fn: ts.ArrowFunction;
    indexTypes: ts.Type[];
}
export declare function getRepetitionParams(checker: ts.TypeChecker, rep: ts.ArrayLiteralExpression): RepetitionData;
export declare class MacroError extends Error {
    start: number;
    length: number;
    rawMsg: string;
    constructor(callSite: ts.Node, msg: string);
}
export declare function genDiagnosticFromMacroError(sourceFile: ts.SourceFile, err: MacroError): ts.Diagnostic;
export declare function getNameFromProperty(obj: ts.PropertyName): string | undefined;
export declare function createObjectLiteral(record: Record<string, ts.Expression | ts.Statement | undefined>): ts.ObjectLiteralExpression;
export declare function primitiveToNode(primitive: unknown): ts.Expression;
export declare function resolveAliasedSymbol(checker: ts.TypeChecker, sym?: ts.Symbol): ts.Symbol | undefined;
export declare function fnBodyToString(checker: ts.TypeChecker, fn: {
    body?: ts.ConciseBody | undefined;
}, compilerOptions?: ts.CompilerOptions): string;
export declare function tryRun(contentStartNode: ts.Node, comptime: ComptimeFunction, args?: Array<unknown>, additionalMessage?: string): any;
export declare function macroParamsToArray<T>(params: Array<MacroParam>, values: Array<T>): Array<T | Array<T>>;
export declare function resolveTypeWithTypeParams(providedType: ts.Type, typeParams: ts.TypeParameter[], replacementTypes: ts.Type[]): ts.Type;
export declare function resolveTypeArguments(checker: ts.TypeChecker, call: ts.CallExpression): ts.Type[];
/**
 * When a macro gets called, no matter if it's built-in or not, it must expand to a valid expression.
 * If the macro expands to multiple statements, it gets wrapped in an IIFE.
 * This helper function does the opposite, it de-expands the expanded valid expression to an array
 * of statements.
 */
export declare function deExpandMacroResults(nodes: Array<ts.Statement>): [Array<ts.Statement>, ts.Node?];
export declare function normalizeFunctionNode(checker: ts.TypeChecker, fnNode: ts.Expression): ts.FunctionLikeDeclaration | undefined;
export declare function expressionToStringLiteral(exp: ts.Expression): ts.Expression;
/**
 * If you attempt to get the type of a synthetic node literal (string literals like "abc", numeric literals like 3.14, etc.),
 * the default `checker.getTypeAtLocation` method will return the `never` type. This fixes that issue.
 */
export declare function getTypeAtLocation(checker: ts.TypeChecker, node: ts.Node): ts.Type;
export declare function getGeneralType(checker: ts.TypeChecker, type: ts.Type): ts.Type;
export declare function createNumberNode(num: number): ts.Expression;
export declare class MapArray<K, V> extends Map<K, V[]> {
    constructor();
    push(key: K, value: V): void;
    transferKey(oldKey: K, newKey: K): void;
    deleteAndReturn(key: K): V[] | undefined;
    deleteEntry(toBeDeleted: V): void;
    clearArray(key: K): void;
}
