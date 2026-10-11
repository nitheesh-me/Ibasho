/**
 * Stage ids, tiers and the Preview versus real stamp (ARCH 15.4, 15.5, SPEC 19, R26).
 * Owner: WP-00. Leaf module so every result type can carry a stamp without import cycles.
 */
import type { IsoDate, MessageKey } from '../common.ts';

/** Analysis stages in progress-bar order (SPEC 19). Narration follows and never blocks a number. */
export type StageId = 'geometry' | 'sun' | 'radiation' | 'daylight' | 'energy' | 'codes' | 'optimise';
export const STUDIO_STAGES: readonly StageId[] = [
  'geometry',
  'sun',
  'radiation',
  'daylight',
  'energy',
  'codes',
  'optimise',
];

/** Rough results appear first and sharpen in place. */
export type Tier = 'rough' | 'refined' | 'final';
export const TIERS: readonly Tier[] = ['rough', 'refined', 'final'];

/** `preview` replays fixtures (never sealed); `real` computes. */
export type StageImpl = 'preview' | 'real';

/** Per stage display metadata for the staged bar (WP-06 `StageBar`, WP-08). */
export interface StageMeta {
  id: StageId;
  /** Bead label and "what it is doing" line. */
  label: MessageKey;
  doing: MessageKey;
  /** Stages whose outputs this stage reads (the change-propagation graph). */
  after: readonly StageId[];
}
export const STAGE_META: readonly StageMeta[] = [
  { id: 'geometry', label: 'studio.stage.geometry', doing: 'studio.stage.geometry.doing', after: [] },
  { id: 'sun', label: 'studio.stage.sun', doing: 'studio.stage.sun.doing', after: ['geometry'] },
  {
    id: 'radiation',
    label: 'studio.stage.radiation',
    doing: 'studio.stage.radiation.doing',
    after: ['geometry', 'sun'],
  },
  {
    id: 'daylight',
    label: 'studio.stage.daylight',
    doing: 'studio.stage.daylight.doing',
    after: ['geometry', 'sun'],
  },
  {
    id: 'energy',
    label: 'studio.stage.energy',
    doing: 'studio.stage.energy.doing',
    after: ['geometry', 'radiation'],
  },
  {
    id: 'codes',
    label: 'studio.stage.codes',
    doing: 'studio.stage.codes.doing',
    after: ['geometry', 'energy'],
  },
  {
    id: 'optimise',
    label: 'studio.stage.optimise',
    doing: 'studio.stage.optimise.doing',
    after: ['geometry', 'energy', 'codes'],
  },
];

/** Index of a stage on the bar (0 for geometry). */
export function stageIndex(s: StageId): number {
  return STUDIO_STAGES.indexOf(s);
}

/**
 * Stages to rerun when `changed` stages have new inputs: the changed ones and every stage
 * downstream of them, in bar order (SPEC 18.5). The caller names the stages whose own inputs
 * changed, e.g. `energy` for a tariff edit, `geometry` for a window edit.
 */
export function downstreamStages(changed: readonly StageId[]): StageId[] {
  const out = new Set<StageId>(changed);
  for (const m of STAGE_META) {
    if (m.after.some((a) => out.has(a))) out.add(m.id);
  }
  return STUDIO_STAGES.filter((s) => out.has(s));
}

/**
 * Where a stored result came from. Preview stamps are shown on every number they reach
 * (AC-PG3) and keep `verify` from sealing (R26).
 */
export interface ResultStamp {
  impl: StageImpl;
  providers: { stage: StageId; id: string; version: string; impl: StageImpl }[];
  tier: Tier;
  computedAt: IsoDate;
}

/** True when any stage that fed the result was a Preview provider. */
export function isPreview(stamp: ResultStamp): boolean {
  return stamp.impl === 'preview' || stamp.providers.some((p) => p.impl === 'preview');
}
