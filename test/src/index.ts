function $add(param1: {
    user: { name: string }
}, arr: [number, string]) {
    param1.user.name + arr[0] + (arr)[1];
}

$add!({
    user: { name: "Google" }
}, [22, "Feud"]);