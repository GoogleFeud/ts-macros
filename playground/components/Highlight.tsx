import { useMonaco } from "@monaco-editor/react";
import { useEffect, useState } from "react";

export function Highlight(props: { text: string }) {
  const [highlighted, setHighlighted] = useState<string>();
  const monaco = useMonaco();

  useEffect(() => {
    if (!monaco) return;
    (async () => {
      const colorized = await monaco.editor.colorize(props.text, "javascript", {
        tabSize: 4,
      });
      setHighlighted(colorized);
    })();
  }, [monaco, props.text]);

  return (
    <div>
      {highlighted && (
        <div
          dangerouslySetInnerHTML={{ __html: highlighted }}
          style={{
            backgroundColor: "#1e1e1e",
            overflowY: "auto",
            paddingLeft: "15px",
            height: "calc(80vh - 50px)",
            fontFamily: "monospace",
            overflowX: "hidden",
          }}
        ></div>
      )}
    </div>
  );
}
