---
name: Built-in macros
order: 8
---

# Built-in macros

ts-macros provides you with a lot of useful built-in macros which you can use inside macros. All the exported functions from this library that start with two dollar signs (`$$`) are built-in macros!

|> Important: You cannot chain built-in macros!

[[$$loadEnv]] - Loads an env file from the provided path.     
[[$$readFile]] - Reads from the provided file and expands to the file's contents.     
[[$$kindof]] - Expands to the `kind` of the AST node.     
[[$$inlineFunc]], [[$$inline]] - Inlines the provided arrow function.     
[[$$define]] - Creates a const variable with the provided name and initializer.     
[[$$i]] - Gives you the repetition count.     
[[$$length]] - Gets the length of an array / string literal.     
[[$$ident]] - Turns a string literal into an identifier.      
[[$$err]] - Throws an error during transpilation.     
[[$$includes]] - Checks if an item is included in an array / string literal.     
[[$$slice]] - Slices an array / string literal.     
[[$$ts]] - Turns a string literal into code.     
[[$$escape]] - Places a block of code in the parent block.     
[[$$propsOfType]] - Expands to an array with all properties of a type.     
[[$$typeToString]] - Turns a type to a string literal.     
[[$$typeAssignableTo]] - Compares two types.    
[[$$text]] - Turns an expression into a string literal.     
[[$$decompose]] - Expands to an array literal containing the nodes that make up an expression.      
[[$$map]] - Takes a function that acts as a macro and goes over all the nodes of an expression with it, replacing each node with the expanded result of the macro function.     
[[$$comptime]] - Allows you to run code during transpilation.     
[[$$raw]] - Allows you to interact with the raw typescript APIs.    
[[$$getStore]], [[$$setStore]] - Allow you to store variables in a macro call.