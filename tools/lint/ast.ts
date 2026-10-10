/** TypeScript AST helpers for the lints. Owner: WP-00 until G0, then WP-10. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

export function parse(file: string, text: string): ts.SourceFile {
  const kind = file.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : file.endsWith('.ts')
      ? ts.ScriptKind.TS
      : ts.ScriptKind.JS;
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
}

export function parseFile(root: string, file: string): ts.SourceFile {
  return parse(file, readFileSync(join(root, file), 'utf8'));
}

export function pos(sf: ts.SourceFile, node: ts.Node): { line: number; col: number } {
  const lc = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  return { line: lc.line + 1, col: lc.character + 1 };
}

export function walk(node: ts.Node, visit: (n: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (c) => walk(c, visit));
}

export const isCode = (f: string): boolean =>
  /\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/.test(f) && !f.endsWith('.d.ts');
export const isTest = (f: string): boolean => /(\.test\.tsx?$|\.spec\.tsx?$|\/test\/|\/__tests__\/)/.test(f);
