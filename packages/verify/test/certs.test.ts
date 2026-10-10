/**
 * Golden, scored and mutant certificates (BUILD_PLAN M0-1 to M0-4, SPEC AC-P1 and R20, D4 parity).
 * Owner: WP-04.
 *
 * The mirror passes the GH1 golden and fails each mutant on its named check. When the Lean
 * checker is built (`cd proofs && lake build ibasho-check`), both checkers must agree on every
 * verdict (check id, ok, path) and on the exit code.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { CERT_CHECK_IDS, SPEC_HASH } from '@ibasho/spec-gen';
import { describe, expect, it } from 'vitest';
import { exitCode, mirrorCheck, type VerdictReport } from '../src/index.ts';
import { buildGolden, buildMutant, buildScored, CERT_DIR, MUTANTS, SCORED_FILE } from './gh1-certs.ts';

const LEAN = '../../proofs/.lake/build/bin/ibasho-check';
const hasLean = existsSync(LEAN);
const read = (f: string): unknown => JSON.parse(readFileSync(`${CERT_DIR}/${f}`, 'utf8'));

function lean(file: string): { code: number; report: VerdictReport } {
  const r = spawnSync(LEAN, [`${CERT_DIR}/${file}`], { encoding: 'utf8' });
  return { code: r.status ?? -1, report: JSON.parse(r.stdout) as VerdictReport };
}
const shape = (r: VerdictReport) => ({
  ok: r.ok,
  specHash: r.specHash,
  rows: r.rows,
  verdicts: r.verdicts?.map((v) => ({ check: v.check, ok: v.ok, path: v.path })),
  skipped: r.skipped?.map((s) => s.check),
});
const FILES = ['gh1-m0.cert.json', SCORED_FILE, ...MUTANTS.map((m) => m.file)];

describe('GH1 M-0 golden certificate', () => {
  it('passes every check in the mirror (exit 0)', () => {
    const r = mirrorCheck(read('gh1-m0.cert.json'));
    expect(r.verdicts?.filter((v) => !v.ok)).toEqual([]);
    expect(exitCode(r)).toBe(0);
    expect(r.specHash).toBe(SPEC_HASH);
    expect(r.rows).toBe(8);
  });
  it('runs every check id or names why it is skipped', () => {
    const r = mirrorCheck(read('gh1-m0.cert.json'));
    const seen = [...(r.verdicts ?? []).map((v) => v.check), ...(r.skipped ?? []).map((s) => s.check)];
    expect([...seen].sort()).toEqual([...CERT_CHECK_IDS].sort());
  });
  it('the committed golden and mutants equal a fresh engine search plus emit', async () => {
    const golden = await buildGolden();
    expect(read('gh1-m0.cert.json')).toEqual(JSON.parse(JSON.stringify(golden)));
    expect(read(SCORED_FILE)).toEqual(JSON.parse(JSON.stringify(buildScored(golden))));
    for (const m of MUTANTS)
      expect(read(m.file)).toEqual(JSON.parse(JSON.stringify(buildMutant(golden, m.file))));
  }, 60_000);
});

describe('scored certificate', () => {
  it('passes every check, score included, and skips none (exit 0)', () => {
    const r = mirrorCheck(read(SCORED_FILE));
    expect(r.verdicts?.filter((v) => !v.ok)).toEqual([]);
    expect(r.verdicts?.map((v) => v.check)).toEqual([...CERT_CHECK_IDS]);
    expect(r.skipped).toEqual([]);
    expect(exitCode(r)).toBe(0);
  });
});

describe.each(MUTANTS)('mutant $acceptance ($file)', (m) => {
  it(`fails ${m.fails} at ${m.path ?? 'no row'} in the mirror (exit 1)`, () => {
    const r = mirrorCheck(read(m.file));
    expect(exitCode(r)).toBe(1);
    const v = r.verdicts?.find((x) => x.check === m.fails);
    expect(v?.ok).toBe(false);
    expect(v?.path).toBe(m.path);
  });
});

describe.skipIf(!hasLean)('Lean checker parity (ibasho-check)', () => {
  it.each(FILES)('%s: same verdicts and exit code', (f) => {
    const l = lean(f);
    const t = mirrorCheck(read(f));
    expect(shape(t)).toEqual(shape(l.report));
    expect(exitCode(t)).toBe(l.code);
  });
  it('GH1 golden exits 0 in Lean', () => {
    expect(lean('gh1-m0.cert.json').code).toBe(0);
  });
});

describe('malformed certificates', () => {
  const golden = read('gh1-m0.cert.json') as Record<string, unknown>;
  const cases: [string, unknown][] = [
    ['not an object', 42],
    ['wrong schema', { ...golden, schema: 'ibasho.cert/1' }],
    ['bad base64', { ...golden, front: 'AA=A' }],
    ['missing claimed', { ...golden, claimed: undefined }],
  ];
  it.each(cases)('%s: exit 2', (_, c) => {
    const r = mirrorCheck(c);
    expect(exitCode(r)).toBe(2);
    expect(r.error).toMatch(/^malformed certificate: /);
  });
});
