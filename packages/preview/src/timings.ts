/**
 * Recorded stage timings for the Preview replay (SPEC 19): milliseconds at Standard resolution
 * on the reference laptop for GB1 (about 20,000 m²), from the SD and SO brief budgets. Other
 * buildings scale with the square root of floor area; resolution and the device factor scale
 * on top. Rough appears at 25% of the stage time and refined at 60%.
 */
import type { StageId } from '@ibasho/core';

export const STAGE_MS: Readonly<Record<StageId, number>> = {
  geometry: 400,
  sun: 2200,
  radiation: 3200,
  daylight: 4200,
  energy: 2600,
  codes: 900,
  optimise: 5200,
};

export const TIER_AT = { rough: 0.25, refined: 0.6, final: 1 } as const;

const RES = { sketch: 0.4, standard: 1, fine: 2.2 } as const;

/** Stage duration in ms for a building of `gfaM2` at a resolution and device factor. */
export function stageMs(
  stage: StageId,
  gfaM2: number,
  level: keyof typeof RES,
  deviceFactor: number,
): number {
  const size = Math.min(1.6, Math.max(0.3, Math.sqrt(Math.max(1, gfaM2) / 20_000)));
  const site = stage === 'sun' || stage === 'radiation' || stage === 'daylight' ? RES[level] : 1;
  return Math.round((STAGE_MS[stage] as number) * size * site * deviceFactor);
}
