/**
 * Kleene evaluator tests (WP-03 M-0; BUILD_PLAN C3). Colocated: the engine `test/` folder is WP-02's.
 */
import { type Expr, type Tri, xoshiro128ss } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import { evalExpr, type FactEnv, RuleError, unknownFacts } from './expr.ts';

const T: Expr = { const: true };
const F: Expr = { const: false };
const U: Expr = { const: 'unknown' };
const TRI: Tri[] = [true, false, 'unknown'];
const lit = (t: Tri): Expr => ({ const: t });

describe('Kleene connectives', () => {
  it('and, or, not follow the strong Kleene tables', () => {
    for (const a of TRI)
      for (const b of TRI) {
        const and = evalExpr({ and: [lit(a), lit(b)] }, {});
        const or = evalExpr({ or: [lit(a), lit(b)] }, {});
        if (a === false || b === false) expect(and).toBe(false);
        else if (a === true && b === true) expect(and).toBe(true);
        else expect(and).toBe('unknown');
        if (a === true || b === true) expect(or).toBe(true);
        else if (a === false && b === false) expect(or).toBe(false);
        else expect(or).toBe('unknown');
      }
    expect(evalExpr({ not: T }, {})).toBe(false);
    expect(evalExpr({ not: F }, {})).toBe(true);
    expect(evalExpr({ not: U }, {})).toBe('unknown');
  });
  it('empty and is true, empty or is false', () => {
    expect(evalExpr({ and: [] }, {})).toBe(true);
    expect(evalExpr({ or: [] }, {})).toBe(false);
  });
});

describe('leaves', () => {
  const env: FactEnv = { 'h.a': 3, 'h.s': 'terrace', 'h.b': true, 'h.c': false, 'h.u': 'unknown' };
  it('missing and unknown facts are unknown, never zero', () => {
    expect(evalExpr({ cmp: '=', left: { fact: 'h.missing' }, right: 0 }, env)).toBe('unknown');
    expect(evalExpr({ cmp: '<', left: { fact: 'h.u' }, right: 1 }, env)).toBe('unknown');
    expect(evalExpr({ cmp: '<', left: { fact: 'h.a' }, right: { fact: 'h.u' } }, env)).toBe('unknown');
    expect(evalExpr({ in: { fact: 'h.u' }, set: [1, 2] }, env)).toBe('unknown');
  });
  it('compares numbers with every operator', () => {
    const c = (cmp: '<' | '<=' | '=' | '>=' | '>' | '!=', right: number) =>
      evalExpr({ cmp, left: { fact: 'h.a' }, right }, env);
    expect([c('<', 4), c('<=', 3), c('=', 3), c('>=', 4), c('>', 2), c('!=', 3)]).toEqual([
      true,
      true,
      true,
      false,
      true,
      false,
    ]);
  });
  it('reads booleans as 1 and 0', () => {
    expect(evalExpr({ cmp: '=', left: { fact: 'h.b' }, right: 1 }, env)).toBe(true);
    expect(evalExpr({ cmp: '=', left: { fact: 'h.c' }, right: 1 }, env)).toBe(false);
    expect(evalExpr({ in: { fact: 'h.c' }, set: [0] }, env)).toBe(true);
  });
  it('strings support = and != only', () => {
    expect(evalExpr({ cmp: '=', left: { fact: 'h.s' }, right: 'terrace' }, env)).toBe(true);
    expect(evalExpr({ cmp: '!=', left: { fact: 'h.s' }, right: 'flat' }, env)).toBe(true);
    expect(evalExpr({ cmp: '=', left: { fact: 'h.a' }, right: '3' }, env)).toBe(false);
    expect(evalExpr({ in: { fact: 'h.s' }, set: ['flat', 'terrace'] }, env)).toBe(true);
    expect(() => evalExpr({ cmp: '<', left: { fact: 'h.s' }, right: 'z' }, env)).toThrow(RuleError);
  });
  it('a named function missing from the table is unknown; a present one gets resolved args', () => {
    const e: Expr = { fn: 'adf_category', args: [{ fact: 'h.a' }] };
    expect(evalExpr(e, env)).toBe('unknown');
    expect(evalExpr(e, env, { adf_category: (args) => args[0] === 3 })).toBe(true);
    expect(evalExpr({ fn: 'adf_category', args: [{ fact: 'h.u' }] }, env, { adf_category: () => true })).toBe(
      'unknown',
    );
  });
  it('unknownFacts lists only the unknown or missing facts read', () => {
    const e: Expr = {
      and: [
        { cmp: '>', left: { fact: 'h.a' }, right: { fact: 'h.u' } },
        { not: { in: { fact: 'h.missing' }, set: [1] } },
        { fn: 'mees_cap', args: [{ fact: 'h.b' }, { fact: 'h.z' }] },
      ],
    };
    expect(unknownFacts(e, env)).toEqual(['h.missing', 'h.u', 'h.z']);
  });
});

// C3: Kleene results equal the result under every completion of up to 6 unknown facts.
const FACTS = ['f0', 'f1', 'f2', 'f3', 'f4', 'f5'];

function randomExpr(rng: ReturnType<typeof xoshiro128ss>, depth: number): Expr {
  const k = depth <= 0 ? 3 + rng.int(3) : rng.int(6);
  const fact = { fact: FACTS[rng.int(FACTS.length)] as string };
  switch (k) {
    case 0:
      return { and: Array.from({ length: rng.int(4) }, () => randomExpr(rng, depth - 1)) };
    case 1:
      return { or: Array.from({ length: rng.int(4) }, () => randomExpr(rng, depth - 1)) };
    case 2:
      return { not: randomExpr(rng, depth - 1) };
    case 3:
      return {
        cmp: (['<', '<=', '=', '>=', '>', '!='] as const)[rng.int(6)] ?? '=',
        left: fact,
        right: rng.int(3),
      };
    case 4:
      return { in: fact, set: [rng.int(3)] };
    default:
      return rng.int(4) === 0 ? lit(TRI[rng.int(3)] as Tri) : { cmp: '=', left: fact, right: 1 };
  }
}

/** Every completion of the unknown facts of `env` over the domain {0, 1, 2}. */
function completions(env: Record<string, number | 'unknown'>): Record<string, number>[] {
  let out: Record<string, number>[] = [{}];
  for (const f of FACTS) {
    const v = env[f];
    const vals = v === 'unknown' || v === undefined ? [0, 1, 2] : [v];
    out = out.flatMap((c) => vals.map((x) => ({ ...c, [f]: x })));
  }
  return out;
}

describe('C3 Kleene soundness over completions', () => {
  it('a definite Kleene result holds under every completion of the unknown facts', () => {
    const rng = xoshiro128ss('wp03-c3');
    let definite = 0;
    for (let i = 0; i < 400; i++) {
      const e = randomExpr(rng, 4);
      const env: Record<string, number | 'unknown'> = {};
      for (const f of FACTS) {
        const r = rng.int(4);
        if (r === 0) continue; // missing counts as unknown
        env[f] = r === 1 ? 'unknown' : rng.int(3);
      }
      const k = evalExpr(e, env);
      const all = completions(env).map((c) => evalExpr(e, c));
      if (k !== 'unknown') {
        definite++;
        for (const v of all) expect(v).toBe(k);
      }
    }
    expect(definite).toBeGreaterThan(50);
  });
});
