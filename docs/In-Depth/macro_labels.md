---
name: Macro labels
order: 10
---

# Macro labels

Macros can also be used on statements with labels:

```ts --Macro
// Macro for turning a for...of loop to a regular for loop
function $NormalizeFor(info: ForIterLabel): void {
  if ($$kindof!(info.initializer) === ts.SyntaxKind.Identifier) {
    const iter = info.iterator.length;
    for (
      $$define!(info.initializer, 0, true);
      info.initializer < iter;
      info.initializer++
    ) {
      $$inline!(info.statement);
    }
  }
}
```

```ts --Call
const arr = [1, 2, 3, 4, 5];

$NormalizeFor: for (const item of arr) {
  console.log(item + 1);
}
```

```ts --Result
const iter = arr.length;
for (let item = 0; item < iter; item++) {
  console.log(item + 1);
}
```

Only catch is that these macros cannot accept any other parameters - their first parameter will **always** be an object with information about the statement. Even though you cannot provide parameters yourself, you can still use the `Var` and `Accumulator` markers. All statements are wrapped in an arrow function, you can either call it or inline it with `$$inline`.

## Usable statements

### If

If statements. Check out the [[IfLabel]] interface to see all information exposed to the macro.

```ts --Macro
// Macro for turning an if statement to a ternary expression
function $ToTernary(label: IfLabel): void {
  label.condition ? $$inline!(label.then) : $$inline!(label.else);
}
```

```ts --Call
let num: number = 123;
$ToTernary: if (num === 124) {
  console.log("Number is valid.");
} else {
  console.log("Number is not valid.");
}
```

```ts --Result
num === 124
  ? console.log("Number is valid.")
  : console.log("Number is not valid.");
```

### ForIter

A `for...of` or a `for...in` loop. Check out the [[ForIterLabel]] interface for all the properties.

```ts --Macro
// A macro which turns a for...of loop to a forEach
function $ToForEach(info: ForIterLabel, variable: Var): void {
  if ($$kindof!(info.initializer) === ts.SyntaxKind.Identifier) {
    // In order to make it so info.initializer replaces the argument, we need to use
    // a Var marker.
    variable = info.initializer;
    info.iterator.forEach((variable: any) => {
      $$inline!(info.statement);
    });
  }
}
```

```ts --Call
const arr = [1, 3, 4, 5, 6];

$ToForEach: for (const item of arr) {
  console.log(item);
  console.log(item + 1);
}
```

```ts --Result
arr.forEach((item) => {
  console.log(item);
  console.log(item + 1);
});
```

### For

A general C-like for loop. Check out the [[ForLabel]] interface for all the properties.

```ts --Macro
// Macro for turning a regular for loop into a while loop
function $ForToWhile(info: ForLabel) {
  if (info.initializer.variables) {
    +[
      [info.initializer.variables],
      (variable: [string, any]) => {
        $$define!(variable[0], variable[1], true);
      },
    ];
  } else info.initializer.expression;
  while (info.condition) {
    $$inline!(info.statement);
    info.increment;
  }
}
```

```ts --Call
const arr = [1, 3, 4, 5, 6];

$ForToWhile: for (let i = 2, j; i < arr.length; i++) {
  console.log(i);
  console.log(i + 1);
}
```

```ts --Result
let i = 2;
let j = undefined;
while (i < arr.length) {
  console.log(i);
  console.log(i + 1);
  i++;
}
```

### While

A `do...while` or a `while` loop. Check out the [[WhileLabel]] interface for all the properties.

```ts --Macro
// Slows down a while loop by using an interval
function $ToInterval(info: WhileLabel, intervalTimer = 1000) {
  const interval = setInterval(() => {
    if (info.condition) {
      $$inline!(info.statement);
    } else {
      clearInterval(interval);
    }
  }, intervalTimer);
}
```

```ts --Call
const arr = [1, 3, 4, 5, 6];

$ToInterval: while (arr.length !== 0) {
  console.log(arr.pop());
}
```

```ts --Result
const interval = setInterval(() => {
  if (arr.length !== 0) {
    console.log(arr.pop());
  } else {
    clearInterval(interval);
  }
}, 1000);
```

### Block

A block, or a collection of statements, wrapped in an arrow function. See [[BlockLabel]] for all the properties.

```ts --Macro
// Wraps a block in a try/catch, ignoring the error
function $TrySilence(info: BlockLabel) {
  try {
    $$inline!(info.statement);
  } catch (err) {}
}
```

```ts --Call
const arr = [1, 3, 4, 5, 6];

if (arr.includes(5))
  $TrySilence: {
    throw "Errorr...";
    // Some async actions...
  }
else
  $TrySilence: {
    // Some async actions...
    console.log(arr);
  }
```

```ts --Result
if (arr.includes(5)) {
  try {
    throw "Errorr...";
  } catch (err) {}
} else {
  try {
    console.log(arr);
  } catch (err) {}
}
```

### Generic Label type

A [[Label]] type is also provided, which allows you to be able to run a single macro for multiple statements. Just compare the `kind` property with any value of the [[LabelKinds]] enum.

## Calling label macros

You can also call label macros just like regular macros!

```ts --Macro
// Let's use the ToInterval macro, and let's make it so we can provide
// a custom interval when we're calling the macro explicitly:

function $ToInterval(info: WhileLabel, intervalTimer = 1000) {
  const interval = setInterval(() => {
    if (info.condition) {
      $$inline!(info.statement);
    } else {
      clearInterval(interval);
    }
  }, intervalTimer);
}
```

```ts --Call
const arr = [1, 2, 3, 4, 5];
$ToInterval!(
  {
    condition: arr.length !== 0,
    do: false,
    kind: LabelKinds.While,
    statement: () => {
      console.log(arr.pop());
    },
  },
  5000
);
```

```ts --Result
const interval_1 = setInterval(() => {
  if (arr.length !== 0) {
    console.log(arr.pop());
  } else {
    clearInterval(interval_1);
  }
}, 5000);
```

## Nesting macro labels

Macro labels can be nested. Let's use both the `ForToWhile` and the `ToInterval` macros we created earlier on the same statement:

```ts --Call
$ToInterval: $ForToWhile: for (let i = 0; i < 100; i++) {
  console.log(i);
}
```

```ts --Result
let i = 0;
const interval = setInterval(() => {
  if (i < 100) {
    console.log(i);
    i++;
  } else {
    clearInterval(interval);
  }
}, 1000);
```

If a nested label macro expands to two or more statements that can be used with macro labels, then only the first statement will be used in the upper macro label, while all other statements will be placed **above** that statement.
