import * as ts from "typescript";
import * as fs from "fs";
import { MacroTransformer } from "./transformer";
import * as path from "path";
import { expressionToStringLiteral, fnBodyToString, getGeneralType, hasBit, MacroError, macroParamsToArray, normalizeFunctionNode, primitiveToNode, tryRun } from "./utils";

const jsonFileCache: Record<string, ts.Expression> = {};
const regFileCache: Record<string, string> = {};

export interface NativeMacro {
    call: (args: ts.NodeArray<ts.Expression>, transformer: MacroTransformer, callSite: ts.CallExpression) => ts.VisitResult<ts.Node|undefined>,
    preserveParams?: boolean
}

export default {
    "$$loadEnv": {
        call: (args, transformer, callSite) => {
            const extraPath = args.length && ts.isStringLiteral(args[0]) ? args[0].text:"";
            let dotenv;
            try {
                dotenv = require("dotenv");
            } catch {
                throw new MacroError(callSite, "`loadEnv` macro called but `dotenv` module is not installed.");
            }
            if (extraPath) dotenv.config({path: path.join(ts.sys.getCurrentDirectory(), extraPath)});
            else dotenv.config();
            transformer.props.optimizeEnv = true;
            return transformer.context.factory.createCallExpression(
                transformer.context.factory.createPropertyAccessExpression(
                    transformer.context.factory.createCallExpression(
                        transformer.context.factory.createIdentifier("require"),
                        undefined,
                        [transformer.context.factory.createStringLiteral("dotenv")]
                    ),
                    transformer.context.factory.createIdentifier("config")
                ),
                undefined,
                extraPath ? [transformer.context.factory.createObjectLiteralExpression(
                    [transformer.context.factory.createPropertyAssignment(
                        transformer.context.factory.createIdentifier("path"),
                        transformer.context.factory.createStringLiteral(extraPath)
                    )])]:[]
            );
        }
    },
    "$$readFile": {
        call: ([file, parseJSON], transformer, callSite) => {
            const filePath = file && transformer.getStringFromNode(file, false, true);
            if (!filePath)  throw new MacroError(callSite, "`readFile` macro expects a path to the JSON file as the first parameter.");
            const shouldParse = parseJSON && transformer.getBoolFromNode(parseJSON);
            if (shouldParse) {
                if (jsonFileCache[filePath]) return jsonFileCache[filePath];
            }
            else if (regFileCache[filePath]) return ts.factory.createStringLiteral(regFileCache[filePath]);
            const fileContents = fs.readFileSync(filePath, "utf-8");
            if (shouldParse) {
                const value = primitiveToNode(JSON.parse(fileContents));
                jsonFileCache[filePath] = value;
                return value;
            } else {
                regFileCache[filePath] = fileContents;
                return ts.factory.createStringLiteral(fileContents);
            }
        }
    },
    "$$inline": {
        call: ([func, params, doNotCall], transformer, callSite) => {
            if (!func) throw new MacroError(callSite, "`inline` macro expects a function as the first argument.");
            if (!params || !ts.isArrayLiteralExpression(params)) throw new MacroError(callSite, "`inline` macro expects an array of expressions as the second argument.");
            const fn = normalizeFunctionNode(transformer.checker, func);
            if (!fn || !fn.body) throw new MacroError(callSite, "`inline` macro expects a function as the first argument.");
            let newBody: ts.ConciseBody;
            if (!fn.parameters.length) newBody = fn.body;
            else {
                const replacements = new Map();
                for (let i=0; i < fn.parameters.length; i++) {
                    const param = fn.parameters[i];
                    if (ts.isIdentifier(param.name)) replacements.set(param.name.text, params.elements[i]);
                }
                const visitor = (node: ts.Node): ts.Node|undefined => {
                    if (ts.isIdentifier(node) && replacements.has(node.text)) return replacements.get(node.text);
                    return ts.visitEachChild(node, visitor, transformer.context);
                };
                transformer.context.suspendLexicalEnvironment();
                newBody = ts.visitFunctionBody(fn.body, visitor, transformer.context);
            }
            if (doNotCall) return ts.factory.createArrowFunction(undefined, undefined, [], undefined, undefined, newBody);
            else {
                if (ts.isBlock(newBody)) return newBody.statements;
                else return newBody;
            }
        }
    },
    "$$kindof": {
        call: (args, transformer, callSite) => { 
            if (!args.length) throw new MacroError(callSite, "`kindof` macro expects a single argument.");
            return transformer.context.factory.createNumericLiteral(args[0].kind);
        }
    },
    "$$define": {
        call: ([name, value, useLet, exportDecl], transformer, callSite) => {
            const strContent = transformer.getStringFromNode(name, true, true);
            if (!strContent) throw new MacroError(callSite, "`define` macro expects a string literal as the first argument.");
            const list = transformer.context.factory.createVariableDeclarationList([
                transformer.context.factory.createVariableDeclaration(strContent, undefined, undefined, value)
            ], transformer.getBoolFromNode(useLet) ? ts.NodeFlags.Let : ts.NodeFlags.Const);
            if (ts.isForStatement(callSite.parent)) return list;
            else return ts.factory.createVariableStatement(transformer.getBoolFromNode(exportDecl) ? [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)] : undefined, list);
        }
    },
    "$$i": {
        call: (_, transformer) => {
            if (transformer.repeat.length) return transformer.context.factory.createNumericLiteral(transformer.repeat[transformer.repeat.length - 1].index);
            else return transformer.context.factory.createNumericLiteral(-1); 
        }
    },
    "$$length": {
        call: ([arrLit], transformer, callSite) => {
            if (!arrLit) throw new MacroError(callSite, "`length` macro expects an array / string literal as the first argument."); 
            if (ts.isArrayLiteralExpression(arrLit)) return transformer.context.factory.createNumericLiteral(arrLit.elements.length);
            const str = transformer.getStringFromNode(arrLit, true, true);
            if (str) return transformer.context.factory.createNumericLiteral(str.length);
            throw new MacroError(callSite, "`length` macro expects an array / string literal as the first argument."); 
        }
    },
    "$$ident": {
        call: ([thing], transformer, callSite) => {
            if (!thing) throw new MacroError(callSite, "`ident` macro expects a string literal as the first parameter.");
            const strVal = transformer.getStringFromNode(thing, true, true);
            if (strVal) return transformer.getLastMacro()?.defined?.get(strVal) || ts.factory.createIdentifier(strVal);
            else return thing;
        }
    },
    "$$err": {
        call: ([msg], transformer, callSite) => {
            const strVal = transformer.getStringFromNode(msg, false, true);
            if (!strVal) throw new MacroError(callSite, "`err` macro expects a string literal as the first argument.");
            const lastMacro = transformer.macroStack.pop();
            throw new MacroError(callSite, `${lastMacro ? `In macro ${lastMacro.macro.name}: ` : ""}${strVal}`);
        }
    },
    "$$includes": {
        call: ([array, item], transformer, callSite) => {
            if (!array) throw new MacroError(callSite, "`includes` macro expects an array/string literal as the first argument.");
            if (!item) throw new MacroError(callSite, "`includes` macro expects a second argument.");
            const strContent = transformer.getStringFromNode(array, false, true);
            if (strContent) {
                const valItem = transformer.getLiteralFromNode(item);
                if (typeof valItem !== "string") throw new MacroError(callSite, "`includes` macro expects a string literal as the second argument.");
                return strContent.includes(valItem) ? ts.factory.createTrue() : ts.factory.createFalse();
            } else if (ts.isArrayLiteralExpression(array)) {
                const normalArr = array.elements.map(el => transformer.getLiteralFromNode(transformer.expectExpression(el)));
                return normalArr.includes(transformer.getLiteralFromNode(item)) ? ts.factory.createTrue() : ts.factory.createFalse();
            } else throw new MacroError(callSite, "`includes` macro expects an array/string literal as the first argument.");
        }
    },
    "$$ts": {
        call: ([code], transformer, callSite) => {
            const str = transformer.getStringFromNode(transformer.expectExpression(code), true, true);
            if (!str) throw new MacroError(callSite, "`ts` macro expects a string as it's first argument.");
            const result = ts.createSourceFile("expr", str, ts.ScriptTarget.ESNext, false, ts.ScriptKind.JS);
            const visitor = (node: ts.Node): ts.Node => ts.factory.cloneNode(ts.visitEachChild(node, visitor, transformer.context));
            return ts.visitNodes(result.statements, visitor) as unknown as Array<ts.Statement>;
        }
    },
    "$$escape": {
        call: ([code], transformer, callSite) => {
            if (!code) throw new MacroError(callSite, "`escape` macro expects a function as it's first argument.");
            const maybeFn = normalizeFunctionNode(transformer.checker, transformer.expectExpression(code));
            if (!maybeFn || !maybeFn.body) throw new MacroError(callSite, "`escape` macro expects a function as it's first argument.");
            if (ts.isBlock(maybeFn.body)) {
                const hygienicBody = [...transformer.makeHygienic(maybeFn.body.statements as unknown as ts.Statement[])];
                const lastStatement = hygienicBody.pop();
                transformer.escapeStatement(...hygienicBody);
                if (lastStatement) {
                    if (ts.isReturnStatement(lastStatement)) {
                        return lastStatement.expression;
                    } else {
                        if (!hygienicBody.length && ts.isExpression(lastStatement)) return lastStatement;
                        transformer.escapeStatement(lastStatement);
                    }
                }
            } else return maybeFn.body;
        }
    },
    "$$slice": {
        call: ([thing, start, end], transformer, callSite) => {
            if (!thing) throw new MacroError(callSite, "`slice` macro expects an array/string literal as the first argument.");
            const startNum = (start && transformer.getNumberFromNode(start)) || -Infinity;
            const endNum = (end && transformer.getNumberFromNode(end)) || Infinity;
            const strVal = transformer.getStringFromNode(thing, false, true);
            if (strVal) return ts.factory.createStringLiteral(strVal.slice(startNum, endNum));
            else if (ts.isArrayLiteralExpression(thing)) return ts.factory.createArrayLiteralExpression(thing.elements.slice(startNum, endNum));
            else throw new MacroError(callSite, "`slice` macro expects an array/string literal as the first argument.");
        }
    },
    "$$propsOfType": {
        call: (_args, transformer, callSite) => {
            const type = transformer.resolveTypeArgumentOfCall(callSite, 0);
            if (!type) throw new MacroError(callSite, "`propsOfType` macro expects one type parameter.");
            return ts.factory.createArrayLiteralExpression(type.getProperties().map(sym => ts.factory.createStringLiteral(sym.name)));
        }
    },
    "$$typeToString": {
        call: ([simplifyType, nonNullType, fullExpand], transformer, callSite) => {
            let type = transformer.resolveTypeArgumentOfCall(callSite, 0);
            if (!type) throw new MacroError(callSite, "`typeToString` macro expects one type parameter.");
            if (transformer.getBoolFromNode(simplifyType)) type = getGeneralType(transformer.checker, type);
            if (transformer.getBoolFromNode(nonNullType)) type = transformer.checker.getNonNullableType(type);
            return ts.factory.createStringLiteral(transformer.checker.typeToString(type, undefined, transformer.getBoolFromNode(fullExpand) ? ts.TypeFormatFlags.NoTruncation : undefined));
        }
    },
    "$$typeAssignableTo": {
        call: (_args, transformer, callSite) => {
            const type = transformer.resolveTypeArgumentOfCall(callSite, 0);
            const compareTo = transformer.resolveTypeArgumentOfCall(callSite, 1);
            if (!type || !compareTo) throw new MacroError(callSite, "`typeAssignableTo` macro expects two type parameters.");
            return transformer.checker.isTypeAssignableTo(type, compareTo) ? ts.factory.createTrue() : ts.factory.createFalse();
        }
    },
    "$$typeMetadata": {
        call: ([collectProps, collectMethods], transformer, callSite) => {
            const type = transformer.resolveTypeArgumentOfCall(callSite, 0);
            if (!type) throw new MacroError(callSite, "`typeMetadata` macro expects a type parameter.");
            const shouldCollectProps = transformer.getBoolFromNode(collectProps);
            const shouldCollectMethods = transformer.getBoolFromNode(collectMethods);

            const methods: ts.ObjectLiteralExpression[] = [];
            const properties: ts.ObjectLiteralExpression[] = [];

            const stringifyType = (type: ts.Type) => ts.factory.createStringLiteral(transformer.checker.typeToString(transformer.checker.getNonNullableType(type), undefined, ts.TypeFormatFlags.NoTruncation));

            for (const property of type.getProperties()) {
                const valueDecl = property.valueDeclaration;
                if (!valueDecl) continue;
                const propType = transformer.checker.getTypeOfSymbolAtLocation(property, valueDecl);
                const callSig = propType.getCallSignatures()[0];

                if (callSig && shouldCollectMethods) {
                    methods.push(ts.factory.createObjectLiteralExpression([
                        ts.factory.createPropertyAssignment("name", ts.factory.createStringLiteral(property.name)),
                        ts.factory.createPropertyAssignment("tags", ts.factory.createObjectLiteralExpression(ts.getJSDocTags(valueDecl).map(tag => ts.factory.createPropertyAssignment(tag.tagName.text, typeof tag.comment === "string" ? ts.factory.createStringLiteral(tag.comment) : ts.factory.createTrue())))),
                        ts.factory.createPropertyAssignment("parameters", ts.factory.createArrayLiteralExpression(callSig.getParameters().map(method => {
                            const paramType = transformer.checker.getTypeOfSymbol(method);
                            return ts.factory.createObjectLiteralExpression([
                                ts.factory.createPropertyAssignment("name", ts.factory.createStringLiteral(method.name)),
                                ts.factory.createPropertyAssignment("type", stringifyType(paramType)),
                                ts.factory.createPropertyAssignment("optional", hasBit(method.flags, ts.SymbolFlags.Optional) ? ts.factory.createTrue() : ts.factory.createFalse())
                            ]);
                        }))),
                        ts.factory.createPropertyAssignment("returnType", stringifyType(callSig.getReturnType()))
                    ]));
                }
                else if (!callSig && shouldCollectProps) {
                    properties.push(ts.factory.createObjectLiteralExpression([
                        ts.factory.createPropertyAssignment("name", ts.factory.createStringLiteral(property.name)),
                        ts.factory.createPropertyAssignment("tags", ts.factory.createObjectLiteralExpression(ts.getJSDocTags(valueDecl).map(tag => ts.factory.createPropertyAssignment(tag.tagName.text, typeof tag.comment === "string" ? ts.factory.createStringLiteral(tag.comment) : ts.factory.createTrue())))),
                        ts.factory.createPropertyAssignment("type", stringifyType(propType)),
                        ts.factory.createPropertyAssignment("optional", hasBit(property.flags, ts.SymbolFlags.Optional) ? ts.factory.createTrue() : ts.factory.createFalse())
                    ]));
                }
            }

            return ts.factory.createObjectLiteralExpression([
                ts.factory.createPropertyAssignment("name", ts.factory.createStringLiteral(type.symbol?.name || "anonymous")),
                ts.factory.createPropertyAssignment("properties", ts.factory.createArrayLiteralExpression(properties)),
                ts.factory.createPropertyAssignment("methods", ts.factory.createArrayLiteralExpression(methods))
            ]);
        }
    },
    "$$text": {
        call: ([exp], transformer, callSite) => {
            if (!exp) throw new MacroError(callSite, "`text` macro expects an expression.");
            return expressionToStringLiteral(exp);
        }
    },
    "$$decompose": {
        call: ([exp], transformer) => {
            if (!exp) return ts.factory.createArrayLiteralExpression([]);
            const elements: Array<ts.Expression> = [];
            const visitor = (node: ts.Node) => {
                if (ts.isExpression(node)) elements.push(node);
                return node;
            };
            ts.visitEachChild(exp, visitor, transformer.context);
            return ts.factory.createArrayLiteralExpression(elements);
        }
    },
    "$$map": {
        call: ([exp, visitor], transformer, callSite) => {
            const lastMacro = transformer.getLastMacro();
            if (!lastMacro) throw new MacroError(callSite, "`$$map` macro can only be used inside other macros.");
            if (!exp) throw new MacroError(callSite, "`$$map` macro expects an expression as it's first argument.");
            if (!visitor) throw new MacroError(callSite, "`$$map` macro expects a function expression as it's second argument.");
            const fn = normalizeFunctionNode(transformer.checker, visitor);
            if (!fn || !fn.body) throw new MacroError(callSite, "`$$map` macro expects a function as it's second argument.");
            if (!fn.parameters.length || !ts.isIdentifier(fn.parameters[0].name)) throw new MacroError(callSite, "`$$map` macro expects the function to have a parameter.");
            const paramName = fn.parameters[0].name.text;
            const kindParamName = fn.parameters[1] && ts.isIdentifier(fn.parameters[1].name) && fn.parameters[1].name.text;
            const visitorFn = (node: ts.Node) : ts.Node|Array<ts.Node> => {
                const visitedNode = ts.visitNode(node, transformer.boundVisitor);
                if (!visitedNode) return node;
                if (!ts.isExpression(visitedNode)) return ts.visitEachChild(visitedNode, visitorFn, transformer.context);
                lastMacro.store.set(paramName, visitedNode);
                if (kindParamName) lastMacro.store.set(kindParamName, ts.factory.createNumericLiteral(visitedNode.kind));
                const newNodes = transformer.transformFunction(fn, true);
                if (newNodes.length === 1 && newNodes[0].kind === ts.SyntaxKind.NullKeyword) return ts.visitEachChild(visitedNode, visitorFn, transformer.context);
                return newNodes;
            };
            return ts.visitNode(exp, visitorFn);
        },
        preserveParams: true
    },
    "$$comptime": {
        call: ([fn], transformer, callSite) => {
            if (transformer.config.noComptime) return;
            if (transformer.macroStack.length) throw new MacroError(callSite, "`comptime` macro cannot be called inside macros.");
            if (!fn) throw new MacroError(callSite, "`comptime` macro expects a function as the first parameter.");
            const callableFn = normalizeFunctionNode(transformer.checker, fn);
            if (!callableFn || !callableFn.body) throw new MacroError(callSite, "`comptime` macro expects a function as the first parameter.");
            let parent = callSite.parent;
            if (ts.isExpressionStatement(parent)) {
                parent = parent.parent;
                if (ts.isBlock(parent)) parent = parent.parent;
                if ("body" in parent) {
                    const signature = transformer.checker.getSignatureFromDeclaration(parent as ts.SignatureDeclaration);
                    if (!signature || !signature.declaration) return;
                    transformer.addComptimeSignature(signature.declaration, fnBodyToString(transformer.checker, callableFn, transformer.context.getCompilerOptions()), signature.parameters.map(p => p.name));
                    return;
                }
            }
        },
        preserveParams: true
    },
    "$$raw": {
        call: ([fn], transformer, callSite) => {
            if (transformer.config.noComptime) return;
            const lastMacro = transformer.getLastMacro();
            if (!lastMacro) throw new MacroError(callSite, "`raw` macro must be called inside another macro.");
            if (!fn) throw new MacroError(callSite, "`raw` macro expects a function as the first parameter.");
            const callableFn = normalizeFunctionNode(transformer.checker, fn);
            if (!callableFn || !callableFn.body) throw new MacroError(callSite, "`raw` macro expects a function as the first parameter.");
            const renamedParameters = [];
            for (const param of callableFn.parameters.slice(1)) {
                if (!ts.isIdentifier(param.name)) throw new MacroError(callSite, "`raw` macro parameters cannot be deconstructors.");
                renamedParameters.push(param.name.text);
            }
            const stringified = transformer.addComptimeSignature(callableFn, fnBodyToString(transformer.checker, callableFn, transformer.context.getCompilerOptions()), ["ctx", ...renamedParameters]);
            return tryRun(fn, stringified, [{
                ts,
                factory: ts.factory,
                transformer,
                checker: transformer.checker,
                thisMacro: lastMacro,
                require,
                error: (node: ts.Node, message: string) => {
                    throw new MacroError(node, message);
                }
            }, ...macroParamsToArray(lastMacro.macro.params, [...lastMacro.args])], `$$raw in ${lastMacro.macro.name}: `);
        },
        preserveParams: true
    }
} as Record<string, NativeMacro>;