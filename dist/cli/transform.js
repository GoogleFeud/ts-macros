"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformFile = transformFile;
exports.createFile = createFile;
exports.createAnonDiagnostic = createAnonDiagnostic;
exports.pretranspile = pretranspile;
exports.validateSettings = validateSettings;
const ts = require("typescript");
const path = require("path");
const childProcess = require("child_process");
const fs = require("fs");
const transformer_1 = require("../transformer");
const __1 = require("..");
const watcher_1 = require("../watcher");
function transformFile(sourceFile, printer, transformer) {
    const newSourceFile = transformer.run(sourceFile);
    return printer.printFile(newSourceFile);
}
function createFile(providedPath, content, jsExtension) {
    const withoutFilename = providedPath.slice(0, providedPath.lastIndexOf(path.sep));
    if (!fs.existsSync(withoutFilename))
        fs.mkdirSync(withoutFilename, { recursive: true });
    fs.writeFileSync(jsExtension ? providedPath.slice(0, -3) + ".js" : providedPath, content);
}
function createAnonDiagnostic(message) {
    return ts.createCompilerDiagnostic({
        key: "Errror",
        code: 8000,
        message,
        category: ts.DiagnosticCategory.Error
    });
}
function pretranspile(settings) {
    const config = settings.tsconfig || ts.findConfigFile(process.cwd(), ts.sys.fileExists, "tsconfig.json");
    if (!config)
        return [createAnonDiagnostic("Couldn't find tsconfig.json file.")];
    const distPath = path.join(process.cwd(), settings.dist);
    if (!fs.existsSync(distPath))
        fs.mkdirSync(distPath, { recursive: true });
    const transformerConfig = { noComptime: settings.nocomptime, keepImports: true };
    const printer = ts.createPrinter();
    if (settings.watch) {
        (0, watcher_1.createMacroTransformerWatcher)(config, {
            updateFile: (fileName, content) => createFile(path.join(process.cwd(), settings.dist, fileName.slice(process.cwd().length)), content, settings.emitjs),
            afterUpdate: settings.exec ? (isInitial) => isInitial && childProcess.exec(settings.exec) : undefined
        }, settings.emitjs, transformerConfig, printer);
    }
    else {
        const readConfig = ts.parseConfigFileWithSystem(config, {}, undefined, undefined, ts.sys, () => undefined);
        if (!readConfig)
            return [createAnonDiagnostic("Couldn't read tsconfig.json file.")];
        if (readConfig.errors.length)
            return readConfig.errors;
        const program = ts.createProgram({
            rootNames: readConfig.fileNames,
            options: readConfig.options
        });
        const transformer = new transformer_1.MacroTransformer(ts.nullTransformationContext, program.getTypeChecker(), __1.macros, transformerConfig);
        for (const file of program.getSourceFiles()) {
            if (file.isDeclarationFile)
                continue;
            const transformed = transformFile(file, printer, transformer);
            createFile(path.join(process.cwd(), settings.dist, file.fileName.slice(process.cwd().length)), settings.emitjs ? ts.transpile(transformed, program.getCompilerOptions()) : transformed, settings.emitjs);
        }
        if (settings.exec)
            childProcess.execSync(settings.exec);
        if (settings.cleanup)
            fs.rmSync(settings.dist, { recursive: true, force: true });
    }
}
function validateSettings(settings) {
    const errors = [];
    if (settings.exec && typeof settings.exec !== "string")
        errors.push("Expected exec to be a string");
    if (settings.tsconfig && typeof settings.tsconfig !== "string")
        errors.push("Expected tsconfig to be a string");
    return errors;
}
