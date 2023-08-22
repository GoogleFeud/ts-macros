import * as ts from "typescript";

export function transformDeclaration(checker: ts.TypeChecker, decl: ts.Statement) : ts.Statement {
    if (ts.isInterfaceDeclaration(decl) || ts.isTypeAliasDeclaration(decl) || ts.isEnumDeclaration(decl)) return decl;
    else if (ts.isClassDeclaration(decl)) {
        return ts.factory.createClassDeclaration([
            ...(decl.modifiers || []),
            ts.factory.createToken(ts.SyntaxKind.DeclareKeyword)
        ],
        decl.name,
        decl.typeParameters,
        decl.heritageClauses,
        decl.members.map(m => {
            if (ts.isMethodDeclaration(m)) return ts.factory.createMethodDeclaration(m.modifiers, m.asteriskToken, m.name, m.questionToken, m.typeParameters, m.parameters, m.type, undefined);
            else if (ts.isPropertyDeclaration(m)) return ts.factory.createPropertyDeclaration(m.modifiers, m.name, m.questionToken || m.exclamationToken, m.type, undefined);
            else if (ts.isGetAccessorDeclaration(m)) return ts.factory.createGetAccessorDeclaration(m.modifiers, m.name, m.parameters, m.type, undefined);
            else if (ts.isSetAccessorDeclaration(m)) return ts.factory.createSetAccessorDeclaration(m.modifiers, m.name, m.parameters, undefined);
            else if (ts.isConstructorDeclaration(m)) return ts.factory.createConstructorDeclaration(m.modifiers, m.parameters, undefined);
            else return m;
        })
        );
    }
    else if (ts.isVariableStatement(decl)) {
        const decls = [];
        for (const declaration of decl.declarationList.declarations) {
            let initializerType;
            if (declaration.initializer) {
                const type = checker.getTypeAtLocation(declaration.initializer);
                const typeNode = checker.typeToTypeNode(type, undefined, undefined);
                if (typeNode) initializerType = typeNode;
            }
            decls.push(ts.factory.createVariableDeclaration(declaration.name, declaration.exclamationToken, initializerType));
        }
        return ts.factory.createVariableStatement([
            ...(decl.modifiers || []),
            ts.factory.createToken(ts.SyntaxKind.DeclareKeyword)
        ], decls);
    }
    else return decl;
}