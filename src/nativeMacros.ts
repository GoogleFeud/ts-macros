import ts = require("typescript");
import * as fs from "fs";
import { MacroTransformer } from "./transformer";
import * as path from "path";
import { MacroError, primitiveToNode } from "./utils";

const jsonFileCache: Record<string, ts.Expression> = {};
const regFileCache: Record<string, string> = {};

export default {
    "$$loadEnv": (args, transformer, callSite) => {
        const extraPath = args.length && ts.isStringLiteral(args[0]) ? args[0].text:"";
        let dotenv;
        try {
            dotenv = require("dotenv");
        } catch {
            throw new MacroError(callSite, "`loadEnv` macro called but `dotenv` module is not installed.");
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
        if (!filePath)  throw new MacroError(callSite, "`readFile` macro expects a path to the JSON file as the first parameter.");
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
        if (!fnParam) throw new MacroError(callSite, "`inlineFunc` macro expects an arrow function as the first argument.");
        const fn = ts.visitNode(fnParam, transformer.boundVisitor);
        if (!fn || !ts.isArrowFunction(fn)) throw new MacroError(callSite, "`inlineFunc` macro expects an arrow function as the first argument.");
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
        const newFn = ts.visitEachChild(fn, visitor, transformer.context);
        if ("statements" in newFn.body) return transformer.context.factory.createImmediatelyInvokedArrowFunction(newFn.body.statements);
        return newFn.body;
    },
    "$$kindof": (args, transformer, callSite) => { 
        if (!args.length) throw new MacroError(callSite, "`kindof` macro expects a single argument.");
        return transformer.context.factory.createNumericLiteral(args[0].kind);
    },
    "$$define": ([name, value, useLet], transformer, callSite) => {
        const strContent = transformer.getStringFromNode(name, true, true);
        if (typeof strContent !== "string") throw new MacroError(callSite, "`define` macro expects a string literal as the first argument.");
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
        if (!arrLit) throw new MacroError(callSite, "`length` macro expects an array / string literal as the first argument."); 
        if (ts.isArrayLiteralExpression(arrLit)) return transformer.context.factory.createNumericLiteral(arrLit.elements.length);
        const str = transformer.getStringFromNode(arrLit, true, true);
        if (str) return transformer.context.factory.createNumericLiteral(str.length);
        throw new MacroError(callSite, "`length` macro expects an array / string literal as the first argument."); 
    },
    "$$ident": ([thing], transformer, callSite) => {
        if (!thing) throw new MacroError(callSite, "`ident` macro expects a string literal as the first parameter.");
        const lastMacro = transformer.getLastMacro()?.defined || {};
        const strVal = transformer.getStringFromNode(thing, true, true);
        if (strVal) return lastMacro[strVal] || ts.factory.createIdentifier(strVal);
        else return thing;
    },
    "$$err": ([msg], transformer, callSite) => {
        const strVal = transformer.getStringFromNode(msg, false, true);
        if (!strVal) throw new MacroError(callSite, "`err` macro expects a string literal as the first argument.");
        const lastMacro = transformer.macroStack.pop();
        throw new MacroError(callSite, `${lastMacro ? `In macro ${lastMacro.macro.name}: ` : ""}${strVal}`);
    },
    "$$includes": ([array, item], transformer, callSite) => {
        if (!array) throw new MacroError(callSite, "`includes` macro expects an array/string literal as the first argument.");
        if (!item) throw new MacroError(callSite, "`includes` macro expects a second argument.");
        const strContent = transformer.getStringFromNode(array, false, true);
        if (strContent) {
            const valItem = transformer.getLiteralFromNode(item);
            if (typeof valItem !== "string") throw new MacroError(callSite, "`includes` macro expects a string literal as the second argument.");
            return strContent.includes(valItem) ? ts.factory.createTrue() : ts.factory.createFalse();
        } else if (ts.isArrayLiteralExpression(array)) {
            const normalArr = array.elements.map(el => transformer.getLiteralFromNode(ts.visitNode(el, transformer.boundVisitor)));
            return normalArr.includes(transformer.getLiteralFromNode(item)) ? ts.factory.createTrue() : ts.factory.createFalse();
        } else throw new MacroError(callSite, "`includes` macro expects an array/string literal as the first argument.");
    },
    "$$ts": ([code], transformer, callSite) => {
        const str = transformer.getStringFromNode(ts.visitNode(code, transformer.boundVisitor), true, true);
        if (!str) throw new MacroError(callSite, "`ts` macro expects a string as it's first argument.");
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
        if (!code || !ts.isArrowFunction(code)) throw new MacroError(callSite, "`escape` macro expects an arrow function as it's first argument.");
        if (ts.isBlock(code.body)) {
            transformer.macros.escaped.push(...transformer.makeHygienic(code.body.statements));
        } else {
            transformer.macros.escaped.push(ts.factory.createExpressionStatement(code.body));
        }
    },
    "$$slice": ([thing, start, end], transformer, callSite) => {
        if (!thing) throw new MacroError(callSite, "`slice` macro expects an array/string literal as the first argument.");
        const startNum = (start && transformer.getNumberFromNode(start)) || -Infinity;
        const endNum = (end && transformer.getNumberFromNode(end)) || Infinity;
        const strVal = transformer.getStringFromNode(thing, false, true);
        if (strVal) return ts.factory.createStringLiteral(strVal.slice(startNum, endNum));
        else if (ts.isArrayLiteralExpression(thing)) return ts.factory.createArrayLiteralExpression(thing.elements.slice(startNum, endNum));
        else throw new MacroError(callSite, "`includes` macro expects an array/string literal as the first argument.");
    },
    "$$propsOfType": (_args, transformer, callSite) => {
        if (!callSite.typeArguments || !callSite.typeArguments[0]) throw new MacroError(callSite, "`propsOfType` macro expects one type parameter.");
        const type = transformer.checker.getTypeAtLocation(callSite.typeArguments[0]);
        if (type.isTypeParameter()) {
            const param = transformer.getTypeParam(type);
            if (!param) return ts.factory.createArrayLiteralExpression();
            return ts.factory.createArrayLiteralExpression(param.getProperties().map(sym => ts.factory.createStringLiteral(sym.name)));
        } 
        else return ts.factory.createArrayLiteralExpression((type as ts.Type).getProperties().map(sym => ts.factory.createStringLiteral(sym.name)));
    },
    "$$typeToString": (_args, transformer, callSite) => {
        if (!callSite.typeArguments || !callSite.typeArguments[0]) throw new MacroError(callSite, "`typeToString` macro expects one type parameter.");
        const type = transformer.checker.getTypeAtLocation(callSite.typeArguments[0]);
        if (type.isTypeParameter()) {
            const param = transformer.getTypeParam(type);
            if (!param) return ts.factory.createStringLiteral("");
            return ts.factory.createStringLiteral(transformer.checker.typeToString(param));
        } 
        else return ts.factory.createStringLiteral(transformer.checker.typeToString(type as ts.Type));
    }
} as Record<string, (args: ts.NodeArray<ts.Expression>, transformer: MacroTransformer, callSite: ts.CallExpression) => ts.VisitResult<ts.Node>>;