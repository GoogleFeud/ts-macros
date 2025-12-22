import * as ts from "typescript";
export declare const UNKNOWN_TOKEN: ts.KeywordTypeNode<ts.SyntaxKind.UnknownKeyword>;
export declare function transformDeclaration(checker: ts.TypeChecker, decl: ts.Statement): ts.Statement | undefined;
