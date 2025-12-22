#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parseArgs = require("yargs-parser");
const ts = require("typescript");
const transform_1 = require("./transform");
const formatter_1 = require("./formatter");
(() => {
    const args = parseArgs(process.argv.slice(2));
    const command = args._[0];
    if (command === "transform") {
        const dist = args._[1];
        if (!dist || typeof dist !== "string")
            return (0, formatter_1.emitError) `Please provide an out folder path.\n\nUsage: ts-macros transform [PATH]`;
        const validatedSettings = (0, transform_1.validateSettings)(args);
        if (validatedSettings.length)
            return (0, formatter_1.emitError) `Setting errors:\n${validatedSettings.join(", ")}`;
        const errors = (0, transform_1.pretranspile)(Object.assign({ dist }, args));
        if (errors)
            console.log(ts.formatDiagnosticsWithColorAndContext(errors, {
                getNewLine: () => "\r\n",
                getCurrentDirectory: () => "unknown directory",
                getCanonicalFileName: (fileName) => fileName
            }));
    }
    else if (command === "help")
        emitHelp();
    else {
        (0, formatter_1.emitNotification) `Unknown command ${command}.`;
        emitHelp();
    }
})();
function emitHelp() {
    (0, formatter_1.emitNotification) `ts-macros CLI args

Commands:
* transform [OUT] - Expand all macros and write transformed files to the selected OUT directory.
    ${(0, formatter_1.cyan)("Example")}: ts-macros transform ./transformed --nocomptime
    -- nocomptime   - Disable usage of $$raw and $$comptime macros.
    -- emitjs       - Emits javascript instead of typescript.
    -- exec=[CMD]   - Execute a command after writing the transformed typescript files to disk.
    -- cleanup      - Delete the OUT directory after executing CMD.
    -- tsconfig     - Point the transformer to a different tsconfig.json file.
    -- watch        - Transformer will transform your files on changes. If the exec option is also provided, it will be run only after the first transform.
`;
}
