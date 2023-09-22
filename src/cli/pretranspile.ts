import * as ts from "typescript";
import * as path from "path";
import * as childProcess from "child_process";
import * as fs from "fs";
import { MacroTransformer } from "../transformer";
import { TsMacrosConfig, macros } from "..";

export interface PretranspileSettings {
    dist: string,
    exec?: string,
    tsconfig?: string,
    cleanup?: boolean,
    watch?: boolean,
    noComptime?: boolean,
}

export function pretranspileFile(sourceFile: ts.SourceFile, printer: ts.Printer, transformer: MacroTransformer) : string {
    const newSourceFile = transformer.run(sourceFile);
    return printer.printFile(newSourceFile);
}

export function createFile(providedPath: string, content: string) : void {
    const withoutFilename = providedPath.slice(0, providedPath.lastIndexOf(path.sep));
    if (!fs.existsSync(withoutFilename)) fs.mkdirSync(withoutFilename, { recursive: true });
    fs.writeFileSync(providedPath, content);
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
        const host = ts.createWatchCompilerHost(config, { noEmit: true }, ts.sys, ts.createSemanticDiagnosticsBuilderProgram, undefined, undefined, undefined, undefined);
        const oldWrite = host.writeFile;
        host.writeFile = (path, data) => {
            console.log("WRITING:", path);
            return oldWrite?.(path, data);
        };
        const oldCreateProgram = host.createProgram;
        const transformer = new MacroTransformer(ts.nullTransformationContext, (undefined as unknown as ts.TypeChecker), macros, transformerConfig);
        host.createProgram = (rootNames, options, host, oldProgram) => {
            const newProgram = oldCreateProgram(rootNames, options, host, oldProgram);
            transformer.checker = newProgram.getProgram().getTypeChecker();
            const sourceFiles = [];
            for (const source of newProgram.getProgram().getSourceFiles()) {
                if (source.isDeclarationFile) continue;
                const oldSource = oldProgram?.getSourceFile(source.fileName);
                if (!oldSource || oldSource.version !== source.version) {
                    const transpiled = pretranspileFile(source, printer, transformer);
                    sourceFiles.push(ts.createSourceFile(source.fileName, transpiled, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS));
                    createFile(path.join(process.cwd(), settings.dist, source.fileName.slice(process.cwd().length)), transpiled);
                }
            }
            return newProgram;
        };
        ts.createWatchProgram(host);
    } else {
        const readConfig = ts.parseConfigFileWithSystem(config, ts.getDefaultCompilerOptions(), undefined, undefined, ts.sys, () => undefined);
        if (!readConfig) return [createAnonDiagnostic("Couldn't read tsconfig.json file.")];
        if (readConfig.errors.length) return readConfig.errors;
        const program = ts.createProgram({
            rootNames: readConfig.fileNames,
            options: readConfig.options
        });
        const transformer = new MacroTransformer(ts.nullTransformationContext, program.getTypeChecker(), macros, transformerConfig);
        for (const file of program.getSourceFiles()) {
            if (file.isDeclarationFile) continue;
            createFile(path.join(process.cwd(), settings.dist, file.fileName.slice(process.cwd().length)), pretranspileFile(file, printer, transformer));
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