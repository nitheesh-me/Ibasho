/**
 * GH1 M-0 golden certificate and the three M-0 mutants (BUILD_PLAN M0-2, M0-3, M0-4). Owner: WP-04.
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
import { emit } from '../src/emit.ts';
import { decodeI64, decodeU8, encodeI64, encodeU8 } from '../src/wire.ts';

export const CERT_DIR = '../../packages/fixtures/src/certs';

export interface MutantSpec {
  file: string;
  /** BUILD_PLAN acceptance id. */
  acceptance: string;
  /** The check that must fail in both checkers. */
  fails: string;
  /** Verdict path both checkers report for it. */
  path: string;
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
];

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

const clone = (c: Certificate): Certificate => JSON.parse(JSON.stringify(c)) as Certificate;

export function buildMutant(golden: Certificate, file: string): Certificate {
  const c = clone(golden);
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
  } else throw new Error(`unknown mutant ${file}`);
  return c;
}

export const certJson = (c: unknown): string => `${JSON.stringify(c, null, 2)}\n`;
