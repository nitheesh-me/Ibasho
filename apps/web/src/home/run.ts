/**
 * One run of the home stage (ARCH 6 data flow, M-0 slice). Owner: WP-08.
 *
 * search in the worker, mirror check in the worker, then the store: twin version, result and
 * certificate with its verdict. Storage is best effort: a private window without IndexedDB still
 * shows the home, and the page says the result was not kept.
 */
import type { SearchProgress, SearchResult } from '@ibasho/core';
import type { Store } from '@ibasho/store';
import { type RemoteEngine, runSearch } from '../engine/client.ts';
import type { VerifyOutcome } from '../worker/serve.ts';
import { type HomeEntry, searchRequest } from './sample.ts';

export interface HomeRun {
  result: SearchResult;
  check: VerifyOutcome;
  kept: boolean;
}

export async function keep(store: Store, home: HomeEntry, run: Omit<HomeRun, 'kept'>): Promise<boolean> {
  try {
    const active = await store.twins.active(home.id);
    if (!active || active.twin.version !== home.twin.version) await store.twins.append(home.twin, home.name);
    await store.results.put(home.id, run.result);
    await store.certs.put(run.result.hash, run.check.certificate);
    await store.certs.addVerdict(run.result.hash, {
      rung: run.check.rung,
      coverage: run.check.coverage,
      ok: run.check.report.ok,
      report: run.check.report,
    });
    return true;
  } catch {
    return false;
  }
}

export async function runHome(
  engine: RemoteEngine,
  home: HomeEntry,
  store: Store | null,
  onProgress?: (p: SearchProgress) => void,
): Promise<HomeRun> {
  const run = await runSearch(engine, searchRequest(home), onProgress);
  const kept = store ? await keep(store, home, run) : false;
  return { ...run, kept };
}
