"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchCompilerHost = patchCompilerHost;
exports.extractGeneratedTypes = extractGeneratedTypes;
exports.default = default_1;
const ts = require("typescript");
const transformer_1 = require("../transformer");
const index_1 = require("../index");
const declarations_1 = require("./declarations");
const utils_1 = require("../utils");
const chainingTypes_1 = require("./chainingTypes");
function printAsTS(printer, statements, source) {
    let fileText = "";
    for (const fileItem of statements) {
        fileText += printer.printNode(ts.EmitHint.Unspecified, fileItem, source);
    }
    return fileText;
}
function patchCompilerHost(host, config, newSourceFiles, instance) {
    const compilerHost = host || instance.createCompilerHost(config || instance.getDefaultCompilerOptions(), true);
    const ogGetSourceFile = compilerHost.getSourceFile;
    return Object.assign(Object.assign({}, compilerHost), { getSourceFile(fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile) {
            if (newSourceFiles.has(fileName))
                return newSourceFiles.get(fileName);
            else
                return ogGetSourceFile(fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile);
        } });
}
function extractGeneratedTypes(typeChecker, parsedSourceFile) {
    const newNodes = [];
    for (const statement of parsedSourceFile.statements) {
        if (statement.pos === -1) {
            const transformed = (0, declarations_1.transformDeclaration)(typeChecker, statement);
            if (transformed)
                newNodes.push(transformed);
        }
    }
    const printer = ts.createPrinter();
    return {
        typeNodes: newNodes,
        chainTypes: (0, chainingTypes_1.generateChainingTypings)(typeChecker, index_1.macros),
        print: (statements) => printAsTS(printer, statements, parsedSourceFile)
    };
}
function default_1(program, host, options, extras) {
    var _a;
    const isTSC = (_a = process.argv[1]) === null || _a === void 0 ? void 0 : _a.endsWith("tsc");
    const instance = extras.ts;
    const transformer = new transformer_1.MacroTransformer(instance.nullTransformationContext, program.getTypeChecker(), index_1.macros, Object.assign(Object.assign({}, options), { keepImports: true }), {
        beforeRegisterMacro: (transformer, _sym, macro) => transformer.cleanupMacros(macro)
    });
    const newSourceFiles = new Map();
    const diagnostics = [];
    const compilerOptions = program.getCompilerOptions();
    const typeChecker = program.getTypeChecker();
    const printer = instance.createPrinter();
    const sourceFiles = program.getSourceFiles();
    for (let i = 0; i < sourceFiles.length; i++) {
        const sourceFile = sourceFiles[i];
        if (sourceFile.isDeclarationFile)
            continue;
        let localDiagnostic;
        let parsed;
        try {
            parsed = transformer.run(sourceFile);
        }
        catch (err) {
            parsed = sourceFile;
            if (err instanceof utils_1.MacroError) {
                localDiagnostic = (0, utils_1.genDiagnosticFromMacroError)(sourceFile, err);
                diagnostics.push(localDiagnostic);
            }
        }
        if (isTSC)
            newSourceFiles.set(sourceFile.fileName, instance.createSourceFile(sourceFile.fileName, printer.printFile(parsed), sourceFile.languageVersion, true, ts.ScriptKind.TS));
        else {
            const newNodes = [];
            for (const statement of parsed.statements) {
                if (statement.pos === -1) {
                    const transformed = (0, declarations_1.transformDeclaration)(typeChecker, statement);
                    if (transformed)
                        newNodes.push(transformed);
                }
            }
            if (i === sourceFiles.length - 1) {
                newNodes.push(...(0, chainingTypes_1.generateChainingTypings)(typeChecker, index_1.macros));
            }
            const newNodesOnly = printAsTS(printer, newNodes, parsed);
            const newNodesSource = instance.createSourceFile(sourceFile.fileName, sourceFile.text + "\n" + newNodesOnly, sourceFile.languageVersion, true, ts.ScriptKind.TS);
            if (localDiagnostic)
                newNodesSource.parseDiagnostics.push(localDiagnostic);
            if (options.logFileData)
                ts.sys.writeFile(`${sourceFile.fileName}_log.txt`, `Generated at: ${new Date()}\nMacros: ${index_1.macros.size}\nNew node kinds: ${newNodes.map(n => ts.SyntaxKind[n.kind]).join(", ")}\nFull source:\n\n${newNodesSource.text}`);
            newSourceFiles.set(sourceFile.fileName, newNodesSource);
        }
    }
    return instance.createProgram(program.getRootFileNames(), compilerOptions, patchCompilerHost(host, compilerOptions, newSourceFiles, instance), undefined, diagnostics);
}
