
import ts from "typescript";
import TsMacros, { macros } from "../../dist";

export const Markers = `
declare function $$loadEnv(path?: string) : void;
declare function $$readFile(path: string, parseJSON?: false) : string;
declare function $$inlineFunc<R = any>(func: Function, ...params: Array<unknown>) : R;
declare function $$kindof(ast: unknown) : number;
declare function $$define(varname: string, initializer: unknown, let?: boolean) : number;
declare function $$i() : number;
declare function $$length(arr: Array<any>|string) : number;
declare function $$ident(str: string) : any;
declare function $$err(str: string) : void;
declare function $$includes<T>(arr: Array<T>, val: T) : boolean;
declare function $$includes(arr: string, val: string) : boolean;
declare function $$slice<T>(str: Array<T>, start?: number, end?: number) : Array<T>;
declare function $$slice(str: string, start?: number, end?: number) : string;
declare function $$ts<T = unknown>(code: string) : T;
declare function $$escape(code: () => void) : any;
declare function $$typeToString<T>() : string;
declare function $$propsOfType<T>() : Array<string>;
declare function $$comptime(fn: () => void) : void;
interface RawContext {
    ts: any,
    factory: any,
    transformer: any,
    checker: any,
    thisMacro: any
}
declare function $$raw<T>(fn: (ctx: RawContext, ...args: any[]) => ts.Node | ts.Node[] | undefined) : T;
declare function $$setStore(key: string, value: any) : void;
declare function $$getStore<T>(key: string) : T;
type Accumulator = number & { __marker?: "Accumulator" };
type Save<T> = T & { __marker?: "Save" }
const enum LabelKinds {
    If,
    ForIter,
    For,
    While,
    Block
}
interface IfLabel {
    kind: LabelKinds.If
    condition: any,
    then: any,
    else: any
}
interface ForIterLabel {
    kind: LabelKinds.ForIter,
    type: "in" | "of",
    initializer: any,
    iterator: any,
    statement: any
}
interface ForLabel {
    kind: LabelKinds.For,
    initializer: {
        expression?: any,
        variables?: Array<[variableName: string, initializer: any]>
    },
    condition: any,
    increment: any,
    statement: any
}
interface WhileLabel {
    kind: LabelKinds.While,
    do: boolean,
    condition: any,
    statement: any
}
interface BlockLabel {
    kind: LabelKinds.Block,
    statement: any
}
type Label = IfLabel | ForIterLabel | ForLabel | WhileLabel | BlockLabel;

`;

export const CompilerOptions: ts.CompilerOptions = {
    ...ts.getDefaultCompilerOptions(),                    
    noImplicitAny: true,                          
    strictNullChecks: true,
    target: ts.ScriptTarget.ESNext     
};

export function genTranspile(lib: string) : (str: string) => { code?: string, error?: unknown} {
    const LibFile = ts.createSourceFile("lib.d.ts", lib, CompilerOptions.target || ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
    return (str) => {
        console.log("HMM?:", str);
        const SourceFile = ts.createSourceFile("module.ts", Markers + str, CompilerOptions.target || ts.ScriptTarget.ESNext, true);
        let output = "";
        const CompilerHost: ts.CompilerHost = {
            getSourceFile: (fileName) => {
                if (fileName.endsWith(".d.ts")) return LibFile;
                return SourceFile;
            },
            getDefaultLibFileName: () => "lib.d.ts",
            useCaseSensitiveFileNames: () => false,
            writeFile: (_name, text) => output = text,
            getCanonicalFileName: fileName => fileName,
            getCurrentDirectory: () => "",
            getNewLine: () => "\n",
            fileExists: () => true,
            readFile: () => "",
            directoryExists: () => true,
            getDirectories: () => []
        };
    
        const program = ts.createProgram(["module.ts"], CompilerOptions, CompilerHost);
        //@ts-expect-error Set globals
        window.checker = program.getTypeChecker();
        //@ts-expect-error Set globals
        window.source = SourceFile;
        try {
            macros.clear();
            program.emit(undefined, undefined, undefined, undefined, { before: [ TsMacros(program) as unknown as ts.TransformerFactory<ts.SourceFile> ]});
        } catch (err: unknown) {
            console.log(err);
            return { error: err };
        }
        return { code: output };
    };
}