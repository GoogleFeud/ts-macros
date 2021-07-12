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
// Transpiles to: console.log(searchItem === "erwin" || searchItem === "tj")
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

Javascript has 3 main constructs: `Expression`, `ExpressionStatement` and `Statement`. Macro calls can never be `Statement`s, but:

**If a macro call is a `ExpressionStatement`, then it's going to get "flattened" - the macro call will literally be replaced by the macro body.**
```ts
function $map(arr, cb) {
   const array = arr;
   const res = [];
   for (let i=0; i < array.length; i++) {
      res.push(cb(array[i]);
   }
}

$map!([1, 2, 3], (num) => num * 2); // This is an ExpressionStatement

// Transpiles to:
const array = [1, 2, 3];
const res = [];
for (let i = 0; i < array.length; i++) {
    res.push(((item) => item * 2)(array[i], i));
}
```

**If a macro call is in an `Expression` and it's body expands to a single expression then the call is replaced by the expression**
```ts
function $push( ...nums: Array<number>) {
    +["[]", (nums: number) => nums * Math.random() << 0]
}

const rngNums = $push!(1, 2, 3); // Macro call is an expression here
// Transpiles to:
const rngNums = [1 * Math.random() << 0, 2 * Math.random() << 0, 3 * Math.random() << 0];
```

**If a macro call is in an `Expression` and it's body contains **more** than a single expression, or contains a `Statement`, then the body is wrapped in an IIFE.**
```ts
function $push(array: Array<number>, ...nums: Array<number>) {
    +[(nums: number) => array.push(nums)];
}

const arr: Array<number> = [];
const newSize = $push!(arr, 1, 2, 3);
// Transpiles to:
const arr = [];
const newSize = (() => {
    arr.push(1)
    arr.push(2)
    return arr.push(3);
})();
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

$doubleAll!(1, 2, 3, 4, 5); // Transpiles to [2, 4, 6, 8, 10];
```

### Ternary operator in macros

If the condition of a ternary operator inside a macro is one of the macro parameters, the entire ternary operation is going to replaced, as long as the given value is a literal:

```ts
function $test(double, ...nums) {
    +["[]", () => nums * (double ? 2:1)]
}

$test!(true, 1, 2, 3); // Transpiles to: [2, 4, 6]

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

### Adding / subtracting / multiplying / dividing literals

Number literals will automatically be added / subtracted / multiplied / divided.

```ts
function $add(...nums: Array<number>) {
    +["+", (nums: number) => nums];
} 

$add!(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15); // Transpiles to 120
```

### Chaining macros

It's possible to chain macros with any javascript object you want.

```ts
function $doubleNum(number: number) : number|void {
    number * number
}

(5).$doubleNum!(); // Transpiles to: 25
const someNum = 10;
someNum.$doubleNum!(); // Transpiles to: someNum * someNum
```

### Macros inside macros

Not recommended, but possible. The inner-macros don't have access to any previous arguments.

```ts
function $contains(value: number, ...possible: Array<number>) {
    function $inc(value: number) {
        value + 1;
    }
    +["||", (possible: unknown) => $inc!(value) === possible];
}

console.log($contains!(1, 1, 2, 3, 4, 5, 6, 7, 8)); 
```
