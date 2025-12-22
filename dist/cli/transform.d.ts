import * as ts from "typescript";
import { MacroTransformer } from "../transformer";
export interface PretranspileSettings {
    dist: string;
    exec?: string;
    tsconfig?: string;
    cleanup?: boolean;
    watch?: boolean;
    nocomptime?: boolean;
    emitjs?: boolean;
}
export declare function transformFile(sourceFile: ts.SourceFile, printer: ts.Printer, transformer: MacroTransformer): string;
export declare function createFile(providedPath: string, content: string, jsExtension?: boolean): void;
export declare function createAnonDiagnostic(message: string): ts.Diagnostic;
export declare function pretranspile(settings: PretranspileSettings): ts.Diagnostic[] | undefined;
export declare function validateSettings(settings: Record<string, unknown>): string[];
