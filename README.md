# ts-macros

## Examples

A macro is any function which starts with a dollar sign ($).

### Simple example

```ts
function $random(max) {
    max * Math.random() << 0;
}

const rng = random!(5);
```

Transpiles to:

```js
const rng = 5 * Math.random() << 0;
```

### Iterating over args

```ts
function $myMacro(...a) {
    +("+")(a);
}

myMacro!(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
```

Transpiles to:

```js
1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10
```

### As if it's a regular function

```ts
function $sendLargeMsg(content, quiet = false) {
    ctx.respond({
        type: InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: `> **❌ ${content}**`,
            flags: quiet ? 1 << 6:undefined, 
            allowedMentions: { parse: [] }
        }
    });
}

// In a scope where "ctx" is available
sendLargeMsg!("Hello World");
```

Transpiles to:

```js
    ctx.respond({
        type: 3,
        data: {
            content: "> **❌ Hello World**",
            allowedMentions: { parse: [] }
        }
    });
```