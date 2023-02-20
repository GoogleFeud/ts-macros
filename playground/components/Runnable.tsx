import SplitPane from "react-split-pane";
import { Highlight } from "./Highlight";
import styles from "../css/App.module.css";
import { useState } from "react";

export function Runnable(props: { code: string }) {
  const [evalRes, setEvalRes] = useState<string>();
  return (
    <SplitPane split="horizontal" defaultSize={"70%"} primary="first">
      <div>
        <Highlight text={props.code} />
      </div>
      <div className={styles.runSection}>
        <button
          className={styles.button}
          onClick={async () => {
            try {
              setEvalRes(await eval(props.code));
            } catch (err) {
              // @ts-expect-error ...
              setEvalRes(err.toString());
            }
          }}
        >
          Run
        </button>
        <br />
        <p className={styles.runSectionResult}>{evalRes}</p>
      </div>
    </SplitPane>
  );
}
