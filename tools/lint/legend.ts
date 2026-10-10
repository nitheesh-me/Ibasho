/**
 * legend: a `visual-layer` plugin that encodes numbers must declare `Legend` and `evidenceAt`
 * (AC-15, DESIGN_SYSTEM rule 3 "every mark is a measurement"). The registry enforces the same
 * at runtime (`@ibasho/core` `checkPlugin`); this lint catches it before boot.
 * Owner: WP-00 until G0, then WP-10.
 *
 * It looks for object literals with `kind: 'visual-layer'`. When `encodesNumbers` is `true` (or not
 * a literal `false`), the object must have `Legend` and `evidenceAt` members. An object that
 * spreads another object cannot be verified statically and is reported.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { isCode, isTest, parse, pos, walk } from './ast.ts';
import type { Finding } from './files.ts';

export const LEGEND_SCOPE = [/^packages\/scene\/src\//, /^packs\/[^/]+\/src\/ui\//, /^packages\/ui\/src\//];

function propName(p: ts.ObjectLiteralElementLike): string | undefined {
  if (!p.name) return undefined;
  if (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) return p.name.text;
  return undefined;
}

export function legendInSource(file: string, text: string): Finding[] {
  const sf = parse(file, text);
  const out: Finding[] = [];
  walk(sf, (n) => {
    if (!ts.isObjectLiteralExpression(n)) return;
    const props = new Map<string, ts.ObjectLiteralElementLike>();
    for (const p of n.properties) {
      const name = propName(p);
      if (name) props.set(name, p);
    }
    const kind = props.get('kind');
    if (!kind || !ts.isPropertyAssignment(kind) || !ts.isStringLiteralLike(kind.initializer)) return;
    if (kind.initializer.text !== 'visual-layer') return;
    const enc = props.get('encodesNumbers');
    const encodes = !(
      enc &&
      ts.isPropertyAssignment(enc) &&
      enc.initializer.kind === ts.SyntaxKind.FalseKeyword
    );
    if (!encodes) return;
    const p = pos(sf, n);
    if (n.properties.some((x) => ts.isSpreadAssignment(x))) {
      out.push({
        rule: 'legend',
        file,
        ...p,
        message: 'visual-layer object uses a spread; declare Legend and evidenceAt literally',
      });
      return;
    }
    for (const req of ['Legend', 'evidenceAt']) {
      if (!props.has(req)) {
        out.push({
          rule: 'legend',
          file,
          ...p,
          message: `visual-layer that encodes numbers has no ${req} (AC-15)`,
        });
      }
    }
  });
  return out;
}

export function legend(root: string, files: readonly string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (!isCode(f) || isTest(f)) continue;
    if (!LEGEND_SCOPE.some((r) => r.test(f))) continue;
    out.push(...legendInSource(f, readFileSync(join(root, f), 'utf8')));
  }
  return out;
}
