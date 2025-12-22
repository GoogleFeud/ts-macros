import * as ts from "typescript";
import type { ProgramTransformerExtras, PluginConfig } from "ts-patch";
import { TsMacrosConfig } from "../index";
export declare function patchCompilerHost(host: ts.CompilerHost | undefined, config: ts.CompilerOptions | undefined, newSourceFiles: Map<string, ts.SourceFile>, instance: typeof ts): ts.CompilerHost;
export declare function extractGeneratedTypes(typeChecker: ts.TypeChecker, parsedSourceFile: ts.SourceFile): {
    typeNodes: ts.Statement[];
    chainTypes: ts.Statement[];
    print: (statements: ts.Statement[]) => string;
};
export default function (program: ts.Program, host: ts.CompilerHost | undefined, options: PluginConfig & TsMacrosConfig, extras: ProgramTransformerExtras): ts.Program;
