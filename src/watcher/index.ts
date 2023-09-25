import * as ts from "typescript";
import { Macro, MacroTransformer } from "../transformer";
import { TsMacrosConfig, macros } from "..";
import { MacroError, MapArray, genDiagnosticFromMacroError } from "../utils";

export enum FileUpdateCause {
    ContentChange,
    MacroChange
}

export interface MacroTransformerWatcherActions {
    updateFile: (fileName: string, content: string, cause: FileUpdateCause, isJS?: boolean) => void,
    afterUpdate?: (isInitial: boolean) => void
}

export function transpileFile(sourceFile: ts.SourceFile, printer: ts.Printer, transformer: MacroTransformer) : ts.Diagnostic | string {
    try {
        const transformed = transformer.run(sourceFile);
        return printer.printFile(transformed);
    } catch(err) {
        if (err instanceof MacroError) return genDiagnosticFromMacroError(sourceFile, err);
        else throw err;
    }
}

export function createMacroTransformerWatcher(configFileName: string, actions: MacroTransformerWatcherActions, jsOut?: boolean, transformerConfig?: TsMacrosConfig, inPrinter?: ts.Printer) : ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram> {
    const printer = inPrinter || ts.createPrinter(),
        host = ts.createWatchCompilerHost(configFileName, { noEmit: true }, ts.sys, ts.createSemanticDiagnosticsBuilderProgram, undefined, undefined, undefined, undefined),
        oldCreateProgram = host.createProgram,
        macrosCreatedInFile = new MapArray<string, Macro>(),
        macrosReferencedInFiles = new MapArray<Macro, string>(),
        transformer = new MacroTransformer(ts.nullTransformationContext, (undefined as unknown as ts.TypeChecker), macros, transformerConfig, {
            beforeRegisterMacro(transformer, _symbol, macro) {
                transformer.cleanupMacros(macro, (oldMacro) => macrosReferencedInFiles.transferKey(oldMacro, macro));
                macrosCreatedInFile.push(macro.node.getSourceFile().fileName, macro);
            },
            beforeCallMacro(_transformer, macro, expand) {
                if (!expand.call) return;
                macrosReferencedInFiles.push(macro, expand.call.getSourceFile().fileName);
            },
            beforeFileTransform(_transformer, sourceFile) {
                macrosCreatedInFile.clearArray(sourceFile.fileName);
                macrosReferencedInFiles.deleteEntry(sourceFile.fileName);
            },
        }),
        getFilesThatNeedChanges = (origin: string) : string[] => {
            const ownedMacros = macrosCreatedInFile.get(origin);
            if (!ownedMacros) return [];
            const files = [];
            for (const macro of ownedMacros) {
                const macroIsReferencedIn = macrosReferencedInFiles.get(macro);
                if (!macroIsReferencedIn) continue;
                files.push(...macroIsReferencedIn);
            }
            return files;
        };

    host.createProgram = (rootNames, options, host, oldProgram) => {
        const errors: ts.Diagnostic[] = [];
        const newProgram = oldCreateProgram(rootNames, options, host, oldProgram, errors);
        transformer.checker = newProgram.getProgram().getTypeChecker();

        const forcedFilesToGetTranspiled: string[] = [];

        for (const source of newProgram.getProgram().getSourceFiles()) {
            if (source.isDeclarationFile) continue;
            //@ts-expect-error Bypass
            newProgram.getSemanticDiagnostics(source).length = 0;
            const oldSource = oldProgram?.getSourceFile(source.fileName);

            const isForced = forcedFilesToGetTranspiled.includes(source.fileName);

            if (!oldSource || oldSource.version !== source.version || isForced) {
                const transpiled = transpileFile(source, printer, transformer);
                if (typeof transpiled === "string") {
                    forcedFilesToGetTranspiled.push(...getFilesThatNeedChanges(source.fileName));
                    actions.updateFile(source.fileName, jsOut ? ts.transpile(transpiled, newProgram.getCompilerOptions()) : transpiled, isForced ? FileUpdateCause.MacroChange : FileUpdateCause.ContentChange, jsOut);
                } else errors.push(transpiled);
            }
        }
        actions.afterUpdate?.(!!oldProgram);
        return newProgram;
    };
    return ts.createWatchProgram(host);
}