/**
 * `pnpm verify [cert ...]` (ARCH 8.1). Owner: WP-04.
 *
 * Runs the Lean checker (`proofs/.lake/build/bin/ibasho-check`) and the TS mirror on each
 * certificate and requires them to agree (check id, ok, path, exit code). With no argument it
 * runs the committed set in `packages/fixtures/src/certs/`: the golden must pass and every
 * mutant must fail its named check.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
// Relative import: tools may read workspace sources; @ibasho/verify is pure TS.
import { exitCode, mirrorCheck, type VerdictReport } from '../../../packages/verify/src/index.ts';

export const ROOT = resolve(import.meta.dirname, '../../..');
export const LEAN_BIN = join(ROOT, 'proofs/.lake/build/bin/ibasho-check');
export const CERT_DIR = join(ROOT, 'packages/fixtures/src/certs');

export interface Outcome {
  file: string;
  mirror: { code: number; report: VerdictReport };
  lean?: { code: number; report: VerdictReport };
  agree: boolean;
  /** For the committed set: does the result match the manifest's expectation? */
  expected?: boolean;
}

const key = (r: VerdictReport): string =>
  JSON.stringify({
    ok: r.ok,
    malformed: r.error !== undefined,
    verdicts: r.verdicts?.map((v) => [v.check, v.ok, v.path ?? null]),
  });

export function runOne(file: string): Outcome {
  const mirrorReport = (() => {
    try {
      return mirrorCheck(JSON.parse(readFileSync(file, 'utf8')));
    } catch (e) {
      return {
        schema: 'ibasho.verdicts/1',
        ok: false,
        error: `malformed certificate: ${String(e)}`,
      } as const;
    }
  })();
  const mirror = { code: exitCode(mirrorReport), report: mirrorReport as VerdictReport };
  if (!existsSync(LEAN_BIN)) return { file, mirror, agree: true };
  const r = spawnSync(LEAN_BIN, [file], { encoding: 'utf8' });
  const lean = { code: r.status ?? -1, report: JSON.parse(r.stdout || '{}') as VerdictReport };
  return { file, mirror, lean, agree: lean.code === mirror.code && key(lean.report) === key(mirror.report) };
}

interface Manifest {
  golden: string;
  mutants: { file: string; fails: string; path: string }[];
}

export function runCommitted(): Outcome[] {
  const m = JSON.parse(readFileSync(join(CERT_DIR, 'manifest.json'), 'utf8')) as Manifest;
  const golden = runOne(join(CERT_DIR, m.golden));
  golden.expected = golden.mirror.code === 0;
  const mutants = m.mutants.map((mu) => {
    const o = runOne(join(CERT_DIR, mu.file));
    const v = o.mirror.report.verdicts?.find((x) => x.check === mu.fails);
    o.expected = o.mirror.code === 1 && v?.ok === false && v.path === mu.path;
    return o;
  });
  return [golden, ...mutants];
}

export function main(args: string[]): number {
  const outs = args.length ? args.map((a) => runOne(resolve(a))) : runCommitted();
  if (!existsSync(LEAN_BIN))
    console.log(`note: ${LEAN_BIN} is not built; mirror only (cd proofs && lake build ibasho-check)`);
  let bad = false;
  for (const o of outs) {
    const failed = o.mirror.report.verdicts
      ?.filter((v) => !v.ok)
      .map((v) => `${v.check}${v.path ? `@${v.path}` : ''}`);
    const line = [
      o.file.replace(`${ROOT}/`, ''),
      `mirror=${o.mirror.code}`,
      o.lean ? `lean=${o.lean.code}` : 'lean=n/a',
      o.agree ? 'agree' : 'DISAGREE',
      o.expected === undefined ? '' : o.expected ? 'as expected' : 'UNEXPECTED',
      failed?.length ? `failed: ${failed.join(', ')}` : (o.mirror.report.error ?? ''),
    ];
    console.log(line.filter(Boolean).join('  '));
    if (!o.agree || o.expected === false || (o.expected === undefined && o.mirror.code !== 0)) bad = true;
  }
  return bad ? 1 : 0;
}
