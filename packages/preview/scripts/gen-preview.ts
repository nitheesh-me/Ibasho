/**
 * Records the Preview fixtures (WP-13): runs the seven Preview stages on each golden building and
 * writes `packages/fixtures/src/preview/<id>/<stage>.json` (wire JSON, bigints as strings) plus
 * `timings.json`. Run: `pnpm --filter @ibasho/preview gen:preview`. Deterministic; the tests
 * recompute and compare byte for byte.
 */
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { STUDIO_STAGES } from '@ibasho/core';
import { toWireJson } from '@ibasho/core/schemas';
import { runPreviewJob, setPreviewTimer, stageMs } from '../src/index.ts';
import { AS_OF, FIXTURE_BUILDINGS, fixtureInputs, PREVIEW_DIR } from './fixture-inputs.ts';

setPreviewTimer(async () => {});

for (const id of FIXTURE_BUILDINGS) {
  const inputs = fixtureInputs(id);
  const { place } = inputs;
  const t0 = performance.now();
  const { end, outputs } = await runPreviewJob(
    {
      jobId: `rec_${id}`,
      generation: 1,
      placeId: place.id,
      buildingId: id,
      stages: [...STUDIO_STAGES],
      resolution: 'standard',
      asOf: AS_OF,
    },
    inputs,
    () => {},
    { deviceFactor: 0 },
  );
  if (end.status !== 'done') throw new Error(`${id}: ${end.status}`);
  const dir = join(PREVIEW_DIR, id);
  mkdirSync(dir, { recursive: true });
  for (const s of STUDIO_STAGES) {
    const p = join(dir, `${s}.json`);
    writeFileSync(`${p}.tmp`, `${toWireJson(outputs[s])}\n`);
    renameSync(`${p}.tmp`, p);
  }
  const gfa = Number(outputs.geometry?.quantities.gfaMm2 ?? 0n) / 1e6;
  const timings = Object.fromEntries(STUDIO_STAGES.map((s) => [s, stageMs(s, gfa, 'standard', 1)]));
  writeFileSync(
    join(dir, 'timings.json'),
    `${JSON.stringify({ resolution: 'standard', deviceFactor: 1, ms: timings }, null, 2)}\n`,
  );
  const e = outputs.energy;
  const opt = outputs.optimise;
  console.log(
    id,
    `gfa ${gfa.toFixed(0)} m2`,
    `EUI ${e?.eui.site.lo}-${e?.eui.site.hi}`,
    `bill ${e?.bills.map((b) => `${b.carrier} ${(Number(b.total) / 1e8).toFixed(0)} ${b.currency}`).join(', ')}`,
    `front ${opt?.front.length}/${opt?.tried}`,
    `codes ${outputs.codes?.codes.length}`,
    `${(performance.now() - t0).toFixed(0)} ms`,
  );
}
