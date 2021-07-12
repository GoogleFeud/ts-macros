
export function $add(...nums: Array<number>) : number|void {
    +["+", (nums: number) => nums];
}

export function $calc(type: string, ...nums: Array<number>) : number|void {
    if (type === "+") +["+", (nums: number) => nums];
    else if (type === "-") +["-", (nums: number) => nums];
    else if (type === "*") +["*", (nums: number) => nums];
    else 0;
}