import ts = require("typescript");
import { Macro } from "../transformer";
export declare function generateChainingTypings(checker: ts.TypeChecker, macros: Map<ts.Symbol, Macro>): ts.Statement[];
