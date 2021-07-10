
import * as ts from "typescript";
import { MacroTransformer } from "./transformer";

export default (program: ts.Program): ts.TransformerFactory<ts.Node> => ctx => {
    return firstNode => {
        return new MacroTransformer(ctx).run(firstNode);
    };
};