import SplitPane from "react-split-pane";
import styles from "../css/App.module.css";
import { useState } from "react";
import Editor from "@monaco-editor/react";

export function Runnable(props: { code: string }) {
    const [evalRes, setEvalRes] = useState<string>();
    return <SplitPane split="horizontal" defaultSize={"75%"} primary="first">
        <div style={{width: "100%"}}>
            <Editor height={"80vh"} language="javascript" theme="vs-dark" value={props.code} options={{readOnly: true}}/>;
        </div>
        <div className={styles.runSection}>
            <button className={styles.button} onClick={() => {
                try {
                    setEvalRes(eval(props.code));
                } catch(err) {
                    // @ts-expect-error ...
                    setEvalRes(err.toString());
                }
            }}>Run</button>
            <br />
            <p className={styles.runSectionResult}>{evalRes}</p>
        </div>
    </SplitPane>;
}