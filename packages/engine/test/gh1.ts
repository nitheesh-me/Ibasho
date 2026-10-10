/**
 * GH1 test wiring for the engine search tests (WP-02). Tests may wire packs, engine and fixtures
 * together (dependency-cruiser exempts tests).
 */
import {
  type AnyPlugin,
  createRegistry,
  type HomeTwin,
  type OwnerCtx,
  type SearchRequest,
} from '@ibasho/core';
import { parseTwin } from '@ibasho/core/schemas';
import gh1Json from '../../../packages/fixtures/src/homes/gh1.twin.json' with { type: 'json' };
import climateEngineModule from '../../../packs/climate/src/engine/module.ts';
import homeUkEngineModule from '../../../packs/home-uk/src/engine/module.ts';
import moneyUkEngineModule from '../../../packs/money-uk/src/engine/module.ts';
import rulesUkEngineModule from '../../../packs/rules-uk/src/engine/module.ts';
import { createEngine, type Engine, type EngineOptions } from '../src/api.ts';
import { M0_OPTION_IDS } from '../src/search/plan.ts';

export const gh1: HomeTwin = parseTwin(gh1Json);
export const ASOF = '2026-10-11' as const;
export const owner: OwnerCtx = { tenure: 'owner', discountRatePpb: 35_000_000n, horizonYears: 25 };
export const MODULES = [climateEngineModule, homeUkEngineModule, moneyUkEngineModule, rulesUkEngineModule];

export async function allPlugins(): Promise<AnyPlugin[]> {
  const out: AnyPlugin[] = [];
  for (const m of MODULES) out.push(...(await m.load()));
  return out;
}

export function request(over: Partial<SearchRequest> = {}): SearchRequest {
  return {
    twin: gh1,
    owner,
    target: { kind: 'default' },
    memory: { rejected: [], completed: [] },
    asOf: ASOF,
    ...over,
  };
}

/** A ready engine over the four M-0 engine modules, loaded through `init` like the worker. */
export async function readyEngine(opts: EngineOptions = {}, allOptions = false): Promise<Engine> {
  const plugins = await allPlugins();
  const shared = createRegistry();
  shared.registerAll(plugins);
  const engine = createEngine({
    ...(allOptions ? {} : { allowOptions: M0_OPTION_IDS }),
    ...opts,
    modules: MODULES.map((m) => ({ id: m.id, load: async () => ({ default: m }) })),
  });
  await engine.init(
    MODULES.map((m) => m.id),
    shared.fingerprint({ side: 'both' }),
  );
  return engine;
}
