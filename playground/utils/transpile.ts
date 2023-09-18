
import ts from "typescript";
import TsMacros, { macros, MacroError } from "../../dist";
import { extractGeneratedTypes } from "../../dist/type-resolve";

export let Markers = `
declare function $$loadEnv(path?: string) : void;
declare function $$readFile(path: string, parseJSON?: false) : string;
declare function $$inline<F extends (...args: any) => any>(func: F, params: Parameters<F>, doNotCall: any) : () => ReturnType<F>;
declare function $$inline<F extends (...args: any) => any>(func: F, params: Parameters<F>) : ReturnType<F>;
declare function $$kindof(ast: unknown) : number;
declare function $$define(varname: string, initializer: unknown, let?: boolean, exportDecl?: boolean) : void;
declare function $$i() : number;
declare function $$length(arr: Array<any>|string) : number;
declare function $$ident(str: string) : any;
declare function $$err(str: string) : void;
declare function $$includes<T>(arr: Array<T>, val: T) : boolean;
declare function $$includes(arr: string, val: string) : boolean;
declare function $$slice<T>(str: Array<T>, start?: number, end?: number) : Array<T>;
declare function $$slice(str: string, start?: number, end?: number) : string;
declare function $$ts<T = unknown>(code: string) : T;
declare function $$escape<T>(code: () => T) : T;
declare function $$typeToString<T>(simplify?: boolean, nonNull?: boolean) : string;
declare function $$propsOfType<T>() : Array<string>;
declare function $$typeAssignableTo<T, K>() : boolean;
declare function $$comptime(fn: () => void) : void;
interface RawContext {
    ts: any,
    factory: any,
    transformer: any,
    checker: any,
    thisMacro: any
}
declare function $$raw<T>(fn: (ctx: RawContext, ...args: any[]) => ts.Node | ts.Node[] | undefined) : T;
declare function $$text(exp: any) : string;
declare function $$decompose(exp: any) : any[];
declare function $$map<T>(exp: T, mapper: (value: any, parent: number) => any) : T;
type Accumulator = number & { __marker?: "Accumulator" };
type Save<T> = T & { __marker?: "Save" };
type EmptyDecorator = (...props: any) => void;
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

Markers += "const enum SyntaxKind {\n";
for (const kind in Object.keys(ts.SyntaxKind)) {
    if (ts.SyntaxKind[kind]) Markers += `${ts.SyntaxKind[kind]} = ${kind},\n`;
}
Markers += "\n}\n";

const FinalMarkersFile = ts.createSourceFile("markers.d.ts", Markers, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

export const CompilerOptions: ts.CompilerOptions = {
    //...ts.getDefaultCompilerOptions(),                    
    noImplicitAny: true,
    strictNullChecks: true,
    target: ts.ScriptTarget.ESNext,
    experimentalDecorators: true,
    lib: ["ES5"]
};

export interface GeneratedTypes {
    fromMacros: string,
    chainTypes: string
}

export function transpile(str: string) : {
    generatedTypes: GeneratedTypes,
    errors: MacroError[],
    transpiledSourceCode?: string
} {
    macros.clear();

    const sourceFile = ts.createSourceFile("module.ts", str, CompilerOptions.target || ts.ScriptTarget.ESNext, true);
    let output;
    const errors = [];

    const CompilerHost: ts.CompilerHost = {
        getSourceFile: (fileName) => {
            if (fileName.endsWith("lib.d.ts")) return FinalMarkersFile;
            else if (fileName === "module.ts") return sourceFile;
            else return;
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
    const transformerFactory = TsMacros(program);
    try {
        program.emit(undefined, undefined, undefined, undefined, { before: [transformerFactory as unknown as ts.TransformerFactory<ts.SourceFile>] });
    } catch (err: unknown) {
        if (err instanceof MacroError) errors.push(err);
    }

    const genResult = extractGeneratedTypes(program.getTypeChecker(), sourceFile);
    if (genResult.error) errors.push(genResult.error);
    return {
        transpiledSourceCode: output,
        generatedTypes: {
            fromMacros: genResult.print(genResult.typeNodes),
            chainTypes: genResult.print(genResult.chainTypes)
        },
        errors
    }
}