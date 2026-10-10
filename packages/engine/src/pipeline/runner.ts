/**
 * Pipeline runner (BUILD_PLAN 2: WP-01 owns stage order, the light path, quantisation and
 * evidence id assignment). Owner: WP-01.
 *
 * Stage order is core `STAGE_ORDER`. The heavy path runs geometry to dhw (everything that changes
 * demand); the light path runs systems, renewables and delivered on a cached heavy run. A full
 * simulation is exactly heavy then light on the same twin, so the light path reproduces it
 * bit for bit whenever the light twin differs from the heavy twin only on light paths
 * (`isLightPath`), which is the factorisation assumption of ARCH 6.
 *
 * Climate: `rating` runs on `cfg.ratingClimate` (SAP 10.2 Appendix U, UK average) when given;
 * the other modes run on `cfg.climate`, which must match the twin's `climatePackId`.
 * Heat pumps: the systems stage needs the design heat loss of the run's twin and of the home
 * before the package (`opts.baseTwin`, the emitter sizing basis, BP 3.10 step 3). `simulate` sets
 * `baseTwin` itself; callers of `runHeavy` and `runLight` pass it (absent means the run's own twin
 * is the base, which is right for baseline runs only).
 *
 * Evidence: stages emit drafts with keys unique within one run. The runner namespaces keys per
 * (package, mode) run and assigns ids through the core evidence graph builder
 * (`evidenceId(quantity, subject)`, deterministic). Seals start `unverified`; `verify` decides them.
 */
import {
  type ClimatePack,
  type CoolingMonthly,
  canonicalHash,
  createEvidenceGraphBuilder,
  type DemandMonthly,
  type DhwMonthly,
  type EvidenceDraft,
  type EvidenceGraph,
  type FabricOut,
  type GainsOut,
  type GeometryOut,
  type HomeTwin,
  type HourlyClimate,
  type IsoDate,
  type MeasureModel,
  type PackageSpec,
  type RunMode,
  type SimBundle,
  type SimFn,
  type SimResult,
  type StageCtx,
  type SystemPlugin,
  type TwinPatch,
  type VentOut,
} from '@ibasho/core';
import { floatDraft } from '../physics/common.ts';
import type { HeatLossIn, SystemsInExt } from '../physics/systems.ts';
import { quantiseWh } from '../physics/delivered.ts';
import { type GainsInWithHousehold, type Household, household } from '../physics/household.ts';
import {
  createDefaultStages,
  PHYSICS_DEFAULTS,
  type PhysicsDefaults,
  type StageSet,
} from '../physics/index.ts';
import { applyPatch, packagePatch, splitPatch } from './patch.ts';

export class PipelineError extends Error {
  override name = 'PipelineError';
}

export interface PipelineConfig {
  climate: ClimatePack;
  /** Climate for `rating` mode (SAP 10.2 Appendix U UK average). Absent: `climate`. */
  ratingClimate?: ClimatePack;
  /** Measure models used to turn a `PackageSpec` into a patch. */
  measures?: readonly MeasureModel[];
  /** System plugins supplying efficiencies the twin does not state. */
  systems?: readonly SystemPlugin[];
  physics?: Partial<PhysicsDefaults>;
  /** Replace stages (tests, later tiers). Defaults to `createDefaultStages`. */
  stages?: Partial<StageSet>;
}

export interface RunOpts {
  mode: RunMode;
  asOf: IsoDate;
  /** The package this run belongs to (evidence subject). Absent means `baseline`. */
  pkg?: PackageSpec;
  /** The home before the package (heat pump emitter basis). Absent: the run's own twin. */
  baseTwin?: HomeTwin;
}

/**
 * A climate pack may also expose its hourly data synchronously (local adapter until core
 * `ClimatePack` carries it; INTERFACES request). Used for EN 14825 bins and the 5R1C model.
 */
export type ClimateWithSyncHourly = ClimatePack & { hourlySync?: () => HourlyClimate };

/** Cached result of the heavy stages for one twin and mode. */
export interface HeavyRun {
  twin: HomeTwin;
  opts: RunOpts;
  household: Household;
  geometry: GeometryOut;
  fabric: FabricOut;
  vent: VentOut;
  gains: GainsOut;
  demand: DemandMonthly;
  cooling: CoolingMonthly;
  dhw: DhwMonthly;
  /** Namespaced drafts of the heavy stages. */
  drafts: EvidenceDraft[];
  /** Key prefix used for this run's drafts. */
  prefix: string;
  /** Un-namespaced keys produced by this run. */
  keys: ReadonlySet<string>;
}

export interface LightRun {
  result: SimResult;
  /** Namespaced drafts of the light stages. */
  drafts: EvidenceDraft[];
}

const stageCache = new WeakMap<PipelineConfig, StageSet>();

function stagesOf(cfg: PipelineConfig): StageSet {
  let s = stageCache.get(cfg);
  if (!s) {
    s = {
      ...createDefaultStages({ ...PHYSICS_DEFAULTS, ...cfg.physics }, cfg.systems ?? []),
      ...cfg.stages,
    } as StageSet;
    stageCache.set(cfg, s);
  }
  return s;
}

function prefixFor(opts: RunOpts): string {
  return `${opts.pkg?.id ?? 'baseline'}@${opts.mode}/`;
}

/** The climate a mode runs on. */
export function climateFor(mode: RunMode, cfg: PipelineConfig): ClimatePack {
  return mode === 'rating' && cfg.ratingClimate ? cfg.ratingClimate : cfg.climate;
}

function ctxFor(twin: HomeTwin, opts: RunOpts, cfg: PipelineConfig): StageCtx {
  if (twin.climatePackId !== cfg.climate.id) {
    throw new PipelineError(
      `twin ${twin.id} wants climate ${twin.climatePackId}, pipeline has ${cfg.climate.id}`,
    );
  }
  const climate = climateFor(opts.mode, cfg);
  if (climate.months.length !== 12) throw new PipelineError(`climate ${climate.id} needs 12 months`);
  const ctx: StageCtx = { mode: opts.mode, asOf: opts.asOf, climate, twin };
  if (opts.pkg) ctx.pkg = opts.pkg;
  return ctx;
}

/** Namespace draft keys; inputs resolve to `own` keys first, then to `outer` (heavy) keys. */
function namespace(
  drafts: readonly EvidenceDraft[],
  prefix: string,
  outer?: { prefix: string; keys: ReadonlySet<string> },
): EvidenceDraft[] {
  const own = new Set(drafts.flatMap((d) => (d.key !== undefined ? [d.key] : [])));
  const map = (k: string) => (own.has(k) || !outer?.keys.has(k) ? prefix + k : outer.prefix + k);
  return drafts.map((d) => {
    const out: EvidenceDraft = {
      ...d,
      inputs: d.inputs.map((i) => (i.key !== undefined ? { ...i, key: map(i.key) } : i)),
    };
    if (d.key !== undefined) out.key = prefix + d.key;
    return out;
  });
}

const DESIGN_INDOOR_C = 21;

/** Design heat loss H_d (21 - theta_e,d) in W from fabric and ventilation (BP 3.10 step 1). */
function designLossW(fabric: FabricOut, vent: VentOut, climate: ClimatePack): number {
  const hve = Math.max(...vent.hveWK);
  return (fabric.htrWK + hve) * (DESIGN_INDOOR_C - climate.design.thetaEdC);
}

const baseLossCache = new WeakMap<PipelineConfig, WeakMap<HomeTwin, number>>();

/**
 * Design heat loss of a twin on the home's own climate, W (no evidence). Cached per config and
 * twin object, so the factorised search pays for it once per home.
 */
export function designHeatLossW(twin: HomeTwin, cfg: PipelineConfig): number {
  let byTwin = baseLossCache.get(cfg);
  if (!byTwin) {
    byTwin = new WeakMap();
    baseLossCache.set(cfg, byTwin);
  }
  const hit = byTwin.get(twin);
  if (hit !== undefined) return hit;
  const st = stagesOf(cfg);
  const ctx = ctxFor(twin, { mode: 'standard', asOf: '2026-01-01' }, cfg);
  const geometry = st.geometry.run(twin, ctx).output;
  const fabric = st.fabric.run(geometry, ctx).output;
  const vent = st.ventilation.run(geometry, ctx).output;
  const w = designLossW(fabric, vent, cfg.climate);
  byTwin.set(twin, w);
  return w;
}

function heatLossIn(heavy: HeavyRun, cfg: PipelineConfig, base: HomeTwin): HeatLossIn {
  const own = cfg.climate as ClimateWithSyncHourly;
  const out: HeatLossIn = {
    designLossW: designLossW(heavy.fabric, heavy.vent, cfg.climate),
    designLossBaseW: designHeatLossW(base, cfg),
    thetaEdC: cfg.climate.design.thetaEdC,
    months: cfg.climate.months,
    volumeM3: heavy.geometry.volumeM3,
  };
  if (own.hourlySync) out.hourly = own.hourlySync();
  return out;
}

/** Run geometry to dhw on a twin that already carries the heavy part of its package. */
export function runHeavy(twin: HomeTwin, opts: RunOpts, cfg: PipelineConfig): HeavyRun {
  const st = stagesOf(cfg);
  const ctx = ctxFor(twin, opts, cfg);
  const drafts: EvidenceDraft[] = [];
  const take = <T>(r: { output: T; evidence: EvidenceDraft[] }): T => {
    drafts.push(...r.evidence);
    return r.output;
  };
  const geometry = take(st.geometry.run(twin, ctx));
  const hh = household(opts.mode, geometry.tfaM2, ctx);
  drafts.push(
    floatDraft(
      ctx,
      'occ.n',
      hh.occupancyN,
      'persons',
      {
        id: opts.mode === 'your-home' ? 'twin' : 'SAP-1b',
        doc: opts.mode === 'your-home' ? 'stated occupants' : 'SAP 10.2 Table 1b occupancy',
      },
      { inputs: [{ key: 'geom.tfa', role: 'tfa' }] },
    ),
  );
  const fabric = take(st.fabric.run(geometry, ctx));
  const vent = take(st.ventilation.run(geometry, ctx));
  const gainsIn: GainsInWithHousehold = { geometry, fabric, occupancyN: hh.occupancyN, household: hh };
  const gains = take(st.gains.run(gainsIn, ctx));
  const balanceIn = { geometry, fabric, vent, gains };
  const demand = take(st['heat-balance'].run(balanceIn, ctx));
  const cooling = take(st.cooling.run(balanceIn, ctx));
  const dhw = take(st.dhw.run({ geometry, occupancyN: hh.occupancyN }, ctx));
  const prefix = prefixFor(opts);
  const keys = new Set(drafts.flatMap((d) => (d.key !== undefined ? [d.key] : [])));
  return {
    twin,
    opts,
    household: hh,
    geometry,
    fabric,
    vent,
    gains,
    demand,
    cooling,
    dhw,
    drafts: namespace(drafts, prefix),
    prefix,
    keys,
  };
}

/**
 * Run systems, renewables and delivered on a cached heavy run. `lightTwin` is the heavy twin with
 * the light part of the package applied; `opts` defaults to the heavy run's (same package).
 */
export function runLight(
  heavy: HeavyRun,
  lightTwin: HomeTwin,
  cfg: PipelineConfig,
  opts?: RunOpts,
): LightRun {
  const o = opts ?? heavy.opts;
  if (o.mode !== heavy.opts.mode)
    throw new PipelineError(`light run mode ${o.mode} on a ${heavy.opts.mode} heavy run`);
  const st = stagesOf(cfg);
  const ctx = ctxFor(lightTwin, o, cfg);
  const drafts: EvidenceDraft[] = [];
  const take = <T>(r: { output: T; evidence: EvidenceDraft[] }): T => {
    drafts.push(...r.evidence);
    return r.output;
  };
  const systemsIn: SystemsInExt = {
    demand: heavy.demand,
    cooling: heavy.cooling,
    dhw: heavy.dhw,
    systems: lightTwin.systems,
    household: heavy.household,
    heat: heatLossIn(heavy, cfg, o.baseTwin ?? heavy.opts.baseTwin ?? heavy.twin),
  };
  const systems = take(st.systems.run(systemsIn, ctx));
  const renew = take(
    st.renewables.run({ geometry: heavy.geometry, electricityKWh: systems.electricity }, ctx),
  );
  const deliveredWh = take(st.delivered.run({ systems, renew }, ctx));
  const exportWh = renew.exportKWh.map((k) => quantiseWh(k)) as unknown as SimResult['exportWh'];
  const result: SimResult = {
    mode: o.mode,
    homeId: lightTwin.id,
    packageId: o.pkg?.id ?? 'baseline',
    deliveredWh,
    exportWh,
    qhKWh: heavy.demand.qhKWh,
    qcKWh: heavy.cooling.qcKWh,
  };
  return { result, drafts: namespace(drafts, prefixFor(o), { prefix: heavy.prefix, keys: heavy.keys }) };
}

export interface SimRun {
  result: SimResult;
  heavy: HeavyRun;
  drafts: EvidenceDraft[];
}

/** One mode of one package: patch, heavy, light. */
export function simulate(
  req: { twin: HomeTwin; pkg?: PackageSpec; mode: RunMode; asOf: IsoDate },
  cfg: PipelineConfig,
): SimRun {
  const patch = req.pkg ? packagePatch(req.twin, req.pkg, cfg.measures ?? []) : { set: [] };
  const { heavy: hp, light: lp } = splitPatch(patch);
  const heavyTwin = applyPatch(req.twin, hp);
  const opts: RunOpts = { mode: req.mode, asOf: req.asOf, baseTwin: req.twin };
  if (req.pkg) opts.pkg = req.pkg;
  const heavy = runHeavy(heavyTwin, opts, cfg);
  const light = runLight(heavy, applyPatch(heavyTwin, lp), cfg);
  return { result: light.result, heavy, drafts: [...heavy.drafts, ...light.drafts] };
}

/** Several modes of one package, with their evidence graph. Hash covers the results only. */
export function simulateBundle(
  req: { twin: HomeTwin; pkg?: PackageSpec; modes: readonly RunMode[]; asOf: IsoDate },
  cfg: PipelineConfig,
  o: { evidence?: boolean } = {},
): SimBundle {
  const builder = createEvidenceGraphBuilder();
  const byMode: Partial<Record<RunMode, SimResult>> = {};
  for (const mode of [...new Set(req.modes)]) {
    const run = simulate({ twin: req.twin, mode, asOf: req.asOf, ...(req.pkg ? { pkg: req.pkg } : {}) }, cfg);
    byMode[mode] = run.result;
    if (o.evidence !== false) builder.addDrafts(run.drafts);
  }
  const graph: EvidenceGraph = builder.build();
  const hash = canonicalHash({ homeId: req.twin.id, packageId: req.pkg?.id ?? 'baseline', byMode });
  return { hash, byMode, graph };
}

/** A core `SimFn` (twin, patch, mode) for calibration, bound to a config and date. */
export function makeSimFn(cfg: PipelineConfig, asOf: IsoDate): SimFn {
  return (twin: HomeTwin, patch: TwinPatch, mode: RunMode) => {
    const patched = applyPatch(twin, patch);
    const heavy = runHeavy(patched, { mode, asOf }, cfg);
    return runLight(heavy, patched, cfg).result;
  };
}
