# ts-macros

ts-macros is a typescript transformer which allows you to create function macros that expand to javascript code during the transpilation phase of your program. 

📖 **[Documentation](https://github.com/GoogleFeud/ts-macros/wiki)**
🎮 **[Playground](https://googlefeud.github.io/ts-macros/)**
✍️ **[Examples](https://github.com/GoogleFeud/ts-macros/wiki/Practical-Macro-Examples)**

## The Basics

All macro names must start with a dollar sign (`$`) and must be declared using the function keyword. Macros can then be called just like a normal function, but with a `!` after it's name: `$macro!(params)`. All the code inside of the macro is going to "expand" where the macro is called.

![showcase](https://github.com/GoogleFeud/ts-macros/blob/dev/.github/assets/intro_gif.gif)

**What you can do with ts-macros**:
- Generate repetitive code
- Generate code conditionally, based on enviourment variables or other configuration files
- Generate types which you can use in your code (read more [here](https://github.com/GoogleFeud/ts-macros/wiki/Type-Resolver-Transformer))
- Create abstractions without the runtime cost

## Usage

```
npm i --save-dev ts-macros
```

<details>
    <summary>Usage with ts-patch</summary>

```
npm i --save-dev ts-patch
```

and add the ts-macros transformer to your tsconfig.json:

```json
"compilerOptions": {
//... other options
"plugins": [
        { "transform": "ts-macros" }
    ]
}
```

Afterwards you can either:
- Transpile your code using the `tspc` command that ts-patch provides.
- Patch the instance of typescript that's in your `node_modules` folder with the `ts-patch install` command and then use the `tsc` command to transpile your code.
</details>

<details>
    <summary>Usage with ts-loader</summary>

```js
const TsMacros = require("ts-macros").default;

options: {
      getCustomTransformers: program => {
        before: [TsMacros(program)]
      }
}
```
</details>

<details>
    <summary>Usage with ts-node</summary>

To use transformers with ts-node, you'll have to change the compiler in the `tsconfig.json`:

```
npm i --save-dev ts-node
```

```json
"ts-node": {
    "compiler": "ts-patch/compiler"
  },
  "compilerOptions": {
    "plugins": [
        { "transform": "ts-macros" }
    ]
  }
```
</details>

<details>
    <summary>CLI Usage (esbuild, vite, watchers)</summary>

If you want to use ts-macros with:
- tools that don't support typescript
- tools that aren't written in javascript and therefore cannot run typescript transformers (tools that use swc, for example)
- any tools' watch mode (webpack, vite, esbuild, etc)

you can use the CLI - [read more about the CLI and example here](https://github.com/GoogleFeud/ts-macros/wiki/CLI-usage)

</details>

## Security

This library has 2 built-in macros (`$raw` and `$comptime`) which execute arbitrary code during transpile time. The code is **not** sandboxed in any way and has access to your file system and all node modules.

If you're transpiling an untrusted codebase which uses this library, make sure to set the `noComptime` option to `true`. Enabling it will replace all calls to these macros with `null` without executing the code inside them. It's always best to review all call sites to `$$raw` and `$$comptime` yourself before transpiling any untrusted codebases.

**ttypescript/ts-patch:**
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