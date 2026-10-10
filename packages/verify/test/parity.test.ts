/**
 * Differential parity: Lean `ibasho-check` and the TS mirror on many one-field mutations of the
 * GH1 golden (D4, LV 6.6). Owner: WP-04.
 *
 * The fixture mutants exercise a few checks each. Here every claimed column (bills and score
 * included), the front, the picks, the witnesses, the context (done measures included) and a few
 * malformed shapes are perturbed one at a time; both checkers must give the same report shape
 * and exit code. Each case also states the exit code it must give, so a bug shared by both
 * checkers still fails. Score cases start from the scored certificate.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { exitCode, mirrorCheck, type VerdictReport } from '../src/index.ts';
import { decodeI64, decodeU8, decodeU32, encodeI64, encodeU8, encodeU32 } from '../src/wire.ts';
import { CERT_DIR, SCORED_FILE } from './gh1-certs.ts';

const LEAN = '../../proofs/.lake/build/bin/ibasho-check';
const hasLean = existsSync(LEAN);

// biome-ignore lint/suspicious/noExplicitAny: mutations reach into arbitrary certificate JSON on purpose, including invalid shapes.
type Json = Record<string, any>;
const golden = JSON.parse(readFileSync(`${CERT_DIR}/gh1-m0.cert.json`, 'utf8')) as Json;
const scored = JSON.parse(readFileSync(`${CERT_DIR}/${SCORED_FILE}`, 'utf8')) as Json;
const clone = (): Json => JSON.parse(JSON.stringify(golden)) as Json;
/** Mutate the scored certificate instead of the golden. */
const onScored =
  (f: (c: Json) => void) =>
  (c: Json): void => {
    for (const k of Object.keys(c)) delete c[k];
    Object.assign(c, JSON.parse(JSON.stringify(scored)) as Json);
    f(c);
  };
const scoreRow = (c: Json, row: number): Json => c.claimed.score.rows.find((e: Json) => e.row === row);

const bumpI64 = (s: string, i: number, d: bigint): string => {
  const xs = decodeI64(s);
  xs[i] = xs[i]! + d;
  return encodeI64(xs);
};
const setU8 = (s: string, i: number, v: number): string => {
  const xs = decodeU8(s);
  xs[i] = v;
  return encodeU8(xs);
};
const setU32 = (s: string, i: number, v: number): string => {
  const xs = decodeU32(s);
  xs[i] = v;
  return encodeU32(xs);
};

/** [name, mutation, expected exit code]. */
const CASES: [string, (c: Json) => void, 0 | 1 | 2][] = [
  ['golden unchanged', () => {}, 0],
  ['unknown spec hash', (c) => (c.specHash = '0'.repeat(64)), 1],
  ['claimed n0 off by one', (c) => (c.claimed.n0 = bumpI64(c.claimed.n0, 2, 1n)), 1],
  ['claimed npv off by one', (c) => (c.claimed.npv = bumpI64(c.claimed.npv, 4, -1n)), 1],
  [
    'claimed lifetime carbon off by one',
    (c) => (c.claimed.carbonSaved = bumpI64(c.claimed.carbonSaved, 5, 1n)),
    1,
  ],
  [
    'claimed annual carbon off by one',
    (c) => (c.claimed.carbonAnnual = bumpI64(c.claimed.carbonAnnual, 1, 1n)),
    1,
  ],
  ['claimed gas saving off by one', (c) => (c.claimed.saving = bumpI64(c.claimed.saving, 6 + 1, 1n)), 1],
  ['front drops a nondominated row', (c) => (c.front = encodeU32(decodeU32(c.front).slice(0, 2))), 1],
  ['front gains an infeasible row', (c) => (c.front = encodeU32([0, ...decodeU32(c.front)])), 1],
  ['front out of order', (c) => (c.front = encodeU32([...decodeU32(c.front)].reverse())), 1],
  ['bestReturn pick swapped', (c) => (c.picks.bestReturn = c.picks.leastUpfront), 1],
  ['leastUpfront pick swapped', (c) => (c.picks.leastUpfront = c.picks.bestReturn), 1],
  ['lowestRunningCarbon pick off front', (c) => (c.picks.lowestRunningCarbon = 0), 1],
  ['witness on a front row', (c) => (c.claimed.witness = setU32(c.claimed.witness, 1, 4)), 1],
  ['witness out of range', (c) => (c.claimed.witness = setU32(c.claimed.witness, 0, 99)), 1],
  ['feasible row marked needs check', (c) => (c.claimed.status = setU8(c.claimed.status, 1, 1)), 1],
  ['needs check row marked target miss', (c) => (c.claimed.status = setU8(c.claimed.status, 2, 3)), 1],
  ['baseline marked feasible', (c) => (c.claimed.status = setU8(c.claimed.status, 0, 0)), 1],
  ['rule ids dropped on a needs check row', (c) => (c.claimed.ruleIds[2] = []), 1],
  ['unknown rule id on a feasible row', (c) => (c.claimed.ruleIds[1] = ['UK.NOPE']), 1],
  ['needsCheck list drops a row', (c) => (c.needsCheck = encodeU32(decodeU32(c.needsCheck).slice(1))), 1],
  // A looped supply needs the DNO check just as an unknown one does: same statuses.
  ['looped supply now known true', (c) => (c.context.home.facts['h.supply.looped'] = true), 0],
  ['looped supply now known false', (c) => (c.context.home.facts['h.supply.looped'] = false), 1],
  ['as of date after the tariff window', (c) => (c.context.asOf = '2027-02-01'), 1],
  ['horizon longer than the trajectory', (c) => (c.context.owner.horizonYears = 30), 1],
  ['discount rate changed', (c) => (c.context.owner.discountRatePpb = '40000000'), 1],
  ['grant applied to the baseline', (c) => c.packs.grants[0].data.applied.push(['0', '1']), 1],
  ['option cost changed', (c) => (c.groups[0].facts['draught-proofing-chimney-balloon']['c.mid'] = '1'), 1],
  // A column of the wrong length is a well formed certificate that fails `enum.complete`.
  ['claimed electricity bill off by one', (c) => (c.claimed.bills = bumpI64(c.claimed.bills, 6 * 3, 1n)), 1],
  ['claimed bills missing', (c) => delete c.claimed.bills, 1],
  [
    'claimed bills one row short',
    (c) => (c.claimed.bills = encodeI64(decodeI64(c.claimed.bills).slice(6))),
    1,
  ],
  ['done measure on the front', (c) => (c.context.memory.completed = ['loft']), 1],
  ['done option id on the front', (c) => (c.context.memory.completed = ['loft-300']), 1],
  ['done measure nobody offers', (c) => (c.context.memory.completed = ['solar-pv']), 0],
  ['memory completed missing', (c) => delete c.context.memory.completed, 2],
  ['scored certificate unchanged', onScored(() => {}), 0],
  ['score sub off', onScored((c) => (scoreRow(c, 1).sub[0] = '26')), 1],
  ['score group off', onScored((c) => (scoreRow(c, 4).groups[2] = '0')), 1],
  ['score total off', onScored((c) => (scoreRow(c, 0).total = '19')), 1],
  ['score in unreduced form', onScored((c) => (scoreRow(c, 1).sub[0] = '50/2')), 0],
  ['score indicator changed', onScored((c) => (scoreRow(c, 5).indicators[1] = '0')), 1],
  ['score six indicators', onScored((c) => scoreRow(c, 1).indicators.pop()), 1],
  ['score row out of range', onScored((c) => (scoreRow(c, 5).row = 99)), 1],
  ['score rows out of order', onScored((c) => c.claimed.score.rows.reverse()), 1],
  ['score drops a front row', onScored((c) => c.claimed.score.rows.splice(1, 1)), 1],
  ['score with per-area anchors', onScored((c) => (c.claimed.score.mode = 'per-area')), 1],
  ['score unknown zone', onScored((c) => (c.claimed.score.zone = 'mars')), 2],
  ['score zero denominator', onScored((c) => (scoreRow(c, 1).total = '1/0')), 2],
  ['score decimal not a rational', onScored((c) => (scoreRow(c, 1).total = '0.5')), 2],
  ['status column too short', (c) => (c.claimed.status = encodeU8(decodeU8(c.claimed.status).slice(1))), 1],
  ['npv column not base64', (c) => (c.claimed.npv = '***'), 2],
  ['groups missing', (c) => delete c.groups, 2],
];

const shape = (r: VerdictReport) => ({
  ok: r.ok,
  specHash: r.specHash,
  rows: r.rows,
  verdicts: r.verdicts?.map((v) => ({ check: v.check, ok: v.ok, path: v.path })),
  skipped: r.skipped?.map((s) => s.check),
  malformed: r.error !== undefined,
});

const dir = mkdtempSync(join(tmpdir(), 'ibasho-parity-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('mutation cases give the stated exit code in the mirror', () => {
  it.each(CASES)('%s', (_, mutate, want) => {
    const c = clone();
    mutate(c);
    expect(exitCode(mirrorCheck(c))).toBe(want);
  });
});

describe.skipIf(!hasLean)('Lean and mirror agree on every mutation', () => {
  it.each(CASES)('%s', (name, mutate) => {
    const c = clone();
    mutate(c);
    const file = join(dir, `${name.replace(/\W+/g, '_')}.json`);
    writeFileSync(file, JSON.stringify(c));
    const r = spawnSync(LEAN, [file], { encoding: 'utf8' });
    const lean = JSON.parse(r.stdout) as VerdictReport;
    const mirror = mirrorCheck(c);
    expect(shape(mirror)).toEqual(shape(lean));
    expect(exitCode(mirror)).toBe(r.status);
  });
});
