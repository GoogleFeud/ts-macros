import * as ts from "typescript";
export declare const binaryNumberActions: Record<number, (left: number, right: number) => ts.Expression>;
export declare const binaryActions: Record<number, (origLeft: ts.Expression, origRight: ts.Expression, left: unknown, right: unknown) => ts.Expression | undefined>;
export declare const possiblyUnknownValueBinaryActions: Record<number, (origLeft: ts.Expression, origRight: ts.Expression, left: unknown, right: unknown) => ts.Expression | undefined>;
export declare const unaryActions: Record<number, (val: unknown) => ts.Expression | undefined>;
export declare const labelActions: Record<number, (statement: any) => ts.Expression>;
