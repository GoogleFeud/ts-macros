"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.labelActions = exports.unaryActions = exports.possiblyUnknownValueBinaryActions = exports.binaryActions = exports.binaryNumberActions = void 0;
const ts = require("typescript");
const utils_1 = require("./utils");
exports.binaryNumberActions = {
    [ts.SyntaxKind.MinusToken]: (left, right) => (0, utils_1.createNumberNode)(left - right),
    [ts.SyntaxKind.AsteriskToken]: (left, right) => (0, utils_1.createNumberNode)(left * right),
    [ts.SyntaxKind.SlashToken]: (left, right) => (0, utils_1.createNumberNode)(left / right),
    [ts.SyntaxKind.LessThanToken]: (left, right) => left < right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.LessThanEqualsToken]: (left, right) => left <= right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.GreaterThanToken]: (left, right) => left > right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.GreaterThanEqualsToken]: (left, right) => left >= right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.AmpersandToken]: (left, right) => (0, utils_1.createNumberNode)(left & right),
    [ts.SyntaxKind.BarToken]: (left, right) => (0, utils_1.createNumberNode)(left | right),
    [ts.SyntaxKind.CaretToken]: (left, right) => (0, utils_1.createNumberNode)(left ^ right),
    [ts.SyntaxKind.PercentToken]: (left, right) => (0, utils_1.createNumberNode)(left % right)
};
exports.binaryActions = {
    [ts.SyntaxKind.PlusToken]: (_origLeft, _origRight, left, right) => {
        if (typeof left === "string" || typeof right === "string")
            return ts.factory.createStringLiteral(left + right);
        else if (typeof left === "number" || typeof right === "number")
            return (0, utils_1.createNumberNode)(left + right);
    },
    [ts.SyntaxKind.EqualsEqualsEqualsToken]: (_origLeft, _origRight, left, right) => left === right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.EqualsEqualsToken]: (_origLeft, _origRight, left, right) => left == right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.ExclamationEqualsEqualsToken]: (_origLeft, _origRight, left, right) => left !== right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.ExclamationEqualsToken]: (_origLeft, _origRight, left, right) => left != right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.AmpersandAmpersandToken]: (origLeft, origRight, left, right) => {
        if (left && right)
            return origRight;
        if (!left)
            return origLeft;
        if (!right)
            return origRight;
    },
    [ts.SyntaxKind.BarBarToken]: (origLeft, origRight, left, right) => {
        if (left)
            return origLeft;
        else if (right)
            return origRight;
        else
            return origRight;
    }
};
exports.possiblyUnknownValueBinaryActions = {
    [ts.SyntaxKind.AmpersandAmpersandToken]: (origLeft, origRight, left) => {
        if (left !== utils_1.NO_LIT_FOUND) {
            if (left)
                return origRight;
            else
                return origLeft;
        }
    },
    [ts.SyntaxKind.BarBarToken]: (origLeft, origRight, left) => {
        if (left !== utils_1.NO_LIT_FOUND) {
            if (left)
                return origLeft;
            else
                return origRight;
        }
    }
};
exports.unaryActions = {
    [ts.SyntaxKind.ExclamationToken]: (val) => !val ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.MinusToken]: (val) => {
        if (typeof val !== "number")
            return;
        return (0, utils_1.createNumberNode)(-val);
    },
    [ts.SyntaxKind.TildeToken]: (val) => {
        if (typeof val !== "number")
            return;
        return (0, utils_1.createNumberNode)(~val);
    },
    [ts.SyntaxKind.PlusToken]: (val) => {
        if (typeof val !== "number" && typeof val !== "string")
            return;
        return (0, utils_1.createNumberNode)(+val);
    }
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
exports.labelActions = {
    [ts.SyntaxKind.IfStatement]: (node) => {
        return (0, utils_1.createObjectLiteral)({
            kind: ts.factory.createNumericLiteral(0 /* LabelKinds.If */),
            condition: node.expression,
            then: node.thenStatement,
            else: node.elseStatement
        });
    },
    [ts.SyntaxKind.ForOfStatement]: (node) => {
        let initializer;
        if (ts.isVariableDeclarationList(node.initializer)) {
            const firstDecl = node.initializer.declarations[0];
            if (firstDecl && ts.isIdentifier(firstDecl.name))
                initializer = firstDecl.name;
        }
        else {
            initializer = node.initializer;
        }
        return (0, utils_1.createObjectLiteral)({
            kind: ts.factory.createNumericLiteral(1 /* LabelKinds.ForIter */),
            type: ts.factory.createStringLiteral("of"),
            initializer: initializer,
            iterator: node.expression,
            statement: node.statement
        });
    },
    [ts.SyntaxKind.ForInStatement]: (node) => {
        let initializer;
        if (ts.isVariableDeclarationList(node.initializer)) {
            const firstDecl = node.initializer.declarations[0];
            if (firstDecl && ts.isIdentifier(firstDecl.name))
                initializer = firstDecl.name;
        }
        else {
            initializer = node.initializer;
        }
        return (0, utils_1.createObjectLiteral)({
            kind: ts.factory.createNumericLiteral(1 /* LabelKinds.ForIter */),
            type: ts.factory.createStringLiteral("in"),
            initializer: initializer,
            iterator: node.expression,
            statement: node.statement
        });
    },
    [ts.SyntaxKind.WhileStatement]: (node) => {
        return (0, utils_1.createObjectLiteral)({
            kind: ts.factory.createNumericLiteral(3 /* LabelKinds.While */),
            do: ts.factory.createFalse(),
            condition: node.expression,
            statement: node.statement
        });
    },
    [ts.SyntaxKind.DoStatement]: (node) => {
        return (0, utils_1.createObjectLiteral)({
            kind: ts.factory.createNumericLiteral(3 /* LabelKinds.While */),
            do: ts.factory.createTrue(),
            condition: node.expression,
            statement: node.statement
        });
    },
    [ts.SyntaxKind.ForStatement]: (node) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let variables, expression;
        if (node.initializer) {
            if (ts.isVariableDeclarationList(node.initializer)) {
                variables = [];
                for (const decl of node.initializer.declarations) {
                    if (ts.isIdentifier(decl.name))
                        variables.push(ts.factory.createArrayLiteralExpression([ts.factory.createIdentifier(decl.name.text), decl.initializer || ts.factory.createIdentifier("undefined")]));
                }
            }
            else
                expression = node.initializer;
        }
        return (0, utils_1.createObjectLiteral)({
            kind: ts.factory.createNumericLiteral(2 /* LabelKinds.For */),
            initializer: (0, utils_1.createObjectLiteral)({
                variables: variables && ts.factory.createArrayLiteralExpression(variables),
                expression
            }),
            condition: node.condition,
            increment: node.incrementor,
            statement: node.statement
        });
    },
    [ts.SyntaxKind.Block]: (node) => {
        return (0, utils_1.createObjectLiteral)({
            kind: ts.factory.createNumericLiteral(4 /* LabelKinds.Block */),
            statement: node
        });
    },
    [ts.SyntaxKind.VariableStatement]: (node) => {
        const idents = [], inits = [];
        for (const decl of node.declarationList.declarations) {
            if (!ts.isIdentifier(decl.name))
                continue;
            idents.push(decl.name);
            inits.push(decl.initializer || ts.factory.createIdentifier("undefined"));
        }
        return (0, utils_1.createObjectLiteral)({
            kind: ts.factory.createNumericLiteral(5 /* LabelKinds.VariableDeclaration */),
            identifiers: ts.factory.createArrayLiteralExpression(idents),
            initializers: ts.factory.createArrayLiteralExpression(inits),
            declarationType: (0, utils_1.hasBit)(node.declarationList.flags, ts.NodeFlags.Const) ? ts.factory.createStringLiteral("const") :
                (0, utils_1.hasBit)(node.declarationList.flags, ts.NodeFlags.Let) ? ts.factory.createStringLiteral("let") : ts.factory.createStringLiteral("var")
        });
    }
};
