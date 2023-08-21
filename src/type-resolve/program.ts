import * as ts from "typescript";
import type { ProgramTransformerExtras, PluginConfig } from "ts-patch";
import { MacroTransformer } from "../transformer";
import { TsMacrosConfig, macros } from "../index";

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
    const transformer = new MacroTransformer(instance.nullTransformationContext, program.getTypeChecker(), macros, options as TsMacrosConfig);
    const newSourceFiles = new Map();
    const compilerOptions = program.getCompilerOptions();
    const printer = instance.createPrinter();

    for (const sourceFile of program.getSourceFiles()) {
        if (sourceFile.isDeclarationFile) continue;
    
        const parsed = transformer.run(sourceFile);
        if (!instance.isSourceFile(parsed)) continue;
        if (isTSC) newSourceFiles.set(sourceFile.fileName, instance.createSourceFile(sourceFile.fileName, printAsTS(printer, parsed.statements, parsed), sourceFile.languageVersion, true, ts.ScriptKind.TS));
        else {
            const newNodes = [];
            for (const statement of parsed.statements) {
                if (statement.pos === -1 && (ts.isTypeDeclaration(statement) || ts.isVariableStatement(statement))) {
                    newNodes.push(statement);
                }
            }
            const newNodesOnly = printAsTS(printer, instance.factory.createNodeArray(newNodes), parsed);
            const newNodesSource = instance.createSourceFile(sourceFile.fileName, sourceFile.text + "\n" + newNodesOnly, sourceFile.languageVersion, true, ts.ScriptKind.TS);
            ts.sys.writeFile(`${sourceFile.fileName}_log.txt`, newNodesSource.text);
            newSourceFiles.set(sourceFile.fileName, newNodesSource); 
        }
    }

    return instance.createProgram(
        program.getRootFileNames(),
        compilerOptions,
        patchCompilerHost(host, compilerOptions, newSourceFiles, instance)
    );
}