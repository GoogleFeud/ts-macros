import ts = require("typescript");
import { Macro } from "../transformer";
import { MapArray, hasBit } from "../utils";
import { UNKNOWN_TOKEN } from "./declarations";

function resolveTypeName(checker: ts.TypeChecker, type: ts.Type) : string | undefined {
    if (hasBit(type.flags, ts.TypeFlags.String)) return "String";
    else if (hasBit(type.flags, ts.TypeFlags.Number)) return "Number";
    else if (hasBit(type.flags, ts.TypeFlags.Boolean)) return "Boolean";
    //else if (type.isClassOrInterface()) return type.symbol.name;
    else if (checker.isArrayType(type) || checker.isTupleType(type)) return "Array";
    else return;
}

export function generateChainingTypings(checker: ts.TypeChecker, macros: Map<ts.Symbol, Macro>) : ts.Statement[] {
    const ambientDecls = new MapArray<ts.Type, ts.MethodSignature>();
    for (const [, macro] of macros) {
        const macroParamNode = macro.params[0]?.node;
        if (!macroParamNode) continue;
        const macroParamType = checker.getTypeAtLocation(macroParamNode);
        if (!macroParamType) continue;
        const decl = ts.factory.createMethodSignature([], macro.name, macro.node.questionToken, macro.node.typeParameters, macro.node.parameters.slice(1), macro.node.type || UNKNOWN_TOKEN);
        if (macroParamType.isUnion()) {
            for (const type of macroParamType.types) ambientDecls.push(type, decl);
        }
        else ambientDecls.push(macroParamType, decl);
    }

    const decls: ts.Statement[] = [];
    for (const [type, chainFunctions] of ambientDecls) {
        const typeName = resolveTypeName(checker, type);
        if (!typeName) continue;
        //@ts-expect-error Err
        decls.push(ts.factory.createInterfaceDeclaration(undefined, typeName, type.target?.typeParameters?.map((p: ts.TypeParameter) => ts.factory.createTypeReferenceNode(
            ts.factory.createIdentifier(p.symbol.name),
            undefined
        )), undefined, chainFunctions));
    }

    return [
        ts.factory.createModuleDeclaration(
            [ts.factory.createToken(ts.SyntaxKind.DeclareKeyword)],
            ts.factory.createIdentifier("global"),
            ts.factory.createModuleBlock(decls),
            ts.NodeFlags.ExportContext | ts.NodeFlags.GlobalAugmentation | ts.NodeFlags.Ambient | ts.NodeFlags.ContextFlags
        )
    ];
}