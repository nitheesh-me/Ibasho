/**
 * Weather, analysis resolution and site results (ARCH 15.4, SD 4, SPEC R30, R31).
 * Owner: WP-00 (contract); WP-16 computes, WP-07 paints lenses, WP-13 records Preview fixtures.
 */
import type { Grade, IsoDate, SourceRef } from '../common.ts';
import type { Q } from '../exact/q.ts';
import type { Ival } from '../ival.ts';
import type { PluginBase } from '../plugin/types.ts';
import type { ResultStamp } from './provenance.ts';

/** EnergyPlus weather file, parsed (R28). Arrays hold 8760 hourly values, local standard time. */
export interface Epw {
  schema: 'ibasho.epw/1';
  /** sha256 of the raw file bytes. */
  hash: string;
  location: {
    city: string;
    country: string;
    source: string;
    stationId: string;
    lat: number;
    lon: number;
    tzHours: number;
    elevationM: number;
  };
  period: 'typical' | 'actual' | 'future';
  dryBulbC: readonly number[];
  dewPointC: readonly number[];
  rhPct: readonly number[];
  ghiWhm2: readonly number[];
  dniWhm2: readonly number[];
  dhiWhm2: readonly number[];
  windMs: readonly number[];
  windDirDeg: readonly number[];
  source: SourceRef;
}

export type ResolutionLevel = 'sketch' | 'standard' | 'fine';
export const RESOLUTION_LEVELS: readonly ResolutionLevel[] = ['sketch', 'standard', 'fine'];

/** Every result states its resolution; the difference lens refuses mixed resolutions (AC-W6). */
export interface Resolution {
  level: ResolutionLevel;
  /** Sensor grid spacing, mm (500, 1000, 2000). */
  grid: number;
  stepMin: 6 | 15 | 60;
  skyPatches: 145 | 577;
  contextRadiusM: number;
}

export type DaylightTier = 'T0' | 'T1' | 'T2' | 'T3';
export const DAYLIGHT_TIERS: readonly DaylightTier[] = ['T0', 'T1', 'T2', 'T3'];

export interface SunHours {
  /** Mean hours of direct sun per day, as a range over the sensor set. */
  dailyMean: Ival;
  /** Annual direct sun hours (central). */
  annual: number;
  /** Twelve monthly means of hours per day, when computed. */
  monthly?: readonly number[];
}

export interface SiteResult {
  inputsHash: string;
  weatherHash: string;
  sceneHash: string;
  method: DaylightTier;
  kernel: 'cpu' | 'gpu-preview';
  resolution: Resolution;
  stamp: ResultStamp;
  surfaces: {
    id: string;
    /** Twelve monthly irradiation values, Wh/m², or unknown. */
    irrWhm2: readonly bigint[] | 'unknown';
    sunHours?: SunHours;
    svf?: Q;
    /** Surface area, m², and the year's received and unobstructed irradiation, Wh (AC-LK3 from the stored result). */
    areaM2?: number;
    receivedWh?: bigint;
    unobstructedWh?: bigint;
  }[];
  /** Monthly obstruction shading factor F_sh,obst for the engine. */
  windows: { id: string; shadingFactor: readonly Q[] }[];
  rooms: {
    id: string;
    sda?: Ival;
    ase?: Ival;
    ecbcShare?: Ival;
    views?: Ival;
    tier: DaylightTier;
  }[];
  /** Shading ledger: identity checked (AC-LK3). */
  ledger: { receiver: string; blocker: string; lostWh: bigint }[];
  /**
   * Context buildings inside the analysis radius left out because their height is unknown (RB 5):
   * they cast no shade, so shade may be understated. Sorted ids; absent means none were checked.
   */
  unknownHeightIds?: string[];
  /** Context buildings the modelled building overlaps, treated as replaced. Sorted ids. */
  overlappedIds?: string[];
  /** Ground sun-hours grid around the building (place frame, metres), row major from (x0, y0). */
  ground?: {
    x0: number;
    y0: number;
    cellM: number;
    cols: number;
    rows: number;
    hours: number[];
    date: IsoDate;
  };
}

/** A sky model, daylight tier or visibility kernel variant with its validated error band (R31). */
export interface SiteMethodPlugin extends PluginBase<'site-method'> {
  methodId: string;
  role: 'sky' | 'daylight-tier' | 'kernel';
  tier?: DaylightTier;
  /** Error against the SD 7 reference rooms, percentage points; absent means not yet measured. */
  errorBand?: { metric: 'sda' | 'ase' | 'irr' | 'sun-hours'; lo: number; hi: number; grade: Grade };
  /** Label used until the band is measured (R31: "sDA (simplified)"). */
  label: string;
}
