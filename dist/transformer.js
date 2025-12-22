"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MacroTransformer = void 0;
/* eslint-disable @typescript-eslint/no-non-null-assertion */
const ts = require("typescript");
const nativeMacros_1 = require("./nativeMacros");
const utils_1 = require("./utils");
const actions_1 = require("./actions");
class MacroTransformer {
    constructor(context, checker, macroMap, config, hooks) {
        this.context = context;
        this.boundVisitor = this.visitor.bind(this);
        this.repeat = [];
        this.macroStack = [];
        this.escapedStatements = [];
        this.props = {};
        this.checker = checker;
        this.macros = macroMap;
        this.comptimeSignatures = new Map();
        this.config = config || {};
        this.hooks = hooks || {};
    }
    run(node) {
        var _a, _b;
        if (node.isDeclarationFile)
            return node;
        (_b = (_a = this.hooks).beforeFileTransform) === null || _b === void 0 ? void 0 : _b.call(_a, this, node);
        const statements = [];
        this.addEscapeScope();
        for (const stmt of node.statements) {
            if (ts.isImportDeclaration(stmt) && stmt.importClause && !stmt.importClause.isTypeOnly) {
                if (stmt.importClause.namedBindings && ts.isNamedImports(stmt.importClause.namedBindings)) {
                    const filtered = stmt.importClause.namedBindings.elements.filter(el => {
                        if (el.isTypeOnly)
                            return this.config.keepImports;
                        const sym = (0, utils_1.resolveAliasedSymbol)(this.checker, this.checker.getSymbolAtLocation(el.name));
                        if (!sym)
                            return true;
                        if (this.macros.has(sym) || nativeMacros_1.default[sym.name])
                            return false;
                        else if (((0, utils_1.hasBit)(sym.flags, ts.SymbolFlags.Interface) && !(0, utils_1.hasBit)(sym.flags, ts.SymbolFlags.Class)) || (0, utils_1.hasBit)(sym.flags, ts.SymbolFlags.ConstEnum) || (0, utils_1.hasBit)(sym.flags, ts.SymbolFlags.TypeAlias))
                            return this.config.keepImports;
                        else
                            return true;
                    });
                    if (filtered.length)
                        statements.push(ts.factory.updateImportDeclaration(stmt, stmt.modifiers, ts.factory.createImportClause(stmt.importClause.isTypeOnly, undefined, ts.factory.createNamedImports(filtered)), stmt.moduleSpecifier, stmt.assertClause));
                    continue;
                }
                else if (!stmt.importClause.namedBindings && stmt.importClause.name) {
                    const sym = (0, utils_1.resolveAliasedSymbol)(this.checker, this.checker.getSymbolAtLocation(stmt.importClause.name));
                    if (!sym || !this.macros.has(sym))
                        statements.push(stmt);
                    continue;
                }
            }
            const res = this.visitor(stmt);
            this.saveAndClearEscapedStatements(statements);
            if (res) {
                if (Array.isArray(res))
                    statements.push(...res);
                else
                    statements.push(res);
            }
        }
        this.removeEscapeScope();
        return ts.factory.updateSourceFile(node, statements);
    }
    expectExpression(node) {
        const visited = ts.visitNode(node, this.boundVisitor);
        if (!visited || !ts.isExpression(node))
            throw new utils_1.MacroError(node, "Expected an expression.");
        return visited;
    }
    expectStatement(node) {
        const visited = ts.visitNode(node, this.boundVisitor);
        if (!visited || !ts.isStatement(visited))
            throw new utils_1.MacroError(node, "Expected a statement.");
        return visited;
    }
    maybeStatement(node) {
        if (!node)
            return;
        const visited = ts.visitNode(node, this.boundVisitor);
        if (!visited)
            return undefined;
        if (!ts.isStatement(visited))
            throw new utils_1.MacroError(node, "Expected a statement.");
        return visited;
    }
    expect(node, kind) {
        const visited = ts.visitNode(node, this.boundVisitor);
        if (!visited || visited.kind !== kind)
            throw new utils_1.MacroError(node, `Expected SyntaxKind ${kind}.`);
        return visited;
    }
    visitor(node) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        if (ts.isFunctionDeclaration(node) && node.name && !((_a = node.modifiers) === null || _a === void 0 ? void 0 : _a.some(mod => mod.kind === ts.SyntaxKind.DeclareKeyword)) && (0, utils_1.isMacroIdent)(node.name)) {
            if (!node.body)
                return node;
            const sym = this.checker.getSymbolAtLocation(node.name);
            if (!sym)
                return node;
            if (this.macros.has(sym))
                return;
            const macroName = sym.name;
            const params = [];
            for (let i = 0; i < node.parameters.length; i++) {
                const param = node.parameters[i];
                if (!ts.isIdentifier(param.name))
                    throw new utils_1.MacroError(param, "You cannot use deconstruction patterns in macros.");
                const marker = this.getMarker(param);
                params.push({
                    spread: Boolean(param.dotDotDotToken),
                    marker,
                    start: i,
                    name: param.name.text,
                    node: param,
                    defaultVal: param.initializer || (param.questionToken ? ts.factory.createIdentifier("undefined") : undefined)
                });
            }
            const macro = {
                name: macroName,
                params,
                body: node.body,
                typeParams: node.typeParameters || [],
                node,
                namespace: ts.isModuleBlock(node.parent) ? node.parent.parent : undefined
            };
            (_c = (_b = this.hooks).beforeRegisterMacro) === null || _c === void 0 ? void 0 : _c.call(_b, this, sym, macro);
            this.macros.set(sym, macro);
            return;
        }
        if (ts.isModuleDeclaration(node) && node.body) {
            const bod = ts.visitNode(node.body, this.boundVisitor);
            if (!bod.statements.length)
                return;
            else
                return ts.factory.updateModuleDeclaration(node, node.modifiers, node.name, bod);
        }
        if (ts.isBlock(node)) {
            const statements = [];
            this.addEscapeScope();
            for (const stmt of node.statements) {
                const res = this.visitor(stmt);
                this.saveAndClearEscapedStatements(statements);
                if (res) {
                    if (Array.isArray(res))
                        statements.push(...res);
                    else
                        statements.push(res);
                }
            }
            this.removeEscapeScope();
            return ts.factory.updateBlock(node, statements);
        }
        // Check for macro calls in labels
        if (ts.isLabeledStatement(node)) {
            const macro = this.findMacroByName(node.label, node.label.text);
            if (!macro || !macro.body)
                return;
            let statementNode = node.statement;
            const results = [];
            if (ts.isLabeledStatement(statementNode)) {
                const labelRes = this.visitor(node.statement);
                if (!labelRes)
                    return node;
                else if (Array.isArray(labelRes)) {
                    const foundStmt = labelRes.findIndex(node => actions_1.labelActions[node.kind]);
                    if (foundStmt === -1)
                        return node;
                    results.push(...labelRes.filter((_item, ind) => ind !== foundStmt));
                    statementNode = labelRes[foundStmt];
                }
                else
                    statementNode = this.expectStatement(node.statement);
            }
            const labelAction = actions_1.labelActions[statementNode.kind];
            if (!labelAction)
                return node;
            this.macroStack.push({
                macro,
                call: undefined,
                args: ts.factory.createNodeArray([labelAction(statementNode)]),
                defined: new Map(),
                store: new Map()
            });
            results.push(...ts.visitEachChild(macro.body, this.boundVisitor, this.context).statements);
            const acc = macro.params.find(p => p.marker === 1 /* MacroParamMarkers.Accumulator */);
            if (acc)
                acc.defaultVal = ts.factory.createNumericLiteral(+acc.defaultVal.text + 1);
            this.macroStack.pop();
            return results;
        }
        if (ts.isExpressionStatement(node)) {
            if (ts.isCallExpression(node.expression) && ts.isNonNullExpression(node.expression.expression)) {
                const statements = this.runMacroFromCallExpression(node.expression, node.expression.expression.expression);
                if (!statements)
                    return node;
                return this.expandMacroResults(statements, node.parent);
            }
            else if (ts.isTaggedTemplateExpression(node.expression) && ts.isNonNullExpression(node.expression.tag)) {
                const statements = this.runMacroFromTemplateExpression(node.expression, node.expression.tag.expression);
                if (!statements)
                    return node;
                return this.expandMacroResults(statements, node.parent);
            }
        }
        if (ts.canHaveDecorators(node) && ((_d = ts.getDecorators(node)) === null || _d === void 0 ? void 0 : _d.length)) {
            const decorators = ts.getDecorators(node);
            let prev;
            const extra = [];
            for (let i = decorators.length - 1; i >= 0; i--) {
                const decorator = decorators[i];
                if (ts.isCallExpression(decorator.expression) && ts.isNonNullExpression(decorator.expression.expression)) {
                    const res = this.runMacroFromCallExpression(decorator.expression, decorator.expression.expression.expression, prev || decorator.parent);
                    if (res && res.length) {
                        const [deExpanded, last] = (0, utils_1.deExpandMacroResults)(res);
                        if (last)
                            prev = ts.visitNode(last, this.boundVisitor);
                        extra.push(...deExpanded);
                    }
                }
            }
            if (prev)
                return [...extra, prev];
        }
        if (ts.isCallExpression(node)) {
            if (ts.isNonNullExpression(node.expression)) {
                const statements = this.runMacroFromCallExpression(node, node.expression.expression);
                if (!statements)
                    return node;
                else if (!statements.length)
                    return ts.factory.createNull();
                else
                    return this.expandMacroResults(statements);
            }
            else
                this.callComptimeFunction(node);
        }
        if (ts.isTaggedTemplateExpression(node) && ts.isNonNullExpression(node.tag)) {
            const statements = this.runMacroFromTemplateExpression(node, node.tag.expression);
            if (!statements || !statements.length)
                return ts.factory.createNull();
            return this.expandMacroResults(statements);
        }
        if (ts.isNewExpression(node))
            this.callComptimeFunction(node);
        // If this is true then we're in the context of a macro call
        if (this.macroStack.length) {
            const { macro, args, store } = this.getLastMacro();
            // Detects property / element access and tries to remove it if possible
            if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
                if (this.props.optimizeEnv && ts.isPropertyAccessExpression(node) && node.expression.getText() === "process.env") {
                    const value = process.env[node.name.text];
                    if (!value)
                        return node;
                    return ts.factory.createStringLiteral(value);
                }
                else {
                    let exp = this.expectExpression(node.expression);
                    while (ts.isParenthesizedExpression(exp))
                        exp = exp.expression;
                    if (ts.isObjectLiteralExpression(exp)) {
                        const name = ts.isPropertyAccessExpression(node) ? (0, utils_1.getNameFromProperty)(node.name) : this.getNumberFromNode(this.expectExpression(node.argumentExpression));
                        if (!name)
                            return node;
                        const prop = exp.properties.find(p => p.name && ((0, utils_1.getNameFromProperty)(p.name) === name));
                        if (!prop)
                            return ts.factory.createNull();
                        if (ts.isPropertyAssignment(prop))
                            return prop.initializer;
                        else
                            return ts.factory.createPropertyAccessExpression(exp, name.toString());
                    }
                    else if (ts.isArrayLiteralExpression(exp)) {
                        if (!ts.isElementAccessExpression(node))
                            return ts.factory.createPropertyAccessExpression(exp, node.name);
                        const nameNode = this.expectExpression(node.argumentExpression);
                        const name = this.getNumberFromNode(nameNode);
                        if (name !== undefined && exp.elements[name])
                            return exp.elements[name];
                        return ts.factory.createElementAccessExpression(exp, nameNode);
                    }
                }
            }
            else if (ts.isAsExpression(node))
                return ts.visitNode(node.expression, this.boundVisitor);
            else if (ts.isNonNullExpression(node))
                return ts.visitNode(node.expression, this.boundVisitor);
            else if (ts.isNumericLiteral(node))
                return ts.factory.createNumericLiteral(node.text);
            else if (ts.isStringLiteral(node))
                return ts.factory.createStringLiteral(node.text);
            else if (ts.isRegularExpressionLiteral(node))
                return ts.factory.createRegularExpressionLiteral(node.text);
            else if (ts.isTemplateHead(node))
                return ts.factory.createTemplateHead(node.text, node.rawText, node.templateFlags);
            else if (ts.isTemplateMiddle(node))
                return ts.factory.createTemplateMiddle(node.text, node.rawText, node.templateFlags);
            else if (ts.isTemplateTail(node))
                return ts.factory.createTemplateTail(node.text, node.rawText, node.templateFlags);
            // Detects use of a macro parameter and replaces it with a literal
            else if (ts.isIdentifier(node)) {
                if (store.has(node.text)) {
                    const value = store.get(node.text);
                    if (ts.isStringLiteral(value) && (ts.isDeclaration(node.parent) || ts.isPropertyAccessExpression(node.parent)))
                        return ts.factory.createIdentifier(node.text);
                    return value;
                }
                const paramMacro = this.getMacroParam(node.text, macro, args);
                if (!paramMacro)
                    return node;
                if (ts.isIdentifier(paramMacro))
                    return paramMacro;
                return ts.visitNode(paramMacro, this.boundVisitor);
            }
            else if (ts.isVariableStatement(node)) {
                const leftovers = [];
                for (const varNode of node.declarationList.declarations) {
                    if (ts.isIdentifier(varNode.name) && varNode.name.text.startsWith("$")) {
                        store.set(varNode.name.text, varNode.initializer ? this.expectExpression(varNode.initializer) : ts.factory.createIdentifier("undefined"));
                    }
                    else {
                        leftovers.push(this.expect(varNode, ts.SyntaxKind.VariableDeclaration));
                    }
                }
                if (leftovers.length)
                    return ts.factory.createVariableStatement(node.modifiers, ts.factory.createVariableDeclarationList(leftovers, node.declarationList.flags));
                else
                    return undefined;
            }
            else if (ts.isArrayLiteralExpression(node) && node.elements.some(t => ts.isSpreadElement(t))) {
                const elements = [];
                for (const element of node.elements) {
                    if (ts.isSpreadElement(element)) {
                        const visited = this.expectExpression(element.expression);
                        if (ts.isArrayLiteralExpression(visited))
                            elements.push(...visited.elements);
                        else
                            elements.push(this.expectExpression(element));
                    }
                    else
                        elements.push(this.expectExpression(element));
                }
                return ts.factory.createArrayLiteralExpression(elements);
            }
            // Detects a ternary expression and tries to remove it if possible
            else if (ts.isConditionalExpression(node)) {
                const param = this.expectExpression(node.condition);
                const res = this.getBoolFromNode(param);
                if (res === false)
                    return ts.visitNode(node.whenFalse, this.boundVisitor);
                else if (res === true)
                    return ts.visitNode(node.whenTrue, this.boundVisitor);
                else
                    return ts.factory.createConditionalExpression(param, undefined, this.expectExpression(node.whenTrue), undefined, this.expectExpression(node.whenFalse));
            }
            // Detects an if statement and tries to remove it if possible
            else if (ts.isIfStatement(node) && !ts.isParenthesizedExpression(node.expression)) {
                const condition = this.expectExpression(node.expression);
                const res = this.getBoolFromNode(condition);
                if (res === true) {
                    const res = this.expectStatement(node.thenStatement);
                    if (res && ts.isBlock(res))
                        return [...res.statements];
                    return res;
                }
                else if (res === false) {
                    if (!node.elseStatement)
                        return undefined;
                    const res = this.maybeStatement(node.elseStatement);
                    if (res && ts.isBlock(res))
                        return [...res.statements];
                    return res;
                }
                return ts.factory.createIfStatement(condition, this.expectStatement(node.thenStatement), node.elseStatement ? this.expectStatement(node.elseStatement) : undefined);
            }
            // Detects a binary operation and tries to remove it if possible
            else if (ts.isBinaryExpression(node)) {
                const op = node.operatorToken.kind;
                const right = this.expectExpression(node.right);
                if (op === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left) && store.has(node.left.text)) {
                    store.set(node.left.text, right);
                    return;
                }
                const left = this.expectExpression(node.left);
                const leftVal = this.getLiteralFromNode(left);
                const rightVal = this.getLiteralFromNode(right);
                if (leftVal === utils_1.NO_LIT_FOUND || rightVal === utils_1.NO_LIT_FOUND)
                    return (_f = (_e = actions_1.possiblyUnknownValueBinaryActions[op]) === null || _e === void 0 ? void 0 : _e.call(actions_1.possiblyUnknownValueBinaryActions, left, right, leftVal, rightVal)) !== null && _f !== void 0 ? _f : ts.factory.createBinaryExpression(left, op, right);
                if (actions_1.binaryNumberActions[op] && typeof leftVal === "number" && typeof rightVal === "number")
                    return actions_1.binaryNumberActions[op](leftVal, rightVal);
                else
                    return (_h = (_g = actions_1.binaryActions[op]) === null || _g === void 0 ? void 0 : _g.call(actions_1.binaryActions, left, right, leftVal, rightVal)) !== null && _h !== void 0 ? _h : ts.factory.createBinaryExpression(left, op, right);
            }
            // Detects a typeof expression and tries to remove it if possible
            else if (ts.isTypeOfExpression(node)) {
                const visitedNode = this.expectExpression(node.expression);
                const val = this.getLiteralFromNode(visitedNode);
                if (val === utils_1.NO_LIT_FOUND)
                    return ts.factory.updateTypeOfExpression(node, visitedNode);
                return ts.factory.createStringLiteral(typeof val);
            }
            // Detects a repetition
            else if (ts.isExpressionStatement(node) && ts.isPrefixUnaryExpression(node.expression) && node.expression.operator === ts.SyntaxKind.PlusToken && ts.isArrayLiteralExpression(node.expression.operand))
                return this.execRepetition((0, utils_1.getRepetitionParams)(this.checker, node.expression.operand));
            else if (ts.isPrefixUnaryExpression(node)) {
                if (node.operator === ts.SyntaxKind.PlusToken && ts.isArrayLiteralExpression(node.operand)) {
                    const params = (0, utils_1.getRepetitionParams)(this.checker, node.operand);
                    if (!params.separator)
                        throw new utils_1.MacroError(node, "Repetition separator must be included if a repetition is used as an expression.");
                    return this.execRepetition(params, true);
                }
                else {
                    // Detects a unary expression and tries to remove it if possible
                    const op = node.operator;
                    const value = this.expectExpression(node.operand);
                    const val = this.getLiteralFromNode(value);
                    if (val === utils_1.NO_LIT_FOUND)
                        return ts.factory.createPrefixUnaryExpression(node.operator, value);
                    return ((_j = actions_1.unaryActions[op]) === null || _j === void 0 ? void 0 : _j.call(actions_1.unaryActions, val)) || value;
                }
            }
            else if (ts.isCallExpression(node)) {
                const repNodeIndex = node.arguments.findIndex(arg => ts.isPrefixUnaryExpression(arg) && arg.operator === ts.SyntaxKind.PlusToken && ts.isArrayLiteralExpression(arg.operand));
                if (repNodeIndex !== -1) {
                    const repNode = node.arguments[repNodeIndex].operand;
                    const params = (0, utils_1.getRepetitionParams)(this.checker, repNode);
                    if (!params.separator) {
                        const newBod = this.execRepetition(params, true);
                        const finalArgs = [];
                        for (let i = 0; i < node.arguments.length; i++) {
                            if (i === repNodeIndex)
                                finalArgs.push(...newBod);
                            else
                                finalArgs.push(node.arguments[i]);
                        }
                        return ts.visitNode(ts.factory.createCallExpression(node.expression, node.typeArguments, finalArgs), this.boundVisitor);
                    }
                }
            }
            return ts.visitEachChild(node, this.boundVisitor, this.context);
        }
        return ts.visitEachChild(node, this.boundVisitor, this.context);
    }
    execRepetition({ fn, literals, separator, indexTypes }, wrapStatements) {
        const newBod = [];
        const repeatNames = fn.parameters.map(p => p.name.getText());
        const elementSlices = Array.from({ length: repeatNames.length }, () => []);
        let totalLoopsNeeded = 0;
        for (let i = 0; i < literals.length; i++) {
            const lit = literals[i];
            const resolved = this.expectExpression(lit);
            if (ts.isArrayLiteralExpression(resolved)) {
                if (resolved.elements.length > totalLoopsNeeded)
                    totalLoopsNeeded = resolved.elements.length;
                elementSlices[i % repeatNames.length].push(...resolved.elements);
            }
        }
        if (!totalLoopsNeeded)
            return [ts.factory.createNull()];
        const ind = this.repeat.push({
            index: 0,
            elementSlices,
            repeatNames,
            indexTypes
        }) - 1;
        for (; this.repeat[ind].index < totalLoopsNeeded; this.repeat[ind].index++) {
            newBod.push(...this.transformFunction(fn, wrapStatements));
        }
        this.repeat.pop();
        return separator && separators[separator] ? [separators[separator](this, newBod)] : newBod;
    }
    transformFunction(fn, wrapStatements) {
        if (!fn.body)
            return [];
        const newBod = [];
        if ("statements" in fn.body) {
            if (wrapStatements)
                newBod.push((0, utils_1.wrapExpressions)(fn.body.statements.map(node => this.maybeStatement(node)).filter(el => el)));
            else {
                for (const stmt of fn.body.statements) {
                    const res = ts.visitNode(stmt, this.boundVisitor);
                    if (res) {
                        if (Array.isArray(res))
                            newBod.push(...res);
                        else
                            newBod.push(res);
                    }
                }
            }
        }
        else {
            const res = this.expectExpression(fn.body);
            newBod.push(res);
        }
        return newBod;
    }
    getMacroParam(name, macro, params) {
        const index = macro.params.findIndex(p => p.name === name);
        if (index === -1) {
            for (let i = this.repeat.length - 1; i >= 0; i--) {
                const repeat = this.repeat[i];
                const repeatNameIndex = repeat.repeatNames.indexOf(name);
                if (repeatNameIndex !== -1) {
                    const repeatCollection = repeat.elementSlices[repeatNameIndex];
                    if (repeatCollection.length <= repeat.index)
                        return ts.factory.createNull();
                    else
                        return repeatCollection[repeat.index];
                }
            }
            return;
        }
        const paramMacro = macro.params[index];
        if (paramMacro.realName)
            return paramMacro.realName;
        if (paramMacro.spread) {
            const spreadItems = params.slice(paramMacro.start);
            if (spreadItems.length === 1 && ts.isSpreadElement(spreadItems[0]))
                return spreadItems[0].expression;
            else
                return ts.factory.createArrayLiteralExpression(params.slice(paramMacro.start));
        }
        return params[paramMacro.start] || paramMacro.defaultVal;
    }
    runMacroFromTemplateExpression(call, name) {
        const macro = this.macros.get((0, utils_1.resolveAliasedSymbol)(this.checker, this.checker.getSymbolAtLocation(name)));
        if (!macro || !ts.isTemplateExpression(call.template))
            return;
        const strings = [ts.factory.createStringLiteral(call.template.head.text)], expressions = [];
        for (const span of call.template.templateSpans) {
            expressions.push(this.expectExpression(span.expression));
            strings.push(ts.factory.createStringLiteral(span.literal.text));
        }
        return this.execMacro(macro, ts.factory.createNodeArray([ts.factory.createArrayLiteralExpression(strings), ...expressions]), call);
    }
    runMacroFromCallExpression(call, name, target) {
        var _a;
        const args = call.arguments;
        let macro, normalArgs;
        if (ts.isPropertyAccessExpression(name)) {
            if (!(0, utils_1.isMacroIdent)(name.name))
                return;
            const symofArg = (0, utils_1.resolveAliasedSymbol)(this.checker, this.checker.getSymbolAtLocation(name.expression));
            if (symofArg && (0, utils_1.hasBit)(symofArg.flags, ts.SymbolFlags.Namespace))
                return this.runMacroFromCallExpression(call, name.name);
            const possibleMacros = this.findMacroByTypeParams(name, call);
            if (!possibleMacros.length)
                throw new utils_1.MacroError(call, `No possible candidates for "${name.name.getText()}" call`);
            else if (possibleMacros.length > 1)
                throw new utils_1.MacroError(call, `More than one possible candidate for "${name.name.getText()}" call`);
            else
                macro = possibleMacros[0];
            const newArgs = ts.factory.createNodeArray([this.expectExpression(name.expression), ...call.arguments]);
            normalArgs = this.macroStack.length ? ts.factory.createNodeArray(newArgs.map(arg => this.expectExpression(arg))) : newArgs;
        }
        else if (ts.isIdentifier(name)) {
            if (!(0, utils_1.isMacroIdent)(name))
                return;
            const nativeMacro = nativeMacros_1.default[name.text];
            if (nativeMacro) {
                const macroResult = nativeMacro.call(nativeMacro.preserveParams ? args : ts.factory.createNodeArray(args.map(arg => this.expectExpression(arg))), this, call);
                if (!macroResult)
                    return [];
                else if (Array.isArray(macroResult))
                    return macroResult;
                else if (ts.isStatement(macroResult))
                    return [macroResult];
                return [ts.factory.createExpressionStatement(macroResult)];
            }
            macro = this.macros.get((0, utils_1.resolveAliasedSymbol)(this.checker, this.checker.getSymbolAtLocation(name)));
            normalArgs = this.macroStack.length ? ts.factory.createNodeArray(args.map(arg => this.expectExpression(arg))) : args;
        }
        if (!macro || !macro.body) {
            const calledSym = (0, utils_1.resolveAliasedSymbol)(this.checker, this.checker.getSymbolAtLocation(name));
            if (((_a = calledSym === null || calledSym === void 0 ? void 0 : calledSym.declarations) === null || _a === void 0 ? void 0 : _a.length) && !this.boundVisitor(calledSym.declarations[0]))
                return this.runMacroFromCallExpression(call, name, target);
            else
                return;
        }
        return this.execMacro(macro, normalArgs || ts.factory.createNodeArray(), call, target);
    }
    execMacro(macro, args, call, target) {
        var _a, _b;
        const macroExpand = { macro, args, call, target, defined: new Map(), store: new Map() };
        (_b = (_a = this.hooks).beforeCallMacro) === null || _b === void 0 ? void 0 : _b.call(_a, this, macro, macroExpand);
        this.macroStack.push(macroExpand);
        const pre = [];
        for (let i = 0; i < macro.params.length; i++) {
            const param = macro.params[i];
            if (param.marker === 2 /* MacroParamMarkers.Save */) {
                const value = param.spread ? ts.factory.createArrayLiteralExpression(args.slice(param.start)) : (args[param.start] || param.defaultVal);
                if (!ts.isIdentifier(value)) {
                    param.realName = ts.factory.createUniqueName(param.name);
                    pre.push(ts.factory.createVariableDeclaration(param.realName, undefined, undefined, value));
                }
            }
        }
        if (pre.length)
            this.escapeStatement(ts.factory.createVariableStatement(undefined, ts.factory.createVariableDeclarationList(pre, ts.NodeFlags.Let)));
        const result = ts.visitEachChild(macro.body, this.boundVisitor, this.context).statements;
        const acc = macro.params.find(p => p.marker === 1 /* MacroParamMarkers.Accumulator */);
        if (acc)
            acc.defaultVal = ts.factory.createNumericLiteral(+acc.defaultVal.text + 1);
        this.macroStack.pop();
        return [...result];
    }
    expandMacroResults(statements, parent) {
        if (parent) {
            const prepared = this.makeHygienic(statements);
            if (prepared.length && ts.isReturnStatement(prepared[prepared.length - 1]) && ts.isSourceFile(parent)) {
                const exp = prepared.pop();
                if (exp.expression)
                    prepared.push(ts.factory.createExpressionStatement(exp.expression));
            }
            return prepared;
        }
        else {
            let last = statements.pop();
            if (statements.length === 0) {
                if (ts.isReturnStatement(last) || ts.isExpressionStatement(last))
                    return last.expression;
                else if (!ts.isStatement(last))
                    return last;
            }
            if (ts.isExpressionStatement(last))
                last = ts.factory.createReturnStatement(last.expression);
            else if (!ts.isStatement(last))
                last = ts.factory.createReturnStatement(last);
            return ts.factory.createCallExpression(ts.factory.createParenthesizedExpression(ts.factory.createArrowFunction(undefined, undefined, [], undefined, undefined, ts.factory.createBlock([...statements, last], true))), undefined, undefined);
        }
    }
    makeHygienic(statements) {
        var _a;
        const defined = ((_a = this.getLastMacro()) === null || _a === void 0 ? void 0 : _a.defined) || new Map();
        const makeBindingElementHygienic = (name) => {
            if (ts.isIdentifier(name)) {
                const newName = ts.factory.createUniqueName(name.text);
                defined.set(name.text, newName);
                return newName;
            }
            else if (ts.isArrayBindingPattern(name))
                return ts.factory.createArrayBindingPattern(name.elements.map(el => ts.isBindingElement(el) ? ts.factory.createBindingElement(el.dotDotDotToken, el.propertyName, makeBindingElementHygienic(el.name), el.initializer ? this.expectExpression(el.initializer) : undefined) : el));
            else if (ts.isObjectBindingPattern(name))
                return ts.factory.createObjectBindingPattern(name.elements.map(el => ts.factory.createBindingElement(el.dotDotDotToken, el.propertyName, makeBindingElementHygienic(el.name), el.initializer ? this.expectExpression(el.initializer) : undefined)));
            else
                return name;
        };
        const visitor = (node) => {
            if (ts.isVariableDeclaration(node) && node.pos !== -1) {
                return ts.factory.updateVariableDeclaration(node, makeBindingElementHygienic(node.name), undefined, undefined, node.initializer ? visitor(this.expectExpression(node.initializer)) : undefined);
            }
            else if (ts.isIdentifier(node)) {
                if (node.parent && ts.isPropertyAccessExpression(node.parent) && node.parent.expression !== node)
                    return node;
                else
                    return defined.get(node.text) || node;
            }
            else
                return ts.visitEachChild(node, visitor, this.context);
        };
        return statements.map(stmt => visitor(stmt));
    }
    getMarker(param) {
        if (!param.type)
            return 0 /* MacroParamMarkers.None */;
        const type = this.checker.getTypeAtLocation(param.type).getProperty("__marker");
        if (!type)
            return 0 /* MacroParamMarkers.None */;
        const typeOfMarker = this.checker.getTypeOfSymbol(type).getNonNullableType();
        if (!typeOfMarker.isStringLiteral())
            return 0 /* MacroParamMarkers.None */;
        switch (typeOfMarker.value) {
            case "Accumulator": return 1 /* MacroParamMarkers.Accumulator */;
            case "Save": return 2 /* MacroParamMarkers.Save */;
            default: return 0 /* MacroParamMarkers.None */;
        }
    }
    callComptimeFunction(node) {
        var _a;
        if (this.comptimeSignatures.size) {
            const signature = this.checker.getResolvedSignature(node);
            if (signature && signature.declaration) {
                const func = this.comptimeSignatures.get(signature.declaration);
                if (func) {
                    (0, utils_1.tryRun)(node, func, ((_a = node.arguments) === null || _a === void 0 ? void 0 : _a.map(arg => {
                        const lit = this.getLiteralFromNode(arg, false, true, true);
                        if (lit === utils_1.NO_LIT_FOUND)
                            return undefined;
                        else
                            return lit;
                    })) || []);
                }
            }
        }
    }
    getNumberFromNode(node) {
        if (ts.isParenthesizedExpression(node))
            return this.getNumberFromNode(node.expression);
        if (ts.isNumericLiteral(node))
            return +node.text;
        else if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand))
            return -(+node.operand.text);
        const type = this.checker.getTypeAtLocation(node);
        if (type.isNumberLiteral())
            return type.value;
        //@ts-expect-error Private API
        if (type.intrinsicName === "null")
            return 0;
    }
    getStringFromNode(node, handleIdents = false, handleTemplates = false) {
        if (!node)
            return;
        const lit = this.getLiteralFromNode(node, handleIdents, handleTemplates);
        if (typeof lit === "string")
            return lit;
        return undefined;
    }
    getLiteralFromNode(node, handleIdents = false, handleTemplates = false, handleObjects = false) {
        if (ts.isParenthesizedExpression(node))
            return this.getLiteralFromNode(node.expression);
        else if (ts.isAsExpression(node))
            return this.getLiteralFromNode(node.expression);
        else if (ts.isNumericLiteral(node))
            return +node.text;
        else if (ts.isStringLiteral(node))
            return node.text;
        else if (node.kind === ts.SyntaxKind.FalseKeyword)
            return false;
        else if (node.kind === ts.SyntaxKind.TrueKeyword)
            return true;
        else if (node.kind === ts.SyntaxKind.NullKeyword)
            return null;
        else if (ts.isIdentifier(node)) {
            if (node.text === "undefined")
                return undefined;
            else if (handleIdents)
                return node.text;
        }
        else if (handleTemplates && ts.isTemplateExpression(node)) {
            let res = node.head.text;
            for (const span of node.templateSpans) {
                const lit = this.getLiteralFromNode(this.expectExpression(span.expression));
                res += (lit || "").toString() + span.literal.text;
            }
            return res;
        }
        else if (handleObjects && ts.isObjectLiteralExpression(node)) {
            const obj = {};
            for (const prop of node.properties) {
                if (!ts.isPropertyAssignment(prop) || !prop.initializer)
                    continue;
                const name = prop.name && (0, utils_1.getNameFromProperty)(prop.name);
                if (!name)
                    continue;
                obj[name] = this.getLiteralFromNode(prop.initializer, handleIdents, handleTemplates, handleObjects);
            }
            return obj;
        }
        else if (handleObjects && ts.isArrayLiteralExpression(node))
            return node.elements.map(el => this.getLiteralFromNode(el, handleIdents, handleTemplates, handleObjects));
        const type = this.checker.getTypeAtLocation(node);
        if (type.isNumberLiteral())
            return type.value;
        else if (type.isStringLiteral())
            return type.value;
        //@ts-expect-error Private API
        else if (type.value)
            return type.value;
        //@ts-expect-error Private API
        else if (type.intrinsicName === "false")
            return false;
        //@ts-expect-error Private API
        else if (type.intrinsicName === "true")
            return true;
        //@ts-expect-error Private API
        else if (type.intrinsicName === "undefined")
            return undefined;
        //@ts-expect-error Private API
        else if (type.intrinsicName === "null")
            return null;
        else
            return utils_1.NO_LIT_FOUND;
    }
    getBoolFromNode(node) {
        if (!node)
            return undefined;
        if (node.kind === ts.SyntaxKind.FalseKeyword || node.kind === ts.SyntaxKind.NullKeyword)
            return false;
        else if (node.kind === ts.SyntaxKind.TrueKeyword)
            return true;
        else if (ts.isNumericLiteral(node)) {
            if (node.text === "0")
                return false;
            return true;
        }
        else if (ts.isStringLiteral(node)) {
            if (node.text === "")
                return false;
            return true;
        }
        else if (ts.isArrayLiteralExpression(node) || ts.isObjectLiteralElement(node))
            return true;
        else if (ts.isIdentifier(node) && node.text === "undefined")
            return false;
        const type = this.checker.getTypeAtLocation(node);
        if (type.isNumberLiteral()) {
            if (type.value === 0)
                return false;
            return true;
        }
        else if (type.isStringLiteral()) {
            if (type.value === "")
                return false;
            return true;
        }
        else if (type.getCallSignatures().length)
            return true;
        //@ts-expect-error Private API
        else if (type.intrinsicName === "false")
            return false;
        //@ts-expect-error Private API
        else if (type.intrinsicName === "true")
            return true;
        //@ts-expect-error Private API
        else if (type.intrinsicName === "undefined")
            return false;
        //@ts-expect-error Private API
        else if (type.intrinsicName === "null")
            return false;
        return undefined;
    }
    resolveTypeArgumentOfCall(macroCall, typeIndex) {
        var _a, _b;
        if (!macroCall.typeArguments || !macroCall.typeArguments[typeIndex])
            return;
        const type = this.checker.getTypeAtLocation(macroCall.typeArguments[typeIndex]);
        const lastMacroCall = this.getLastMacro();
        if (!lastMacroCall)
            return type;
        const lastRep = this.repeat[this.repeat.length - 1];
        if (type.isTypeParameter()) {
            if (lastRep && lastRep.indexTypes) {
                const resolvedIndexTypeParameterIndex = lastRep.indexTypes.findIndex(indType => indType === type);
                if (resolvedIndexTypeParameterIndex !== -1) {
                    const resolvedTypeParam = (_a = lastRep.elementSlices[resolvedIndexTypeParameterIndex]) === null || _a === void 0 ? void 0 : _a[lastRep.index];
                    if (!resolvedTypeParam)
                        return;
                    return (0, utils_1.getTypeAtLocation)(this.checker, resolvedTypeParam);
                }
            }
            const resolvedTypeParameterIndex = lastMacroCall.macro.typeParams.findIndex(arg => this.checker.getTypeAtLocation(arg) === type);
            if (resolvedTypeParameterIndex !== -1 && lastMacroCall.call && ts.isCallExpression(lastMacroCall.call)) {
                const resolvedTypeParam = (_b = lastMacroCall.call.typeArguments) === null || _b === void 0 ? void 0 : _b[resolvedTypeParameterIndex];
                if (!resolvedTypeParam)
                    return (0, utils_1.resolveTypeArguments)(this.checker, lastMacroCall.call)[resolvedTypeParameterIndex];
                return (0, utils_1.getTypeAtLocation)(this.checker, resolvedTypeParam);
            }
        }
        else {
            const allParams = lastMacroCall.macro.typeParams.map(p => this.checker.getTypeAtLocation(p));
            const replacementTypes = (0, utils_1.resolveTypeArguments)(this.checker, lastMacroCall.call);
            if (lastRep && lastRep.indexTypes) {
                allParams.push(...lastRep.indexTypes);
                for (let i = 0; i < lastRep.repeatNames.length; i++) {
                    const replacementType = lastRep.elementSlices[i][lastRep.index];
                    if (replacementType)
                        replacementTypes.push((0, utils_1.getTypeAtLocation)(this.checker, replacementType));
                }
            }
            return (0, utils_1.resolveTypeWithTypeParams)(type, allParams, replacementTypes);
        }
    }
    findMacroByTypeParams(prop, call) {
        const name = prop.name.getText();
        const firstType = this.checker.getTypeAtLocation(prop.expression);
        const restTypes = call.arguments.map((exp) => this.checker.getTypeAtLocation(exp));
        const macros = [];
        mainLoop: for (const [sym, macro] of this.macros) {
            // If the names are different, continue to the next macro
            if (macro.name !== name)
                continue;
            const fnType = this.checker.getTypeOfSymbolAtLocation(sym, sym.valueDeclaration).getCallSignatures()[0];
            const fnTypeParams = macro.typeParams.map(p => this.checker.getTypeAtLocation(p));
            const anyArray = fnTypeParams.map(p => p.getConstraint() || this.checker.getAnyType());
            const fnArgs = fnTypeParams.length ? fnType.parameters.map(p => (0, utils_1.resolveTypeWithTypeParams)(this.checker.getTypeOfSymbolAtLocation(p, p.valueDeclaration), fnTypeParams, anyArray)) : fnType.parameters.map(p => this.checker.getTypeOfSymbolAtLocation(p, p.valueDeclaration));
            const firstArg = fnArgs.shift();
            // If the first parameter matches type
            if (this.checker.isTypeAssignableTo(firstType, firstArg)) {
                // Check if the rest of the parameters match
                for (let i = 0; i < fnArgs.length; i++) {
                    // If the parameter is spread, do not compare, it will be done afterwards
                    if (macro.params[i + 1].spread)
                        break;
                    // If the macro call is missing a parameter
                    // and that parameter is NOT optional and does NOT have a default value
                    // continue to the next macro
                    if (!restTypes[i]) {
                        if (fnArgs[i].getDefault() || fnArgs[i] !== fnArgs[i].getNonNullableType())
                            continue;
                        else
                            continue mainLoop;
                    }
                    if (!this.checker.isTypeAssignableTo(restTypes[i], fnArgs[i]))
                        continue mainLoop;
                }
                // If the macro call has more arguments than the macro declaration
                if (restTypes.length > fnArgs.length) {
                    // If the last parameter of the function is a spread parameter, check if the rest of the
                    // passed values match the type, otherwise return
                    let argType = this.checker.getTypeArguments(fnArgs[fnArgs.length - 1])[0];
                    if (argType.isTypeParameter())
                        argType = argType.getConstraint() || this.checker.getAnyType();
                    if (macro.params[macro.params.length - 1].spread) {
                        for (let i = fnArgs.length - 1; i < restTypes.length; i++) {
                            if (!this.checker.isTypeAssignableTo(restTypes[i], argType))
                                continue mainLoop;
                        }
                    }
                    else
                        continue;
                }
                macros.push(macro);
            }
        }
        return macros;
    }
    findMacroByName(node, name) {
        const foundMacros = [];
        for (const [, macro] of this.macros) {
            if (macro.name === name)
                foundMacros.push(macro);
        }
        if (foundMacros.length > 1)
            throw new utils_1.MacroError(node, `More than one macro with the name ${name} exists.`);
        return foundMacros[0];
    }
    getLastMacro() {
        return this.macroStack[this.macroStack.length - 1];
    }
    saveAndClearEscapedStatements(into) {
        into.push(...this.escapedStatements[this.escapedStatements.length - 1]);
        this.escapedStatements[this.escapedStatements.length - 1].length = 0;
    }
    escapeStatement(...statements) {
        this.escapedStatements[this.escapedStatements.length - 1].push(...statements);
    }
    removeEscapeScope() {
        this.escapedStatements.pop();
    }
    addEscapeScope() {
        this.escapedStatements.push([]);
    }
    addComptimeSignature(sym, fn, args) {
        if (this.comptimeSignatures.has(sym))
            return this.comptimeSignatures.get(sym);
        const comptime = new Function(...args, fn);
        this.comptimeSignatures.set(sym, comptime);
        return comptime;
    }
    strToAST(str) {
        const file = ts.createSourceFile("", str, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
        const uniquelize = (node) => ts.factory.cloneNode(ts.visitEachChild(node, uniquelize, this.context));
        return ts.visitEachChild(file, uniquelize, this.context).statements;
    }
    getIdent(name) {
        const lastMacro = this.getLastMacro();
        if (!lastMacro)
            return ts.factory.createIdentifier(name);
        return lastMacro.defined.get(name) || ts.factory.createIdentifier(name);
    }
    toNode(primitive) {
        return (0, utils_1.primitiveToNode)(primitive);
    }
    cleanupMacros(macro, extra) {
        for (const [oldSym, oldMacro] of this.macros) {
            if (macro.name === oldMacro.name && macro.node.getSourceFile().fileName === oldMacro.node.getSourceFile().fileName && macro.namespace === oldMacro.namespace) {
                this.macros.delete(oldSym);
                extra === null || extra === void 0 ? void 0 : extra(oldMacro);
                break;
            }
        }
    }
}
exports.MacroTransformer = MacroTransformer;
const separators = {
    "[]": (_transformer, body) => ts.factory.createArrayLiteralExpression(body.map(m => ts.isExpressionStatement(m) ? m.expression : m)),
    "+": (transformer, body) => (0, utils_1.toBinaryExp)(transformer, body, ts.SyntaxKind.PlusToken),
    "-": (transformer, body) => (0, utils_1.toBinaryExp)(transformer, body, ts.SyntaxKind.MinusToken),
    "*": (transformer, body) => (0, utils_1.toBinaryExp)(transformer, body, ts.SyntaxKind.AsteriskToken),
    "||": (transformer, body) => (0, utils_1.toBinaryExp)(transformer, body, ts.SyntaxKind.BarBarToken),
    "&&": (transformer, body) => (0, utils_1.toBinaryExp)(transformer, body, ts.SyntaxKind.AmpersandAmpersandToken),
    "()": (transformer, body) => ts.factory.createParenthesizedExpression((0, utils_1.toBinaryExp)(transformer, body, ts.SyntaxKind.CommaToken)),
    ".": (_, body) => {
        let last = body[0];
        for (let i = 1; i < body.length; i++) {
            const el = body[i];
            if (ts.isIdentifier(el))
                last = ts.factory.createPropertyAccessExpression(last, el);
            else
                last = ts.factory.createElementAccessExpression(last, el);
        }
        return last;
    },
    "{}": (transformer, body) => {
        return ts.factory.createObjectLiteralExpression(body.filter(el => ts.isArrayLiteralExpression(el)).map((el) => {
            const arr = el;
            if (arr.elements.length < 2)
                return ts.factory.createPropertyAssignment("undefined", ts.factory.createIdentifier("undefined"));
            const string = transformer.getStringFromNode(arr.elements[0], false, true);
            if (!string)
                return ts.factory.createPropertyAssignment("undefined", ts.factory.createIdentifier("undefined"));
            return ts.factory.createPropertyAssignment(string, arr.elements[1]);
        }));
    }
};
