#!/usr/bin/env node

import * as parseArgs from "yargs-parser";
import * as ts from "typescript";
import { PretranspileSettings, pretranspile, validateSettings } from "./pretranspile";
import { cyan, emitError, emitNotification } from "./formatter";

type CLIArgs = {
    _: string[],
} & Omit<PretranspileSettings, "dist">;

(() => {

    const args = parseArgs(process.argv.slice(2)) as CLIArgs;
    const command = args._[0];

    if (command === "transform") {
        const dist = args._[1];
        if (!dist || typeof dist !== "string") return emitError`Please provide an out folder path.\n\nUsage: ts-macros transform [PATH]`;
        const validatedSettings = validateSettings(args);
        if (validatedSettings.length) return emitError`Setting errors:\n${validatedSettings.join(", ")}`;
        const errors = pretranspile({
            dist,
            ...args
        });

        if (errors) console.log(ts.formatDiagnosticsWithColorAndContext(errors, {
            getNewLine: () => "\r\n",
            getCurrentDirectory: () => "unknown directory",
            getCanonicalFileName: (fileName) => fileName
        }));
    }
    else if (command === "help") emitHelp();
    else {
        emitNotification`Unknown command ${command}.`;
        emitHelp();
    }
})();


function emitHelp() : void {
    emitNotification`ts-macros CLI args

Commands:
* transform [OUT] - Expand all macros and write transformed TS files to the selected OUT directory.
    ${cyan("Example")}: ts-macros transform ./transformed --noComptime
    -- noComptime   - Disable usage of $$raw and $$comptime macros.
    -- exec=[CMD]   - Execute a command after writing the transformed typescript files to disk.
    -- cleanup      - Delete the OUT directory after executing CMD.
    -- tsconfig     - Point the transformer to a different tsconfig.json file.
    -- watch        - Transformer will transform your files on changes. Cleanup and exec options are ignored.
`;
}