import * as ts from "typescript";
import { MacroTransformer } from "./transformer";
export interface NativeMacro {
    call: (args: ts.NodeArray<ts.Expression>, transformer: MacroTransformer, callSite: ts.CallExpression) => ts.VisitResult<ts.Node | undefined>;
    preserveParams?: boolean;
}
declare const _default: Record<string, NativeMacro>;
export default _default;
