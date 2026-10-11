/**
 * Named design parameter presets for studio levers, with the same values the Preview optimiser
 * turns (estimates until WP-18 reads products from the packs). Merge the ones a variant picks
 * into `StageIn.energy.params`.
 */
import type { CompiledBuilding, EnergyParams } from '@ibasho/core';

export const PARAM_PRESETS = {
  /** Low-e double glazing. */
  glazing: { 'low-e': { shgc: 0.3, uWin: 2.8 } },
  /** Cool white roof finish. */
  roof: { cool: { roofAbsorptance: 0.3 } },
  /** Insulated wall at the ECSBC reference U-value. */
  wall: { insulated: { uWall: 0.4 } },
  /** LED retrofit. */
  lighting: { led: { lpdScale: 0.65 } },
  /** Daylight dimming controls. */
  daylight: { on: { daylightControls: true } },
} as const satisfies Record<string, Record<string, EnergyParams>>;

/** Rooftop PV in kWp for a share of the roof (0 to 1), at 6.5 m² per kWp. */
export function pvKwpFor(compiled: CompiledBuilding, roofShare: number): number {
  const roofM2 = Number(compiled.quantities.roofMm2) / 1e6;
  return Math.floor((roofM2 * Math.max(0, Math.min(1, roofShare))) / 6.5);
}
