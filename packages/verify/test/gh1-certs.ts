/**
 * GH1 M-0 golden certificate, the M-0 mutants (BUILD_PLAN M0-2, M0-3, M0-4), the done-measure
 * mutant (SPEC AC-P1) and a scored certificate with two score mutants. Owner: WP-04.
 *
 * The golden is a real engine search (the WP-02 GH1 wiring) passed through `emit` with the home
 * pack's measure ids and the twin's rule facts. Tests may wire packs, engine and fixtures
 * together (dependency-cruiser exempts tests). Regenerate the committed files with
 * `pnpm --filter @ibasho/verify gen:certs`.
 */
import type { Certificate } from '@ibasho/spec-gen';
import { MEASURES, measureOfOption } from '../../../packs/home-uk/src/ids.ts';
import { homeFacts } from '../../engine/src/rules/facts.ts';
import { gh1, readyEngine, request } from '../../engine/test/gh1.ts';
import { emit, scoreClaim } from '../src/emit.ts';
import { decodeI64, decodeU8, decodeU32, encodeI64, encodeU8 } from '../src/wire.ts';

export const CERT_DIR = '../../packages/fixtures/src/certs';

export interface MutantSpec {
  file: string;
  /** BUILD_PLAN acceptance id. */
  acceptance: string;
  /** The check that must fail in both checkers. */
  fails: string;
  /** Verdict path both checkers report for it (none when the failure is not one row). */
  path?: string;
  /** The certificate it mutates (default: the golden). */
  base?: 'golden' | 'scored';
  note: string;
}

export const MUTANTS: readonly MutantSpec[] = [
  {
    file: 'gh1-m0.mutant-saving-sign.cert.json',
    acceptance: 'M0-2',
    fails: 'acct.saving',
    path: 'row/1',
    note: 'Row 1 (loft-300): every claimed annual saving has its sign flipped.',
  },
  {
    file: 'gh1-m0.mutant-rejected-in-front.cert.json',
    acceptance: 'M0-3',
    fails: 'feas.recompute',
    path: 'row/1',
    note: 'The owner rejected the loft measure, yet loft-300 packages stay feasible and on the front.',
  },
  {
    file: 'gh1-m0.mutant-unknown-feasible.cert.json',
    acceptance: 'M0-4',
    fails: 'feas.recompute',
    path: 'row/3',
    note: 'Row 3 (heat-ashp+loft-300) needs the DNO check (looped supply unknown) but is marked feasible.',
  },
  {
    file: 'gh1-m0.mutant-completed-in-front.cert.json',
    acceptance: 'AC-P1',
    fails: 'feas.recompute',
    path: 'row/1',
    note: 'The owner marked the loft measure done, yet loft-300 packages stay feasible and on the front.',
  },
  {
    file: 'gh1-m0.mutant-score-total.cert.json',
    acceptance: 'R20',
    fails: 'score.recompute',
    path: 'row/1',
    base: 'scored',
    note: 'Scored certificate: the claimed total of row 1 is one point higher than its sub-scores give.',
  },
  {
    file: 'gh1-m0.mutant-score-unscored-pick.cert.json',
    acceptance: 'R20',
    fails: 'score.recompute',
    base: 'scored',
    note: 'Scored certificate: the score of the bestReturn pick is left out, so a displayed package is unscored.',
  },
];

/** The scored certificate (golden plus `claimed.score`). */
export const SCORED_FILE = 'gh1-m0.scored.cert.json';

/**
 * Seven indicators per displayed row, `SCORE_DIMS` order (F, C, E, A, H, R, T), UK burden mode.
 * SYNTHETIC: chosen to exercise every clamp branch of the score, not computed from GH1 physics;
 * WP-02 owns the real indicators (SPEC 8). Rows 0 (baseline) and every front or pick row are scored.
 */
export function syntheticIndicators(rowsToScore: readonly number[]): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (const r of rowsToScore) {
    const k = BigInt(r);
    out[r] = [
      `${17n - k}/5`, // F: W/m2K, from 3.4 down (inside the 0.8 to 4 anchors)
      `${90n - 9n * k}`, // C: starts past the worst anchor (clamps to 0)
      `${300n - 20n * k}`, // E: kWh/m2yr
      `${11n - k}/100`, // A: burden share
      `${9n + 3n * k}/10`, // H: primary efficiency, rising towards the best anchor
      `${k}/8`, // R: composite
      `${7n}/10`, // T: composite
    ];
  }
  return out;
}

/** Golden plus a `claimed.score` of row 0 and every displayed row (front and picks). */
export function buildScored(golden: Certificate): Certificate {
  const c = clone(golden);
  const shown = new Set<number>([0, ...decodeU32(c.front)]);
  for (const p of [c.picks.leastUpfront, c.picks.bestReturn, c.picks.lowestRunningCarbon])
    if (p !== undefined) shown.add(p);
  c.claimed.score = scoreClaim({
    zone: 'uk',
    mode: 'burden',
    indicators: syntheticIndicators([...shown].sort((a, b) => a - b)),
  });
  return c;
}

export async function buildGolden(): Promise<Certificate> {
  const engine = await readyEngine();
  const result = await (await engine.search(request())).result;
  const optionMeta: Record<string, { measure: string; kind: string }> = {};
  for (const g of result.certificate.groups)
    for (const o of g.options) {
      if (o === 'none') continue;
      const m = measureOfOption(o);
      if (!m) throw new Error(`option ${o} has no measure in packs/home-uk ids`);
      optionMeta[o] = { measure: m, kind: MEASURES[m].kind };
    }
  const facts = homeFacts(gh1) as Record<string, true | false | 'unknown' | number | string>;
  return emit(result, {
    optionMeta,
    home: {
      region: gh1.region,
      facts,
      checks: gh1.checks.map((c) => ({ kind: c.kind, at: c.at, result: c.result })),
    },
  });
}

function clone(c: Certificate): Certificate {
  return JSON.parse(JSON.stringify(c)) as Certificate;
}

/** A mutant of the golden, or of the scored certificate when the spec says so. */
export function buildMutant(golden: Certificate, file: string): Certificate {
  const spec = MUTANTS.find((m) => m.file === file);
  const c = clone(spec?.base === 'scored' ? buildScored(golden) : golden);
  if (file === MUTANTS[0]!.file) {
    const s = decodeI64(c.claimed.saving!);
    for (let i = 6; i < 12; i++) s[i] = -s[i]!;
    c.claimed.saving = encodeI64(s);
  } else if (file === MUTANTS[1]!.file) {
    c.context.memory.rejected = ['loft'];
  } else if (file === MUTANTS[2]!.file) {
    const st = decodeU8(c.claimed.status);
    st[3] = 0;
    c.claimed.status = encodeU8(st);
    c.claimed.ruleIds[3] = [];
  } else if (file === MUTANTS[3]!.file) {
    c.context.memory.completed = ['loft'];
  } else if (file === MUTANTS[4]!.file) {
    const row = c.claimed.score!.rows.find((e) => e.row === 1)!;
    const [n, d] = row.total.split('/');
    const den = BigInt(d ?? '1');
    row.total = d === undefined ? `${BigInt(n!) + 1n}` : `${BigInt(n!) + den}/${den}`;
  } else if (file === MUTANTS[5]!.file) {
    const pick = c.picks.bestReturn!;
    c.claimed.score!.rows = c.claimed.score!.rows.filter((e) => e.row !== pick);
  } else throw new Error(`unknown mutant ${file}`);
  return c;
}

export const certJson = (c: unknown): string => `${JSON.stringify(c, null, 2)}\n`;
