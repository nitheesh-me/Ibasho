/**
 * Building document `ibasho.building/1` and its compiled form (ARCH 15.4, BE 2, SPEC R27).
 * Owner: WP-00 (contract); WP-14 implements `compile()` in `packages/plan`, WP-15 edits documents.
 *
 * Plan coordinates and heights are integer millimetres (`Mm`, a safe integer). Angles are integer
 * millidegrees. Areas are exact integer mm² (`bigint` when summed). Ids are stable across edits
 * (`rm_`, `sg_`, `op_`, `st_` prefixes by convention) so evidence, memory and certificates can
 * point at them. The document stores pack ids, never copied numbers.
 */
import type { IsoDate, MessageKey } from '../common.ts';
import type { NumField } from '../fields.ts';
import type { HomeTwin, SystemRef } from '../twin.ts';
import type { MetricId } from './metrics.ts';

/** The eight building types (R25). `rental` is tenure layered on a geometry. */
export type BuildingTypeId =
  | 'office'
  | 'hotel'
  | 'education'
  | 'hospital'
  | 'lab'
  | 'apartments'
  | 'rental'
  | 'single-family';
export const BUILDING_TYPES: readonly BuildingTypeId[] = [
  'office',
  'hotel',
  'education',
  'hospital',
  'lab',
  'apartments',
  'rental',
  'single-family',
];

/** Safe integer millimetres. */
export type Mm = number;
/** Integer millidegrees. Plan rotations are from the place's true north, clockwise. */
export type Mdeg = number;
/** Exact area in mm². */
export type Mm2 = bigint;
/** A plan point `[x, y]` in mm. */
export type PointMm = [Mm, Mm];
/** A simple polygon with holes, counter-clockwise outer ring, clockwise holes, no repeated last point. */
export interface PolygonMm {
  outer: PointMm[];
  holes: PointMm[][];
}

/** Rental and shared ownership (R25): who owns, who pays, who decides. Layered on a type. */
export interface TenureSplit {
  owner: 'owner-occupier' | 'landlord' | 'association' | 'institution' | 'unknown';
  /** Party per carrier that pays the bill. */
  pays: { electricity: Party; water: Party; diesel?: Party; gas?: Party };
  /** Party that decides each kind of change. */
  decides: { envelope: Party; systems: Party; roof: Party; interior: Party };
  /** Shares for a fair split (SPEC 22 `split.*`), per mille, summing to 1000 per carrier. */
  shares?: { party: Party; carrier: 'electricity' | 'water' | 'diesel' | 'gas'; perMille: number }[];
}
export type Party = 'owner' | 'landlord' | 'tenant' | 'association' | 'members' | 'unknown';

export interface BuildingDoc {
  schema: 'ibasho.building/1';
  id: string;
  /** Monotonic per building; documents are append-only versions (store `docs`). */
  version: number;
  placeId: string;
  name: string;
  typeId: BuildingTypeId;
  tenure?: TenureSplit;
  /** Drives the code edition in force (SPEC R34). Absent means unknown. */
  permitDate?: IsoDate;
  /** Building origin in the place's local frame, mm. */
  origin: { x: Mm; y: Mm };
  rotationMdeg: Mdeg;
  storeys: Storey[];
  roofs: RoofSpec[];
  shades: FreeShade[];
  zones: ThermalZone[];
  systems: SystemRef[];
  /** Used while storeys have no rooms (BE 2.4). */
  massing?: MassingSpec;
}

export interface Storey {
  id: string;
  name: string;
  /** Other names (e.g. "entry level" for a first floor that is the entrance). */
  aliases?: string[];
  /** Finished floor level above the building datum. */
  elevation: Mm;
  floorToFloor: Mm;
  /** Identical storeys represented once (multiplier ≥ 1). */
  multiplier: number;
  belowGrade: boolean;
  rooms: Room2D[];
  rooms3d: Room3D[];
  cores: Core[];
  underlay?: Underlay;
}

export interface Room2D {
  id: string;
  name?: string;
  /** Other names and functions the room answers to in search (no personal names). */
  aliases?: string[];
  floor: PolygonMm;
  ceiling: Mm;
  /** Absent means unknown; an untyped room widens the EUI range (SPEC R33, AC-NW2). */
  spaceTypeId?: string;
  zoneId?: string;
  /** One per outer polygon edge, in ring order. */
  segments: Segment[];
  floorBoundary: 'ground' | 'adjacent' | 'exposed';
  ceilingBoundary: 'roof' | 'adjacent' | 'exposed';
}

export type SegmentBoundary =
  | { kind: 'outdoors' | 'ground' | 'adiabatic' | 'air' }
  | { kind: 'adjacent'; roomId: string; segId: string };

export interface Segment {
  id: string;
  boundary: SegmentBoundary;
  constructionId?: string;
  /** Wall thickness when known (interior side of the outline). */
  thickness?: Mm;
  window: WindowRule;
  shading: ShadeRule[];
}

/** `wwrPm` is the window to wall ratio in per mille (0 to 950). */
export type WindowRule =
  | { kind: 'none' }
  | { kind: 'ratio'; wwrPm: number; sill: Mm; head?: Mm; productId?: string }
  | { kind: 'repeating'; wwrPm: number; width: Mm; spacing: Mm; sill: Mm; head: Mm; productId?: string }
  | { kind: 'single'; width: Mm; height: Mm; sill: Mm; offset: Mm; productId?: string }
  | { kind: 'detailed'; openings: Opening[] };

/** An explicit opening in segment `u`, `v` coordinates (u along the segment, v up from the floor). */
export interface Opening {
  id: string;
  kind: 'window' | 'door' | 'glass-door' | 'vent' | 'skylight';
  u: Mm;
  v: Mm;
  width: Mm;
  height: Mm;
  productId?: string;
  operable?: boolean;
  frame?: Mm;
}

export type ShadeRule =
  | { kind: 'overhang'; depth: Mm; aboveHead: Mm; extension: Mm }
  | { kind: 'fins'; depth: Mm; spacing?: Mm; sides: 'both' | 'left' | 'right' }
  | { kind: 'louvres'; spacing: Mm; depth: Mm; angleMdeg: Mdeg; axis: 'h' | 'v' }
  | { kind: 'light-shelf'; inside: Mm; outside: Mm; height: Mm }
  | { kind: 'balcony'; depth: Mm; parapet: Mm }
  /** Jaali or perforated screen; `porosityPm` per mille open. */
  | { kind: 'screen'; porosityPm: number; offset: Mm; presetId?: string };

/** Non-extruded room (attics, domes, sloped ceilings): planar faces in building mm. */
export interface Room3D {
  id: string;
  name?: string;
  spaceTypeId?: string;
  zoneId?: string;
  faces: {
    id: string;
    kind: 'wall' | 'roof' | 'floor';
    vertices: [Mm, Mm, Mm][];
    boundary: SegmentBoundary;
    constructionId?: string;
    openings: Opening[];
  }[];
}

/** Stair, lift or shaft: unconditioned and area-excluded by default. */
export interface Core {
  id: string;
  kind: 'stair' | 'lift' | 'shaft' | 'services';
  outline: PointMm[];
  conditioned: boolean;
  excludeFromArea: boolean;
}

/** A PDF or image page placed under a storey, calibrated by two points and a real distance. */
export interface Underlay {
  ref: string;
  page: number;
  calibration?: { a: PointMm; b: PointMm; distance: Mm };
  opacityPm: number;
}

export interface RoofSpec {
  id: string;
  storeyId: string;
  shape: 'flat' | 'mono' | 'gable' | 'hip' | 'dome' | 'unknown';
  pitchMdeg?: Mdeg;
  constructionId?: string;
  /** Cool roof finish, per mille solar reflectance; absent means unknown. */
  reflectancePm?: number;
  emittancePm?: number;
  pvZones: { id: string; outline: PointMm[]; coveragePm: number }[];
  skylights: Opening[];
}

/** Free shade attached to the building (canopy, screen, pergola), in building mm. */
export interface FreeShade {
  id: string;
  kind: 'canopy' | 'screen' | 'pergola' | 'wall' | 'tree';
  vertices: [Mm, Mm, Mm][];
  transmittancePm: number;
  presetId?: string;
}

export interface ThermalZone {
  id: string;
  name?: string;
  roomIds: string[];
  systemId?: string;
  conditioned: boolean;
  setpoints?: { coolC?: NumField; heatC?: NumField };
  scheduleSetId?: string;
}

/** Massing mode (BE 2.4): used while storeys have no rooms. */
export interface MassingSpec {
  footprint: PointMm[];
  storeys: number;
  floorToFloor: Mm;
  groundFloorToFloor?: Mm;
  /** Inset per storey index and edge index (terraces, podium and tower, phototropic steps). */
  setbacks: { storey: number; edge: number; inset: Mm }[];
  core: { kind: 'share'; perMille: number } | { kind: 'polygon'; outline: PointMm[] };
  /** Default 4570 mm (ASHRAE 90.1 Appendix G perimeter zoning). */
  perimeterDepth: Mm;
  /** Per facade orientation bin, per mille. */
  wwrByFacade: Partial<Record<FacadeBin, number>>;
  shadesByFacade: Partial<Record<FacadeBin, ShadeRule[]>>;
  /** Space type mix in per mille, summing to 1000. */
  programme: { spaceTypeId: string; perMille: number }[];
}

/** Eight orientation bins of the outward facade normal from true north. */
export type FacadeBin = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export const FACADE_BINS: readonly FacadeBin[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Facade bin of an outward normal azimuth in millidegrees (bins centred on each direction). */
export function facadeBin(azimuthMdeg: Mdeg): FacadeBin {
  const a = (((azimuthMdeg % 360_000) + 360_000) % 360_000) + 22_500;
  return FACADE_BINS[Math.floor(a / 45_000) % 8] as FacadeBin;
}

// ---------------------------------------------------------------------------------------------
// Compiled form (output of the `geometry` stage)

/**
 * Multi-zone engine input for non-home types (WP-18). Homes keep `HomeTwin`. Areas are exact mm²;
 * orientations millidegrees; boundaries name the zone on the other side.
 */
export interface ZoneTwin {
  schema: 'ibasho.zonetwin/1';
  buildingId: string;
  typeId: BuildingTypeId;
  zones: {
    id: string;
    roomIds: string[];
    spaceTypeIds: string[];
    floorMm2: Mm2;
    volumeMm3: bigint;
    conditioned: boolean;
    systemId?: string;
    storeyId: string;
  }[];
  surfaces: {
    id: string;
    zoneId: string;
    kind: 'wall' | 'roof' | 'floor' | 'window' | 'door' | 'skylight';
    areaMm2: Mm2;
    azimuthMdeg: Mdeg;
    tiltMdeg: Mdeg;
    boundary: 'outdoors' | 'ground' | 'adiabatic' | { zoneId: string };
    constructionId?: string;
    productId?: string;
    /** Parent wall or roof for an opening. */
    hostId?: string;
  }[];
  systems: SystemRef[];
}

export interface Quantities {
  gfaMm2: Mm2;
  /** Net conditioned area: rooms whose space type is conditioned. */
  ncaMm2: Mm2;
  storeys: {
    storeyId: string;
    gfaMm2: Mm2;
    roomSumMm2: Mm2;
    wallFootprintMm2: Mm2;
    /** Exactly 0 when the plan is valid (AC-ED2). */
    overlapMm2: Mm2;
  }[];
  facades: { bin: FacadeBin; grossMm2: Mm2; openingMm2: Mm2 }[];
  roofMm2: Mm2;
  skylightMm2: Mm2;
  /** Projection factor per opening (H / V), exact. */
  openings: { id: string; segId: string; areaMm2: Mm2; pf?: { n: bigint; d: bigint } }[];
}

/** One shared edge between two rooms; symmetric by construction (B14). */
export interface Adjacency {
  a: { roomId: string; segId: string };
  b: { roomId: string; segId: string };
  overlap: Mm;
}

export type PlanCheckKind =
  | 'unclosed'
  | 'self-intersect'
  | 'overlap'
  | 'window-over-wall'
  | 'tiny-room'
  | 'untyped-room'
  | 'orphan-zone'
  | 'meter';

/** A live plan lint or a no-simulation code meter (SPEC 20). */
export interface PlanCheck {
  id: string;
  kind: PlanCheckKind;
  severity: 'error' | 'warn' | 'info';
  /** Room, segment, opening or storey ids the check is drawn on. */
  targets: string[];
  message: MessageKey;
  meter?: { metric: MetricId; value: number; limit?: number; pass: true | false | 'unknown' };
}

/** Triangulated surfaces with stable ids, shared by the site worker and the scene. */
export interface SurfaceSet {
  /** Building local frame, integer mm, z up. */
  surfaces: {
    id: string;
    kind: 'wall' | 'roof' | 'floor' | 'window' | 'door' | 'skylight' | 'shade' | 'ground';
    /** Room, segment, opening or shade id the surface belongs to. */
    ownerId: string;
    /** Flat xyz triples in mm. */
    positions: readonly number[];
    /** Triangle vertex indices into `positions` / 3. */
    indices: readonly number[];
    azimuthMdeg: Mdeg;
    tiltMdeg: Mdeg;
  }[];
  /**
   * Room outlines per storey (building frame), so daylight and the scene work on real rooms.
   * `elevations` has one floor level per storey copy (a multiplied storey lists every copy).
   */
  rooms?: {
    id: string;
    zoneId?: string;
    storeyId: string;
    outer: PointMm[];
    holes?: PointMm[][];
    elevations: Mm[];
    /** Floor to ceiling, mm. */
    ceiling: Mm;
  }[];
}

export interface CompiledBuilding {
  /** sha256 of the canonical document (memo key). */
  docHash: string;
  twin: HomeTwin | ZoneTwin;
  quantities: Quantities;
  adjacency: Adjacency[];
  checks: PlanCheck[];
  meshes: SurfaceSet;
  /**
   * Where the building frame sits in the place frame (copied from the document), so site
   * analysis and the scene can place `meshes` among city context without the document.
   */
  placement?: { origin: { x: Mm; y: Mm }; rotationMdeg: Mdeg };
}

/** True when the compiled twin is a multi-zone `ZoneTwin` rather than a `HomeTwin`. */
export function isZoneTwin(t: HomeTwin | ZoneTwin): t is ZoneTwin {
  return (t as ZoneTwin).schema === 'ibasho.zonetwin/1';
}
