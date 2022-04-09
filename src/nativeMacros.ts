import ts = require("typescript");
import { MacroTransformer } from "./transformer";
import * as path from "path";
import { MacroError } from "./utils";

export default {
    "$$loadEnv": (args, transformer, callSite) => {
        const extraPath = args.length && ts.isStringLiteral(args[0]) ? args[0].text:"";
        let dotenv;
        try {
            dotenv = require("dotenv");
        } catch {
            throw new MacroError(callSite, "`loadEnv` macro called but `dotenv` module is not installed.");
        }
        if (extraPath) dotenv.config({path: path.join(transformer.dirname, extraPath)});
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
    "$$loadJSONAsEnv": (args, transformer, callSite) => {
        const extraPath = ts.isStringLiteral(args[0]) ? args[0].text:undefined;
        if (!extraPath) throw new MacroError(callSite, "`loadJSONAsEnv` macro expects a path to the JSON file.");
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const json = require(path.join(transformer.dirname, extraPath));
        Object.assign(process.env, json);
        transformer.props.optimizeEnv = true;
        return undefined;
    },
    "$$inlineFunc": (args, transformer, callSite) => {
        const argsArr = [...args].reverse();
        const fn = argsArr.pop();
        if (!fn || !ts.isArrowFunction(fn)) throw new MacroError(callSite, "`unwrapFunc` macro expects an arrow function as the first parameter.");
        if (!fn.parameters.length) return fn.body;
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
        if (!args.length) throw new MacroError(callSite, "`kindof` macro expects a single parameter.");
        return transformer.context.factory.createNumericLiteral(args[0].kind);
    },
    "$$const": (args, transformer, callSite) => {
        const name = args[0];
        if (!name || !ts.isStringLiteral(name)) throw new MacroError(callSite, "`define` macro expects a string literal as the first parameter.");
        const value = args[1];
        return transformer.context.factory.createVariableStatement(undefined, 
            transformer.context.factory.createVariableDeclarationList([
                transformer.context.factory.createVariableDeclaration(name.text, undefined, undefined, value)
            ], ts.NodeFlags.Const));
    },
    "$$i": (_, transformer) => {
        if (transformer.repeat.length) return transformer.context.factory.createNumericLiteral(transformer.repeat[transformer.repeat.length - 1].index);
        else return transformer.context.factory.createNumericLiteral(-1); 
    },
    "$$length": ([arrLit], transformer, callSite) => {
        if (!ts.isArrayLiteralExpression(arrLit)) throw new MacroError(callSite, "`length` macro expects an array literal as the first parameter."); 
        return transformer.context.factory.createNumericLiteral(arrLit.elements.length);
    },
    "$$ident": ([thing], transformer, callSite) => {
        if (!thing) throw new MacroError(callSite, "`ident` macro expects a string literal as the first parameter."); 
        else if (ts.isStringLiteral(thing)) return transformer.context.factory.createIdentifier(thing.text);
        else return thing;
    },
    "$$err": ([msg], transformer, callSite) => {
        if (!msg || !ts.isStringLiteral(msg)) throw new MacroError(callSite, "`err` macro expects a string literal as the first parameter."); 
        const lastMacro = transformer.macroStack.pop();
        throw new MacroError(callSite, `${lastMacro ? `In macro ${lastMacro.macro.name}: ` : ""}${msg.text}`);
    },
    "$$includes": ([array, item], transformer, callSite) => {
        if (!array || !ts.isArrayLiteralExpression(array)) throw new MacroError(callSite, "`includes` macro expects an array literal as the first parameter.");
        if (!item) throw new MacroError(callSite, "`includes` macro expects a second parameter.");
        const valItem = transformer.getLiteralFromNode(item);
        const normalArr = array.elements.map(el => transformer.getLiteralFromNode(ts.visitNode(el, transformer.boundVisitor)));
        return normalArr.includes(valItem) ? ts.factory.createTrue() : ts.factory.createFalse();
    },
    "$$ts": ([code], transformer, callSite) => {
        if (!code) throw new MacroError(callSite, "`ts` macro expects a string as it's first parameter.");
        const str = transformer.getLiteralFromNode(ts.visitNode(code, transformer.boundVisitor));
        if (!str || typeof str !== "string") throw new MacroError(callSite, "`ts` macro expects a string as it's first parameter.");
        const result = ts.createSourceFile("expr", str, ts.ScriptTarget.ESNext, false, ts.ScriptKind.JS);
        const visitor = (node: ts.Node): ts.Node => {
            if (ts.isIdentifier(node)) {
                return ts.factory.createIdentifier(node.text);
            }
            return ts.visitEachChild(node, visitor, transformer.context);
        };
        return ts.visitNodes(result.statements, visitor) as unknown as Array<ts.Statement>;
    }
} as Record<string, (args: ts.NodeArray<ts.Expression>, transformer: MacroTransformer, callSite: ts.Node) => ts.VisitResult<ts.Node>>;