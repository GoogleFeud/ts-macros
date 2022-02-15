function $contains(value: unknown, ...possible: Array<unknown>) {
    return +["||", (possible: unknown) => value === possible];
}

interface MacroStr extends String {
    $contains: (...vals: Array<string>) => string|false;
}

interface MacroBool extends Boolean {
    $contains: (...vals: Array<boolean>) => boolean;
}

(("feud" as unknown as MacroStr).$contains!("google", "feud", "erwin") as unknown as MacroBool).$contains!(true, false);