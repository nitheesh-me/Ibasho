/**
 * The app's engine worker body (ARCH 5.5, 8.4). Owner: WP-08.
 *
 * Exposes the WP-02 engine over Comlink plus one app call, `verify`, which runs the WP-04 mirror
 * checker on the certificate of a result the worker already holds. The mirror runs in the worker
 * (ARCH 8.4) so the main thread never blocks on it. Kept free of `self` so tests can serve it on a
 * `MessageChannel` port exactly as the browser worker does.
 */
import type { HomeTwin, ModuleRef } from '@ibasho/core';
import {
  createEngine,
  type Engine,
  type ExposedEngine,
  exposedEngine,
  homeFacts,
  M0_OPTION_IDS,
} from '@ibasho/engine';
import { MEASURES, measureOfOption } from '@ibasho/pack-home-uk/ids';
import { emit, mirrorCheck, type VerdictReport } from '@ibasho/verify';
import * as Comlink from 'comlink';

export interface VerifyOutcome {
  rung: 'mirror';
  /** The mirror checks every row while that is cheap (ARCH 8.4); M-0 results are always small. */
  coverage: 'all';
  report: VerdictReport;
  /** The completed certificate the checker read (stored with its verdict). */
  certificate: ReturnType<typeof emit>;
}

export type AppEngine = ExposedEngine & {
  verify(resultHash: string, twin: HomeTwin): Promise<VerifyOutcome>;
};

/** Run the mirror on a result the engine holds. Throws when the hash is unknown. */
export function verifyResult(engine: Engine, resultHash: string, twin: HomeTwin): VerifyOutcome {
  const state = engine.stateOf(resultHash);
  if (!state) throw new Error(`no result ${resultHash} in this worker`);
  const result = state.result;
  const optionMeta: Record<string, { measure: string; kind: string }> = {};
  for (const g of result.certificate.groups)
    for (const o of g.options) {
      if (o === 'none') continue;
      const m = measureOfOption(o);
      if (!m) throw new Error(`option ${o} has no measure id in packs/home-uk`);
      optionMeta[o] = { measure: m, kind: MEASURES[m].kind };
    }
  const facts = homeFacts(twin) as Record<string, true | false | 'unknown' | number | string>;
  const certificate = emit(result, {
    optionMeta,
    home: {
      region: twin.region,
      facts,
      checks: twin.checks.map((c) => ({ kind: c.kind, at: c.at, result: c.result })),
    },
  });
  return { rung: 'mirror', coverage: 'all', report: mirrorCheck(certificate), certificate };
}

/** Create the engine over `modules` and expose it with `verify` on `endpoint`. */
export function serveEngine(endpoint: Comlink.Endpoint, modules: readonly ModuleRef[]): Engine {
  const engine = createEngine({ modules: [...modules], allowOptions: M0_OPTION_IDS });
  const api: AppEngine = {
    ...exposedEngine(engine),
    async verify(resultHash, twin) {
      return verifyResult(engine, resultHash, twin);
    },
  };
  Comlink.expose(api, endpoint);
  return engine;
}
