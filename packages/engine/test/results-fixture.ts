/**
 * The committed GH1 M-0 search fixture (`packages/fixtures/src/results/gh1-m0.search.json`), built
 * from a real search. Owner: WP-02. Regenerate with `pnpm --filter @ibasho/engine gen:results`;
 * `test/results.test.ts` fails when the file drifts from the engine.
 *
 * Contents: the request context, the result hash, the package table (integers as decimal strings),
 * front, picks, needs-check lane and the full `ibasho.cert/2` certificate input for WP-04's checker
 * and mirror. PLACEHOLDER until M-B: the real-scale `gh1.search.json` (10,800 packages).
 */
import { canonicalJson, PACKAGE_STATUS, type SearchResult } from '@ibasho/core';
import { ASOF, readyEngine, request } from './gh1.ts';

const STATUS_NAME = Object.fromEntries(Object.entries(PACKAGE_STATUS).map(([k, v]) => [v, k]));

export const RESULTS_FIXTURE_PATH = '../../packages/fixtures/src/results/gh1-m0.search.json';

export async function buildGh1M0Results(): Promise<{ json: string; result: SearchResult }> {
  const engine = await readyEngine();
  const req = request();
  const result = await (await engine.search(req)).result;
  const p = result.packages;
  const doc = {
    schema: 'ibasho.results-fixture/1',
    note: 'GH1, M-0 slice (loft-300, draught, heat-ashp), no budget, default target. Generated; do not edit.',
    asOf: ASOF,
    hash: result.hash,
    specHash: result.specHash,
    owner: {
      tenure: req.owner.tenure,
      discountRatePpb: req.owner.discountRatePpb.toString(),
      horizonYears: req.owner.horizonYears,
    },
    packages: p.ids.map((id, r) => ({
      row: r,
      id,
      heavyKey: result.heavy.keys[p.heavyIdx[r]!],
      status: STATUS_NAME[p.status[r]!],
      n0MicroPence: p.n0[r]!.toString(),
      npvMicroPence: p.npv[r]!.toString(),
      lifetimeCarbonSavedG: p.carbonSaved[r]!.toString(),
      witness: p.witness[r] === 0xffffffff ? null : p.witness[r],
      ruleIds: p.ruleIds[r],
    })),
    front: [...result.front],
    picks: result.picks,
    needsCheck: [...result.needsCheck],
    certificate: result.certificate,
  };
  return { json: `${JSON.stringify(JSON.parse(canonicalJson(doc)), null, 2)}\n`, result };
}
