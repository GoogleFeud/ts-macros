/* eslint-disable */


function $sendAndReturn(message: string) {
    //@ts-expect-error
    ctx.send(message);
    return false;
}

function a(ctx: unknown) {
    // Some other code
    $sendAndReturn!("Hello World!");
}