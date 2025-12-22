"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MapArray = exports.MacroError = exports.NO_LIT_FOUND = void 0;
exports.flattenBody = flattenBody;
exports.isMacroIdent = isMacroIdent;
exports.hasBit = hasBit;
exports.wrapExpressions = wrapExpressions;
exports.toBinaryExp = toBinaryExp;
exports.getRepetitionParams = getRepetitionParams;
exports.genDiagnosticFromMacroError = genDiagnosticFromMacroError;
exports.getNameFromProperty = getNameFromProperty;
exports.createObjectLiteral = createObjectLiteral;
exports.primitiveToNode = primitiveToNode;
exports.resolveAliasedSymbol = resolveAliasedSymbol;
exports.fnBodyToString = fnBodyToString;
exports.tryRun = tryRun;
exports.macroParamsToArray = macroParamsToArray;
exports.resolveTypeWithTypeParams = resolveTypeWithTypeParams;
exports.resolveTypeArguments = resolveTypeArguments;
exports.deExpandMacroResults = deExpandMacroResults;
exports.normalizeFunctionNode = normalizeFunctionNode;
exports.expressionToStringLiteral = expressionToStringLiteral;
exports.getTypeAtLocation = getTypeAtLocation;
exports.getGeneralType = getGeneralType;
exports.createNumberNode = createNumberNode;
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
const ts = require("typescript");
exports.NO_LIT_FOUND = Symbol("NO_LIT_FOUND");
function flattenBody(body) {
    if ("statements" in body) {
        return [...body.statements];
    }
    return [ts.factory.createExpressionStatement(body)];
}
function isMacroIdent(ident) {
    return ident.text[0] === "$";
}
function hasBit(flags, bit) {
    return (flags & bit) !== 0;
}
function wrapExpressions(exprs) {
    let last = exprs.pop();
    if (!last)
        return ts.factory.createNull();
    if (exprs.length === 0 && ts.isReturnStatement(last))
        return last.expression || ts.factory.createIdentifier("undefined");
    if (ts.isExpressionStatement(last))
        last = ts.factory.createReturnStatement(last.expression);
    else if (!(last.kind > ts.SyntaxKind.EmptyStatement && last.kind < ts.SyntaxKind.DebuggerStatement))
        last = ts.factory.createReturnStatement(last);
    return ts.factory.createImmediatelyInvokedArrowFunction([...exprs, last]);
}
function toBinaryExp(transformer, body, id) {
    let last;
    for (const element of body.map(m => ts.isExpressionStatement(m) ? m.expression : m)) {
        if (!last)
            last = element;
        else
            last = transformer.context.factory.createBinaryExpression(last, id, element);
    }
    return ts.visitNode(last, transformer.boundVisitor);
}
function getRepetitionParams(checker, rep) {
    const res = { literals: [] };
    const firstElement = rep.elements[0];
    if (ts.isStringLiteral(firstElement))
        res.separator = firstElement.text;
    else if (ts.isArrayLiteralExpression(firstElement))
        res.literals.push(...firstElement.elements);
    else if (ts.isArrowFunction(firstElement))
        res.fn = firstElement;
    const secondElement = rep.elements[1];
    if (secondElement) {
        if (ts.isArrayLiteralExpression(secondElement))
            res.literals.push(...secondElement.elements);
        else if (ts.isArrowFunction(secondElement))
            res.fn = secondElement;
    }
    const thirdElement = rep.elements[2];
    if (thirdElement && ts.isArrowFunction(thirdElement))
        res.fn = thirdElement;
    if (!res.fn)
        throw new MacroError(rep, "Repetition must include arrow function.");
    res.indexTypes = (res.fn.typeParameters || []).map(arg => checker.getTypeAtLocation(arg));
    return res;
}
class MacroError extends Error {
    constructor(callSite, msg) {
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
exports.MacroError = MacroError;
function genDiagnosticFromMacroError(sourceFile, err) {
    return {
        code: 8000,
        start: err.start,
        length: err.length,
        messageText: err.rawMsg,
        file: sourceFile,
        category: ts.DiagnosticCategory.Error
    };
}
function getNameFromProperty(obj) {
    if (ts.isIdentifier(obj) || ts.isStringLiteral(obj) || ts.isPrivateIdentifier(obj) || ts.isNumericLiteral(obj))
        return obj.text;
    else
        return undefined;
}
function createObjectLiteral(record) {
    const assignments = [];
    for (const key in record) {
        const obj = record[key];
        assignments.push(ts.factory.createPropertyAssignment(key, obj ? ts.isStatement(obj) ? ts.factory.createArrowFunction(undefined, undefined, [], undefined, undefined, ts.isBlock(obj) ? obj : ts.factory.createBlock([obj])) : obj : ts.factory.createIdentifier("undefined")));
    }
    return ts.factory.createObjectLiteralExpression(assignments);
}
function primitiveToNode(primitive) {
    if (primitive === null)
        return ts.factory.createNull();
    else if (primitive === undefined)
        return ts.factory.createIdentifier("undefined");
    else if (typeof primitive === "string")
        return ts.factory.createStringLiteral(primitive);
    else if (typeof primitive === "number")
        return ts.factory.createNumericLiteral(primitive);
    else if (typeof primitive === "boolean")
        return primitive ? ts.factory.createTrue() : ts.factory.createFalse();
    else if (Array.isArray(primitive))
        return ts.factory.createArrayLiteralExpression(primitive.map(p => primitiveToNode(p)));
    else {
        const assignments = [];
        for (const key in primitive) {
            assignments.push(ts.factory.createPropertyAssignment(ts.factory.createStringLiteral(key), primitiveToNode(primitive[key])));
        }
        return ts.factory.createObjectLiteralExpression(assignments);
    }
}
function resolveAliasedSymbol(checker, sym) {
    if (!sym)
        return;
    while ((sym.flags & ts.SymbolFlags.Alias) !== 0) {
        const newSym = checker.getAliasedSymbol(sym);
        if (newSym.name === "unknown")
            return sym;
        sym = newSym;
    }
    return sym;
}
function fnBodyToString(checker, fn, compilerOptions) {
    if (!fn.body)
        return "";
    const includedFns = new Set();
    let code = "";
    const visitor = (node) => {
        if (ts.isCallExpression(node)) {
            const signature = checker.getResolvedSignature(node);
            if (signature &&
                signature.declaration &&
                signature.declaration !== fn &&
                signature.declaration.parent.parent !== fn &&
                (ts.isFunctionDeclaration(signature.declaration) ||
                    ts.isArrowFunction(signature.declaration) ||
                    ts.isFunctionExpression(signature.declaration))) {
                const name = signature.declaration.name ? signature.declaration.name.text : ts.isIdentifier(node.expression) ? node.expression.text : undefined;
                if (!name || includedFns.has(name))
                    return;
                includedFns.add(name);
                code += `function ${name}(${signature.parameters.map(p => p.name).join(",")}){${fnBodyToString(checker, signature.declaration, compilerOptions)}}`;
            }
            ts.forEachChild(node, visitor);
        }
        else
            ts.forEachChild(node, visitor);
    };
    ts.forEachChild(fn.body, visitor);
    return code + ts.transpile((fn.body.original || fn.body).getText(), compilerOptions);
}
function tryRun(contentStartNode, comptime, args = [], additionalMessage) {
    try {
        return comptime(...args);
    }
    catch (err) {
        if (err instanceof Error) {
            throw new MacroError(contentStartNode, (additionalMessage || "") + err.message);
        }
        else
            throw err;
    }
}
function macroParamsToArray(params, values) {
    const result = [];
    for (let i = 0; i < params.length; i++) {
        if (params[i].spread)
            result.push(values.slice(i));
        else if (!values[i] && params[i].defaultVal)
            result.push(params[i].defaultVal);
        else
            result.push(values[i]);
    }
    return result;
}
function resolveTypeWithTypeParams(providedType, typeParams, replacementTypes) {
    const checker = providedType.checker;
    // Access type
    if ("indexType" in providedType && "objectType" in providedType) {
        const indexType = resolveTypeWithTypeParams(providedType.indexType, typeParams, replacementTypes);
        const objectType = resolveTypeWithTypeParams(providedType.objectType, typeParams, replacementTypes);
        const foundType = indexType.isTypeParameter() ? replacementTypes[typeParams.findIndex(t => t === indexType)] : indexType;
        if (!foundType || !foundType.isLiteral())
            return providedType;
        const realType = objectType.getProperty(foundType.value.toString());
        if (!realType)
            return providedType;
        return checker.getTypeOfSymbol(realType);
    }
    // Conditional type
    else if ("checkType" in providedType && "extendsType" in providedType && "resolvedTrueType" in providedType && "resolvedFalseType" in providedType) {
        const checkType = resolveTypeWithTypeParams(providedType.checkType, typeParams, replacementTypes);
        const extendsType = resolveTypeWithTypeParams(providedType.extendsType, typeParams, replacementTypes);
        const trueType = resolveTypeWithTypeParams(providedType.resolvedTrueType, typeParams, replacementTypes);
        const falseType = resolveTypeWithTypeParams(providedType.resolvedFalseType, typeParams, replacementTypes);
        if (checker.isTypeAssignableTo(checkType, extendsType))
            return trueType;
        else
            return falseType;
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
        const newType = Object.assign({}, providedType);
        newType.types = newType.types.map(t => resolveTypeWithTypeParams(t, typeParams, replacementTypes));
        return newType;
    }
    else if (providedType.isTypeParameter())
        return replacementTypes[typeParams.findIndex(t => t === providedType)] || providedType;
    //@ts-expect-error Private API
    else if (providedType.resolvedTypeArguments) {
        const newType = Object.assign({}, providedType);
        //@ts-expect-error Private API
        newType.resolvedTypeArguments = providedType.resolvedTypeArguments.map(arg => resolveTypeWithTypeParams(arg, typeParams, replacementTypes));
        return newType;
    }
    else if (providedType.getCallSignatures().length) {
        const newType = Object.assign({}, providedType);
        const originalCallSignature = providedType.getCallSignatures()[0];
        const callSignature = Object.assign({}, originalCallSignature);
        callSignature.resolvedReturnType = resolveTypeWithTypeParams(originalCallSignature.getReturnType(), typeParams, replacementTypes);
        callSignature.parameters = callSignature.parameters.map(p => {
            if (!p.valueDeclaration || !p.valueDeclaration.type)
                return p;
            const newParam = checker.createSymbol(p.flags, p.escapedName);
            //@ts-expect-error Private API
            newParam.type = resolveTypeWithTypeParams(checker.getTypeAtLocation(p.valueDeclaration.type), typeParams, replacementTypes);
            return newParam;
        });
        //@ts-expect-error Private API
        newType.callSignatures = [callSignature];
        return newType;
    }
    return providedType;
}
function resolveTypeArguments(checker, call) {
    var _a;
    const sig = checker.getResolvedSignature(call);
    if (!sig || !sig.mapper)
        return [];
    switch (sig.mapper.kind) {
        case ts.TypeMapKind.Simple:
            return [sig.mapper.target];
        case ts.TypeMapKind.Array:
            return ((_a = sig.mapper.targets) === null || _a === void 0 ? void 0 : _a.filter(t => t)) || [];
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
function deExpandMacroResults(nodes) {
    const cloned = [...nodes];
    const lastNode = cloned[nodes.length - 1];
    if (!lastNode)
        return [nodes];
    if (ts.isReturnStatement(lastNode)) {
        const expression = cloned.pop().expression;
        if (!expression)
            return [nodes];
        if (ts.isCallExpression(expression) && ts.isParenthesizedExpression(expression.expression) && ts.isArrowFunction(expression.expression.expression)) {
            const flattened = flattenBody(expression.expression.expression.body);
            let last = flattened.pop();
            if (last && ts.isReturnStatement(last) && last.expression)
                last = last.expression;
            return [[...cloned, ...flattened], last];
        }
        else
            return [cloned, expression];
    }
    return [cloned, cloned[cloned.length - 1]];
}
function normalizeFunctionNode(checker, fnNode) {
    var _a;
    if (ts.isArrowFunction(fnNode) || ts.isFunctionExpression(fnNode) || ts.isFunctionDeclaration(fnNode))
        return fnNode;
    const origin = checker.getSymbolAtLocation(fnNode);
    if (origin && ((_a = origin.declarations) === null || _a === void 0 ? void 0 : _a.length)) {
        const originDecl = origin.declarations[0];
        if (ts.isFunctionLikeDeclaration(originDecl))
            return originDecl;
        else if (ts.isVariableDeclaration(originDecl) && originDecl.initializer && ts.isFunctionLikeDeclaration(originDecl.initializer))
            return originDecl.initializer;
    }
}
function expressionToStringLiteral(exp) {
    if (ts.isParenthesizedExpression(exp))
        return expressionToStringLiteral(exp.expression);
    else if (ts.isStringLiteral(exp))
        return exp;
    else if (ts.isIdentifier(exp))
        return ts.factory.createStringLiteral(exp.text);
    else if (ts.isNumericLiteral(exp))
        return ts.factory.createStringLiteral(exp.text);
    else if (exp.kind === ts.SyntaxKind.TrueKeyword)
        return ts.factory.createStringLiteral("true");
    else if (exp.kind === ts.SyntaxKind.FalseKeyword)
        return ts.factory.createStringLiteral("false");
    else
        return ts.factory.createStringLiteral("null");
}
/**
 * If you attempt to get the type of a synthetic node literal (string literals like "abc", numeric literals like 3.14, etc.),
 * the default `checker.getTypeAtLocation` method will return the `never` type. This fixes that issue.
 */
function getTypeAtLocation(checker, node) {
    if (node.pos === -1) {
        if (ts.isStringLiteral(node))
            return checker.getStringLiteralType(node.text);
        else if (ts.isNumericLiteral(node))
            return checker.getNumberLiteralType(+node.text);
        else if (ts.isTemplateExpression(node))
            return checker.getStringType();
        else
            return checker.getTypeAtLocation(node);
    }
    return checker.getTypeAtLocation(node);
}
function getGeneralType(checker, type) {
    if (type.isStringLiteral())
        return checker.getStringType();
    else if (type.isNumberLiteral())
        return checker.getNumberType();
    else if (hasBit(type.flags, ts.TypeFlags.BooleanLiteral))
        return checker.getBooleanType();
    else
        return type;
}
function createNumberNode(num) {
    if (num < 0)
        return ts.factory.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken, ts.factory.createNumericLiteral(Math.abs(num)));
    else
        return ts.factory.createNumericLiteral(num);
}
class MapArray extends Map {
    constructor() {
        super();
    }
    push(key, value) {
        const arr = this.get(key);
        if (!arr)
            this.set(key, [value]);
        else
            arr.push(value);
    }
    transferKey(oldKey, newKey) {
        const returned = this.deleteAndReturn(oldKey);
        if (!returned)
            return;
        this.set(newKey, returned);
    }
    deleteAndReturn(key) {
        const returned = this.get(key);
        this.delete(key);
        return returned;
    }
    deleteEntry(toBeDeleted) {
        for (const [, arr] of this) {
            const ind = arr.indexOf(toBeDeleted);
            if (ind === -1)
                continue;
            arr.splice(ind, 1);
        }
    }
    clearArray(key) {
        const arr = this.get(key);
        if (arr)
            arr.length = 0;
    }
}
exports.MapArray = MapArray;
