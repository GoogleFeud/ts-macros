import * as ts from "typescript";
import type { ProgramTransformerExtras, PluginConfig } from "ts-patch";
import { MacroTransformer } from "../transformer";
import { TsMacrosConfig, macros } from "../index";
import { transformDeclaration } from "./declarations";
import { MacroError } from "../utils";

export function printAsTS(printer: ts.Printer, statements: ts.NodeArray<ts.Statement>, source: ts.SourceFile) : string {
    let fileText = "";
    for (const fileItem of statements) {
        fileText += printer.printNode(ts.EmitHint.Unspecified, fileItem, source);
    }
    return fileText;
}

export function patchCompilerHost(host: ts.CompilerHost | undefined, config: ts.CompilerOptions | undefined, newSourceFiles: Map<string, ts.SourceFile>, instance: typeof ts) : ts.CompilerHost {
    const compilerHost = host || instance.createCompilerHost(config || instance.getDefaultCompilerOptions(), true);
    const ogGetSourceFile = compilerHost.getSourceFile;
    return {
        ...compilerHost,
        getSourceFile(fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile) {
            if (newSourceFiles.has(fileName)) return newSourceFiles.get(fileName) as ts.SourceFile;
            else return ogGetSourceFile(fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile);
        }
    };
}

export default function (
    program: ts.Program, 
    host: ts.CompilerHost | undefined, 
    options: PluginConfig, 
    extras: ProgramTransformerExtras
) : ts.Program {
    const isTSC = process.argv[1]?.endsWith("tsc");

    const instance = extras.ts as typeof ts;
    const transformer = new MacroTransformer(instance.nullTransformationContext, program.getTypeChecker(), macros, {...options as TsMacrosConfig, keepImports: true});
    const newSourceFiles = new Map();
    const diagnostics: ts.Diagnostic[] = [];
    const compilerOptions = program.getCompilerOptions();
    const typeChecker = program.getTypeChecker();
    const printer = instance.createPrinter();

    for (const sourceFile of program.getSourceFiles()) {
        if (sourceFile.isDeclarationFile) continue;
        let localDiagnostic: ts.Diagnostic|undefined;

        let parsed;
        try {
            parsed = transformer.run(sourceFile);
        } catch(err) {
            parsed = sourceFile;
            if (err instanceof MacroError) {
                localDiagnostic = {
                    code: 8000,
                    start: err.start,
                    length: err.length,
                    messageText: err.rawMsg,
                    file: sourceFile,
                    category: ts.DiagnosticCategory.Error
                };
                diagnostics.push(localDiagnostic);
            }
        }
        if (isTSC) newSourceFiles.set(sourceFile.fileName, instance.createSourceFile(sourceFile.fileName, printAsTS(printer, parsed.statements, parsed), sourceFile.languageVersion, true, ts.ScriptKind.TS));
        else {
            const newNodes = [];
            const positions = [];
            for (const statement of parsed.statements) {
                positions.push(`${statement.pos}-${ts.isExpressionStatement(statement) ? statement.expression.kind : statement.kind}`);
                if (statement.pos === -1) {
                    const transformed = transformDeclaration(typeChecker, statement);
                    if (transformed) newNodes.push(transformed);
                }
            }
            const newNodesOnly = printAsTS(printer, instance.factory.createNodeArray(newNodes), parsed);
            const newNodesSource = instance.createSourceFile(sourceFile.fileName, sourceFile.text + "\n" + newNodesOnly, sourceFile.languageVersion, true, ts.ScriptKind.TS);
            if (localDiagnostic) newNodesSource.parseDiagnostics.push(localDiagnostic as ts.DiagnosticWithLocation);
            ts.sys.writeFile(`${sourceFile.fileName}_log.txt`, positions.join(", ") + "\n\n" + newNodesSource.text);
            newSourceFiles.set(sourceFile.fileName, newNodesSource); 
        }

    }

    return instance.createProgram(
        program.getRootFileNames(),
        compilerOptions,
        patchCompilerHost(host, compilerOptions, newSourceFiles, instance),
        undefined,
        diagnostics
    );
}