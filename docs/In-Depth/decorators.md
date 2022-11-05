---
name: Macro Decorators
order: 9
---

# Macro decorators

Macro functions can also be used as decorators! Here is a basic macro which adds two numbers, let's try using it as a decorator:

```ts --Macro
function $add(numA: number, numB: number) : EmptyDecorator {
    return (numA + numB) as unknown as EmptyDecorator;
}
```
```ts --Call
@$add!(1, 2)
class Test {}
```
```ts --Result
(3)
```

The macro expands and replaces the entire class declaration! Since macros are just plain functions, they cannot get access to the class itself and manipulate it. This is why for decorator macros to work, we need to use the [[$$raw]] built-in macro, which allows us to manipulate the typescript AST directly!

Let's write a macro which creates a copy of the class, except with a name of our choosing. With the `$$raw` macro, we get access to the class AST node thanks to the `ctx` object:

```ts
function $renameClass(newName: string) : EmptyDecorator {
    return $$raw!((ctx, newNameNode: ts.StringLiteral) => {
       const target = ctx.thisMacro.target as ts.ClassDeclaration;
    });
}
```

To copy the class, we can use the `ctx.factory.updateClassDeclaration` method:

```ts
ctx.factory.updateClassDeclaration(
    target,
    target.modifiers?.filter(m => m.kind !== ctx.ts.SyntaxKind.Decorator),
    ctx.factory.createIdentifier(newNameNode.text),
    target.typeParameters,
    target.heritageClauses,
    target.members
)
```

It's important to remove the decorators from the declaration so the macro decorators don't get to the compiled code. Let's put it all together:

```ts --Macro
function $renameClass(newName: string) : EmptyDecorator {
    return $$raw!((ctx, newNameNode: ts.StringLiteral) => {
       const target = ctx.thisMacro.target as ts.ClassDeclaration;
       return ctx.factory.updateClassDeclaration(
            target,
            target.modifiers?.filter(m => m.kind !== ctx.ts.SyntaxKind.Decorator),
            ctx.factory.createIdentifier(newNameNode.text),
            target.typeParameters,
            target.heritageClauses,
            target.members
        )
    });
}
```
```ts --Call
@$renameClass!("NewTest")
class Test {
    propA: number
    propB: string
    constructor(a: number, b: string) {
        this.propA = a;
        this.propB = b;
    }
}
```
```ts --Result
class NewTest {
    constructor(a, b) {
        this.propA = a;
        this.propB = b;
    }
}
```

Multiple decorators can be applied to a declaration, so let's create another macro which adds a method which desplays all the properties of the class. I know this looks like a lot of code, but over 50% of the lines are just updating and creating the AST declarations:

```ts --Macro
function $addDebugMethod() : EmptyDecorator {
    return $$raw!((ctx) => {
        const target = ctx.thisMacro.target as ts.ClassDeclaration;
        return ctx.factory.updateClassDeclaration(
            target,
            target.modifiers?.filter(m => m.kind !== ctx.ts.SyntaxKind.Decorator),
            target.name,
            target.typeParameters,
            target.heritageClauses,
            [
                ...target.members,
                ctx.factory.createMethodDeclaration(
                    undefined,
                    undefined,
                    "debug",
                    undefined,
                    undefined,
                    [],
                    undefined,
                    ctx.factory.createBlock(ctx.transformer.strToAST(`
                        console.log(
                            "${target.name?.getText()} ", "{\\n",
                                ${target.members.filter(m => ctx.ts.isPropertyDeclaration(m) && ctx.ts.isIdentifier(m.name)).map(m => `"${(m.name as ts.Identifier).text}: ", this.${(m.name as ts.Identifier).text}}`).join(",\"\\n\",")},
                            "\\n}"
                        )
                    `))
                )
            ]
        )
    });
}
```
```ts --Call
@$renameClass!("NewTest")
@$addDebugMethod!()
class Test {
    propA: number
    propB: string
    constructor(a: number, b: string) {
        this.propA = a;
        this.propB = b;
    }
}
```
```ts --Result
class NewTest {
    constructor(a, b) {
        this.propA = a;
        this.propB = b;
    }
    debug() { 
        console.log("Test ", "{\n", "propA: ", this.propA, "\n", "propB: ", this.propB, "\n}"); 
    }
}
```

Here we use the [[strToAST]] method to make writing the AST easier - the method transforms a string to an array of statements. We can also use it to create the entire class AST, but then you'll have to stringify the class' type parameters, constructor, other members, etc. so it becomes even more messy.

To allow flexibility, decorator macros can return **an array of declarations** so they not only edit declarations, but also create new ones as well. Here's a macro which copies a method, but logs it's arguments in the body:

```ts --Macro
function copyMethod(ctx: RawContext, original: ts.MethodDeclaration, name?: string, body?: ts.Block): ts.MethodDeclaration {
    return ctx.factory.updateMethodDeclaration(
        original,
        original.modifiers?.filter(m => m.kind !== ctx.ts.SyntaxKind.Decorator),
        original.asteriskToken,
        name ? ctx.factory.createIdentifier(name) : original.name,
        original.questionToken,
        original.typeParameters,
        original.parameters,
        original.type,
        body || original.body
    )
}

function $logArgs(): EmptyDecorator {
    return $$raw!(ctx => {
        const target = ctx.thisMacro.target as ts.MethodDeclaration;
        return [
            // Same method, we just remove the decorators
            copyMethod(ctx, target),
            // Test method which logs the arguments
            copyMethod(ctx, target,
                (target.name as ts.Identifier).text + "Test",
                ctx.factory.createBlock([
                    ...ctx.transformer.strToAST(
                        `console.log(${target.parameters.filter(p => ctx.ts.isIdentifier(p.name)).map(p => (p.name as ts.Identifier).text).join(",")})`
                    ),
                    ...(target.body?.statements || [])
                ])
            )
        ]
    });
}
```
```ts --Call
@$renameClass!("NewTest")
@$addDebugMethod!()
class Test {
    propA: number
    propB: string
    constructor(a: number, b: string) {
        this.propA = a;
        this.propB = b;
    }

    @$logArgs!()
    add(a: number, b: string) {
        return a + b;
    }
}
```
```ts --Result
class NewTest {
    constructor(a, b) {
        this.propA = a;
        this.propB = b;
    }
    add(a, b) {
        return a + b;
    }
    addTest(a, b) { console.log(a, b); return a + b; }
    debug() { console.log("Test ", "{\n", "propA: ", this.propA, "\n", "propB: ", this.propB, "\n}"); }
}
```

## Decorator composition

Decorators are called bottom-to-top, so in the example above, `$addDebugMethod` is called first, then `$renameClass`. However, what happens when a decorator macro returns an array of declarations? Let's try it out by creating another decorator which renames a method:

```ts --Macro
function $renameMethod(newName: string) : EmptyDecorator {
    return $$raw!((ctx, newNameNode: ts.StringLiteral) => {
        const target = ctx.thisMacro.target as ts.MethodDeclaration;
        return copyMethod(ctx, target, newNameNode.text);
    });
}
```
```ts --Call
@$renameClass!("NewTest")
@$addDebugMethod!()
class Test {
    propA: number
    propB: string
    constructor(a: number, b: string) {
        this.propA = a;
        this.propB = b;
    }

    @$renameMethod!("addNums")
    @$logArgs!()
    add(a: number, b: string) {
        return a + b;
    }
}
```
```ts --Result
class NewTest {
    constructor(a, b) {
        this.propA = a;
        this.propB = b;
    }
    add(a, b) {
        return a + b;
    }
    addNums(a, b) { console.log(a, b); return a + b; }
    debug() { console.log("Test ", "{\n", "propA: ", this.propA, "\n", "propB: ", this.propB, "\n}"); }
}
```

First `logArgs` gets the declaration and instead of it returns two new ones: `add` (which happens to be the old declaration) and `addTest`. Then `renameMethod` gets it's hands on **only the last returned method** from the previous decorator, which is `addTest`, so it renames it to `addNums`.

To make this work, we'll have to switch the orders of the decorators:

```ts
@$renameClass!("NewTest")
@$addDebugMethod!()
class Test {
    propA: number
    propB: string
    constructor(a: number, b: string) {
        this.propA = a;
        this.propB = b;
    }

    @$logArgs!()
    @$renameMethod!("addNums")
    add(a: number, b: string) {
        return a + b;
    }
}
```

## More info and tips

- You can also use decorator macros on methods, accessors, properties and parameters.
- Returning `undefined` in the [[$$raw]] macro callback will erase the decorator target.
- The declaration returned by the [[$$raw]] callback goes through the transformer, so macros can be called inside it!
- Always use the methods from `ctx.ts` and `ctx.factory`, **not** from `ts` and `ts.factory`.
- If you get an `Invalid Arguments` error, that means that some node does not match the expected one by typescript, for example, you cannot give a call expression node to a method name.
- Do **not** use the `getText` method if you're going to have multiple decorator macros on the same declaration. All but the bottom macros are going to receive synthetic nodes, not real nodes, and the `getText` method does not work for synthetic nodes. It's best to avoid it if you want to be able to reuse macros.