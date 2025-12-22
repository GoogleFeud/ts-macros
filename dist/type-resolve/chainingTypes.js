"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateChainingTypings = generateChainingTypings;
const ts = require("typescript");
const utils_1 = require("../utils");
const declarations_1 = require("./declarations");
function resolveTypeName(checker, type) {
    if ((0, utils_1.hasBit)(type.flags, ts.TypeFlags.String))
        return "String";
    else if ((0, utils_1.hasBit)(type.flags, ts.TypeFlags.Number))
        return "Number";
    else if ((0, utils_1.hasBit)(type.flags, ts.TypeFlags.Boolean))
        return "Boolean";
    //else if (type.isClassOrInterface()) return type.symbol.name;
    else if (checker.isArrayType(type) || checker.isTupleType(type))
        return "Array";
    else
        return;
}
function generateChainingTypings(checker, macros) {
    var _a, _b, _c;
    const ambientDecls = new utils_1.MapArray();
    for (const [, macro] of macros) {
        const macroParamNode = (_a = macro.params[0]) === null || _a === void 0 ? void 0 : _a.node;
        if (!macroParamNode)
            continue;
        const macroParamType = checker.getTypeAtLocation(macroParamNode);
        if (!macroParamType)
            continue;
        const decl = ts.factory.createMethodSignature([], macro.name, macro.node.questionToken, macro.node.typeParameters, macro.node.parameters.slice(1), macro.node.type || declarations_1.UNKNOWN_TOKEN);
        if (macroParamType.isUnion()) {
            for (const type of macroParamType.types)
                ambientDecls.push(type, decl);
        }
        else
            ambientDecls.push(macroParamType, decl);
    }
    const decls = [];
    for (const [type, chainFunctions] of ambientDecls) {
        const typeName = resolveTypeName(checker, type);
        if (!typeName)
            continue;
        //@ts-expect-error Err
        decls.push(ts.factory.createInterfaceDeclaration(undefined, typeName, (_c = (_b = type.target) === null || _b === void 0 ? void 0 : _b.typeParameters) === null || _c === void 0 ? void 0 : _c.map((p) => ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(p.symbol.name), undefined)), undefined, chainFunctions));
    }
    return [
        ts.factory.createModuleDeclaration([ts.factory.createToken(ts.SyntaxKind.DeclareKeyword)], ts.factory.createIdentifier("global"), ts.factory.createModuleBlock(decls), ts.NodeFlags.ExportContext | ts.NodeFlags.GlobalAugmentation | ts.NodeFlags.Ambient | ts.NodeFlags.ContextFlags)
    ];
}
