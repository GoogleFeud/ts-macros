import * as ts from "typescript";
import { MacroTransformer } from "../transformer";
import { TsMacrosConfig } from "..";
export declare enum FileUpdateCause {
    ContentChange = 0,
    MacroChange = 1
}
export interface MacroTransformerWatcherActions {
    updateFile: (fileName: string, content: string, cause: FileUpdateCause, isJS?: boolean) => void;
    afterUpdate?: (isInitial: boolean) => void;
}
export declare function transpileFile(sourceFile: ts.SourceFile, printer: ts.Printer, transformer: MacroTransformer): ts.Diagnostic | string;
export declare function createMacroTransformerWatcher(configFileName: string, actions: MacroTransformerWatcherActions, jsOut?: boolean, transformerConfig?: TsMacrosConfig, inPrinter?: ts.Printer): ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>;
