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

## Contributing

`ts-macros` is being maintained by a single person. Contributions are welcome and appreciated. Feel free to open an issue or create a pull request at https://github.com/GoogleFeud/ts-macros.