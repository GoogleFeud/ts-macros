import * as ts from "typescript";
import { RepetitionData } from "./utils";
import { TsMacrosConfig } from ".";
export declare const enum MacroParamMarkers {
    None = 0,
    Accumulator = 1,
    Save = 2
}
export interface MacroParam {
    spread: boolean;
    marker: MacroParamMarkers;
    start: number;
    name: string;
    node: ts.ParameterDeclaration;
    defaultVal?: ts.Expression;
    realName?: ts.Identifier;
}
export interface Macro {
    name: string;
    params: Array<MacroParam>;
    node: ts.FunctionDeclaration;
    typeParams: Array<ts.TypeParameterDeclaration>;
    body?: ts.FunctionBody;
    namespace?: ts.ModuleDeclaration;
}
export interface MacroExpand {
    macro: Macro;
    call?: ts.Expression;
    args: ts.NodeArray<ts.Expression>;
    defined: Map<string, ts.Identifier>;
    /**
    * The item which has the decorator
    */
    target?: ts.Node;
    store: Map<string, ts.Expression>;
}
export interface MacroRepeat {
    index: number;
    repeatNames: Array<string>;
    elementSlices: Array<Array<ts.Expression>>;
    indexTypes: ts.Type[];
}
export interface MacroTransformerBuiltinProps {
    optimizeEnv?: boolean;
}
export type ComptimeFunction = (...params: Array<unknown>) => void;
export type MacroMap = Map<ts.Symbol, Macro>;
export interface MacroTransformerHooks {
    beforeRegisterMacro?: (transformer: MacroTransformer, symbol: ts.Symbol, macro: Macro) => void;
    beforeCallMacro?: (transformer: MacroTransformer, macro: Macro, expand: MacroExpand) => void;
    beforeFileTransform?: (transformer: MacroTransformer, sourceFile: ts.SourceFile) => void;
}
export declare class MacroTransformer {
    context: ts.TransformationContext;
    macroStack: Array<MacroExpand>;
    repeat: Array<MacroRepeat>;
    boundVisitor: ts.Visitor;
    props: MacroTransformerBuiltinProps;
    checker: ts.TypeChecker;
    macros: MacroMap;
    escapedStatements: Array<Array<ts.Statement>>;
    comptimeSignatures: Map<ts.Node, ComptimeFunction>;
    config: TsMacrosConfig;
    hooks: MacroTransformerHooks;
    constructor(context: ts.TransformationContext, checker: ts.TypeChecker, macroMap: MacroMap, config?: TsMacrosConfig, hooks?: MacroTransformerHooks);
    run(node: ts.SourceFile): ts.SourceFile;
    expectExpression(node: ts.Node): ts.Expression;
    expectStatement(node: ts.Node): ts.Statement;
    maybeStatement(node?: ts.Node): ts.Statement | undefined;
    expect<T extends ts.Node = ts.Node>(node: T, kind: ts.SyntaxKind): T;
    visitor(node: ts.Node): ts.VisitResult<ts.Node | undefined>;
    execRepetition({ fn, literals, separator, indexTypes }: RepetitionData, wrapStatements?: boolean): Array<ts.Node>;
    transformFunction(fn: ts.FunctionLikeDeclaration, wrapStatements?: boolean): Array<ts.Node>;
    getMacroParam(name: string, macro: Macro, params: ts.NodeArray<ts.Node>): ts.Node | undefined;
    runMacroFromTemplateExpression(call: ts.TaggedTemplateExpression, name: ts.Expression): Array<ts.Statement> | undefined;
    runMacroFromCallExpression(call: ts.CallExpression, name: ts.Expression, target?: ts.Node): Array<ts.Statement> | undefined;
    execMacro(macro: Macro, args: ts.NodeArray<ts.Expression>, call: ts.Expression, target?: ts.Node): ts.Statement[];
    expandMacroResults(statements: ts.Statement[], parent?: ts.Node): ts.Node | ts.Node[] | undefined;
    makeHygienic(statements: ts.Statement[]): ts.Statement[];
    getMarker(param: ts.ParameterDeclaration): MacroParamMarkers;
    callComptimeFunction(node: ts.CallExpression | ts.NewExpression): void;
    getNumberFromNode(node: ts.Expression): number | undefined;
    getStringFromNode(node?: ts.Expression, handleIdents?: boolean, handleTemplates?: boolean): string | undefined;
    getLiteralFromNode(node: ts.Expression, handleIdents?: boolean, handleTemplates?: boolean, handleObjects?: boolean): unknown;
    getBoolFromNode(node: ts.Expression | undefined): boolean | undefined;
    resolveTypeArgumentOfCall(macroCall: ts.CallExpression, typeIndex: number): ts.Type | undefined;
    findMacroByTypeParams(prop: ts.PropertyAccessExpression, call: ts.CallExpression): Array<Macro>;
    findMacroByName(node: ts.Node, name: string): Macro | undefined;
    getLastMacro(): MacroExpand | undefined;
    saveAndClearEscapedStatements(into: Array<ts.Statement>): void;
    escapeStatement(...statements: Array<ts.Statement>): void;
    removeEscapeScope(): void;
    addEscapeScope(): void;
    addComptimeSignature(sym: ts.Node, fn: string, args: Array<string>): ComptimeFunction;
    strToAST(str: string): ts.NodeArray<ts.Statement>;
    getIdent(name: string): ts.Identifier;
    toNode(primitive: string | number | boolean | Array<unknown> | Record<string, unknown>): ts.Expression;
    cleanupMacros(macro: Macro, extra?: (old: Macro) => void): void;
}
