import ts = require("typescript");
import { MacroTransformer } from "./transformer";
import * as path from "path";

export default {
    "$$loadEnv": (args, transformer) => {
        const extraPath = args.length && ts.isStringLiteral(args[0]) ? args[0].text:"";
        let dotenv;
        try {
            dotenv = require("dotenv");
        } catch {
            throw new Error("`loadEnv` macro called but `dotenv` module is not installed.");
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
          )
    },
    "$$loadJSONAsEnv": (args, transformer) => {
      const extraPath = ts.isStringLiteral(args[0]) ? args[0].text:undefined;
      if (!extraPath) throw new Error("`loadJSONAsEnv` macro expects a path to the JSON file.");
      const json = require(path.join(transformer.dirname, extraPath));
      Object.assign(process.env, json);
      transformer.props.optimizeEnv = true;
      return undefined;
    },
    "$$inlineFunc": (args, transformer) => {
      const argsArr = [...args].reverse();
      const fn = argsArr.pop();
      if (!fn || !ts.isArrowFunction(fn)) throw new Error("`unwrapFunc` macro expects an arrow function as the first parameter.");
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
    "$$kindof": (args, transformer) => { 
      if (!args.length) throw new Error("`kindof` macro expects a single parameter.");
      return transformer.context.factory.createNumericLiteral(args[0].kind);
    },
    "$$const": (args, transformer) => {
      const name = args[0];
      if (!name || !ts.isStringLiteral(name)) throw new Error("`define` macro expects a string literal as the first parameter.");
      const value = args[1];
      return transformer.context.factory.createVariableStatement(undefined, 
        transformer.context.factory.createVariableDeclarationList([
          transformer.context.factory.createVariableDeclaration(name.text, undefined, undefined, value)
        ], ts.NodeFlags.Const));
    },
    "$$i": (_, transformer) => {
      if (transformer.repeat.length) return transformer.context.factory.createNumericLiteral(transformer.repeat[transformer.repeat.length - 1]);
      else return transformer.context.factory.createNumericLiteral(-1); 
    },
    "$$length": ([arrLit], transformer) => {
      if (!ts.isArrayLiteralExpression(arrLit)) throw new Error("`length` macro expects an array literal as the first parameter."); 
      return transformer.context.factory.createNumericLiteral(arrLit.elements.length);
    },
    "$$ident": ([thing], transformer) => {
      if (!thing) throw new Error("`ident` macro expects a string literal as the first parameter."); 
      else if (ts.isStringLiteral(thing)) return transformer.context.factory.createIdentifier(thing.text);
      else return thing;
    }
} as Record<string, (args: ts.NodeArray<ts.Expression>, transformer: MacroTransformer) => ts.VisitResult<ts.Node>>