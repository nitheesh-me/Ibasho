/**
 * no-math: the engine and pack engine halves must not use non-deterministic maths (ARCH 1.2,
 * SPEC R20, DEC TE-4). Owner: WP-00 until G0, then WP-10.
 *
 * Banned: every `Math.*` member except the operations ECMAScript defines exactly (abs, ceil,
 * floor, trunc, round, sign, min, max, imul, fround, clz32) and the constants. Transcendentals,
 * `Math.sqrt`, `Math.hypot`, `Math.cbrt` and `Math.random` go through `@ibasho/dmath` or the
 * seeded PRNG in `@ibasho/core`. Aliasing `Math` (destructuring, passing it around, `Math[k]`) is
 * banned. The `**` operator is implementation-approximated for floats and is banned too.
 * Suppress one line with a trailing `// lint-allow no-math: <reason>` comment, or with that
 * comment alone on the line before.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { isCode, isTest, parse, pos, walk } from './ast.ts';
import type { Finding } from './files.ts';

export const NO_MATH_SCOPE = [
  /^packages\/engine\//,
  /^packs\/[^/]+\/src\/engine\//,
  // v3 (ARCH 15.2): the plan kernel and the site worker follow the same ban, sqrt allowed.
  /^packages\/(plan|site)\/src\//,
];
/** v3 (ARCH 15.2): IEEE 754 rounds `Math.sqrt` exactly, so plan and site may use it. */
const SQRT_OK = /^packages\/(plan|site)\/src\//;
/** Paths in scope that hold deliberate violations for the lint's own tests. */
const FIXTURES = /\/__lint_fixtures__\//;

const EXACT = new Set([
  'abs',
  'ceil',
  'floor',
  'trunc',
  'round',
  'sign',
  'min',
  'max',
  'imul',
  'fround',
  'clz32',
]);
const CONSTANTS = new Set(['PI', 'E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT2', 'SQRT1_2']);
const ALLOW = /lint-allow no-math:/;

export function noMathInSource(file: string, text: string): Finding[] {
  const sf = parse(file, text);
  const lines = text.split('\n');
  const out: Finding[] = [];
  const report = (node: ts.Node, message: string) => {
    const p = pos(sf, node);
    const prev = lines[p.line - 2] ?? '';
    // Same line, or a preceding line that is only the allow comment.
    if (ALLOW.test(lines[p.line - 1] ?? '') || (ALLOW.test(prev) && /^\s*\/\//.test(prev))) return;
    out.push({ rule: 'no-math', file, ...p, message });
  };
  walk(sf, (n) => {
    if (ts.isIdentifier(n) && n.text === 'Math') {
      const parent = n.parent;
      if (ts.isPropertyAccessExpression(parent) && parent.expression === n) {
        const name = parent.name.text;
        if (!EXACT.has(name) && !CONSTANTS.has(name) && !(name === 'sqrt' && SQRT_OK.test(file))) {
          report(
            parent,
            `Math.${name} is not deterministic across engines; use @ibasho/dmath or the core PRNG`,
          );
        }
        return;
      }
      if (ts.isPropertyAccessExpression(parent) && parent.name === n) return; // x.Math
      if (ts.isPropertyAssignment(parent) && parent.name === n) return; // { Math: ... }
      if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) return;
      report(
        n,
        'Math used as a value (alias, destructuring or computed access) is not allowed in the engine',
      );
    }
    if (ts.isBinaryExpression(n)) {
      const k = n.operatorToken.kind;
      if (k === ts.SyntaxKind.AsteriskAsteriskToken || k === ts.SyntaxKind.AsteriskAsteriskEqualsToken) {
        report(n.operatorToken, 'the ** operator is implementation-approximated for floats; use dmath.pow');
      }
    }
  });
  return out;
}

export function noMath(root: string, files: readonly string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (!isCode(f) || isTest(f) || FIXTURES.test(`/${f}`)) continue;
    if (!NO_MATH_SCOPE.some((r) => r.test(f))) continue;
    out.push(...noMathInSource(f, readFileSync(join(root, f), 'utf8')));
  }
  return out;
}
