/**
 * Mirror checker (ARCH 8.4, LV 6.6). Owner: WP-04.
 *
 * TS twin of Lean `Ibasho.Check.Check` with the same check ids, the same verdict paths and the
 * same report shape as `ibasho-check` (`ibasho.verdicts/1`). Worker safe: pure, no I/O, no DOM.
 * It is not the proof: Lean `check_sound` covers the Lean checker; parity tests tie the two.
 */
import {
  CERT_CHECK_IDS,
  CERT_SKIPPED_CHECKS,
  type CertCheckId,
  HISTORICAL_SPEC_HASHES,
  SEARCH_LIMITS,
  SPEC_HASH,
} from '@ibasho/spec-gen';
import { type Decoded, decodeCert, FUEL_NAMES, MalformedError } from './decode.ts';
import {
  at,
  BUILTIN_TARGET,
  derive,
  fuelRow,
  monthly,
  NO_WITNESS,
  productCount,
  type RowD,
  rowOptions,
  rows,
  ST_FEASIBLE,
  ST_NEEDS_CHECK,
  ST_TARGET_MISS,
  tariffFor,
} from './derive.ts';

export interface Verdict {
  check: CertCheckId;
  ok: boolean;
  path?: string;
  detail?: string;
}
export interface VerdictReport {
  schema: 'ibasho.verdicts/1';
  ok: boolean;
  specHash?: string;
  rows?: number;
  verdicts?: Verdict[];
  skipped?: { check: CertCheckId; reason: string }[];
  /** Set when the certificate is malformed (exit code 2). */
  error?: string;
}

const KNOWN_SPEC_HASHES: readonly string[] = [SPEC_HASH, ...HISTORICAL_SPEC_HASHES];

const allRows = (c: Decoded, p: (r: number) => boolean): boolean => {
  for (let r = 0; r < rows(c); r++) if (!p(r)) return false;
  return true;
};
const firstBad = (c: Decoded, p: (r: number) => boolean): string | undefined => {
  for (let r = 0; r < rows(c); r++) if (!p(r)) return `row/${r}`;
  return undefined;
};
const listEq = <T>(a: readonly T[], b: readonly T[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

function slabsOk(slabs: Decoded['tariffs'][number]['slabs']): boolean {
  let lo = 0n;
  for (let i = 0; i < slabs.length; i++) {
    const [u, p] = slabs[i]!;
    if (u === undefined) return i === slabs.length - 1 && p >= 0n;
    if (!(lo < u && p >= 0n)) return false;
    lo = u;
  }
  return false;
}

function usedFuels(c: Decoded, D: RowD[]): number[] {
  return FUEL_NAMES.map((_, f) => f).filter(
    (f) =>
      monthly(c.baseline, f).some((x) => x !== 0n) ||
      D.some((d) => monthly(d.delivered, f).some((x) => x !== 0n)),
  );
}

function chkPacks(c: Decoded, D: RowD[]): boolean {
  const tariffsOk = c.tariffs.every(
    (t) =>
      slabsOk(t.slabs) &&
      t.standingPerDay >= 0n &&
      t.validFrom <= c.asOf &&
      c.asOf <= t.validTo &&
      c.tariffs.filter((x) => x.fuel === t.fuel).length === 1,
  );
  const carbonOk = c.carbon.every(([, xs]) => xs.length === 12 && xs.every((x) => x >= 0n));
  const trajOk =
    c.trajFirstYear === c.asOfYear &&
    c.horizon <= c.trajYears &&
    c.trajectory.every(([, xs]) => xs.length === c.trajYears && xs.every((x) => x >= 0n));
  const coverOk = usedFuels(c, D).every(
    (f) =>
      tariffFor(c, f) !== undefined &&
      fuelRow(c.carbon, f) !== undefined &&
      fuelRow(c.trajectory, f) !== undefined,
  );
  const grantsOk = c.grants.every(
    (g) =>
      (g.validFrom === undefined || g.validFrom <= c.asOf) &&
      (g.validTo === undefined || c.asOf <= g.validTo) &&
      g.applied.every(([r, a]) => r < rows(c) && a > 0n),
  );
  const grantsLeCost = allRows(c, (r) => D[r] !== undefined && D[r]!.grants <= D[r]!.gross);
  const optionsOk = c.options.every((o) => o.lifetimeYears > 0 && o.costMid >= 0n);
  return tariffsOk && carbonOk && trajOk && coverOk && grantsOk && grantsLeCost && optionsOk && c.horizon > 0;
}

function keyOptions(key: string): string[] {
  const head = key.split('|')[0]!;
  return head === 'baseline' ? [] : head.split('+');
}

function chkEnum(c: Decoded): boolean {
  const n = rows(c);
  const allOpts = c.groups.flatMap((g) => g.options.filter((o) => o !== 'none'));
  return (
    c.groups.every((g) => g.options.length > 0) &&
    n === productCount(c) &&
    n <= SEARCH_LIMITS.packages &&
    c.status.length === n &&
    c.n0.length === n &&
    c.npv.length === n &&
    c.carbonSaved.length === n &&
    c.witness.length === n &&
    c.ruleIds.length === n &&
    c.baseline.length === 72 &&
    c.heavy.length === c.heavyKeys.length * 72 &&
    allOpts.every((o) => c.options.some((x) => x.id === o) && allOpts.filter((x) => x === o).length === 1) &&
    allRows(c, (r) => {
      const k = at(c.light, r, [0, []] as [number, [number, bigint][]])[0];
      const opts = rowOptions(c, r);
      return k < c.heavyKeys.length && keyOptions(at(c.heavyKeys, k, '')).every((o) => opts.includes(o));
    })
  );
}

const savingRowOk = (D: RowD[], s: bigint[], r: number): boolean => {
  const ds = D[r]?.saving ?? [];
  for (let i = 0; i < 6; i++) if (at(s, r * 6 + i, 0n) !== at(ds, i, 0n)) return false;
  return true;
};
function chkAcctSaving(c: Decoded, D: RowD[]): boolean {
  const s = c.saving;
  if (s === undefined) return false;
  return (
    s.length === rows(c) * 6 &&
    (rows(c) === 0 || (D[0] !== undefined && listEq(D[0].delivered, c.baseline))) &&
    allRows(c, (r) => D[r] !== undefined && savingRowOk(D, s, r))
  );
}
function chkAcctCarbon(c: Decoded, D: RowD[]): boolean {
  const a = c.carbonAnnual;
  if (a === undefined) return false;
  return a.length === rows(c) && allRows(c, (r) => D[r] !== undefined && at(a, r, 0n) === D[r]!.carbonAnnual);
}
const finRowOk = (c: Decoded, D: RowD[], r: number): boolean => {
  const d = D[r];
  return (
    d !== undefined &&
    at(c.n0, r, 0n) === d.n0 &&
    at(c.npv, r, 0n) === d.npv &&
    at(c.carbonSaved, r, 0n) === d.lifetimeCarbon
  );
};
const statusClass = (s: number): number => (s === ST_TARGET_MISS ? ST_FEASIBLE : s);
const withoutTarget = (ids: readonly string[]): string[] => ids.filter((x) => x !== BUILTIN_TARGET);
const metaPresent = (c: Decoded): boolean =>
  c.options.every((o) => o.kind !== undefined && o.measure !== undefined);
const feasRowOk = (c: Decoded, D: RowD[], r: number): boolean => {
  const d = D[r];
  return (
    d !== undefined &&
    statusClass(at(c.status, r, 99)) === statusClass(d.expected) &&
    listEq(withoutTarget(at(c.ruleIds, r, [])), withoutTarget(d.expectedIds))
  );
};
const chkFeas = (c: Decoded, D: RowD[]): boolean => metaPresent(c) && allRows(c, (r) => feasRowOk(c, D, r));

function needsCheckRows(c: Decoded, D: RowD[]): number[] {
  const out: number[] = [];
  for (let r = 0; r < rows(c); r++)
    if (at(c.status, r, 99) === ST_NEEDS_CHECK && (D[r]?.meets ?? false)) out.push(r);
  return out;
}
function chkTarget(c: Decoded, D: RowD[]): boolean {
  return (
    c.target.k !== 'epcBand' &&
    allRows(c, (r) => {
      const d = D[r];
      if (d === undefined) return false;
      const st = at(c.status, r, 99);
      return (
        (statusClass(d.expected) !== ST_FEASIBLE || st === d.expected) &&
        at(c.ruleIds, r, []).includes(BUILTIN_TARGET) === (st === ST_TARGET_MISS)
      );
    }) &&
    listEq(c.needsCheck, needsCheckRows(c, D))
  );
}

/* Pareto (Lean `Ibasho.Spec.V2.Pareto`) on the claimed axes. */

interface Outcome {
  pkg: number;
  n0: bigint;
  carbon: bigint;
  npv: bigint;
}
const outcome = (c: Decoded, r: number): Outcome => ({
  pkg: r,
  n0: at(c.n0, r, 0n),
  carbon: at(c.carbonSaved, r, 0n),
  npv: at(c.npv, r, 0n),
});
const oEq = (a: Outcome, b: Outcome): boolean =>
  a.pkg === b.pkg && a.n0 === b.n0 && a.carbon === b.carbon && a.npv === b.npv;
const contains = (xs: readonly Outcome[], o: Outcome): boolean => xs.some((x) => oEq(x, o));
const dominates = (a: Outcome, b: Outcome): boolean =>
  a.n0 <= b.n0 &&
  b.carbon <= a.carbon &&
  b.npv <= a.npv &&
  (a.n0 < b.n0 || b.carbon < a.carbon || b.npv < a.npv);
const cands = (c: Decoded): Outcome[] => {
  const out: Outcome[] = [];
  for (let r = 0; r < rows(c); r++) if (at(c.status, r, 99) === ST_FEASIBLE) out.push(outcome(c, r));
  return out;
};
const frontOk = (cs: Outcome[], front: Outcome[]): boolean =>
  front.every((p) => contains(cs, p) && cs.every((q) => !dominates(q, p)));
function checkFront(cs: Outcome[], front: Outcome[]): boolean {
  return frontOk(cs, front) && cs.every((q) => contains(front, q) || cs.some((r) => dominates(r, q)));
}
const strictlySorted = (xs: readonly number[]): boolean => xs.every((x, i) => i === 0 || xs[i - 1]! < x);
function chkFront(c: Decoded): boolean {
  return (
    strictlySorted(c.front) &&
    checkFront(
      cands(c),
      c.front.map((r) => outcome(c, r)),
    )
  );
}
function chkWitness(c: Decoded): boolean {
  const cs = cands(c);
  const front = c.front.map((r) => outcome(c, r));
  const witnessed =
    frontOk(cs, front) &&
    cs.every((q) => {
      if (contains(front, q)) return true;
      const w = at(c.witness, q.pkg, NO_WITNESS);
      if (w === NO_WITNESS) return false;
      const wo = outcome(c, w);
      return contains(cs, wo) && dominates(wo, q);
    });
  return (
    witnessed &&
    allRows(c, (r) => {
      const w = at(c.witness, r, NO_WITNESS);
      const offFront = at(c.status, r, 99) === ST_FEASIBLE && !c.front.includes(r);
      return offFront ? c.front.includes(w) : w === NO_WITNESS;
    })
  );
}

type Key = [bigint, bigint, bigint, bigint];
const keyLe = (a: Key, b: Key): boolean => {
  for (let i = 0; i < 4; i++) {
    if (a[i]! < b[i]!) return true;
    if (a[i]! > b[i]!) return false;
  }
  return true;
};
const KEYS: Record<'leastUpfront' | 'bestReturn' | 'lowestCarbon', (o: Outcome) => Key> = {
  leastUpfront: (o) => [o.n0, -o.carbon, -o.npv, BigInt(o.pkg)],
  bestReturn: (o) => [-o.npv, o.n0, -o.carbon, BigInt(o.pkg)],
  lowestCarbon: (o) => [-o.carbon, -o.npv, o.n0, BigInt(o.pkg)],
};
function chkPicks(c: Decoded): boolean {
  const cs = cands(c).filter((o) => o.pkg !== 0);
  return (['leastUpfront', 'bestReturn', 'lowestCarbon'] as const).every((k) => {
    const r = c.picks[k];
    if (r === undefined) return cs.length === 0;
    const p = outcome(c, r);
    const key = KEYS[k];
    return contains(cs, p) && p.pkg !== 0 && cs.every((q) => keyLe(key(p), key(q)));
  });
}

/** Verdicts of a decoded certificate, in Lean order. */
export function checkDecoded(c: Decoded): Verdict[] {
  const D = derive(c);
  const v = (check: CertCheckId, ok: boolean, path?: string, detail?: string): Verdict => ({
    check,
    ok,
    ...(path === undefined ? {} : { path }),
    ...(detail === undefined ? {} : { detail }),
  });
  const known = KNOWN_SPEC_HASHES.includes(c.specHash);
  const s = c.saving;
  return [
    v('spec.known', known, undefined, known ? undefined : `specHash ${c.specHash} is not known`),
    v('packs.wellformed', chkPacks(c, D)),
    v('enum.complete', chkEnum(c)),
    v(
      'acct.saving',
      chkAcctSaving(c, D),
      s === undefined ? undefined : firstBad(c, (r) => savingRowOk(D, s, r)),
      s === undefined ? 'claimed.saving is missing' : undefined,
    ),
    v(
      'acct.carbon',
      chkAcctCarbon(c, D),
      undefined,
      c.carbonAnnual === undefined ? 'claimed.carbonAnnual is missing' : undefined,
    ),
    v(
      'fin.recompute',
      allRows(c, (r) => finRowOk(c, D, r)),
      firstBad(c, (r) => finRowOk(c, D, r)),
    ),
    v(
      'feas.recompute',
      chkFeas(c, D),
      firstBad(c, (r) => feasRowOk(c, D, r)),
      metaPresent(c) ? undefined : 'groups[].optionMeta (measure, kind) is missing',
    ),
    v('target.recompute', chkTarget(c, D)),
    v('pareto.front', chkFront(c)),
    v('pareto.witness', chkWitness(c)),
    v('pareto.picks', chkPicks(c)),
  ];
}

const SKIPPED = CERT_CHECK_IDS.flatMap((id) => {
  const reason = CERT_SKIPPED_CHECKS[id];
  return reason === undefined ? [] : [{ check: id, reason }];
});

/** Check a certificate (parsed JSON). Never throws: a malformed certificate gives `error`. */
export function mirrorCheck(cert: unknown): VerdictReport {
  let c: Decoded;
  try {
    c = decodeCert(cert);
  } catch (e) {
    if (!(e instanceof MalformedError)) throw e;
    return { schema: 'ibasho.verdicts/1', ok: false, error: `malformed certificate: ${e.message}` };
  }
  const verdicts = checkDecoded(c);
  return {
    schema: 'ibasho.verdicts/1',
    ok: verdicts.every((x) => x.ok),
    specHash: c.specHash,
    rows: rows(c),
    verdicts,
    skipped: SKIPPED,
  };
}

/** `ibasho-check` exit code of a report: 0 passed, 1 a check failed, 2 malformed. */
export const exitCode = (r: VerdictReport): 0 | 1 | 2 => (r.error !== undefined ? 2 : r.ok ? 0 : 1);
