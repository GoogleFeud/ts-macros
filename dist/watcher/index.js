"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUpdateCause = void 0;
exports.transpileFile = transpileFile;
exports.createMacroTransformerWatcher = createMacroTransformerWatcher;
const ts = require("typescript");
const transformer_1 = require("../transformer");
const __1 = require("..");
const utils_1 = require("../utils");
var FileUpdateCause;
(function (FileUpdateCause) {
    FileUpdateCause[FileUpdateCause["ContentChange"] = 0] = "ContentChange";
    FileUpdateCause[FileUpdateCause["MacroChange"] = 1] = "MacroChange";
})(FileUpdateCause || (exports.FileUpdateCause = FileUpdateCause = {}));
function transpileFile(sourceFile, printer, transformer) {
    try {
        const transformed = transformer.run(sourceFile);
        return printer.printFile(transformed);
    }
    catch (err) {
        if (err instanceof utils_1.MacroError)
            return (0, utils_1.genDiagnosticFromMacroError)(sourceFile, err);
        else
            throw err;
    }
}
function createMacroTransformerWatcher(configFileName, actions, jsOut, transformerConfig, inPrinter) {
    const printer = inPrinter || ts.createPrinter(), host = ts.createWatchCompilerHost(configFileName, { noEmit: true }, ts.sys, ts.createSemanticDiagnosticsBuilderProgram, undefined, undefined, undefined, undefined), oldCreateProgram = host.createProgram, macrosCreatedInFile = new utils_1.MapArray(), macrosReferencedInFiles = new utils_1.MapArray(), transformer = new transformer_1.MacroTransformer(ts.nullTransformationContext, undefined, __1.macros, transformerConfig, {
        beforeRegisterMacro(transformer, _symbol, macro) {
            transformer.cleanupMacros(macro, (oldMacro) => macrosReferencedInFiles.transferKey(oldMacro, macro));
            macrosCreatedInFile.push(macro.node.getSourceFile().fileName, macro);
        },
        beforeCallMacro(_transformer, macro, expand) {
            if (!expand.call)
                return;
            macrosReferencedInFiles.push(macro, expand.call.getSourceFile().fileName);
        },
        beforeFileTransform(_transformer, sourceFile) {
            macrosCreatedInFile.clearArray(sourceFile.fileName);
            macrosReferencedInFiles.deleteEntry(sourceFile.fileName);
        },
    }), getFilesThatNeedChanges = (origin) => {
        const ownedMacros = macrosCreatedInFile.get(origin);
        if (!ownedMacros)
            return [];
        const files = [];
        for (const macro of ownedMacros) {
            const macroIsReferencedIn = macrosReferencedInFiles.get(macro);
            if (!macroIsReferencedIn)
                continue;
            files.push(...macroIsReferencedIn);
        }
        return files;
    };
    host.createProgram = (rootNames, options, host, oldProgram) => {
        var _a;
        const errors = [];
        const newProgram = oldCreateProgram(rootNames, options, host, oldProgram, errors);
        transformer.checker = newProgram.getProgram().getTypeChecker();
        const forcedFilesToGetTranspiled = [];
        for (const source of newProgram.getProgram().getSourceFiles()) {
            if (source.isDeclarationFile)
                continue;
            //@ts-expect-error Bypass
            newProgram.getSemanticDiagnostics(source).length = 0;
            const oldSource = oldProgram === null || oldProgram === void 0 ? void 0 : oldProgram.getSourceFile(source.fileName);
            const isForced = forcedFilesToGetTranspiled.includes(source.fileName);
            if (!oldSource || oldSource.version !== source.version || isForced) {
                const transpiled = transpileFile(source, printer, transformer);
                if (typeof transpiled === "string") {
                    forcedFilesToGetTranspiled.push(...getFilesThatNeedChanges(source.fileName));
                    actions.updateFile(source.fileName, jsOut ? ts.transpile(transpiled, newProgram.getCompilerOptions()) : transpiled, isForced ? FileUpdateCause.MacroChange : FileUpdateCause.ContentChange, jsOut);
                }
                else
                    errors.push(transpiled);
            }
        }
        (_a = actions.afterUpdate) === null || _a === void 0 ? void 0 : _a.call(actions, !!oldProgram);
        return newProgram;
    };
    return ts.createWatchProgram(host);
}
