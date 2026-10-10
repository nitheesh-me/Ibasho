/**
 * `POST /verify` runner (ARCH 8.1, 11): pipes one `ibasho.cert/2` certificate (or NDJSON with
 * `--batch`) into the Lean checker `ibasho-check` and returns its verdict JSON.
 *
 * It runs the prebuilt binary (`proofs/.lake/build/bin/ibasho-check`), never `lake build`: a build
 * is heavy and belongs to the developer, not to a request. When the binary is missing the route
 * answers 503 with the command to build it. One check at a time (a queue), niced, with a timeout.
 * The `@ibasho/verify` handler (WP-04) can replace this runner through `CompanionOptions.verify`.
 */
import { spawn } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { resolve } from 'node:path';

export interface VerifyResult {
  /** Checker exit code: 0 all passed, 1 a check failed, 2 malformed. */
  code: number;
  /** The checker's JSON line (or NDJSON lines with `batch`). */
  stdout: string;
  stderr: string;
}

export interface VerifyRunner {
  /** Whether the checker can run now (shown on `/health`). */
  available(): boolean;
  run(certificate: string, opts: { batch: boolean; signal?: AbortSignal }): Promise<VerifyResult>;
}

export class CheckerUnavailableError extends Error {
  override name = 'CheckerUnavailableError';
}

/** Too many checks waiting (`maxQueue`); the route answers 429. */
export class CheckerBusyError extends Error {
  override name = 'CheckerBusyError';
}

export interface LakeRunnerOptions {
  /** The Lean package (`proofs/`). */
  proofsDir: string;
  /** Override the binary path. Default `<proofsDir>/.lake/build/bin/ibasho-check`. */
  binary?: string;
  timeoutMs?: number;
  /** Lower the checker's CPU priority (default true, so a check never competes with the UI). */
  nice?: boolean;
  /** Most checks running or waiting at once (default 4); more answer 429, so a flood cannot pile up work. */
  maxQueue?: number;
}

export function lakeCheckRunner(opts: LakeRunnerOptions): VerifyRunner {
  const binary = opts.binary ?? resolve(opts.proofsDir, '.lake/build/bin/ibasho-check');
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const maxQueue = opts.maxQueue ?? 4;
  let queue: Promise<unknown> = Promise.resolve();
  let pending = 0;

  const available = () => {
    try {
      accessSync(binary, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  };

  const once = (certificate: string, batch: boolean, signal?: AbortSignal) =>
    new Promise<VerifyResult>((done, fail) => {
      if (!available()) {
        fail(
          new CheckerUnavailableError(
            `ibasho-check is not built; run \`lake build ibasho-check\` in ${opts.proofsDir}`,
          ),
        );
        return;
      }
      const args = batch ? ['--batch'] : [];
      const [cmd, argv] = opts.nice === false ? [binary, args] : ['nice', ['-n', '10', binary, ...args]];
      const child = spawn(cmd, argv, {
        cwd: opts.proofsDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        ...(signal ? { signal } : {}),
      });
      const out: Buffer[] = [];
      const err: Buffer[] = [];
      const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
      child.stdout.on('data', (b: Buffer) => out.push(b));
      child.stderr.on('data', (b: Buffer) => err.push(b));
      child.on('error', (e) => {
        clearTimeout(timer);
        fail(e);
      });
      child.on('close', (code, sig) => {
        clearTimeout(timer);
        if (sig) {
          fail(new Error(`ibasho-check stopped by ${sig}`));
          return;
        }
        done({
          code: code ?? 2,
          stdout: Buffer.concat(out).toString('utf8'),
          stderr: Buffer.concat(err).toString('utf8'),
        });
      });
      child.stdin.on('error', () => {});
      child.stdin.end(certificate);
    });

  return {
    available,
    run(certificate, { batch, signal }) {
      if (pending >= maxQueue)
        return Promise.reject(new CheckerBusyError(`${pending} checks already queued; try again shortly`));
      pending++;
      const next = queue.then(() => {
        // A caller that hung up while waiting gets no process.
        if (signal?.aborted) throw new Error('request aborted before the check started');
        return once(certificate, batch, signal);
      });
      const settled = next.then(
        () => undefined,
        () => undefined,
      );
      queue = settled;
      void settled.then(() => {
        pending--;
      });
      return next;
    },
  };
}
