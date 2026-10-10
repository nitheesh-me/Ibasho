/**
 * Writes `packages/fixtures/src/results/gh1-m0.search.json` from a real search (WP-02).
 * Run: `pnpm --filter @ibasho/engine gen:results`.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildGh1M0Results, RESULTS_FIXTURE_PATH } from '../test/results-fixture.ts';

const out = fileURLToPath(new URL(`../${RESULTS_FIXTURE_PATH}`, import.meta.url));
const { json, result } = await buildGh1M0Results();
writeFileSync(out, json);
console.log(`wrote ${out} (hash ${result.hash}, ${result.packages.ids.length} packages)`);
