import ts = require("typescript");
import { Macro } from "./transformer";


export class MacroMap {
    private parent?: MacroMap;
    private macros: Record<string, Macro>;
    escaped: Array<ts.Statement>;
    constructor(parent?: MacroMap) {
        this.macros = {};
        this.parent = parent;
        this.escaped = [];
    }

    set(macro: Macro) : void {
        this.macros[macro.name] = macro;
    }

    get(macroName: string) : Macro|undefined {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let parent: MacroMap|undefined = this;
        while (parent) {
            if (macroName in parent.macros) return parent.macros[macroName];
            parent = parent.parent;
        }
    }

    shallowHas(macroName: string) : boolean {
        return macroName in this.macros;
    }

    getParent() : MacroMap {
        return this.parent || this;
    }

    extend() : MacroMap {
        return new MacroMap(this);
    }

    concatEscaped(arr: Array<ts.Statement>) : void {
        arr.push(...this.escaped);
        this.escaped.length = 0;
    }

}