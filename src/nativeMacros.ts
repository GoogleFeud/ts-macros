import ts = require("typescript");
import { MacroTransformer } from "./transformer";
import * as path from "path";

export default {
    "$$loadEnv": (args: ts.NodeArray<ts.Expression>, transformer: MacroTransformer) => {
        const extraPath = args.length && ts.isStringLiteral(args[0]) ? args[0].text:"";
        let dotenv;
        try {
            dotenv = require("dotenv");
        } catch {
            throw new Error("`loadEnv` macro called but `dotenv` module is not installed.");
        }
        dotenv.config({path: path.join(transformer.dirname, extraPath)});
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
    "$$loadJSONAsEnv": (args: ts.NodeArray<ts.Expression>, transformer: MacroTransformer) => {
      const extraPath = ts.isStringLiteral(args[0]) ? args[0].text:undefined;
      if (!extraPath) throw new Error("`loadJSONAsEnv` macro expects a path to the JSON file.");
      const json = require(path.join(transformer.dirname, extraPath));
      Object.assign(process.env, json);
      transformer.props.optimizeEnv = true;
      return undefined;
    },
    "$$inlineFunc": (args: ts.NodeArray<ts.Expression>, transformer: MacroTransformer) => {
      const fn = args[0];
      if (!ts.isArrowFunction(fn)) throw new Error("`unwrapFunc` macro expects an arrow function as the first parameter.");
      if (fn.parameters.length) throw new Error("`unwrapFunc` function must have no parameters.");
      return fn.body;
    }
} as Record<string, (args: ts.NodeArray<ts.Expression>, transformer: MacroTransformer) => ts.Node|undefined>