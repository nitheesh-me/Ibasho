/**
 * Three-valued (Kleene) evaluation of rule expressions (ARCH 5.4, RP 3, SPEC R22). Owner: WP-03.
 *
 * Semantics (mirrored by Lean `Spec/V2/Rules/Kleene`, WP-04):
 * - A fact that is missing from the environment, or has the value `'unknown'`, is unknown.
 *   Unknown is never read as false or zero (M1 "unknown is not 0").
 * - `and`, `or`, `not` are the strong Kleene connectives. An empty `and` is true, an empty `or` false.
 * - `cmp` and `in` are unknown when any operand is unknown, else two-valued.
 * - Boolean facts compare as numbers: `true` is 1, `false` is 0. A rule writes "the supply is
 *   looped" as `{ cmp: '=', left: { fact: 'h.supply.looped' }, right: 1 }`.
 * - Numbers compare numerically. Strings support only `=` and `!=`; a number never equals a string.
 *   Ordering two strings, or a string against a number, is a malformed rule and throws `RuleError`.
 * - `fn` calls a named function from the table the caller passes. A function missing from the
 *   table evaluates to unknown, so an unimplemented function can never make a block false.
 */
import type { Expr, FactId, FactRef, NamedFn, Tri } from '@ibasho/core';
import { triAnd, triNot, triOr } from '@ibasho/core';

/** Value of a fact: three-valued truth, a number or a string. */
export type FactValue = Tri | number | string;

/** Facts visible to one evaluation, keyed by namespaced id (`h.*`, `m.*`, `p.*`, `o.*`). */
export type FactEnv = Readonly<Record<FactId, FactValue>>;

/** A named function: receives its resolved (known) arguments and returns three-valued truth. */
export type NamedFnImpl = (args: readonly (number | string)[]) => Tri;
export type FnTable = Readonly<Partial<Record<NamedFn, NamedFnImpl>>>;

export class RuleError extends Error {
  override name = 'RuleError';
}

/** Known scalar, or undefined when the fact is unknown or missing. */
type Scalar = number | string;

function resolve(env: FactEnv, ref: FactRef): Scalar | undefined {
  const v = Object.hasOwn(env, ref.fact) ? env[ref.fact] : undefined;
  if (v === undefined || v === 'unknown') return undefined;
  if (v === true) return 1;
  if (v === false) return 0;
  return v;
}

function operand(env: FactEnv, x: FactRef | number | string): Scalar | undefined {
  return typeof x === 'object' ? resolve(env, x) : x;
}

function compare(op: string, a: Scalar, b: Scalar): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    switch (op) {
      case '<':
        return a < b;
      case '<=':
        return a <= b;
      case '=':
        return a === b;
      case '>=':
        return a >= b;
      case '>':
        return a > b;
      case '!=':
        return a !== b;
    }
    throw new RuleError(`unknown comparison operator ${op}`);
  }
  if (op === '=') return a === b;
  if (op === '!=') return a !== b;
  throw new RuleError(`operator ${op} needs two numbers, got ${typeof a} and ${typeof b}`);
}

/** Evaluate an expression in three-valued logic. */
export function evalExpr(e: Expr, env: FactEnv, fns: FnTable = {}): Tri {
  if ('and' in e) return triAnd(...e.and.map((c) => evalExpr(c, env, fns)));
  if ('or' in e) return triOr(...e.or.map((c) => evalExpr(c, env, fns)));
  if ('not' in e) return triNot(evalExpr(e.not, env, fns));
  if ('const' in e) return e.const;
  if ('cmp' in e) {
    const a = resolve(env, e.left);
    const b = operand(env, e.right);
    if (a === undefined || b === undefined) return 'unknown';
    return compare(e.cmp, a, b);
  }
  if ('in' in e) {
    const a = resolve(env, e.in);
    if (a === undefined) return 'unknown';
    return e.set.includes(a);
  }
  if ('fn' in e) {
    const impl = fns[e.fn];
    if (impl === undefined) return 'unknown';
    const args: Scalar[] = [];
    for (const r of e.args) {
      const v = resolve(env, r);
      if (v === undefined) return 'unknown';
      args.push(v);
    }
    return impl(args);
  }
  throw new RuleError(`malformed expression ${JSON.stringify(e)}`);
}

/**
 * Facts read by `e` that are unknown or missing in `env`, sorted and unique. These are the facts
 * a rule names when its condition is unknown (`Feasibility.unknownBy`).
 */
export function unknownFacts(e: Expr, env: FactEnv): FactId[] {
  const out = new Set<FactId>();
  const visit = (ref: FactRef): void => {
    if (resolve(env, ref) === undefined) out.add(ref.fact);
  };
  const walk = (x: Expr): void => {
    if ('and' in x) for (const c of x.and) walk(c);
    else if ('or' in x) for (const c of x.or) walk(c);
    else if ('not' in x) walk(x.not);
    else if ('cmp' in x) {
      visit(x.left);
      if (typeof x.right === 'object') visit(x.right);
    } else if ('in' in x) visit(x.in);
    else if ('fn' in x) for (const a of x.args) visit(a);
  };
  walk(e);
  return [...out].sort();
}
