---
name: Overview
order: 1
---

# Overview

ts-macros is a custom typescript **transformer** which implements function macros. This library is heavily inspired by Rust's `macro_rules!` macro. Since it's a custom transformer, it can be plugged in into any tool which uses the `typescript` npm package.


## Basic usage

All macro names must start with a dollar sign (`$`) and must be declared using the function keyword. Macros can then be called just like a normal function, but with a `!` after it's name: `$macro!(params)`.

```ts --Macro
function $contains<T>(value: T, ...possible: Array<T>) {
    return +["||", [possible], (item: T) => value === item];
}
```
```ts --Call
console.log($contains!(searchItem, "erwin", "tj")); 
```
```ts --Result
console.log(searchItem === "erwin" || searchItem === "tj");
```

## Install

```
npm i --save-dev ts-macros
```

### Usage with ttypescript

By default, typescript doesn't allow you to add custom transformers, so you must use a tool which adds them. `ttypescript` does just that! Make sure to install it:

```
npm i --save-dev ttypescript
```

and add the `ts-macros` transformer to your `tsconfig.json`:

```json
"compilerOptions": {
//... other options
"plugins": [
        { "transform": "ts-macros" }
    ]
}
```

then transpile your code with `ttsc`.

### Usage with ts-loader

```js
const TsMacros = require("ts-macros").default;

options: {
      getCustomTransformers: program => {
        before: [TsMacros(program)]
      }
}
```

### Usage with vite

If you want to use ts-macros with vite, you'll have to use the `...` plguin. [Here](https://github.com/GoogleFeud/ts-macros-vite-example) is an
example repository which sets up a basic vite project which includes ts-macros.

**Note**: Macros and dev mode do not work well together. If your macro is in one file, and you're using it in a different file, and you want to change some code inside the macro, you'll also have to change some code in the file the macro's used in so you can see the change. It could be adding an empty line or a space somewhere, the change doesn't matter, the file just needs to be transpiled again for the changes in the macro to happen.

## Security

This library has 2 built-in macros (`$raw` and `$comptime`) which **can** execute arbitrary code during transpile time. The code is **not** sandboxed in any way and has access to your file system and all node modules.

If you're transpiling an untrusted codebase which uses this library, make sure to turn the `noComptime` option to `true`. Enabling it will replace all calls to these macros with `null` without executing the code inside them.

**ttypescript:**
```json
"plugins": [
        { "transform": "ts-macros", "noComptime": true }
    ]
```

**manually creating the factory:**
```js
TsMacros(program, { noComptime: true });
```

## Contributing

`ts-macros` is being maintained by a single person. Contributions are welcome and appreciated. Feel free to open an issue or create a pull request at https://github.com/GoogleFeud/ts-macros.