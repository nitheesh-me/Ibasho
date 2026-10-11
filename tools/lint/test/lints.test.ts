import { createRequire } from 'node:module';
import { join } from 'node:path';
import { cruise } from 'dependency-cruiser';
import { describe, expect, it } from 'vitest';
import { globToRegExp, listRepoFiles, repoRoot } from '../files.ts';
import { legend, legendInSource } from '../legend.ts';
import { noDash, scanText } from '../no-dash.ts';
import { noMath, noMathInSource } from '../no-math.ts';
import { checkOwnership, OWNERSHIP, outsideOwnership, ownersOf } from '../ownership.ts';

const root = repoRoot();
const require = createRequire(import.meta.url);

describe('dependency-cruiser layering (G0-2)', () => {
  it('reports ui-imports-engine.ts as a ui-not-engine violation', async () => {
    const config = require(join(root, '.dependency-cruiser.cjs'));
    const prev = process.cwd();
    process.chdir(root);
    try {
      const res = await cruise(['tools/lint/__fixtures__/ui-imports-engine.ts'], {
        ...config.options,
        ruleSet: { forbidden: config.forbidden },
        validate: true,
      });
      const output = typeof res.output === 'string' ? JSON.parse(res.output) : res.output;
      const rules = output.summary.violations.map(
        (v: { rule: { name: string }; from: string }) => `${v.rule.name}:${v.from}`,
      );
      expect(rules).toContain('ui-not-engine:tools/lint/__fixtures__/ui-imports-engine.ts');
    } finally {
      process.chdir(prev);
    }
  });
});

describe('dependency-cruiser v3 layers (V-0)', () => {
  it('reports plan-imports-three.ts (the plan kernel must not import three)', async () => {
    const config = require(join(root, '.dependency-cruiser.cjs'));
    const prev = process.cwd();
    process.chdir(root);
    try {
      const res = await cruise(['tools/lint/__fixtures__/plan-imports-three.ts'], {
        ...config.options,
        ruleSet: { forbidden: config.forbidden },
        validate: true,
      });
      const output = typeof res.output === 'string' ? JSON.parse(res.output) : res.output;
      const rules = output.summary.violations.map(
        (v: { rule: { name: string }; from: string }) => `${v.rule.name}:${v.from}`,
      );
      expect(rules).toContain('engine-no-react-three-dom:tools/lint/__fixtures__/plan-imports-three.ts');
    } finally {
      process.chdir(prev);
    }
  });
});

describe('no-math (G0-3)', () => {
  const file = 'packages/engine/__lint_fixtures__/math-exp.ts';

  it('reports Math.exp in the engine fixture, plus ** and aliasing, and honours lint-allow', async () => {
    const { readFileSync } = await import('node:fs');
    const found = noMathInSource(file, readFileSync(join(root, file), 'utf8'));
    const msgs = found.map((f) => `${f.line}:${f.message.split(' ')[0]}`);
    expect(msgs).toEqual(['3:Math.exp', '5:the', '7:Math']);
    expect(found[0]!.rule).toBe('no-math');
  });

  it('allows exact Math members and constants', () => {
    const src =
      'export const f = (x: number) => Math.max(Math.floor(x), Math.abs(x)) * Math.PI + Math.imul(2, 3);';
    expect(noMathInSource('packages/engine/src/a.ts', src)).toEqual([]);
  });

  it('flags computed access, random, sqrt, destructuring and **=', () => {
    const src = [
      "const a = Math['exp'](1);",
      'const b = Math.random();',
      'const c = Math.sqrt(2);',
      'const { log } = Math;',
      'let d = 2; d **= 2;',
      'const o = { Math: 1 }; const p = o.Math;',
    ].join('\n');
    const lines = noMathInSource('packs/home-uk/src/engine/x.ts', src).map((f) => f.line);
    expect(lines).toEqual([1, 2, 3, 4, 5]);
  });

  it('is clean on the repo and skips fixtures and tests', () => {
    const files = listRepoFiles(root);
    expect(files).toContain('packages/engine/__lint_fixtures__/math-exp.ts');
    expect(noMath(root, files)).toEqual([]);
  });
});

describe('no-dash', () => {
  it('finds em and en dashes with positions', () => {
    const em = String.fromCharCode(0x2014);
    const en = String.fromCharCode(0x2013);
    const f = scanText('x.md', `ok\nnot ${em} ok, 1${en}2`);
    expect(f.map((x) => `${x.line}:${x.col}`)).toEqual(['2:5', '2:12']);
  });

  it('is clean on the repo', () => {
    expect(noDash(root, listRepoFiles(root))).toEqual([]);
  });
});

describe('legend (AC-15)', () => {
  it('reports a numeric layer without Legend and evidenceAt', async () => {
    const { readFileSync } = await import('node:fs');
    const missing = 'tools/lint/__fixtures__/legend-missing.ts';
    const ok = 'tools/lint/__fixtures__/legend-ok.ts';
    expect(legendInSource(missing, readFileSync(join(root, missing), 'utf8')).map((f) => f.message)).toEqual([
      'visual-layer that encodes numbers has no Legend (AC-15)',
      'visual-layer that encodes numbers has no evidenceAt (AC-15)',
    ]);
    expect(legendInSource(ok, readFileSync(join(root, ok), 'utf8'))).toEqual([]);
  });

  it('reports spreads it cannot verify', () => {
    const src = "const base = {}; export const l = { ...base, kind: 'visual-layer', encodesNumbers: true };";
    expect(legendInSource('packages/scene/src/l.ts', src)).toHaveLength(1);
  });

  it('is clean on the repo', () => {
    expect(legend(root, listRepoFiles(root))).toEqual([]);
  });
});

describe('ownership map (BUILD_PLAN 2)', () => {
  it('every repo file has exactly one owner', () => {
    expect(checkOwnership(listRepoFiles(root))).toEqual({ uncovered: [], overlaps: [] });
  });

  it('assigns the split directories to the right work packages', () => {
    const cases: [string, string][] = [
      ['packages/core/src/index.ts', 'WP-00'],
      ['package.json', 'WP-00'],
      ['packages/engine/src/physics/fabric.ts', 'WP-01'],
      ['packages/engine/src/search/plan.ts', 'WP-02'],
      ['packages/engine/src/rules/kleene.ts', 'WP-03'],
      ['packages/engine/package.json', 'WP-02'],
      ['packs/home-uk/src/ids.ts', 'WP-01'],
      ['packs/home-uk/src/engine/measures/loft.ts', 'WP-01'],
      ['packs/home-uk/src/ui/loft.tsx', 'WP-07'],
      ['packages/fixtures/src/homes/gh1.twin.json', 'WP-01'],
      ['packages/fixtures/src/certs/gh1.cert.json', 'WP-04'],
      ['packages/fixtures/package.json', 'WP-10'],
      ['packages/fixtures/src/stranger/gen.ts', 'WP-10'],
      ['packages/fixtures/src/agent/x.json', 'WP-12'],
      ['apps/web/src/main.tsx', 'WP-08'],
      ['apps/web/public/assets/manifest.json', 'WP-11'],
      ['packages/spec-gen/src/generated/spec.ts', 'WP-04'],
      ['tests/smoke/boot.spec.ts', 'WP-10'],
      ['docs/BLACKBOARD.typ', 'shared-append'],
      ['docs/SPEC.md', 'orchestrator'],
      ['apps/mcp/src/index.ts', 'WP-12'],
    ];
    for (const [p, wp] of cases) expect([p, ownersOf(p)]).toEqual([p, [wp]]);
  });

  it('detects gaps and overlaps in a map', () => {
    const map = [
      { owner: 'WP-01' as const, include: ['a/**'] },
      { owner: 'WP-02' as const, include: ['a/b/**'] },
    ];
    expect(checkOwnership(['a/x.ts', 'a/b/y.ts', 'c.ts'], map)).toEqual({
      uncovered: ['c.ts'],
      overlaps: [{ path: 'a/b/y.ts', owners: ['WP-01', 'WP-02'] }],
    });
  });

  it('lists edits outside a work package, allowing shared append files', () => {
    expect(
      outsideOwnership('WP-06', ['packages/ui/src/a.ts', 'docs/STATUS.typ', 'packages/core/src/x.ts']),
    ).toEqual(['packages/core/src/x.ts']);
    expect(OWNERSHIP.length).toBeGreaterThan(10);
  });
});

describe('globToRegExp', () => {
  it('handles **, *, ? and braces', () => {
    expect(globToRegExp('a/**').test('a/b/c.ts')).toBe(true);
    expect(globToRegExp('a/**/x.ts').test('a/x.ts')).toBe(true);
    expect(globToRegExp('a/*.ts').test('a/b/c.ts')).toBe(false);
    expect(globToRegExp('{x,y}.json').test('y.json')).toBe(true);
    expect(globToRegExp('f?.md').test('fa.md')).toBe(true);
    expect(globToRegExp('.npmrc').test('xnpmrc')).toBe(false);
    expect(() => globToRegExp('{a,b')).toThrow();
  });
});
