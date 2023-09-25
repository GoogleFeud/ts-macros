export const red = (text: string): string => `\x1b[31m${text}\x1b[0m`;
export const cyan = (text: string): string => `\x1b[36m${text}\x1b[0m`;

function getColoredMessage(pre: string, text: TemplateStringsArray, ...exps: Array<string>) : string {
    let i = 0;
    let final = "";
    for (const str of text) {
        final += `${str}${exps[i] ? cyan(exps[i++]) : ""}`;
    }
    return `${pre}: ${final}`;
}

export function emitError(text: TemplateStringsArray, ...exps: Array<string>) : void {
    console.error(getColoredMessage(red("[Error]"), text, ...exps));
    process.exit(1);
}


export function emitNotification(text: TemplateStringsArray, ...exps: Array<string>) : void {
    console.log(getColoredMessage(cyan("[Notification]"), text, ...exps));
}