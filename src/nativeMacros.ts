import ts = require("typescript");
import * as fs from "fs";
import { MacroTransformer } from "./transformer";
import * as path from "path";
import { fnBodyToString, MacroError, primitiveToNode, tryRun } from "./utils";

const jsonFileCache: Record<string, ts.Expression> = {};
const regFileCache: Record<string, string> = {};

export default {
    "$$loadEnv": (args, transformer, callSite) => {
        const extraPath = args.length && ts.isStringLiteral(args[0]) ? args[0].text:"";
        let dotenv;
        try {
            dotenv = require("dotenv");
        } catch {
            throw MacroError(callSite, "`loadEnv` macro called but `dotenv` module is not installed.");
        }
        if (extraPath) dotenv.config({path: path.join(ts.sys.getCurrentDirectory(), extraPath)});
        else dotenv.config();
        transformer.props.optimizeEnv = true;
        return transformer.context.factory.createCallExpression(
            transformer.context.factory.createPropertyAccessExpression(
                transformer.context.factory.createCallExpression(
                    transformer.context.factory.createIdentifier("require"),
                    undefined,
                    [transformer.context.factory.createStringLiteral("dotenv")]
                ),
                transformer.context.factory.createIdentifier("config")
            ),
            undefined,
            extraPath ? [transformer.context.factory.createObjectLiteralExpression(
                [transformer.context.factory.createPropertyAssignment(
                    transformer.context.factory.createIdentifier("path"),
                    transformer.context.factory.createStringLiteral(extraPath)
                )])]:[]
        );
    },
    "$$readFile": ([file, parseJSON], transformer, callSite) => {
        const filePath = file && transformer.getStringFromNode(file, false, true);
        if (!filePath)  throw MacroError(callSite, "`readFile` macro expects a path to the JSON file as the first parameter.");
        const shouldParse = parseJSON && transformer.getBoolFromNode(parseJSON);
        if (shouldParse) {
            if (jsonFileCache[filePath]) return jsonFileCache[filePath];
        }
        else if (regFileCache[filePath]) return regFileCache[filePath];
        const fileContents = fs.readFileSync(filePath, "utf-8");
        if (shouldParse) {
            const value = primitiveToNode(JSON.parse(fileContents));
            jsonFileCache[filePath] = value;
            return value;
        } else {
            regFileCache[filePath] = fileContents;
            return ts.factory.createStringLiteral(fileContents);
        }
    },
    "$$inlineFunc": (args, transformer, callSite) => {
        const argsArr = [...args].reverse();
        const fnParam = argsArr.pop();
        if (!fnParam) throw MacroError(callSite, "`inlineFunc` macro expects an arrow function as the first argument.");
        const fn = ts.visitNode(fnParam, transformer.boundVisitor);
        if (!fn || !ts.isArrowFunction(fn)) throw MacroError(callSite, "`inlineFunc` macro expects an arrow function as the first argument.");
        if (!fn.parameters.length) {
            if (ts.isBlock(fn.body)) return fn.body.statements;
            else return fn.body;
        }
        const replacements = new Map();
        for (const param of fn.parameters) {
            if (ts.isIdentifier(param.name)) replacements.set(param.name.text, argsArr.pop());
        }
        const visitor = (node: ts.Node): ts.Node|undefined => {
            if (ts.isIdentifier(node) && replacements.has(node.text)) return replacements.get(node.text);
            return ts.visitEachChild(node, visitor, transformer.context);
        };
        transformer.context.suspendLexicalEnvironment();
        const newFn = ts.visitFunctionBody(fn.body, visitor, transformer.context);
        if (ts.isBlock(newFn)) return transformer.context.factory.createImmediatelyInvokedArrowFunction(newFn.statements);
        return newFn;
    },
    "$$kindof": (args, transformer, callSite) => { 
        if (!args.length) throw MacroError(callSite, "`kindof` macro expects a single argument.");
        return transformer.context.factory.createNumericLiteral(args[0].kind);
    },
    "$$define": ([name, value, useLet], transformer, callSite) => {
        const strContent = transformer.getStringFromNode(name, true, true);
        if (typeof strContent !== "string") throw MacroError(callSite, "`define` macro expects a string literal as the first argument.");
        const list = transformer.context.factory.createVariableDeclarationList([
            transformer.context.factory.createVariableDeclaration(strContent, undefined, undefined, value)
        ], useLet ? ts.NodeFlags.Let : ts.NodeFlags.Const);
        if (ts.isForStatement(callSite.parent)) return list;
        else return [ts.factory.createVariableStatement(undefined, list)];
    },
    "$$i": (_, transformer) => {
        if (transformer.repeat.length) return transformer.context.factory.createNumericLiteral(transformer.repeat[transformer.repeat.length - 1].index);
        else return transformer.context.factory.createNumericLiteral(-1); 
    },
    "$$length": ([arrLit], transformer, callSite) => {
        if (!arrLit) throw MacroError(callSite, "`length` macro expects an array / string literal as the first argument."); 
        if (ts.isArrayLiteralExpression(arrLit)) return transformer.context.factory.createNumericLiteral(arrLit.elements.length);
        const str = transformer.getStringFromNode(arrLit, true, true);
        if (str) return transformer.context.factory.createNumericLiteral(str.length);
        throw MacroError(callSite, "`length` macro expects an array / string literal as the first argument."); 
    },
    "$$ident": ([thing], transformer, callSite) => {
        if (!thing) throw MacroError(callSite, "`ident` macro expects a string literal as the first parameter.");
        const lastMacro = transformer.getLastMacro()?.defined || {};
        const strVal = transformer.getStringFromNode(thing, true, true);
        if (strVal) return lastMacro[strVal] || ts.factory.createIdentifier(strVal);
        else return thing;
    },
    "$$err": ([msg], transformer, callSite) => {
        const strVal = transformer.getStringFromNode(msg, false, true);
        if (!strVal) throw MacroError(callSite, "`err` macro expects a string literal as the first argument.");
        const lastMacro = transformer.macroStack.pop();
        throw MacroError(callSite, `${lastMacro ? `In macro ${lastMacro.macro.name}: ` : ""}${strVal}`);
    },
    "$$includes": ([array, item], transformer, callSite) => {
        if (!array) throw MacroError(callSite, "`includes` macro expects an array/string literal as the first argument.");
        if (!item) throw MacroError(callSite, "`includes` macro expects a second argument.");
        const strContent = transformer.getStringFromNode(array, false, true);
        if (strContent) {
            const valItem = transformer.getLiteralFromNode(item);
            if (typeof valItem !== "string") throw MacroError(callSite, "`includes` macro expects a string literal as the second argument.");
            return strContent.includes(valItem) ? ts.factory.createTrue() : ts.factory.createFalse();
        } else if (ts.isArrayLiteralExpression(array)) {
            const normalArr = array.elements.map(el => transformer.getLiteralFromNode(ts.visitNode(el, transformer.boundVisitor)));
            return normalArr.includes(transformer.getLiteralFromNode(item)) ? ts.factory.createTrue() : ts.factory.createFalse();
        } else throw MacroError(callSite, "`includes` macro expects an array/string literal as the first argument.");
    },
    "$$ts": ([code], transformer, callSite) => {
        const str = transformer.getStringFromNode(ts.visitNode(code, transformer.boundVisitor), true, true);
        if (!str) throw MacroError(callSite, "`ts` macro expects a string as it's first argument.");
        const result = ts.createSourceFile("expr", str, ts.ScriptTarget.ESNext, false, ts.ScriptKind.JS);
        const visitor = (node: ts.Node): ts.Node => {
            if (ts.isIdentifier(node)) {
                return ts.factory.createIdentifier(node.text);
            }
            return ts.visitEachChild(node, visitor, transformer.context);
        };
        return ts.visitNodes(result.statements, visitor) as unknown as Array<ts.Statement>;
    },
    "$$escape": ([code], transformer, callSite) => {
        if (!code || !ts.isArrowFunction(code)) throw MacroError(callSite, "`escape` macro expects an arrow function as it's first argument.");
        if (ts.isBlock(code.body)) {
            transformer.macros.pushEscaped(...transformer.makeHygienic(code.body.statements));
        } else {
            transformer.macros.pushEscaped(ts.factory.createExpressionStatement(code.body));
        }
    },
    "$$slice": ([thing, start, end], transformer, callSite) => {
        if (!thing) throw MacroError(callSite, "`slice` macro expects an array/string literal as the first argument.");
        const startNum = (start && transformer.getNumberFromNode(start)) || -Infinity;
        const endNum = (end && transformer.getNumberFromNode(end)) || Infinity;
        const strVal = transformer.getStringFromNode(thing, false, true);
        if (strVal) return ts.factory.createStringLiteral(strVal.slice(startNum, endNum));
        else if (ts.isArrayLiteralExpression(thing)) return ts.factory.createArrayLiteralExpression(thing.elements.slice(startNum, endNum));
        else throw MacroError(callSite, "`includes` macro expects an array/string literal as the first argument.");
    },
    "$$propsOfType": (_args, transformer, callSite) => {
        if (!callSite.typeArguments || !callSite.typeArguments[0]) throw MacroError(callSite, "`propsOfType` macro expects one type parameter.");
        const type = transformer.checker.getTypeAtLocation(callSite.typeArguments[0]);
        if (type.isTypeParameter()) {
            const param = transformer.getTypeParam(type);
            if (!param) return ts.factory.createArrayLiteralExpression();
            return ts.factory.createArrayLiteralExpression(param.getProperties().map(sym => ts.factory.createStringLiteral(sym.name)));
        } 
        else return ts.factory.createArrayLiteralExpression((type as ts.Type).getProperties().map(sym => ts.factory.createStringLiteral(sym.name)));
    },
    "$$typeToString": (_args, transformer, callSite) => {
        if (!callSite.typeArguments || !callSite.typeArguments[0]) throw MacroError(callSite, "`typeToString` macro expects one type parameter.");
        const type = transformer.checker.getTypeAtLocation(callSite.typeArguments[0]);
        if (type.isTypeParameter()) {
            const param = transformer.getTypeParam(type);
            if (!param) return ts.factory.createStringLiteral("");
            return ts.factory.createStringLiteral(transformer.checker.typeToString(param));
        } 
        else return ts.factory.createStringLiteral(transformer.checker.typeToString(type as ts.Type));
    },
    "$$comptime": (_, transformer, callSite) => {
        if (transformer.macroStack.length) throw MacroError(callSite, "`comptime` macro cannot be called inside macros.");
        const fn = callSite.arguments[0];
        if (!fn || !ts.isArrowFunction(fn)) throw MacroError(callSite, "`comptime` macro expects an arrow function as the first parameter.");
        let parent = callSite.parent;
        if (ts.isExpressionStatement(parent)) {
            parent = parent.parent;
            if (ts.isBlock(parent)) parent = parent.parent;
            if ("body" in parent) {
                const signature = transformer.checker.getSignatureFromDeclaration(parent as ts.SignatureDeclaration);
                if (!signature || !signature.declaration) return;
                transformer.comptimeSignatures.set(signature.declaration, new Function(...signature.parameters.map(p => p.name), fnBodyToString(transformer.checker, fn)) as (...args: Array<unknown>) => void);
                return;
            }
        }
        tryRun(new Function(fnBodyToString(transformer.checker, fn)) as (...args: Array<unknown>) => void);
    }
} as Record<string, (args: ts.NodeArray<ts.Expression>, transformer: MacroTransformer, callSite: ts.CallExpression) => ts.VisitResult<ts.Node>>;