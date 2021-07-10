# ts-macros

`ts-macros` is a typescript transformer which makes it possible to create **function** macros in typescript! The macros are pretty similar to rust's macros (macro_types!), except these are way less verbose and powerful - still very useful nonetheless.

All macro names must start with a dollar sign (`$`) and must be declared using the `function` keyword. Macros can then be called just like a normal function, but with a `!` after it's name: `macro!(params)`.

**Example:**

```ts
function $contains(value: unknown, ...possible: Array<unknown>) {
    +["||", (possible: unknown) => value === possible];
}

const searchItem = "google";
console.log($contains!(searchItem, "erwin", "tj")); 
// Transpiles to: (searchItem === "erwin" || searchItem === "tj")
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

*Syntax:* `+[separator?, () => codeToRepeat]`

Repetitions without separators cannot be used as `Expressions`. 

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
- `,` - Separates all expressions with a `,`
- `||` 
- `&&`

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

### Calling other macros inside macros

Calling other macros is possible!

```ts
function $doubleNum(num) {
    num * 2
}

function $doubleAll(...nums) {
    +["[]", () => $doubleNum!(nums)];
}

$doubleAll!(1, 2, 3, 4, 5); // Transpiles to [1 * 2, 2 * 2, 3 * 2, 4 * 2, 5 * 2];
```

### Ternary operator in macros

If the condition of a ternary operator inside a macro is one of the macro parameters, the entire ternary operation is going to replaced, as long as the given value is a literal:

```ts
function $test(double, ...nums) {
    +["[]", () => nums * (double ? 2:1)]
}

$test!(true, 1, 2, 3); // Transpiles to: [1 * (2), 2 * (2), 3 * (2)]

const val = false;
$test!(val, 1, 2, 3) // Transpiles to: [1 * (val ? 2:1), 2 * (val ? 2:1), 3 * (val ? 2:1)]
```

### Comparing literals

```ts
function $cmp(a) {
    a === "google";
}

$cmp!("google"); // Transpiles to: true
$cmp!("tj"); // Transpiles to: false
```


