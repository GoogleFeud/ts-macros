
import Editor, { useMonaco } from "@monaco-editor/react";
import { languages, editor } from "monaco-editor";
import { useEffect, useState } from "react";
import { CompilerOptions, Markers } from "../utils/transpile";
import { MacroError } from "../../dist";


export function TextEditor(props: {
    onChange: (code: string|undefined) => void,
    code: string|undefined,
    libCode?: string,
    errors: MacroError[]
}) {
    const monaco = useMonaco();
    const [editor, setEditor] = useState<editor.IStandaloneCodeEditor>();
    const [libModel, setLibModel] = useState<editor.ITextModel>();

    useEffect(() => {
        if (!monaco) return;
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
            ...CompilerOptions as unknown as languages.typescript.CompilerOptions
        });
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            diagnosticCodesToIgnore: [1219]
          });

        const filename = "ts:ts-macros/global.d.ts";
        monaco.languages.typescript.javascriptDefaults.addExtraLib(Markers, filename);
        monaco.editor.createModel(Markers, "typescript", monaco.Uri.parse(filename));

        const otherFilename = "ts:ts-macros/global2.d.ts";
        const content = `export {};${props.libCode || ""}`;
        monaco.languages.typescript.javascriptDefaults.addExtraLib(content, otherFilename);
        setLibModel(monaco.editor.createModel(content, "typescript", monaco.Uri.parse(otherFilename)));
    }, [monaco]);

    useEffect(() => {
        if (!monaco) return;
        libModel?.setValue(`export {};${props.libCode || ""}`);
        if (!editor) return;
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
    }, [props.libCode, props.errors]);

    return <Editor height="calc(90vh - 50px)" language="typescript" theme="vs-dark" value={props.code} onChange={props.onChange} onMount={editor => setEditor(editor)}>

    </Editor>;
}