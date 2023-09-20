
import Editor, { useMonaco } from "@monaco-editor/react";
import { languages, editor } from "monaco-editor";
import { useEffect, useState } from "react";
import { CompilerOptions, GeneratedTypes, Markers } from "../utils/transpile";
import { MacroError } from "../../dist";


export function TextEditor(props: {
    onChange: (code: string|undefined) => void,
    code: string|undefined,
    libCode?: GeneratedTypes,
    errors: MacroError[]
}) {
    const monaco = useMonaco();
    const [editor, setEditor] = useState<editor.IStandaloneCodeEditor>();
    const [macroTypeModel, setMacroTypeModel] = useState<editor.ITextModel>();
    const [chainTypeModel, setChainTypeModel] = useState<editor.ITextModel>();

    const macroTypesLib = "ts:ts-macros/generated_types.d.ts";
    const chainTypesLib = "ts:ts-macros/chain_types.d.ts"

    useEffect(() => {
        if (!monaco) return;
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
            ...CompilerOptions as unknown as languages.typescript.CompilerOptions
        });
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            diagnosticCodesToIgnore: [1219]
        });

        const markersLibName = "ts:ts-macros/markers.d.ts";
        monaco.languages.typescript.javascriptDefaults.addExtraLib(Markers, markersLibName);
        monaco.editor.createModel(Markers, "typescript", monaco.Uri.parse(markersLibName));

        const macroTypesContent = props.libCode?.fromMacros || "";
        monaco.languages.typescript.javascriptDefaults.addExtraLib(macroTypesContent, macroTypesLib);
        setMacroTypeModel(monaco.editor.createModel(macroTypesContent, "typescript", monaco.Uri.parse(macroTypesLib)));

        const chainTypesContent = `export {};\n\n${props.libCode?.chainTypes || ""}`;
        monaco.languages.typescript.javascriptDefaults.addExtraLib(chainTypesContent, chainTypesLib);
        setChainTypeModel(monaco.editor.createModel(chainTypesContent, "typescript", monaco.Uri.parse(chainTypesLib)));
    }, [monaco]);

    useEffect(() => {
        if (!monaco) return;
        macroTypeModel?.setValue(props.libCode?.fromMacros || "");
        chainTypeModel?.setValue(`export {};\n\n${props.libCode?.chainTypes || ""}`);
    }, [props.libCode]);

    useEffect(() => {
        if (!monaco || !editor) return;
        const model = editor.getModel();
        if (!model) return;
        monaco.editor.setModelMarkers(model, "_", props.errors.map(error => {
            const startPos = model.getPositionAt(error.start);
            const endPos = model.getPositionAt(error.start + error.length);
            return {
                message: error.rawMsg,
                severity: 8,
                startColumn: startPos.column,
                startLineNumber: startPos.lineNumber,
                endColumn: endPos.column,
                endLineNumber: endPos.lineNumber
            }
        }));
    }, [props.errors]);

    return <Editor height="calc(90vh - 50px)" language="typescript" theme="vs-dark" value={props.code} onChange={props.onChange} onMount={editor => setEditor(editor)}>

    </Editor>;
}