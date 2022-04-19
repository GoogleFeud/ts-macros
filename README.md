# ts-macros

ts-macros is a custom typescript **transformer** which implements function macros. This library is heavily inspired by Rust's `macro_rules!` macro. 

## Basic usage

All macro names must start with a dollar sign (`$`) and must be declared using the function keyword. Macros can then be called just like a normal function, but with a `!` after it's name: `$macro!(params)`.

```ts
function $contains(value: unknown, ...possible: Array<unknown>) {
    return +["||", (possible: unknown) => value === possible];
}

const searchItem = "google";
console.log($contains!(searchItem, "erwin", "tj")); 
// Transpiles to: console.log(false);
```


Macros can also be **chained** with any javascript expression.

```ts
interface MacroStr extends String {
    $contains: (...vals: Array<string>) => string|false;
}

("feud" as unknown as MacroStr).$contains!("google", "feud", "erwin");
// Transpiles to: true
```

To read more about ts-macros features, visit the [documentation](https://googlefeud.github.io/ts-macros/index.html)

## Install

```
npm i --save-dev ts-macros
```

### Usage with ttypescript

By default, typescript doesn't allow you to add custom transformers, so you must use a tool which adds them. `ttypescript` does just that! Make sure to install it:

```
npm i --save-dev ttypescript
```

and add the `ts-docs` transformer to your `tsconfig.json`:

```json
"compilerOptions": {
//... other options
"plugins": [
        { "transform": "ts-macros" }
    ]
}
```

### Usage with ts-loader

```js
const TsMacros = require("ts-macros").default;

options: {
      getCustomTransformers: program => {
        before: [TsMacros(program)]
      }
}
```
