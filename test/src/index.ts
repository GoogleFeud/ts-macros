import { AsRest } from "../../dist";

function $doSmth(obj: any) : number {
    return obj.something[0].laugh;
}

$doSmth!({
    something: [{laugh: true }]
});