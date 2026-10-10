/**
 * The plugin set one search runs with, resolved from the kernel registry. Owner: WP-02.
 */
import {
  type CarbonPack,
  type CarbonTrajectory,
  compareStrings,
  type EpcProxy,
  type FinancePlugin,
  type Fuel,
  type GrantPlugin,
  type HomeTwin,
  type IsoDate,
  type MaintenancePlugin,
  type MeasureCost,
  type MeasureModel,
  type PluginRegistry,
  type RulePackPlugin,
  type TariffPlugin,
  type ValueEvidencePlugin,
} from '@ibasho/core';
import type { PipelineConfig } from '../pipeline/index.ts';

export class SearchEnvError extends Error {
  override name = 'SearchEnvError';
}

export interface SearchEnv {
  pipeline: PipelineConfig;
  measures: readonly MeasureModel[];
  costs: ReadonlyMap<string, MeasureCost>;
  tariffs: ReadonlyMap<Fuel, TariffPlugin>;
  carbon: CarbonPack;
  trajectory: CarbonTrajectory;
  grants: readonly GrantPlugin[];
  rulePacks: readonly RulePackPlugin[];
  value?: ValueEvidencePlugin;
  /** Finance products in force (T1: the loan stub), sorted by id. */
  finance: readonly FinancePlugin[];
  /** The `epc-proxy` plugin for the rating band (at most one in force). */
  epcProxy?: EpcProxy;
  /** Decay models for the "If nothing is done" run (SPEC 14), sorted by id. */
  maintenance: readonly MaintenancePlugin[];
  /** Option ids the search may use (all registered options when absent). */
  allowOptions?: readonly string[];
  /** Registry fingerprint of the engine plugins in force (part of the result hash). */
  fingerprint: string;
}

function one<T extends { id: string }>(xs: readonly T[], what: string, q: string): T {
  if (xs.length === 0) throw new SearchEnvError(`no ${what} plugin for ${q}`);
  if (xs.length > 1) {
    throw new SearchEnvError(
      `${xs.length} ${what} plugins for ${q} (${xs.map((x) => x.id).join(', ')}); exactly one is needed`,
    );
  }
  return xs[0]!;
}

/**
 * Resolve every plugin for a twin's region on `asOf`. One tariff per fuel, one carbon pack, one
 * trajectory and at most one value table may be in force; more is an error (no silent choice).
 */
export function envFromRegistry(
  reg: PluginRegistry,
  twin: HomeTwin,
  asOf: IsoDate,
  allowOptions?: readonly string[],
): SearchEnv {
  const q = { region: twin.region, asOf };
  const where = `${twin.region} on ${asOf}`;
  const climate = reg.get('climate', twin.climatePackId);
  const measures = reg.all('measure', q);
  const costs = new Map<string, MeasureCost>();
  for (const c of reg.all('measure-cost', q)) {
    if (costs.has(c.optionId)) throw new SearchEnvError(`two measure-cost plugins for ${c.optionId}`);
    costs.set(c.optionId, c);
  }
  const tariffs = new Map<Fuel, TariffPlugin>();
  for (const t of reg.all('tariff', q)) {
    if (tariffs.has(t.fuel)) throw new SearchEnvError(`two tariffs for ${t.fuel} for ${where}`);
    tariffs.set(t.fuel, t);
  }
  const values = reg.all('value-evidence', q);
  if (values.length > 1) throw new SearchEnvError(`two value tables for ${where}`);
  const proxies = reg.all('epc-proxy', q);
  if (proxies.length > 1) throw new SearchEnvError(`two EPC proxies for ${where}`);
  const byId = <T extends { id: string }>(xs: readonly T[]) =>
    [...xs].sort((a, b) => compareStrings(a.id, b.id));
  const env: SearchEnv = {
    pipeline: { climate, measures, systems: reg.all('system', q) },
    measures,
    costs,
    tariffs,
    carbon: one(reg.all('carbon', q), 'carbon', where),
    trajectory: one(reg.all('carbon-trajectory', q), 'carbon-trajectory', where),
    grants: reg.all('grant', q),
    rulePacks: byId(reg.all('rule-pack', q)),
    finance: byId(reg.all('finance', q)),
    maintenance: byId(reg.all('maintenance', q)),
    fingerprint: reg.fingerprint({ side: 'engine' }),
  };
  if (values[0]) env.value = values[0];
  if (proxies[0]) env.epcProxy = proxies[0];
  if (allowOptions) env.allowOptions = allowOptions;
  return env;
}
