import ts = require("typescript");
import { Macro } from "./transformer";


export class MacroMap {
    private macros: Map<ts.Symbol, Macro>;
    escaped: Array<ts.Statement>;
    constructor() {
        this.macros = new Map();
        this.escaped = [];
    }

    set(symbol: ts.Symbol, macro: Macro) : void {
        this.macros.set(symbol, macro);
    }

    get(symbol: ts.Symbol) : Macro|undefined {
        return this.macros.get(symbol);
    }

    findByName(name: string) : Macro[] {
        const macros = [];
        for (const [, macro] of this.macros) {
            if (macro.name === name) macros.push(macro);
        }
        return macros;
    }

    concatEscaped(arr: Array<ts.Statement>) : void {
        arr.push(...this.escaped);
        this.escaped.length = 0;
    }

    clear() : void {
        this.macros.clear();
    }

}