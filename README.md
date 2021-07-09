# ts-macros

**This project is WIP!**

`ts-macros` is a typescript transformer which makes it possible to implement **function** macros in typescript! The macros are pretty similar to rust's macros, except these are way less verbose and powerful - still very useful nonetheless.

All macros must start with a dollar sign (`$`) and must be declared using the `function` keyword. Macros can then be called just like a normal function, but with a `!` after it's name: `macro!(params)`.

**Example:**

```ts
function $random(max = 1) {
    max * Math.random() << 0
}

$random!(5); // Transpiles to: 5 * Math.random() << 0
```

## Usage

You must use the `ttypescript` package in order to use this. 

```
npm i ttypescript
```

After that put this in your tsconfig.json:

```js
"compilerOptions": {
//... other options
"plugins": [
        { "transform": "ts-macros" }
]
}
```

## ts-macros in depth

### Repetitions

*Syntax:* `+[separator?, code]`

The code inside the callback must be wrapped in an arrow function. The code is going to get repeated for every "spread" argument. Repetitions without separators cannot be used as `Expressions`. 

**Example:**

```ts
function $random(...nums) {
    +["[]", () => nums * Math.random() << 0] // The [] separator puts everything in an array
}

$random!(1, 2, 3); // Transpiles to: [1 * Math.random() << 0, 2 * Math.random() << 0, 3 * Math.random() << 0]
```

#### Available separators

- `[]` - Puts all the values in an array
- `+` - Adds all the values
- `-` - Subtracts all the values
- `*` - Multiplies all the values
- `.` - Chains element access (`a[b][c]`)
- `,` - Separates all expressions with a `,`

### Expressions / Expression statements

Javascript has 3 main constructs: `Expression`, `ExpressionStatement` and `Statement`. 

If a macro call is used as an `Expression`, then it's only going to expand to **the first** returned expression. Make sure to generate an expression, otherwise there's going to be undefined behaviour.

```ts
function $macroWhichExpandsAStatement() {
    const a = 5;
}
const randomNums = $macroWhichExpandsAStatement!(); 
// Transpiles to: 
const randomNums; 

// because "const randomNums = const a = 5" is invalid syntax.
```

```ts
function $bigMacro(...elements) {
    const arr = [];
    +[() => arr.push(elements)];
}

const nums = $bigMacro!(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
// Transpiles to:
const randomNums;

// Because "const randomNums = const arr = []" is invalid syntax.
```

### Return in macros

`return` is allowed in macros, but you should only call the macro in functions so javascript doesn't throw an error.

```ts
function $sendAndReturn(message) {
    ctx.send(message);
    return false;
}

function handle(ctx) {
    // Some other code
    $sendAndReturn!();
}
```