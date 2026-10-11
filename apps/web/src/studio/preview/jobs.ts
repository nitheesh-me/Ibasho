/**
 * Where studio jobs run (review B-B2). Owner: WP-08.
 *
 * In the browser: the studio worker (`../worker/studio.worker.ts`), so the main thread only paints
 * and takes input. Without workers (tests, very old browsers): in the page, same events.
 */
import type { CityTile, JobEnd, StageId } from '@ibasho/core';
import type { WorkerIn, WorkerOut } from '../worker/studio.worker.ts';
import { type JobHandle, type RunEvent, runPreviewJob, type StageInputs } from './runner.ts';

let worker: Worker | null | undefined;
let sentTiles: readonly CityTile[] | undefined;
const listeners = new Map<string, { onEvent: (e: RunEvent) => void; resolve: (e: JobEnd) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker =
      typeof Worker === 'undefined' || typeof window === 'undefined'
        ? null
        : new Worker(new URL('../worker/studio.worker.ts', import.meta.url), {
            type: 'module',
            name: 'studio',
          });
  } catch {
    worker = null;
  }
  worker?.addEventListener('message', (e: MessageEvent<WorkerOut>) => {
    const m = e.data;
    const id = m.type === 'event' ? m.event.jobId : m.end.jobId;
    const l = listeners.get(id);
    if (!l) return;
    if (m.type === 'event') l.onEvent(m.event);
    else {
      listeners.delete(id);
      l.resolve(m.end);
    }
  });
  worker?.addEventListener('error', () => {
    // A broken worker falls back to running in the page.
    worker = null;
  });
  return worker;
}

export function startJob(
  jobId: string,
  generation: number,
  stages: readonly StageId[],
  inputs: StageInputs,
  onEvent: (e: RunEvent) => void,
  deviceFactor: number,
): JobHandle {
  const w = getWorker();
  if (!w) return runPreviewJob(jobId, generation, stages, inputs, onEvent, deviceFactor);
  if (inputs.tiles.length && sentTiles !== inputs.tiles) {
    sentTiles = inputs.tiles;
    w.postMessage({ type: 'tiles', tiles: [...inputs.tiles] } satisfies WorkerIn);
  }
  const { tiles, ...rest } = inputs;
  const done = new Promise<JobEnd>((resolve) => listeners.set(jobId, { onEvent, resolve }));
  w.postMessage({
    type: 'run',
    jobId,
    generation,
    stages: [...stages],
    inputs: { ...rest, useTiles: tiles.length > 0 },
    deviceFactor,
  } satisfies WorkerIn);
  return {
    jobId,
    cancel: () => w.postMessage({ type: 'cancel', jobId } satisfies WorkerIn),
    done,
  };
}
