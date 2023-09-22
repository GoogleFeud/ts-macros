import * as ts from "typescript";
import * as path from "path";
import * as childProcess from "child_process";
import * as fs from "fs";
import { MacroTransformer } from "../transformer";
import { TsMacrosConfig, macros } from "..";
import { createMacroTransformerWatcher } from "../watcher";

export interface PretranspileSettings {
    dist: string,
    exec?: string,
    tsconfig?: string,
    cleanup?: boolean,
    watch?: boolean,
    noComptime?: boolean,
    emitjs?: boolean
}

export function transformFile(sourceFile: ts.SourceFile, printer: ts.Printer, transformer: MacroTransformer) : string {
    const newSourceFile = transformer.run(sourceFile);
    return printer.printFile(newSourceFile);
}

export function createFile(providedPath: string, content: string, jsExtension?: boolean) : void {
    const withoutFilename = providedPath.slice(0, providedPath.lastIndexOf(path.sep));
    if (!fs.existsSync(withoutFilename)) fs.mkdirSync(withoutFilename, { recursive: true });
    fs.writeFileSync(jsExtension ? providedPath.slice(0, -3) + ".js" : providedPath, content);
}

export function createAnonDiagnostic(message: string) : ts.Diagnostic {
    return ts.createCompilerDiagnostic({
        key: "Errror",
        code: 8000,
        message,
        category: ts.DiagnosticCategory.Error
    });
}

export function pretranspile(settings: PretranspileSettings) : ts.Diagnostic[] | undefined {
    const config = settings.tsconfig || ts.findConfigFile(process.cwd(), ts.sys.fileExists, "tsconfig.json");
    if (!config) return [createAnonDiagnostic( "Couldn't find tsconfig.json file.")];

    const distPath = path.join(process.cwd(), settings.dist);
    if (!fs.existsSync(distPath)) fs.mkdirSync(distPath, { recursive: true });

    const transformerConfig: TsMacrosConfig = { noComptime: settings.noComptime, keepImports: true };
    const printer = ts.createPrinter();

    if (settings.watch) {
        createMacroTransformerWatcher(config, {
            updateFile: (fileName, content) => createFile(path.join(process.cwd(), settings.dist, fileName.slice(process.cwd().length)), content, settings.emitjs)
        }, settings.emitjs, transformerConfig, printer);
    } else {
        const readConfig = ts.parseConfigFileWithSystem(config, {}, undefined, undefined, ts.sys, () => undefined);
        if (!readConfig) return [createAnonDiagnostic("Couldn't read tsconfig.json file.")];
        if (readConfig.errors.length) return readConfig.errors;
        const program = ts.createProgram({
            rootNames: readConfig.fileNames,
            options: readConfig.options
        });
        const transformer = new MacroTransformer(ts.nullTransformationContext, program.getTypeChecker(), macros, transformerConfig);
        for (const file of program.getSourceFiles()) {
            if (file.isDeclarationFile) continue;
            const transformed = transformFile(file, printer, transformer);
            createFile(path.join(process.cwd(), settings.dist, file.fileName.slice(process.cwd().length)), settings.emitjs ? ts.transpile(transformed, program.getCompilerOptions()) : transformed, settings.emitjs);
        }

        if (settings.exec) childProcess.execSync(settings.exec);
        if (settings.cleanup) fs.rmSync(settings.dist, { recursive: true, force: true });
    }
}

export function validateSettings(settings: Record<string, unknown>) : string[] {
    const errors = [];
    if (settings.exec && typeof settings.exec !== "string") errors.push("Expected exec to be a string");
    if (settings.tsconfig && typeof settings.tsconfig !== "string") errors.push("Expected tsconfig to be a string");
    return errors;
}