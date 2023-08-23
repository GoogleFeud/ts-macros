
import Editor, { useMonaco } from "@monaco-editor/react";
import { languages, editor } from "monaco-editor";
import { useEffect, useState } from "react";
import { CompilerOptions, Markers } from "../utils/transpile";


export function TextEditor(props: {
    onChange: (code: string|undefined) => void
    code: string|undefined,
    libCode?: string
}) {
    const monaco = useMonaco();
    const [libModel, setLibModel] = useState<editor.ITextModel>();

    const filename = "ts:ts-macros/index.d.ts";

    useEffect(() => {
        if (!monaco) return;
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
            ...CompilerOptions as unknown as languages.typescript.CompilerOptions
        });
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            diagnosticCodesToIgnore: [1219]
          });

        monaco.languages.typescript.javascriptDefaults.addExtraLib(Markers, filename);
        setLibModel(monaco.editor.createModel(Markers + (props.libCode || ""), "typescript", monaco.Uri.parse(filename)));
    }, [monaco]);

    useEffect(() => {
        if (!monaco) return;
        libModel?.setValue(Markers + (props.libCode || ""));
    }, [props.libCode]);

    return <Editor height="calc(90vh - 50px)" language="typescript" theme="vs-dark" value={props.code} onChange={props.onChange}>

    </Editor>;
}