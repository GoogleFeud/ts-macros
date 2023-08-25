
import { transpile, transpileTStoTS } from "../utils/transpile";
import { useEffect, useState } from "react";
import { TextEditor } from "../components/Editor";
import { Runnable } from "../components/Runnable";
import SplitPane from "react-split-pane";
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import styles from "../css/App.module.css";
import fs from "fs";
import path from "path";
import ts from "typescript";
import { MacroError } from "../../dist";

const SetupCodes = [
    `function $contains<T>(value: T, possible: Array<T>) {
    return +["||", [possible], (val: T) => value === val];
}
    
const searchItem = "google";
$contains!(searchItem, ["erwin", "tj"]);`,
    `function $try(resultObj: Save<{ value?: number, is_err: () => boolean}>) {
    $$escape!(() => {
        if (resultObj.is_err()) {
            return resultObj;
        }
    });
    return resultObj.value;
}

(() => {
    const a = $try!({ value: 123, is_err: () => false });
});`,
    `type ClassInfo = { name: string, value: string };

function $makeClasses(...info: Array<ClassInfo>) {
    +[[info], (classInfo: ClassInfo) => {
        $$ts!(\`
            class \${classInfo.name} {
                constructor() {
                    this.value = \${classInfo.value}
                }
            }
        \`);
    }];
}

$makeClasses!({name: "A", value: "123"}, {name: "B", value: "345"});`,
    `function $map<T, R>(arr: Save<Array<T>>, cb: (item: T) => R) : Array<R> {
    $$escape!(() => {
        const res = [];
        for (let i=0; i < arr.length; i++) {
        res.push($$inlineFunc!(cb, arr[i]));
        }
    });
    return $$ident!("res");
}

(() => {
    $map!([1, 2, 3, 4, 5, 6, 7, 8, 9], (num) => num * 2);
})();`,
`function $ToInterval(info: WhileLabel, intervalTimer = 1000) {
    const interval = setInterval(() => {
        if (info.condition) {
            $$inlineFunc!(info.statement);
        } else {
            clearInterval(interval);
        }
    }, intervalTimer);
}

const arr = [1, 3, 4, 5, 6];

$ToInterval:
while (arr.length !== 0) {
    console.log(arr.pop());
}`,
`
function $renameClass(newName: string) : EmptyDecorator {
    return $$raw!((ctx, newNameNode) => {
       const target = ctx.thisMacro.target;
       return ctx.factory.createClassDeclaration(
            target.modifiers?.filter(m => m.kind !== ctx.ts.SyntaxKind.Decorator),
            ctx.factory.createIdentifier(newNameNode.text),
            target.typeParameters,
            target.heritageClauses,
            target.members
        )
    });
}

@$renameClass!("NewTest")
class Test {
    propA: number
    propB: string
    constructor(a: number, b: string) {
        this.propA = a;
        this.propB = b;
    }
}
`
]

const SetupCode = `
// Interactive playground!
// Write your code here and see the transpiled result.
// All types and functions from the library are already imported!

${SetupCodes[Math.floor(Math.random() * SetupCodes.length)]}
`;

function Main({lib}: { lib: ts.SourceFile }) {
    const [code, setCode] = useState<string|undefined>();
    const [errors, setErrors] = useState<MacroError[]>([]);
    const [libCode, setLibCode] = useState<string|undefined>();
    const [compiledCode, setCompiled] = useState<string>();

    const transpileCode = (source: string) => {
        setCode(source);
        const {code, error} = transpile(lib, source);
        setCompiled(code);
        const {code: libCode, error: libError} = transpileTStoTS(lib, source);
        setLibCode(libCode);
        const errs = [];
        if (error) errs.push(error);
        if (libError) errs.push(libError);
        setErrors(errs);
    } 

    useEffect(() => {
        const params = Object.fromEntries(new URLSearchParams(window.location.search).entries());
        if (params.code) {
            const normalized = decompressFromEncodedURIComponent(params.code);
            if (!normalized) return;
            transpileCode(normalized);
        } else {
            transpileCode(SetupCode);
        }
    }, []);

    return (
        <div>
            <header className={styles.header}>
                <div style={{display: "flex"}}>
                    <h2>Typescript Macros</h2>
                    <button className={styles.button} onClick={() => {
                        if (!code) return;
                        navigator.permissions.query({name: "clipboard-write" as PermissionName}).then(result => {
                            if (result.state == "granted" || result.state == "prompt") {
                                navigator.clipboard.writeText(location.origin + location.pathname + `?code=${compressToEncodedURIComponent(code)}`);
                            }
                        });
                    }}>Copy Link</button>
                </div>
                <a href="https://github.com/GoogleFeud/ts-macros" style={{fontSize: "24px"}}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                </a>
            </header>
            <SplitPane split="vertical" defaultSize={"50%"} primary="first">
                <TextEditor code={code} libCode={libCode} errors={errors} onChange={(code) => {
                    transpileCode(code || "");
                }} />
                <Runnable code={compiledCode || ""} />
            </SplitPane>
            <footer className={styles.footer}>
                <p>Made with ❤️ by <a href="https://github.com/GoogleFeud">GoogleFeud</a>.</p>
            </footer>
        </div>
    );
}

export default (props: { lib: string }) => {
    const LibFile = ts.createSourceFile("lib.d.ts", props.lib, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    return <Main lib={LibFile} />;
};

export async function getStaticProps() {
    return {
        props: {
            lib: fs.readFileSync(path.join(process.cwd(), "./node_modules/typescript/lib/lib.es5.d.ts"), "utf-8")
        }
    };
}