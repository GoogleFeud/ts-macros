
import { $$inlineFunc } from "../../dist";

console.log($$inlineFunc!((a: unknown) => {
    
    console.log(a)
}, "Hello!"));