
export function $map() {
    return 1;
}

function test() {
    function $map(msg: string) {
        return msg + "aaaa";
    }
    $map!("Hello World!");
}

$map!();
