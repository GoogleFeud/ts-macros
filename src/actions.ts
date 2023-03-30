import * as ts from "typescript";
import { LabelKinds } from ".";
import { createObject } from "./utils";

export const binaryNumberActions: Record<number, (left: number, right: number) => ts.Expression> = {
    [ts.SyntaxKind.MinusToken]: (left: number, right: number) => ts.factory.createNumericLiteral(left - right),
    [ts.SyntaxKind.AsteriskToken]: (left: number, right: number) => ts.factory.createNumericLiteral(left * right),
    [ts.SyntaxKind.SlashToken]: (left: number, right: number) => ts.factory.createNumericLiteral(left / right),
    [ts.SyntaxKind.LessThanToken]: (left: number, right: number) => left < right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.LessThanEqualsToken]: (left: number, right: number) => left <= right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.GreaterThanToken]: (left: number, right: number) => left > right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.GreaterThanEqualsToken]: (left: number, right: number) => left >= right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.AmpersandToken]: (left: number, right: number) => ts.factory.createNumericLiteral(left & right),
    [ts.SyntaxKind.BarToken]: (left: number, right: number) => ts.factory.createNumericLiteral(left | right),
    [ts.SyntaxKind.CaretToken]: (left: number, right: number) => ts.factory.createNumericLiteral(left ^ right),
    [ts.SyntaxKind.PercentToken]: (left: number, right: number) => ts.factory.createNumericLiteral(left % right)
};

export const binaryActions: Record<number, (origLeft: ts.Expression, origRight: ts.Expression, left: unknown, right: unknown) => ts.Expression|undefined> = {
    [ts.SyntaxKind.PlusToken]: (_origLeft: ts.Expression, _origRight: ts.Expression, left: unknown, right: unknown) => {
        if (typeof left === "string" || typeof right === "string") return ts.factory.createStringLiteral(left as string + right);
        else if (typeof left === "number" || typeof right === "number") return ts.factory.createNumericLiteral(left as number + (right as number));
    },
    [ts.SyntaxKind.EqualsEqualsEqualsToken]: (_origLeft: ts.Expression, _origRight: ts.Expression, left: unknown, right: unknown) => left === right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.EqualsEqualsToken]: (_origLeft: ts.Expression, _origRight: ts.Expression, left: unknown, right: unknown) => left == right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.ExclamationEqualsEqualsToken]: (_origLeft: ts.Expression, _origRight: ts.Expression, left: unknown, right: unknown) => left !== right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.ExclamationEqualsToken]: (_origLeft: ts.Expression, _origRight: ts.Expression, left: unknown, right: unknown) => left != right ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.AmpersandAmpersandToken]: (origLeft: ts.Expression, origRight: ts.Expression, left: unknown, right: unknown) => {
        if (left && right) return origRight;
        if (!left) return origLeft;
        if (!right) return origRight;
    },
    [ts.SyntaxKind.BarBarToken]: (origLeft: ts.Expression, origRight: ts.Expression, left: unknown, right: unknown) => {
        if (left) return origLeft;
        else if (right) return origRight;
        else return origRight;
    }
};

export const unaryActions: Record<number, (val: unknown) => ts.Expression|undefined> = {
    [ts.SyntaxKind.ExclamationToken]: (val: unknown) => !val ? ts.factory.createTrue() : ts.factory.createFalse(),
    [ts.SyntaxKind.MinusToken]: (val: unknown) => {
        if (typeof val !== "number") return;
        return ts.factory.createNumericLiteral(-val);
    },
    [ts.SyntaxKind.TildeToken]: (val: unknown) => {
        if (typeof val !== "number") return;
        return ts.factory.createNumericLiteral(~val);
    },
    [ts.SyntaxKind.PlusToken]: (val: unknown) => {
        if (typeof val !== "number" && typeof val !== "string") return;
        return ts.factory.createNumericLiteral(+val);
    }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const labelActions: Record<number, (statement: any) => ts.Expression> = {
    [ts.SyntaxKind.IfStatement]: (node: ts.IfStatement) => {
        return createObject({
            kind: ts.factory.createNumericLiteral(LabelKinds.If),
            condition: node.expression,
            then: node.thenStatement,
            else: node.elseStatement
        });
    },
    [ts.SyntaxKind.ForOfStatement]: (node: ts.ForOfStatement) => {
        let initializer;
        if (ts.isVariableDeclarationList(node.initializer)) {
            const firstDecl = node.initializer.declarations[0];
            if (firstDecl && ts.isIdentifier(firstDecl.name)) initializer = firstDecl.name;
        } else {
            initializer = node.initializer;
        }
        return createObject({
            kind: ts.factory.createNumericLiteral(LabelKinds.ForIter),
            type: ts.factory.createStringLiteral("of"),
            initializer: initializer,
            iterator: node.expression,
            statement: node.statement
        });
    },
    [ts.SyntaxKind.ForInStatement]: (node: ts.ForInStatement) => {
        let initializer;
        if (ts.isVariableDeclarationList(node.initializer)) {
            const firstDecl = node.initializer.declarations[0];
            if (firstDecl && ts.isIdentifier(firstDecl.name)) initializer = firstDecl.name;
        } else {
            initializer = node.initializer;
        }
        return createObject({
            kind: ts.factory.createNumericLiteral(LabelKinds.ForIter),
            type: ts.factory.createStringLiteral("in"),
            initializer: initializer,
            iterator: node.expression,
            statement: node.statement
        });
    },
    [ts.SyntaxKind.WhileStatement]: (node: ts.WhileStatement) => {
        return createObject({
            kind: ts.factory.createNumericLiteral(LabelKinds.While),
            do: ts.factory.createFalse(),
            condition: node.expression,
            statement: node.statement
        });
    },
    [ts.SyntaxKind.DoStatement]: (node: ts.WhileStatement) => {
        return createObject({
            kind: ts.factory.createNumericLiteral(LabelKinds.While),
            do: ts.factory.createTrue(),
            condition: node.expression,
            statement: node.statement
        });
    },
    [ts.SyntaxKind.ForStatement]: (node: ts.ForStatement) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let variables, expression;
        if (node.initializer) {
            if (ts.isVariableDeclarationList(node.initializer)) {
                variables = [];
                for (const decl of node.initializer.declarations) {
                    if (ts.isIdentifier(decl.name)) variables.push(ts.factory.createArrayLiteralExpression([ts.factory.createIdentifier(decl.name.text), decl.initializer || ts.factory.createIdentifier("undefined")]));
                }
            } else expression = node.initializer;
        }
        return createObject({
            kind: ts.factory.createNumericLiteral(LabelKinds.For),
            initializer: createObject({
                variables: variables && ts.factory.createArrayLiteralExpression(variables),
                expression
            }),
            condition: node.condition,
            increment: node.incrementor,
            statement: node.statement
        });
    },
    [ts.SyntaxKind.Block]: (node: ts.Block) => {
        return createObject({
            kind: ts.factory.createNumericLiteral(LabelKinds.Block),
            statement: node
        });
    }
};