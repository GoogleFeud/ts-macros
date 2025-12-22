"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cyan = exports.red = void 0;
exports.emitError = emitError;
exports.emitNotification = emitNotification;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
exports.red = red;
const cyan = (text) => `\x1b[36m${text}\x1b[0m`;
exports.cyan = cyan;
function getColoredMessage(pre, text, ...exps) {
    let i = 0;
    let final = "";
    for (const str of text) {
        final += `${str}${exps[i] ? (0, exports.cyan)(exps[i++]) : ""}`;
    }
    return `${pre}: ${final}`;
}
function emitError(text, ...exps) {
    console.error(getColoredMessage((0, exports.red)("[Error]"), text, ...exps));
    process.exit(1);
}
function emitNotification(text, ...exps) {
    console.log(getColoredMessage((0, exports.cyan)("[Notification]"), text, ...exps));
}
