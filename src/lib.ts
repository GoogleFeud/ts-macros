import ts = require("typescript");
import { Macro, MacroParamMarkers, MacroTransformer } from "./transformer";
import { createMacroObject } from "./utils";


export function loadLib(transformer: MacroTransformer, libName: string) : Map<string, Macro>|undefined {
    if (transformer.external.has(libName)) return transformer.external.get(libName);
    const fileHost = transformer.context.getEmitHost();
    if (fileHost.readFile && fileHost.fileExists(`node_modules/${libName}/macros.ts`)) {
        const content = fileHost.readFile(`node_modules/${libName}/macros.ts`) || "";
        const sourceFile = ts.createSourceFile("macros.ts", content, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
        const macroMap = new Map();
        for (const statement of sourceFile.statements) {
            if (ts.isFunctionDeclaration(statement) && statement.name) {
                const name = statement.name.getText();
                macroMap.set(name, createMacroObject(name, statement, (param) => {
                    switch (param.name.getText()) {
                    case "Save": return MacroParamMarkers.Save;
                    case "Accumulator": return MacroParamMarkers.Accumulator;
                    default: return MacroParamMarkers.None;
                    }
                }));
            }
        }
        transformer.external.set(libName, macroMap);
        return macroMap;
    }
}

export function getExternalMacro(transformer: MacroTransformer, macroSym: ts.Symbol) : Macro|undefined {
    if (!macroSym.declarations?.[0]) return;
    let libName;
    const importStmt = macroSym?.declarations?.[0];
    if (ts.isImportSpecifier(importStmt)) libName = (importStmt.parent.parent.parent.moduleSpecifier as ts.StringLiteral).text;
    else if (ts.isImportClause(importStmt)) libName = (importStmt.parent.moduleSpecifier as ts.StringLiteral).text;
    else return;
    const hasSlash = libName.indexOf("/");
    if (hasSlash !== -1) libName = libName.slice(0, hasSlash);

    const externalLib = loadLib(transformer, libName);
    if (!externalLib) return;
    if (externalLib.has(macroSym.name)) {
        const macro = externalLib.get(macroSym.name) as Macro;
        transformer.macros.set(macroSym, macro);
        return macro;
    }
}