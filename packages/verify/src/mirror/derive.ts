/**
 * Mirror: the per-row derivation from trusted inputs. Owner: WP-04.
 *
 * TS twin of Lean `Ibasho.Check.Check` (`deriveRow`), `Ibasho.Check.Finance` and the spec
 * definitions it calls (`Accounting.saving`, `carbonSavingG`, Kleene `status`, `respectsMemory`).
 * Integer arithmetic is bigint throughout; every rounding point is the Lean one.
 */
import {
  type Decoded,
  type Expr,
  type Fact,
  type FactTable,
  FUEL_NAMES,
  type OptionInfo,
  type PackRule,
  type Rat,
  SLOTS_PER_MODE,
  type Tri,
  type Val,
  YOUR_HOME_MODE,
} from './decode.ts';

export const ST_FEASIBLE = 0;
export const ST_NEEDS_CHECK = 1;
export const ST_BLOCKED = 2;
export const ST_TARGET_MISS = 3;
export const NO_WITNESS = 0xffffffff;
export const BUILTIN_MEMORY = 'BUILTIN.MEMORY';
export const BUILTIN_TARGET = 'BUILTIN.TARGET';

const DF_SCALE = 1_000_000_000_000n;
const PPB = 1_000_000_000n;
const UG_PER_G = 1_000_000n;
const NFUELS = FUEL_NAMES.length;
const DAYS_PER_YEAR = 365n;

/* Fixed point (Lean `Ibasho.Spec.V2.Fixed`). */

/** Euclidean division and remainder for `d > 0` (Lean `Int./`, `Int.%`). */
function ediv(n: bigint, d: bigint): [bigint, bigint] {
  let q = n / d;
  let r = n % d;
  if (r < 0n) {
    q -= 1n;
    r += d;
  }
  return [q, r];
}
/** Lean `roundHalfEven` (0 at `d = 0`). */
export function rhe(n: bigint, d: bigint): bigint {
  if (d === 0n) return 0n;
  if (d < 0n) return rhe(-n, -d);
  const [q, r] = ediv(n, d);
  if (d < 2n * r) return q + 1n;
  if (2n * r < d) return q;
  return ediv(q, 2n)[1] === 0n ? q : q + 1n;
}
export const applyFactor = (amount: bigint, factor: bigint): bigint => rhe(amount * factor, DF_SCALE);
export function discountFactors(r: bigint, years: number): bigint[] {
  const out = [DF_SCALE];
  let d = DF_SCALE;
  for (let t = 0; t < years; t++) {
    d = rhe(d * PPB, PPB + r);
    out.push(d);
  }
  return out;
}
export function growthFactors(g: bigint, years: number): bigint[] {
  const out = [DF_SCALE];
  let x = DF_SCALE;
  for (let t = 0; t < years; t++) {
    x = rhe(x * (PPB + g), PPB);
    out.push(x);
  }
  return out;
}
const sum = (xs: Iterable<bigint>): bigint => {
  let s = 0n;
  for (const x of xs) s += x;
  return s;
};
const at = <T>(xs: readonly T[], i: number, d: T): T => (i >= 0 && i < xs.length ? xs[i]! : d);

/* Enumeration (Lean `rowChoice`). */

export function productCount(c: Decoded): number {
  return c.groups.reduce((acc, g) => acc * g.options.length, 1);
}
export function rowChoice(c: Decoded, r: number): string[] {
  const out: string[] = [];
  let rest = r;
  for (let gi = c.groups.length - 1; gi >= 0; gi--) {
    const opts = c.groups[gi]!.options;
    const n = opts.length;
    out.unshift(at(opts, n === 0 ? 0 : rest % n, 'none'));
    if (n !== 0) rest = Math.trunc(rest / n);
  }
  return out;
}
export const rowOptions = (c: Decoded, r: number): string[] => rowChoice(c, r).filter((o) => o !== 'none');
export const optionOf = (c: Decoded, id: string): OptionInfo | undefined =>
  c.options.find((o) => o.id === id);

/* Physics vectors (trusted). */

export function delivered(c: Decoded, r: number): bigint[] {
  const [k, pairs] = at(c.light, r, [0, []] as [number, [number, bigint][]]);
  const v: bigint[] = [];
  for (let s = 0; s < SLOTS_PER_MODE; s++) v.push(at(c.heavy, k * SLOTS_PER_MODE + s, 0n));
  const lo = YOUR_HOME_MODE * SLOTS_PER_MODE;
  for (const [slot, d] of pairs) if (lo <= slot && slot < lo + SLOTS_PER_MODE) v[slot - lo]! += d;
  return v;
}
const cell = (a: readonly bigint[], f: number, m: number): bigint => at(a, f * 12 + m, 0n);
const monthly = (a: readonly bigint[], f: number): bigint[] =>
  Array.from({ length: 12 }, (_, m) => cell(a, f, m));
const fuelRow = (rows: [number, bigint[]][], f: number): bigint[] | undefined =>
  rows.find((x) => x[0] === f)?.[1];
const factor = (c: Decoded, f: number, m: number): bigint => {
  const row = fuelRow(c.carbon, f);
  return row ? at(row, m, 0n) : 0n;
};
const traj = (c: Decoded, f: number, t: number): bigint => {
  const row = fuelRow(c.trajectory, f);
  return row ? at(row, t, 0n) : 0n;
};

/* Bills and finance (Lean `Ibasho.Check.Finance`). */

type Slab = [bigint | undefined, bigint];
export function slabCharge(wh: bigint, slabs: readonly Slab[], lower: bigint): bigint {
  if (slabs.length === 0) return 0n;
  const [upto, price] = slabs[0]!;
  if (upto === undefined) return lower < wh ? (wh - lower) * price : 0n;
  const top = wh < upto ? wh : upto;
  const here = lower < top ? (top - lower) * price : 0n;
  return wh <= upto ? here : here + slabCharge(wh, slabs.slice(1), upto);
}
function annualBill(
  yearly: boolean,
  slabs: readonly Slab[],
  standing: bigint,
  whenUnused: boolean,
  wh: bigint[],
): bigint {
  const energy = yearly ? slabCharge(sum(wh), slabs, 0n) : sum(wh.map((w) => slabCharge(w, slabs, 0n)));
  const used = wh.some((w) => w !== 0n);
  return energy + (used || whenUnused ? DAYS_PER_YEAR * standing : 0n);
}
const tariffFor = (c: Decoded, f: number) => c.tariffs.find((t) => t.fuel === f);
function billOf(c: Decoded, a: readonly bigint[], f: number): bigint {
  const t = tariffFor(c, f);
  return t ? annualBill(t.yearly, t.slabs, t.standingPerDay, t.standingWhenUnused, monthly(a, f)) : 0n;
}
function replacementYears(T: number, H: number): number[] {
  if (T === 0) return [];
  const n = Math.trunc(Math.max(H - 1, 0) / T);
  return Array.from({ length: n }, (_, k) => (k + 1) * T);
}
function residualValue(cost: bigint, T: number, H: number): bigint {
  if (T === 0) return 0n;
  const last = Math.trunc(Math.max(H - 1, 0) / T) * T;
  const stop = last + T;
  return H < stop ? rhe(cost * BigInt(stop - H), BigInt(T)) : 0n;
}
const yearSaving = (bill: bigint[], G: bigint[], t: number): bigint =>
  sum(bill.map((s) => applyFactor(s, at(G, t, DF_SCALE))));
function npv(n0: bigint, bill: bigint[], installed: [bigint, number][], rate: bigint, H: number): bigint {
  const D = discountFactors(rate, H);
  const G = growthFactors(0n, H);
  let flows = 0n;
  for (let i = 0; i < H; i++) flows += applyFactor(yearSaving(bill, G, i + 1), at(D, i + 1, 0n));
  const repl = sum(
    installed.map(([c, T]) => sum(replacementYears(T, H).map((y) => applyFactor(c, at(D, y, 0n))))),
  );
  const rv = sum(installed.map(([c, T]) => residualValue(c, T, H)));
  return flows - repl + applyFactor(rv, at(D, H, 0n)) - n0;
}
const firstYearSaving = (bill: bigint[], H: number): bigint =>
  H === 0 ? 0n : yearSaving(bill, growthFactors(0n, H), 1);

/* Rules (Lean `Ibasho.Spec.V2.Rules.Kleene`). */

const get = (t: FactTable, x: string): Fact => {
  for (let i = t.length - 1; i >= 0; i--) if (t[i]![0] === x) return t[i]![1];
  return undefined;
};
const ofBool = (b: boolean): Tri => (b ? 'yes' : 'no');
const tNot = (a: Tri): Tri => (a === 'yes' ? 'no' : a === 'no' ? 'yes' : 'unknown');
const tAnd = (a: Tri, b: Tri): Tri =>
  a === 'no' || b === 'no' ? 'no' : a === 'yes' && b === 'yes' ? 'yes' : 'unknown';
const tOr = (a: Tri, b: Tri): Tri =>
  a === 'yes' || b === 'yes' ? 'yes' : a === 'no' && b === 'no' ? 'no' : 'unknown';
const ratCmp = (a: Rat, b: Rat): number => {
  const x = a.n * b.d;
  const y = b.n * a.d;
  return x < y ? -1 : x > y ? 1 : 0;
};
const valEq = (a: Val, b: Val): boolean =>
  a.t === 'num' && b.t === 'num' ? ratCmp(a.q, b.q) === 0 : a.t === 'str' && b.t === 'str' && a.s === b.s;
function compare(op: string, a: Val, b: Val): Tri {
  if (a.t === 'num' && b.t === 'num') {
    const k = ratCmp(a.q, b.q);
    switch (op) {
      case '<':
        return ofBool(k < 0);
      case '<=':
        return ofBool(k <= 0);
      case '=':
        return ofBool(k === 0);
      case '>=':
        return ofBool(k >= 0);
      case '>':
        return ofBool(k > 0);
      default:
        return ofBool(k !== 0);
    }
  }
  if (op === '=') return ofBool(valEq(a, b));
  if (op === '!=') return ofBool(!valEq(a, b));
  return 'unknown';
}
/** Named functions: none is wired into the checker yet, so every call is unknown (Lean `fnTable`). */
const fnTable = (_name: string, _args: Val[]): Tri => 'unknown';

export function evalExpr(env: FactTable, e: Expr): Tri {
  switch (e.k) {
    case 'and':
      return e.es.reduceRight<Tri>((acc, x) => tAnd(evalExpr(env, x), acc), 'yes');
    case 'or':
      return e.es.reduceRight<Tri>((acc, x) => tOr(evalExpr(env, x), acc), 'no');
    case 'not':
      return tNot(evalExpr(env, e.e));
    case 'cmp': {
      const a = get(env, e.left);
      const b = 'fact' in e.right ? get(env, e.right.fact) : e.right.lit;
      return a && b ? compare(e.op, a, b) : 'unknown';
    }
    case 'mem': {
      const a = get(env, e.x);
      return a ? ofBool(e.set.some((v) => valEq(a, v))) : 'unknown';
    }
    case 'fn': {
      const vs = e.args.map((x) => get(env, x));
      return vs.every((v) => v !== undefined) ? fnTable(e.name, vs as Val[]) : 'unknown';
    }
    case 'const':
      return e.t;
  }
}

/** Budget built-in (Lean `budgetRule`, TS `BUDGET_RULE`). */
export const BUDGET_RULE: PackRule = {
  rule: {
    id: 'BUILTIN.BUDGET',
    when: {
      k: 'and',
      es: [
        { k: 'cmp', op: '=', left: 'o.budget.set', right: { lit: { t: 'num', q: { n: 1n, d: 1n } } } },
        { k: 'cmp', op: '>', left: 'p.capex', right: { fact: 'o.budget' } },
      ],
    },
    effect: { k: 'block' },
    effectiveFrom: 20000101,
  },
  jurisdiction: 'GB',
  packageScope: true,
};
const BUILTIN_RULES: readonly PackRule[] = [BUDGET_RULE];

const inForce = (r: PackRule, asOf: number): boolean =>
  r.rule.effectiveFrom <= asOf && (r.rule.effectiveTo === undefined || asOf <= r.rule.effectiveTo);
const regionContains = (outer: string, inner: string): boolean =>
  outer === inner || inner.startsWith(`${outer}-`);
const jurisdictionOk = (c: Decoded, pr: PackRule): boolean =>
  pr.jurisdiction !== 'CITY' && (c.region === undefined || regionContains(pr.jurisdiction, c.region));
const kindMatch = (pr: PackRule, kind: string | undefined): boolean =>
  pr.measures === undefined || kind === undefined || pr.measures.includes(kind);

function checkResultOf(c: Decoded, k: string): 'pass' | 'conditional' | 'fail' | undefined {
  let best: Decoded['checks'][number] | undefined;
  for (const rec of c.checks)
    if (rec.kind === k && (best === undefined || best.atDate <= rec.atDate)) best = rec;
  return best?.result;
}

interface App {
  rule: PackRule['rule'];
  env: FactTable;
}
function apps(c: Decoded, r: number, gross: bigint): App[] {
  const opts = rowOptions(c, r)
    .map((id) => optionOf(c, id))
    .filter((o): o is OptionInfo => o !== undefined);
  const pkg: FactTable = [
    ['p.count', { t: 'num', q: { n: BigInt(opts.length), d: 1n } }],
    ['p.capex', { t: 'num', q: { n: gross, d: 1n } }],
  ];
  const rules = [
    ...BUILTIN_RULES.filter((pr) => inForce(pr, c.asOf)),
    ...c.rules.filter((pr) => inForce(pr, c.asOf) && jurisdictionOk(c, pr)),
  ];
  const base = [...c.homeFacts, ...c.ownerFacts];
  return rules.flatMap((pr): App[] => {
    if (pr.packageScope)
      return pr.measures === undefined || opts.some((o) => kindMatch(pr, o.kind))
        ? [{ rule: pr.rule, env: [...base, ...pkg] }]
        : [];
    return opts
      .filter((o) => kindMatch(pr, o.kind))
      .map((o) => ({ rule: pr.rule, env: [...base, ...o.facts] }));
  });
}
function blocks(c: Decoded, a: App): boolean {
  const v = evalExpr(a.env, a.rule.when);
  if (a.rule.effect.k === 'block') return v === 'yes';
  if (a.rule.effect.k === 'check') return v !== 'no' && checkResultOf(c, a.rule.effect.check) === 'fail';
  return false;
}
function undecided(c: Decoded, a: App): boolean {
  const v = evalExpr(a.env, a.rule.when);
  if (a.rule.effect.k === 'block') return v === 'unknown';
  if (a.rule.effect.k === 'check') return v !== 'no' && checkResultOf(c, a.rule.effect.check) === undefined;
  return false;
}

/* Per-row derivation (Lean `RowD`, `deriveRow`). */

export interface RowD {
  delivered: bigint[];
  /** Annual your-home bill per fuel (`money.bills`). */
  bills: bigint[];
  saving: bigint[];
  carbonAnnual: bigint;
  lifetimeCarbon: bigint;
  gross: bigint;
  grants: bigint;
  n0: bigint;
  npv: bigint;
  b1: bigint;
  meets: boolean;
  expected: number;
  expectedIds: string[];
}

function meetsTarget(c: Decoded, b1: bigint, carbon: bigint): boolean {
  const t = c.target;
  if (t.k === 'default') return b1 > 0n && carbon > 0n;
  if (t.k === 'custom') return (!t.save || b1 > 0n) && (!t.cut || carbon > 0n);
  return false;
}

/** Annual saving per fuel and the carbon saved in grams (`saving`, `carbonSavingG`). */
export function savingOf(c: Decoded, before: readonly bigint[], after: readonly bigint[]) {
  const saving: bigint[] = [];
  let ug = 0n;
  for (let f = 0; f < NFUELS; f++) {
    let s = 0n;
    for (let m = 0; m < 12; m++) {
      const d = cell(before, f, m) - cell(after, f, m);
      s += d;
      ug += d * factor(c, f, m);
    }
    saving.push(s);
  }
  return { saving, carbonAnnual: rhe(ug, UG_PER_G) };
}

/** Lean `memoryExcluded`: ruled out and done measures (SPEC AC-P1). */
export const memoryExcluded = (c: Decoded): string[] => [...c.rejected, ...c.completed];

const sortStrings = (xs: string[]): string[] => [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const dedupSorted = (xs: string[]): string[] => xs.filter((x, i) => i === 0 || xs[i - 1] !== x);

export function deriveRow(c: Decoded, r: number): RowD {
  const d = delivered(c, r);
  const { saving, carbonAnnual } = savingOf(c, c.baseline, d);
  const ids = rowOptions(c, r);
  const opts = ids.map((id) => optionOf(c, id)).filter((o): o is OptionInfo => o !== undefined);
  const gross = sum(opts.map((o) => o.costMid));
  const grants = sum(c.grants.map((g) => sum(g.applied.filter(([row]) => row === r).map(([, a]) => a))));
  const n0 = gross - grants > 0n ? gross - grants : 0n;
  const bill = FUEL_NAMES.map((_, f) => billOf(c, c.baseline, f) - billOf(c, d, f));
  let lifeUg = 0n;
  for (let f = 0; f < NFUELS; f++) for (let t = 0; t < c.horizon; t++) lifeUg += saving[f]! * traj(c, f, t);
  const as = apps(c, r, gross);
  const st = as.some((a) => blocks(c, a))
    ? ST_BLOCKED
    : as.some((a) => undecided(c, a))
      ? ST_NEEDS_CHECK
      : ST_FEASIBLE;
  const reasons = as.filter((a) => blocks(c, a) || undecided(c, a)).map((a) => a.rule.id);
  const memIds = [...ids, ...opts.flatMap((o) => (o.measure === undefined ? [] : [o.measure]))];
  const excluded = memoryExcluded(c);
  const rejected = memIds.some((m) => excluded.includes(m));
  const b1 = firstYearSaving(bill, c.horizon);
  const meets = meetsTarget(c, b1, carbonAnnual);
  const expected =
    rejected || st === ST_BLOCKED
      ? ST_BLOCKED
      : st === ST_NEEDS_CHECK
        ? ST_NEEDS_CHECK
        : meets
          ? ST_FEASIBLE
          : ST_TARGET_MISS;
  const extra = [
    ...(rejected ? [BUILTIN_MEMORY] : []),
    ...(expected === ST_TARGET_MISS ? [BUILTIN_TARGET] : []),
  ];
  return {
    delivered: d,
    bills: FUEL_NAMES.map((_, f) => billOf(c, d, f)),
    saving,
    carbonAnnual,
    lifetimeCarbon: rhe(lifeUg, UG_PER_G),
    gross,
    grants,
    n0,
    npv: npv(
      n0,
      bill,
      opts.map((o) => [o.costMid, o.lifetimeYears]),
      c.discountRatePpb,
      c.horizon,
    ),
    b1,
    meets,
    expected,
    expectedIds: dedupSorted(sortStrings([...reasons, ...extra])),
  };
}

export const rows = (c: Decoded): number => c.light.length;
export const derive = (c: Decoded): RowD[] => Array.from({ length: rows(c) }, (_, r) => deriveRow(c, r));
export { at, billOf, cell, fuelRow, monthly, tariffFor };
