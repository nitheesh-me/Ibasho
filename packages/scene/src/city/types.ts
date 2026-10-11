/**
 * City stage data shapes that the v3 core contracts do not yet carry. Owner: WP-07.
 * Each is a candidate for `@ibasho/core` (requested on the blackboard, INTERFACES).
 */
import type { Mm, PointMm } from '@ibasho/core';
import type { ClaimSealProps } from '@ibasho/ui';

/** The scale ladder (PLAN-V3 5). */
export type ZoomLevel = 'city' | 'site' | 'building' | 'floor' | 'room';
export const ZOOM_LEVELS: readonly ZoomLevel[] = ['city', 'site', 'building', 'floor', 'room'];

/**
 * Lenses the city stage paints. `none` shows the paper model with live sun shadows.
 * `lanterns` is the night city (moment 8) and forces the Yoru look on the stage.
 */
export type CityLensId = 'none' | 'shadows' | 'sun-hours' | 'radiation' | 'daylight' | 'lanterns';

/**
 * A daylight point grid on one storey's work plane, in the building plan frame (moment 4).
 * `SiteResult.rooms` carries per room sDA and ASE; the grid is the map behind them.
 */
export interface DaylightGrid {
  buildingId: string;
  storeyId: string;
  /** Plan position of the corner of cell (0, 0). */
  originMm: PointMm;
  cellMm: Mm;
  cols: number;
  rows: number;
  /** Row major from the origin, plan +x then +y. sDA: percent of occupied hours at 300 lux or more; null outside rooms. */
  sda: readonly (number | null)[];
  /** ASE: hours above 1000 lux direct; null outside rooms. Over 250 h draws the warm hatch. */
  ase?: readonly (number | null)[];
  /** Pass threshold for a point (percent), 50 for sDA 300/50. */
  passPct?: number;
  workPlaneMm?: Mm;
}

/** Night lantern data (moment 8): only modelled buildings glow. */
export interface LanternDatum {
  /** Hero doc id, another doc id, or a context building id. */
  buildingId: string;
  /** Site EUI, kWh/m²·yr (central). */
  euiKwhM2: number;
  dominant: 'cooling' | 'lighting' | 'equipment';
  /** Optional 24 hourly load fractions (0 to 1) so the city breathes through a day. */
  hourly?: readonly number[];
}

/**
 * Phototropic variant (moment 6): a heliotropic PV canopy over the courts and shade seeking
 * fins. `t` runs 0 (as built) to 1 (the searched variant). `steps` are evaluated designs from the
 * optimise stage when present; without them the stage labels the bend an illustration.
 */
export interface PhototropicSpec {
  t: number;
  /** Canopy tilt towards the sun at t = 1, degrees (RB 7.2: about 15 to 18). */
  canopyTiltDeg?: number;
  /** Fin depth on low sun facades at t = 1, metres. */
  finDepthM?: number;
  steps?: readonly { t: number; euiKwhM2: number; label?: string }[];
  /** The steps come from Preview data: the strip says so and no seal presses. */
  preview?: boolean;
  /** The verified claim for the final step (real search only): the seal presses on it. */
  claim?: ClaimSealProps['claim'];
}

/** What a pick or hover resolves to. */
export type CityTarget =
  | { kind: 'context'; id: string }
  | { kind: 'hero'; buildingId: string; roomId?: string; surfaceId?: string; storeyId?: string }
  | { kind: 'ground'; east: number; north: number };

/**
 * Find a building, storey or room (owner request, search). The stage eases the camera to it,
 * outlines it in ink by day or lights it by night, dims the rest of the city slightly and, for a
 * storey or room, lifts the floors above as a cutaway. `bboxMm` (pack frame, from a place index
 * hit) frames buildings the stage has no geometry for.
 */
export interface CityFocus {
  kind: 'building' | 'storey' | 'room';
  buildingId: string;
  storeyId?: string;
  roomId?: string;
  bboxMm?: { minX: number; minY: number; maxX: number; maxY: number };
}
