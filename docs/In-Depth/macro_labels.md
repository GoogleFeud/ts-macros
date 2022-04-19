---
name: Macro labels
order: 8
---

# Macro labels

Macros can also be used on statements with labels:

```ts --Macro
// Macro for turning a for...of loop to a regular for loop
function $NormalizeFor(info: ForIterLabel) : void {
    if ($$kindof!(info.initializer) === ts.SyntaxKind.Identifier) {
        const iter = (info.iterator).length;
        for ($$define!(info.initializer, 0, true); info.initializer < iter; info.initializer++) {
            $$inlineFunc!(info.statement);
        }
    }
}
```
```ts --Call
const arr = [1, 2, 3, 4, 5];

$NormalizeFor:
for (const item of arr) {
    console.log(item + 1);
}
```
```ts --Result
const iter = (arr).length;
for (let item = 0; item < iter; item++) {
    console.log(item + 1);
}
```

Only catch is that these macros cannot accept any other parameters - their first parameter will **always** be an object with information about the statement. 

Check out [[IfLabel]], [[ForIterLabel]], [[ForLabel]], [[WhileLabel]], and [[BlockLabel]] for all the information you get to use in the macros.

