# ts-macros

ts-macros is a custom typescript transformer which allows you to create function macros. This library is heavily inspired by Rust's `macro_rules!` macro, and it's just as powerful! 

## Basic usage

All macro names must start with a dollar sign (`$`) and must be declared using the function keyword. Macros can then be called just like a normal function, but with a `!` after it's name: `$macro!(params)`.

```ts
function $contains<T>(value: T, ...possible: Array<T>) {
    return +["||", (possible: T) => value === possible];
}

const searchItem = "google";
console.log($contains!(searchItem, "erwin", "tj")); 
// Transpiles to: console.log(false);
```

Macros can also be **chained** with any javascript expression.

```ts
declare global {
    interface String {
        $contains<T>(...possible: Array<T>) : boolean;
    }
}

"feud".$contains!("google", "feud", "erwin");
// Transpiles to: true
```

To read more about ts-macros features, visit the [documentation](https://googlefeud.github.io/ts-macros/index.html), or you can check out the [interactive playground](https://googlefeud.github.io/ts-macros/playground/) if you want to play with macros without having to set up an enviourment!

**What you can do with ts-macros**:
- Generate repetitive code
- Generate code conditionally, based on enviourment variables or other configuration files
- Create abstractions without the runtime cost

**What you can't do with ts-macros**:
- Generate types which you can use in your code. ts-docs is only a transformer, it's ran **after** typechecking, so generating different types has no effect. However, the code inside the macro itself still gets typechecked

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
