import path from "path";
import fs from "fs";
import readline from "readline";
import { diffLines } from "diff";

const rl = readline.createInterface(process.stdin, process.stdout);

/**
 * If "force" is enabled, the script won't ask you to continue, and if it notices
 * any differences in the code, it'll automatically error, not ask you if anything is
 * valid.
 */
const NO_PROMPT = process.argv[2]?.toLowerCase() === "force";

export const red = (text: string): string => `\x1b[31m${text}\x1b[0m`;
export const gray = (text: string): string => `\x1b[90m${text}\x1b[0m`;
export const cyan = (text: string): string => `\x1b[36m${text}\x1b[0m`;
export const green = (text: string): string => `\x1b[32m${text}\x1b[0m`;
 
const artifactsPath = path.join(process.cwd(), "../tests/snapshots/artifacts");
const integrated = path.join(process.cwd(), "../tests/dist/integrated");

if (!fs.existsSync(artifactsPath)) fs.mkdirSync(artifactsPath);

(async () => {
    if (!NO_PROMPT && !(await askYesOrNo("Run snapshot tests? (y/n): "))) return process.exit();
    const wrongful: Array<string> = [];
    for (const [fileName, dirName, passedDirs] of eachFile(integrated, "")) {
        const newFilePath = path.join(dirName, fileName);
        const newFile = fs.readFileSync(path.join(dirName, fileName), "utf-8");
        const targetFilePath = path.join(artifactsPath, passedDirs.replace("/", "_") + fileName);
        if (!fs.existsSync(targetFilePath)) fs.writeFileSync(targetFilePath, newFile);
        else {
            const oldFile = fs.readFileSync(targetFilePath, "utf-8");
            if (oldFile === newFile) continue;
            const diffs = diffLines(oldFile, newFile);
    
            console.log(`[${cyan("FILE CHANGED")}]: ${red(passedDirs + fileName)}`);
            let final = "";
            for (const change of diffs) {
                if (change.added) final += green(change.value);
                else if (change.removed) final += red(change.value);
                else final += gray(change.value);
            }
            console.log(final);
            if (!NO_PROMPT && await askYesOrNo("Do you agree with this change? (y/n): ")) {
                fs.writeFileSync(targetFilePath, newFile);
                console.clear();
            } else {
                if (NO_PROMPT) {
                    console.error(red("Make sure the following changes are valid before continuing."));
                    process.exit();
                } else {
                    wrongful.push(newFilePath);
                }
            }
        }
    }
    if (wrongful.length) console.error(`${red("The following files didn't match the snapshot")}:\n${wrongful.join("\n")}`);
    process.exit();
})();


function* eachFile(directory: string, passedDirs: string) : Generator<[fileName: string, directory: string, passedDirs: string]> {
    const files = fs.readdirSync(directory, { withFileTypes: true });
    for (const file of files) {
        if (file.isDirectory()) yield* eachFile(path.join(directory, file.name), passedDirs + `${file.name}/`);
        else if (file.isFile()) yield [file.name, directory, passedDirs];
    }
}

function ask(q: string) : Promise<string> {
    return new Promise(res => rl.question(q, res));
}

async function askYesOrNo(q: string) : Promise<boolean> {
    // eslint-disable-next-line no-constant-condition
    while(true) {
        const answer = (await ask(q)).toLowerCase();
        if (answer === "y") return true;
        else if (answer === "n") return false;
    }
}