/**
 * Studio job runner (SPEC 19, ARCH 15.5). Owner: WP-08.
 *
 * Runs agent A's Preview stages (`@ibasho/preview` compute functions, the same code its stage
 * providers run) in bar order, threading outputs into the next stage and reusing `previous`
 * outputs for stages the change did not touch (a tariff edit starts at `codes`). Timings follow
 * `stageMs` (recorded on the reference laptop, scaled by size, resolution and device). Each stage
 * emits a rough result early, a refined one, then the final; cancel returns within one tick
 * (100 ms; the worker will slice at 50 ms). Newer generations supersede older ones in the store.
 *
 * Main thread for V-P. Open item: move the loop into the engine worker (`StudioApi.runJob`).
 */
import type {
  BuildingDoc,
  CityTile,
  IsoDate,
  JobEnd,
  Place,
  ResolutionLevel,
  ScopedGoal,
  Setting,
  SiteContext,
  StageId,
  StageOut,
  Tier,
} from '@ibasho/core';
import { DEFAULT_OBJECTIVES } from '@ibasho/core';
import {
  computeCodes,
  computeEnergy,
  computeGeometry,
  computeOptimise,
  computeSite,
  PREVIEW_SETTING_DEFS,
  RESOLUTIONS,
  stageMs,
} from '@ibasho/preview';
import type { Levers, SettingValues } from './settings.ts';
import { energyParams } from './variant.ts';
import { type StageResult, viewFor } from './views.ts';

export interface StageInputs {
  key: string;
  placeId: string;
  variantId: string;
  doc: BuildingDoc;
  place: Place;
  tiles: readonly CityTile[];
  levers: Levers;
  settings: SettingValues;
  resolution: ResolutionLevel;
  asOf: string;
  previous?: Partial<StageOut>;
  /** Targets from a design brief (SPEC 27): the codes stage reports a gap for each. */
  goals?: ScopedGoal[];
  /** Pack context ids this building replaces (HERO_CONTEXT_IDS). */
  replacedIds?: readonly string[];
}

export interface RunEvent {
  jobId: string;
  generation: number;
  stage: StageId;
  fraction: number;
  tier?: Tier;
  etaMs: number;
  message: string;
  result?: StageResult<StageId>;
  output?: StageOut[StageId];
  status: 'running' | 'done';
}

export interface JobHandle {
  jobId: string;
  cancel(): void;
  done: Promise<JobEnd>;
}

const TICK = 100;

/** Short stage names for progress sentences (worker side: no UI imports). */
const STAGE_WORD: Record<StageId, string> = {
  geometry: 'Geometry',
  sun: 'Sun hours',
  radiation: 'Radiation',
  daylight: 'Daylight',
  energy: 'Energy',
  codes: 'Codes',
  optimise: 'Search',
};

const doing: Record<StageId, string> = {
  geometry: 'Reading the plan',
  sun: 'Tracing the sun past the neighbours',
  radiation: 'Adding up the sky on every facade',
  daylight: 'Lighting each floor',
  energy: 'Running the year, hour by hour',
  codes: 'Checking codes and ratings',
  optimise: 'Trying bundles of changes',
};

/** Studio setting values to the core `Setting[]` the stages read (Preview defaults otherwise). */
export function coreSettings(values: SettingValues): Setting[] {
  return PREVIEW_SETTING_DEFS.map((d) => ({
    ...d.default,
    ...(values[d.id] !== undefined ? { value: values[d.id] } : {}),
    scope: 'app' as const,
    origin:
      values[d.id] !== undefined && values[d.id] !== d.default.value
        ? ('user' as const)
        : ('default' as const),
  }));
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('cancelled', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('cancelled', 'AbortError'));
      },
      { once: true },
    );
  });
}

/** One stage at one tier, in the core contract. */
export function computeOne(
  stage: StageId,
  inp: StageInputs,
  out: Partial<StageOut>,
  tier: Tier,
): StageOut[StageId] {
  const asOf = inp.asOf.slice(0, 10) as IsoDate;
  const site: SiteContext = {
    place: inp.place,
    tiles: [...inp.tiles],
    weatherHash: inp.place.climatePackId,
    ...(inp.replacedIds?.length ? { replacedIds: [...inp.replacedIds] } : {}),
  };
  const resolution = RESOLUTIONS[inp.resolution];
  const settings = coreSettings(inp.settings);
  const need = <K extends StageId>(k: K): StageOut[K] => {
    const v = out[k];
    if (v === undefined) throw new Error(`stage ${stage} needs ${k}`);
    return v;
  };
  switch (stage) {
    case 'geometry':
      return computeGeometry({ doc: inp.doc, packsFingerprint: 'preview' }, tier);
    case 'sun':
      return computeSite('sun', { compiled: need('geometry'), site, resolution }, tier, asOf);
    case 'radiation':
      return computeSite(
        'radiation',
        { compiled: need('geometry'), site, resolution, sun: need('sun') },
        tier,
        asOf,
      );
    case 'daylight':
      return computeSite(
        'daylight',
        { compiled: need('geometry'), site, resolution, sun: need('sun') },
        tier,
        asOf,
      );
    case 'energy': {
      const radiation = out.radiation;
      const compiled = need('geometry');
      const params = energyParams(inp.levers, compiled);
      return computeEnergy(
        {
          compiled,
          ...(radiation ? { radiation } : {}),
          site,
          settings,
          asOf,
          ...(Object.keys(params).length ? { params } : {}),
        },
        tier,
      );
    }
    case 'codes': {
      const daylight = out.daylight;
      return computeCodes(
        {
          compiled: need('geometry'),
          doc: inp.doc,
          energy: need('energy'),
          ...(daylight ? { daylight } : {}),
          site,
          codePackIds: inp.place.codePackIds,
          ...(inp.goals?.length ? { goals: inp.goals } : {}),
          asOf,
        },
        tier,
      );
    }
    default:
      return computeOptimise(
        {
          compiled: need('geometry'),
          doc: inp.doc,
          energy: out.codes?.result ?? need('energy'),
          goals: inp.goals ?? [],
          objectives: [...DEFAULT_OBJECTIVES],
          space: [],
          site,
          settings,
          seed: `${inp.key}`,
          asOf,
        },
        tier,
      );
  }
}

export function runPreviewJob(
  jobId: string,
  generation: number,
  stages: readonly StageId[],
  inputs: StageInputs,
  onEvent: (e: RunEvent) => void,
  deviceFactor = 1,
): JobHandle {
  const ctl = new AbortController();
  const out: Partial<StageOut> = { ...inputs.previous };
  const done = (async (): Promise<JobEnd> => {
    try {
      for (const stage of stages) {
        const gfa = out.geometry ? Number(out.geometry.quantities.gfaMm2) / 1e6 : 10_000;
        const total = Math.max(TICK * 2, stageMs(stage, gfa, inputs.resolution, deviceFactor));
        const marks: [number, Tier][] =
          stage === 'geometry' || stage === 'codes'
            ? [[1, 'final']]
            : [
                [0.3, 'rough'],
                [0.65, 'refined'],
                [1, 'final'],
              ];
        let t = 0;
        let next = 0;
        while (t < total) {
          await sleep(TICK, ctl.signal);
          t += TICK;
          const fraction = Math.min(1, t / total);
          let tier: Tier | undefined;
          // Several tiers can fall in one tick on a fast device: emit the highest reached.
          for (let m = marks[next]; m && fraction >= m[0]; m = marks[next]) {
            tier = m[1];
            next++;
          }
          let result: StageResult<StageId> | undefined;
          let output: StageOut[StageId] | undefined;
          if (tier) {
            output = computeOne(stage, inputs, out, tier);
            if (tier === 'final') (out as Record<string, unknown>)[stage] = output;
            result = viewFor(
              stage,
              {
                key: inputs.key,
                placeId: inputs.placeId,
                variantId: inputs.variantId,
                doc: inputs.doc,
                tier,
                outputs: { ...out, [stage]: output },
              },
              output,
            );
          }
          const eta = Math.max(0, total - t);
          const secs = Math.max(1, Math.round(eta / 1000));
          const message =
            tier === 'rough'
              ? `${STAGE_WORD[stage]}: rough now, final in about ${secs} s`
              : tier === 'refined'
                ? `${STAGE_WORD[stage]}: refining`
                : doing[stage];
          onEvent({
            jobId,
            generation,
            stage,
            fraction,
            ...(tier ? { tier } : {}),
            etaMs: eta,
            message,
            ...(result ? { result } : {}),
            ...(output !== undefined ? { output } : {}),
            status: fraction >= 1 ? 'done' : 'running',
          });
        }
      }
      return { jobId, generation, status: 'done' };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError')
        return { jobId, generation, status: 'cancelled' };
      console.error(e);
      return { jobId, generation, status: 'failed', error: e instanceof Error ? e.message : String(e) };
    }
  })();
  return { jobId, cancel: () => ctl.abort(), done };
}

/**
 * Headline energy for a document under some settings, computed at once (geometry then energy,
 * no site stages): Revisit's before and after and the settings impact preview (SPEC 18.2, 24).
 */
export function headline(inp: StageInputs): StageResult<'energy'> {
  // One function for every headline (review A-M3): reuse the job's geometry and radiation when known.
  const out: Partial<StageOut> = {
    ...(inp.previous?.geometry ? { geometry: inp.previous.geometry } : {}),
    ...(inp.previous?.radiation ? { radiation: inp.previous.radiation } : {}),
  };
  if (!out.geometry) out.geometry = computeOne('geometry', inp, out, 'final') as StageOut['geometry'];
  const energy = computeOne('energy', inp, out, 'final') as StageOut['energy'];
  return viewFor(
    'energy',
    {
      key: inp.key,
      placeId: inp.placeId,
      variantId: inp.variantId,
      doc: inp.doc,
      tier: 'final',
      outputs: out,
    },
    energy,
  );
}
