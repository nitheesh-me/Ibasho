/**
 * Studio worker (review B-B2, ARCH 15.5): runs the stage jobs off the main thread so the page keeps
 * painting while Preview stages compute. Owner: WP-08.
 *
 * Messages in: `tiles` (once, the city pack), `run` (a job), `cancel`. Messages out: `event`
 * (stage progress with the view, evidence and core output) and `end`.
 */
import type { CityTile, JobEnd, StageId } from '@ibasho/core';
import { type JobHandle, type RunEvent, runPreviewJob, type StageInputs } from '../preview/runner.ts';

export type WorkerIn =
  | { type: 'tiles'; area: string; tiles: CityTile[] }
  | {
      type: 'run';
      jobId: string;
      generation: number;
      stages: StageId[];
      /** City area whose tiles this job reads (sent once per area), or absent for none. */
      inputs: Omit<StageInputs, 'tiles'> & { area?: string };
      deviceFactor: number;
    }
  | { type: 'cancel'; jobId: string };

export type WorkerOut = { type: 'event'; event: RunEvent } | { type: 'end'; end: JobEnd };

const scope = self as unknown as {
  postMessage(m: WorkerOut): void;
  onmessage: ((e: MessageEvent<WorkerIn>) => void) | null;
};
/** Tiles per city area: two plots in two cities can run side by side. */
const areas = new Map<string, CityTile[]>();
const jobs = new Map<string, JobHandle>();

scope.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'tiles') {
    areas.set(m.area, m.tiles);
    return;
  }
  if (m.type === 'cancel') {
    jobs.get(m.jobId)?.cancel();
    return;
  }
  const { area, ...rest } = m.inputs;
  const handle = runPreviewJob(
    m.jobId,
    m.generation,
    m.stages,
    { ...rest, tiles: area ? (areas.get(area) ?? []) : [] },
    (event) => scope.postMessage({ type: 'event', event }),
    m.deviceFactor,
  );
  jobs.set(m.jobId, handle);
  void handle.done.then((end) => {
    jobs.delete(m.jobId);
    scope.postMessage({ type: 'end', end });
  });
};
