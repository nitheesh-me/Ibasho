/**
 * Mirror: decode `ibasho.cert/2` into the checker's view. Owner: WP-04.
 *
 * TS twin of Lean `Ibasho.Check.Json` and `Ibasho.Check.Schema`: the same fields, the same
 * failures (a missing or ill-typed field makes the certificate malformed) and the same defaults
 * (an absent optional field is `undefined`, never a value that could make a check pass). Fact
 * numbers are exact rationals read from the JSON number's decimal text.
 */
import { decodeI64, decodeU8, decodeU32 } from '../wire.ts';

export class MalformedError extends Error {
  override name = 'MalformedError';
}

/** Exact rational, `d > 0` (not necessarily reduced). */
export interface Rat {
  n: bigint;
  d: bigint;
}
export type Val = { t: 'num'; q: Rat } | { t: 'str'; s: string };
/** `undefined` is unknown. */
export type Fact = Val | undefined;
/** Insertion order; lookup takes the last binding (Lean `FactTable.get`). */
export type FactTable = [string, Fact][];

export type CmpOp = '<' | '<=' | '=' | '>=' | '>' | '!=';
export type Tri = 'yes' | 'no' | 'unknown';
export type Expr =
  | { k: 'and'; es: Expr[] }
  | { k: 'or'; es: Expr[] }
  | { k: 'not'; e: Expr }
  | { k: 'cmp'; op: CmpOp; left: string; right: { fact: string } | { lit: Val } }
  | { k: 'mem'; x: string; set: Val[] }
  | { k: 'fn'; name: string; args: string[] }
  | { k: 'const'; t: Tri };
export type Effect =
  | { k: 'block' }
  | { k: 'check'; check: string }
  | { k: 'consent' }
  | { k: 'oblige' }
  | { k: 'warn' }
  | { k: 'info' };

export interface Rule {
  id: string;
  when: Expr;
  effect: Effect;
  /** yyyymmdd */
  effectiveFrom: number;
  effectiveTo?: number;
}
export interface PackRule {
  rule: Rule;
  jurisdiction: string;
  /** `undefined` is `'*'`. */
  measures?: string[];
  packageScope: boolean;
}
export interface OptionInfo {
  id: string;
  measure?: string;
  kind?: string;
  facts: FactTable;
  costMid: bigint;
  lifetimeYears: number;
}
export interface Group {
  id: string;
  options: string[];
}
export interface Tariff {
  id: string;
  fuel: number;
  yearly: boolean;
  slabs: [bigint | undefined, bigint][];
  standingPerDay: bigint;
  standingWhenUnused: boolean;
  validFrom: number;
  validTo: number;
}
export interface Grant {
  id: string;
  validFrom?: number;
  validTo?: number;
  applied: [number, bigint][];
}
export interface CheckRec {
  kind: string;
  atDate: number;
  result: 'pass' | 'conditional' | 'fail';
}
export type Target =
  | { k: 'default' }
  | { k: 'custom'; save: boolean; cut: boolean }
  | { k: 'epcBand'; band: string };

/** One scored package (Lean `ScoreRow`). */
export interface ScoreRow {
  row: number;
  ind: Rat[];
  sub: Rat[];
  groups: Rat[];
  total: Rat;
}
/** Lean `ScoreClaim`. */
export interface ScoreClaim {
  zone: 'uk' | 'in';
  mode: 'burden' | 'per-area';
  rows: ScoreRow[];
}

export interface Decoded {
  specHash: string;
  asOf: number;
  asOfYear: number;
  ownerFacts: FactTable;
  budget?: bigint;
  discountRatePpb: bigint;
  horizon: number;
  target: Target;
  rejected: string[];
  completed: string[];
  region?: string;
  homeFacts: FactTable;
  checks: CheckRec[];
  groups: Group[];
  options: OptionInfo[];
  tariffs: Tariff[];
  /** Fuel index to 12 monthly factors. */
  carbon: [number, bigint[]][];
  trajFirstYear: number;
  trajYears: number;
  trajectory: [number, bigint[]][];
  grants: Grant[];
  rules: PackRule[];
  baseline: bigint[];
  heavyKeys: string[];
  heavy: bigint[];
  light: [number, [number, bigint][]][];
  status: number[];
  n0: bigint[];
  npv: bigint[];
  carbonSaved: bigint[];
  witness: number[];
  ruleIds: string[][];
  saving?: bigint[];
  carbonAnnual?: bigint[];
  bills?: bigint[];
  score?: ScoreClaim;
  front: number[];
  picks: { leastUpfront?: number; bestReturn?: number; lowestCarbon?: number };
  needsCheck: number[];
}

/** Core `FUELS` order (Lean `fuelIdx`). */
export const FUEL_NAMES = ['electricity', 'gas', 'oil', 'lpg', 'biomass', 'district'] as const;
export const SLOTS_PER_MODE = 72;
export const YOUR_HOME_MODE = 2;

type J = unknown;
const isObj = (j: J): j is Record<string, J> => typeof j === 'object' && j !== null && !Array.isArray(j);

function bad(msg: string): never {
  throw new MalformedError(msg);
}

function field(j: J, k: string): J {
  if (!isObj(j) || !(k in j)) bad(`missing field ${k}`);
  return j[k];
}
/** Optional field; `null` counts as absent. */
function opt(j: J, k: string): J | undefined {
  if (!isObj(j) || !(k in j)) return undefined;
  const v = j[k];
  return v === null ? undefined : v;
}
function str(j: J, what: string): string {
  if (typeof j !== 'string') bad(`${what}: expected a string`);
  return j;
}
const strField = (j: J, k: string): string => str(field(j, k), k);
function arr(j: J, what: string): J[] {
  if (!Array.isArray(j)) bad(`${what}: expected an array`);
  return j;
}
function obj(j: J, what: string): [string, J][] {
  if (!isObj(j)) bad(`${what}: expected an object`);
  // Lean objects iterate in key order.
  return Object.keys(j)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((k) => [k, j[k]]);
}

const NUM = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i;

/** The exact rational of a JSON number (its shortest decimal text). */
export function ratOfNumber(x: number): Rat {
  const m = NUM.exec(String(x));
  if (!m) bad(`not a finite number: ${x}`);
  const frac = m[3] ?? '';
  let n = BigInt(m[2]! + frac);
  let d = 10n ** BigInt(frac.length);
  const e = Number(m[4] ?? '0');
  if (e > 0) n *= 10n ** BigInt(e);
  else if (e < 0) d *= 10n ** BigInt(-e);
  return { n: m[1] === '-' ? -n : n, d };
}

function natOf(j: J, what: string): number {
  if (typeof j !== 'number') bad(`${what}: expected a number`);
  if (!Number.isInteger(j) || j < 0) bad(`${what}: expected a natural number`);
  return j;
}
const DEC = /^-?\d+$/;
function decInt(j: J, what: string): bigint {
  const s = str(j, what);
  if (!DEC.test(s)) bad(`${what}: expected a decimal integer string, got ${s}`);
  return BigInt(s);
}
function boolOf(j: J, what: string): boolean {
  if (typeof j !== 'boolean') bad(`${what}: expected a boolean`);
  return j;
}
const DATE = /^(\d+)-(\d+)-(\d+)$/;
function date(s: string): number {
  const m = DATE.exec(s);
  if (!m || s.length !== 10) bad(`bad date ${s}`);
  return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
}

/** Lean `fact`: numbers exact, booleans 1 and 0, `"unknown"` and anything else odd unknown. */
export function fact(j: J): Fact {
  if (typeof j === 'number') return { t: 'num', q: ratOfNumber(j) };
  if (j === true) return { t: 'num', q: { n: 1n, d: 1n } };
  if (j === false) return { t: 'num', q: { n: 0n, d: 1n } };
  if (typeof j === 'string') return j === 'unknown' ? undefined : { t: 'str', s: j };
  return undefined;
}
function factTable(j: J, what: string): FactTable {
  return obj(j, what).map(([k, v]) => [k, fact(v)]);
}
function tri(j: J): Tri {
  if (j === true) return 'yes';
  if (j === false) return 'no';
  if (j === 'unknown') return 'unknown';
  return bad('expected true, false or "unknown"');
}
const CMP: readonly string[] = ['<', '<=', '=', '>=', '>', '!='];
function cmpOp(s: string): CmpOp {
  if (!CMP.includes(s)) bad(`unknown comparison ${s}`);
  return s as CmpOp;
}
const factRef = (j: J): string => strField(j, 'fact');
function literal(j: J): Val {
  if (typeof j === 'number') return { t: 'num', q: ratOfNumber(j) };
  if (typeof j === 'string') return { t: 'str', s: j };
  if (typeof j === 'boolean') return { t: 'num', q: { n: j ? 1n : 0n, d: 1n } };
  return bad('bad literal');
}

export function expr(j: J): Expr {
  let v = opt(j, 'and');
  if (v !== undefined) return { k: 'and', es: arr(v, 'and').map(expr) };
  v = opt(j, 'or');
  if (v !== undefined) return { k: 'or', es: arr(v, 'or').map(expr) };
  v = opt(j, 'not');
  if (v !== undefined) return { k: 'not', e: expr(v) };
  v = opt(j, 'const');
  if (v !== undefined) return { k: 'const', t: tri(v) };
  v = opt(j, 'cmp');
  if (v !== undefined) {
    const r = field(j, 'right');
    const right = isObj(r) ? { fact: factRef(r) } : { lit: literal(r) };
    return { k: 'cmp', op: cmpOp(str(v, 'cmp')), left: factRef(field(j, 'left')), right };
  }
  v = opt(j, 'in');
  if (v !== undefined) return { k: 'mem', x: factRef(v), set: arr(field(j, 'set'), 'set').map(literal) };
  v = opt(j, 'fn');
  if (v !== undefined)
    return { k: 'fn', name: str(v, 'fn'), args: arr(field(j, 'args'), 'args').map(factRef) };
  return bad('unknown expression shape');
}

function effect(j: J): Effect {
  const k = strField(j, 'kind');
  switch (k) {
    case 'block':
      return { k: 'block' };
    case 'check':
      return { k: 'check', check: strField(j, 'check') };
    case 'consent':
      strField(j, 'authority');
      return { k: 'consent' };
    case 'oblige':
      field(j, 'spec');
      return { k: 'oblige' };
    case 'warn':
      strField(j, 'risk');
      return { k: 'warn' };
    case 'info':
      return { k: 'info' };
    default:
      return bad(`unknown effect ${k}`);
  }
}

function packRule(j: J): PackRule {
  const id = strField(j, 'id');
  const m = field(j, 'measures');
  const measures = m === '*' ? undefined : arr(m, 'measures').map((x) => str(x, 'measure'));
  const to = opt(j, 'effectiveTo');
  const when = expr(field(j, 'when'));
  const eff = effect(field(j, 'effect'));
  const effectiveFrom = date(strField(j, 'effectiveFrom'));
  const rule: Rule = { id, when, effect: eff, effectiveFrom };
  if (to !== undefined) rule.effectiveTo = date(str(to, 'effectiveTo'));
  const jurisdiction = strField(j, 'jurisdiction');
  const pr: PackRule = { rule, jurisdiction, packageScope: strField(j, 'scope') === 'package' };
  if (measures !== undefined) pr.measures = measures;
  return pr;
}

function checkResult(s: string): CheckRec['result'] {
  if (s === 'pass' || s === 'conditional' || s === 'fail') return s;
  return bad(`unknown check result ${s}`);
}
function fuelOf(s: string): number {
  const i = (FUEL_NAMES as readonly string[]).indexOf(s);
  if (i < 0) bad(`unknown fuel ${s}`);
  return i;
}
function fuelRows(j: J, what: string): [number, bigint[]][] {
  return obj(j, what).map(([k, v]) => {
    const xs = arr(v, k).map((x) => decInt(x, k));
    return [fuelOf(k), xs];
  });
}

function tariff(j: J): Tariff {
  const d = field(j, 'data');
  const slabs = arr(field(d, 'slabs'), 'slabs').map((s): [bigint | undefined, bigint] => {
    const u = opt(s, 'uptoWh');
    const upto = u === undefined ? undefined : decInt(u, 'uptoWh');
    return [upto, decInt(field(s, 'price'), 'price')];
  });
  return {
    id: strField(j, 'id'),
    fuel: fuelOf(strField(d, 'fuel')),
    yearly: strField(d, 'period') === 'year',
    slabs,
    standingPerDay: decInt(field(d, 'standingPerDay'), 'standingPerDay'),
    standingWhenUnused: boolOf(field(d, 'standingWhenUnused'), 'standingWhenUnused'),
    validFrom: date(strField(d, 'validFrom')),
    validTo: date(strField(d, 'validTo')),
  };
}

function grant(j: J): Grant {
  const d = field(j, 'data');
  const od = (k: string): number | undefined => {
    const v = opt(d, k);
    return v === undefined ? undefined : date(str(v, k));
  };
  const applied = arr(field(d, 'applied'), 'applied').map((a): [number, bigint] => {
    const xs = arr(a, 'applied row');
    if (xs.length !== 2) bad('applied entries are [row, amount]');
    const row = decInt(xs[0], 'row');
    if (row < 0n) bad('applied row must be a natural number');
    return [Number(row), decInt(xs[1], 'amount')];
  });
  const g: Grant = { id: strField(j, 'id'), applied };
  const from = od('validFrom');
  const to = od('validTo');
  if (from !== undefined) g.validFrom = from;
  if (to !== undefined) g.validTo = to;
  return g;
}

function target(j: J): Target {
  const k = strField(j, 'kind');
  if (k === 'default') return { k: 'default' };
  if (k === 'custom')
    return {
      k: 'custom',
      save: boolOf(field(j, 'saveMoneyYear1'), 'saveMoneyYear1'),
      cut: boolOf(field(j, 'cutRunningCarbon'), 'cutRunningCarbon'),
    };
  if (k === 'epc-band-at-least') return { k: 'epcBand', band: strField(j, 'band') };
  return bad(`unknown target ${k}`);
}

function ownerFacts(o: J): { table: FactTable; budget?: bigint } {
  const tenure = strField(o, 'tenure');
  const b = opt(o, 'budget');
  const budget = b === undefined ? undefined : decInt(b, 'budget');
  const table: FactTable = [
    ['o.tenure', tenure === 'unknown' ? undefined : { t: 'str', s: tenure }],
    ['o.budget.set', { t: 'num', q: { n: budget === undefined ? 0n : 1n, d: 1n } }],
  ];
  if (budget !== undefined) table.push(['o.budget', { t: 'num', q: { n: budget, d: 1n } }]);
  const r = opt(o, 'rights');
  if (r !== undefined)
    for (const k of ['roof', 'externalWalls', 'windows']) {
      const v = opt(r, k);
      table.push([`o.rights.${k}`, v === undefined ? undefined : fact(v)]);
    }
  return budget === undefined ? { table } : { table, budget };
}

/** Sparse light records: `heavyIdx, n, n x (slot, delta)` per row. */
function lightRecords(xs: bigint[]): [number, [number, bigint][]][] {
  const out: [number, [number, bigint][]][] = [];
  let i = 0;
  while (i < xs.length) {
    if (i + 1 >= xs.length) bad('truncated light record');
    const k = xs[i]!;
    const n = xs[i + 1]!;
    if (k < 0n || n < 0n || BigInt(i + 2) + 2n * n > BigInt(xs.length)) bad('bad light record');
    const pairs: [number, bigint][] = [];
    for (let p = 0; p < Number(n); p++) {
      const slot = xs[i + 2 + 2 * p]!;
      if (slot < 0n || slot >= BigInt(3 * SLOTS_PER_MODE)) bad('light slot out of range');
      pairs.push([Number(slot), xs[i + 3 + 2 * p]!]);
    }
    out.push([Number(k), pairs]);
    i += 2 + 2 * Number(n);
  }
  return out;
}

function optI64(j: J, k: string): bigint[] | undefined {
  const v = opt(j, k);
  return v === undefined ? undefined : decodeI64(str(v, k));
}

const DIGITS = /^\d+$/;
const INT = /^-?\d+$/;
/** Lean `ratWireOf`: `n` or `n/d`, `d > 0`, not necessarily reduced. */
function ratWire(j: J, what: string): Rat {
  const s = str(j, what);
  const parts = s.split('/');
  if (parts.length === 1 && INT.test(parts[0]!)) return { n: BigInt(parts[0]!), d: 1n };
  if (parts.length === 2 && INT.test(parts[0]!) && DIGITS.test(parts[1]!)) {
    const d = BigInt(parts[1]!);
    if (d === 0n) bad(`${what}: zero denominator`);
    return { n: BigInt(parts[0]!), d };
  }
  return bad(`${what}: bad rational ${s}`);
}
const ratList = (j: J, what: string): Rat[] => arr(j, what).map((x) => ratWire(x, what));

function scoreClaim(j: J): ScoreClaim {
  const zone = strField(j, 'zone');
  if (zone !== 'uk' && zone !== 'in') bad(`unknown score zone ${zone}`);
  const mode = strField(j, 'mode');
  if (mode !== 'burden' && mode !== 'per-area') bad(`unknown score mode ${mode}`);
  const rows = arr(field(j, 'rows'), 'score rows').map(
    (e): ScoreRow => ({
      row: natOf(field(e, 'row'), 'row'),
      ind: ratList(field(e, 'indicators'), 'indicators'),
      sub: ratList(field(e, 'sub'), 'sub'),
      groups: ratList(field(e, 'groups'), 'groups'),
      total: ratWire(field(e, 'total'), 'total'),
    }),
  );
  return { zone, mode, rows };
}

function options(groups: J[]): OptionInfo[] {
  const out: OptionInfo[] = [];
  for (const g of groups) {
    const facts = obj(field(g, 'facts'), 'facts');
    const meta = opt(g, 'optionMeta');
    for (const o of arr(field(g, 'options'), 'options')) {
      const id = str(o, 'option');
      if (id === 'none') continue;
      const hit = facts.find(([k]) => k === id);
      if (!hit) bad(`no facts for option ${id}`);
      const f = hit[1];
      const ft = factTable(f, id);
      const m = meta === undefined ? undefined : opt(meta, id);
      const pick = (k: string): string | undefined => {
        const v = m === undefined ? undefined : opt(m, k);
        return typeof v === 'string' ? v : undefined;
      };
      const info: OptionInfo = {
        id,
        facts: ft.filter(([k]) => !k.startsWith('c.')),
        costMid: decInt(field(f, 'c.mid'), `${id} c.mid`),
        lifetimeYears: natOf(field(f, 'c.lifetimeYears'), `${id} c.lifetimeYears`),
      };
      const measure = pick('measure');
      const kind = pick('kind');
      if (measure !== undefined) info.measure = measure;
      if (kind !== undefined) info.kind = kind;
      out.push(info);
    }
  }
  return out;
}

function decodeOrThrow(j: J): Decoded {
  if (strField(j, 'schema') !== 'ibasho.cert/2') bad('schema must be ibasho.cert/2');
  const ctx = field(j, 'context');
  const asOf = date(strField(ctx, 'asOf'));
  const owner = field(ctx, 'owner');
  const of = ownerFacts(owner);
  const home = opt(ctx, 'home');
  const packs = field(j, 'packs');
  const groupsJ = arr(field(j, 'groups'), 'groups');
  const groups = groupsJ.map((g) => ({
    id: strField(g, 'id'),
    options: arr(field(g, 'options'), 'options').map((o) => str(o, 'option')),
  }));
  const traj = field(field(packs, 'trajectory'), 'data');
  const rules = arr(field(packs, 'rules'), 'rules').flatMap((p) =>
    arr(field(field(p, 'data'), 'rules'), 'rules').map(packRule),
  );
  const claimed = field(j, 'claimed');
  const picksJ = field(j, 'picks');
  const pick = (k: string): number | undefined => {
    const v = opt(picksJ, k);
    return v === undefined ? undefined : natOf(v, k);
  };
  const heavy = field(j, 'heavy');
  const regionJ = home === undefined ? undefined : opt(home, 'region');
  const homeFactsJ = home === undefined ? undefined : opt(home, 'facts');
  const checksJ = home === undefined ? undefined : opt(home, 'checks');
  const d: Decoded = {
    specHash: strField(j, 'specHash'),
    asOf,
    asOfYear: Math.trunc(asOf / 10000),
    ownerFacts: of.table,
    discountRatePpb: decInt(field(owner, 'discountRatePpb'), 'discountRatePpb'),
    horizon: natOf(field(owner, 'horizonYears'), 'horizonYears'),
    target: target(field(ctx, 'target')),
    rejected: arr(field(field(ctx, 'memory'), 'rejected'), 'rejected').map((x) => str(x, 'rejected')),
    completed: arr(field(field(ctx, 'memory'), 'completed'), 'completed').map((x) => str(x, 'completed')),
    homeFacts: homeFactsJ === undefined ? [] : factTable(homeFactsJ, 'home facts'),
    checks:
      checksJ === undefined
        ? []
        : arr(checksJ, 'checks').map((c) => ({
            kind: strField(c, 'kind'),
            atDate: date(strField(c, 'at')),
            result: checkResult(strField(c, 'result')),
          })),
    groups,
    options: options(groupsJ),
    tariffs: arr(field(packs, 'tariffs'), 'tariffs').map(tariff),
    carbon: fuelRows(field(field(field(packs, 'carbon'), 'data'), 'factors'), 'carbon'),
    trajFirstYear: natOf(field(traj, 'firstYear'), 'firstYear'),
    trajYears: natOf(field(traj, 'years'), 'years'),
    trajectory: fuelRows(field(traj, 'factors'), 'trajectory'),
    grants: arr(field(packs, 'grants'), 'grants').map(grant),
    rules,
    baseline: decodeI64(strField(field(j, 'baseline'), 'your-home')),
    heavyKeys: arr(field(heavy, 'keys'), 'keys').map((k) => str(k, 'key')),
    heavy: decodeI64(strField(field(heavy, 'delivered'), 'your-home')),
    light: lightRecords(decodeI64(strField(field(j, 'light'), 'delivered'))),
    status: decodeU8(strField(claimed, 'status')),
    n0: decodeI64(strField(claimed, 'n0')),
    npv: decodeI64(strField(claimed, 'npv')),
    carbonSaved: decodeI64(strField(claimed, 'carbonSaved')),
    witness: decodeU32(strField(claimed, 'witness')),
    ruleIds: arr(field(claimed, 'ruleIds'), 'ruleIds').map((r) =>
      arr(r, 'ruleIds').map((x) => str(x, 'ruleId')),
    ),
    front: decodeU32(strField(j, 'front')),
    picks: {},
    needsCheck: decodeU32(strField(j, 'needsCheck')),
  };
  if (of.budget !== undefined) d.budget = of.budget;
  if (typeof regionJ === 'string') d.region = regionJ;
  const saving = optI64(claimed, 'saving');
  const carbonAnnual = optI64(claimed, 'carbonAnnual');
  if (saving !== undefined) d.saving = saving;
  if (carbonAnnual !== undefined) d.carbonAnnual = carbonAnnual;
  const bills = optI64(claimed, 'bills');
  if (bills !== undefined) d.bills = bills;
  const score = opt(claimed, 'score');
  if (score !== undefined) d.score = scoreClaim(score);
  const lu = pick('leastUpfront');
  const br = pick('bestReturn');
  const lc = pick('lowestRunningCarbon');
  if (lu !== undefined) d.picks.leastUpfront = lu;
  if (br !== undefined) d.picks.bestReturn = br;
  if (lc !== undefined) d.picks.lowestCarbon = lc;
  return d;
}

/** Decode a certificate (parsed JSON). Throws `MalformedError` on any malformed field. */
export function decodeCert(j: unknown): Decoded {
  try {
    return decodeOrThrow(j);
  } catch (e) {
    if (e instanceof MalformedError) throw e;
    throw new MalformedError(e instanceof Error ? e.message : String(e));
  }
}
