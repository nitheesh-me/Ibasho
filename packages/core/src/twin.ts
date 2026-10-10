/**
 * The home twin (ARCH 5.2). Owner: WP-00. Schema id `ibasho.twin/2`.
 * Geometry is in house coordinates: metres, x east, y up, z south, origin at the front-left
 * ground corner. Azimuths are degrees clockwise from north.
 */
import type { IsoDate, RegionCode } from './common.ts';
import type { Choice, InputSource, NumField, Tri } from './fields.ts';
import type { Fuel } from './units.ts';

export type BuiltForm =
  | 'detached'
  | 'semi-detached'
  | 'end-terrace'
  | 'mid-terrace'
  | 'enclosed-end-terrace'
  | 'enclosed-mid-terrace'
  | 'flat'
  | 'maisonette'
  | 'independent-house';
export type VentSystem = 'natural' | 'intermittent-extract' | 'mev' | 'piv' | 'mvhr';
/** Heating controls, ordered from least to most capable (SAP Table 4e families). */
export type ControlType =
  | 'none'
  | 'programmer-only'
  | 'room-thermostat'
  | 'programmer-thermostat'
  | 'programmer-thermostat-trvs'
  | 'zone-control'
  | 'trvs-weather-compensation';
/** SAP Table 6d overshading classes. */
export type OvershadingClass = 'heavy' | 'more-than-average' | 'average' | 'very-little';
export type Band = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export const BANDS: readonly Band[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export interface SystemRef {
  /** Id of a `system` plugin (e.g. `gas-combi-condensing`). */
  systemId: string;
  fuel: Fuel;
  efficiency?: NumField;
  sizeKW?: NumField;
  installedYear?: number;
}
export interface PvArray {
  id: string;
  kWp: NumField;
  azimuthDeg: number;
  tiltDeg: number;
  overshading: OvershadingClass;
  elementId?: string;
}
export interface RadiatorSpec {
  id: string;
  zone: 'living' | 'rest';
  room?: string;
  /** Rated output at ΔT 50 K, W. */
  outputW50: NumField;
  elementId?: string;
}
export interface GardenGeom {
  polygon: Vec2[];
  areaM2: number;
}
export interface NeighbourOpening {
  id: string;
  position: Vec3;
  kind: 'window' | 'door';
  habitable: Tri;
}
export interface Boundary {
  id: string;
  path: Vec2[];
  kind: 'wall' | 'fence' | 'hedge' | 'open';
  heightM?: number;
}
/** Planning designations that rules read (RP 4). */
export interface Designations {
  conservationArea: Tri;
  /** Article 2(3) land: conservation area, National Park, National Landscape, Broads, WHS. */
  article23Land: Tri;
  listedGrade: Choice<'I' | 'II*' | 'II' | 'none'>;
  inCurtilageOfListed?: Tri;
  /** Classes removed by an Article 4 direction for this address (e.g. `A`, `C`). */
  article4RemovedClasses: string[];
  scheduledMonument?: Tri;
}
export interface MeterPeriod {
  from: IsoDate;
  to: IsoDate;
  value: number;
  unit: 'kWh' | 'GBP' | 'INR' | 'm3';
}
export interface MeterSeries {
  fuel: Fuel;
  /** Data quality weights the calibration fit (DEC PR-8). */
  quality: 'meter' | 'kwh' | 'money' | 'direct-debit';
  periods: MeterPeriod[];
  source: InputSource;
}
export interface MeterData {
  series: MeterSeries[];
}
/** Planar polygon of an element in house coordinates, outer ring counter-clockwise seen from outside. */
export interface ElementGeom {
  polygon: Vec3[];
  holes?: Vec3[][];
}

export const CHECK_KINDS = [
  'moisture-assessment',
  'dno-approval',
  'structural',
  'pas2035-assessment',
  'asbestos',
] as const;
export type CheckKind = (typeof CHECK_KINDS)[number];

export interface Element {
  id: string;
  kind: 'wall' | 'party-wall' | 'roof' | 'floor' | 'window' | 'door' | 'rooflight';
  zone: 'living' | 'rest' | 'both';
  orientationDeg?: number;
  tiltDeg?: number;
  areaM2: NumField;
  parentId?: string;
  constructionId: string;
  u: NumField;
  g?: NumField;
  frameFactor?: NumField;
  absorptance?: NumField;
  geometry: ElementGeom;
  finish?: string;
  frontsHighway?: Tri;
  onBoundary?: Tri;
}

export type JunctionKind =
  | 'lintel'
  | 'sill'
  | 'jamb'
  | 'eaves'
  | 'ground-floor'
  | 'party-wall'
  | 'intermediate-floor'
  | 'corner'
  | 'joist-end';

export interface Junction {
  /** e.g. `jn-lintel-front-bay`. */
  id: string;
  kind: JunctionKind;
  elementIds: string[];
  lengthM: NumField;
  /** SAP Table K1 default unless stated. W/mK. */
  psi: NumField;
  /** Polyline in house coordinates, for seams and the lens. */
  path: Vec3[];
}

export interface HomeTwin {
  schema: 'ibasho.twin/2';
  id: string;
  version: number;
  region: RegionCode;
  climatePackId: string;
  location: { lat: number; lon: number; district?: string };
  archetypeId: string;
  form: {
    builtForm: BuiltForm;
    storeys: NumField;
    storeyHeightM: NumField;
    footprintM2: NumField;
    perimeterM: NumField;
    frontAzimuthDeg: NumField;
    roof: Choice<'pitched' | 'flat' | 'rafters'>;
    pitchDeg?: NumField;
    floorLevel?: number;
  };
  /** SAP two-zone split, used by 5R1C and room tints. */
  zones: { livingAreaFrac: NumField };
  elements: Element[];
  /** Explicit psi junctions (R19). */
  junctions: Junction[];
  ventilation: {
    chimneysOpen: NumField;
    chimneysBlocked: NumField;
    extractFans: NumField;
    ap50?: NumField;
    draughtProofedFrac: NumField;
    floorType: Choice<'suspended-unsealed' | 'suspended-sealed' | 'solid'>;
    shelteredSides: NumField;
    system: Choice<VentSystem>;
  };
  systems: {
    space: SystemRef;
    dhw: SystemRef & { class: 'combi' | 'cylinder' | 'instant' | 'geyser' };
    boilerAgeYears?: NumField;
    cooling?: SystemRef[];
    pv?: PvArray[];
    battery?: NumField;
    hob: Choice<'gas' | 'electric' | 'induction'>;
    emitters: { kOversize: NumField; radiators?: RadiatorSpec[] };
    controls: Choice<ControlType>;
  };
  occupancy: {
    people: NumField;
    setpointC: NumField;
    heatingHours: NumField;
    acHoursPerNight?: NumField;
    fans?: NumField;
  };
  site: {
    overshading: Choice<OvershadingClass>;
    garden?: GardenGeom;
    neighbours?: NeighbourOpening[];
    boundaries?: Boundary[];
  };
  legal: {
    tenure: Choice<'owner' | 'tenant' | 'landlord' | 'leaseholder'>;
    designations: Designations;
    roofIsCommonArea?: Tri;
    leaseCovenant?: Choice<'absolute' | 'qualified' | 'silent' | 'unknown'>;
    epc?: { band: Band; sap?: number; issued: IsoDate };
    sanctionedLoadKW?: NumField;
    valueGBP?: NumField;
    /** DNO rules. */
    supply: { phases: NumField; looped: Tri; fuseA?: NumField };
  };
  /** Recorded checks (R22). */
  checks: { kind: CheckKind; at: IsoDate; result: 'pass' | 'fail' | 'conditional'; ref?: string }[];
  meters?: MeterData;
  done: { measureId: string; optionId: string; at: IsoDate; costGBP?: number }[];
}

/**
 * Pure parameter deltas produced by `MeasureModel.apply` and by `oblige` effects.
 * `set` paths are JSON Pointers into the twin (`/elements/3/u`); values replace the target.
 * Patches compose by concatenation and apply in order; applying is the pipeline's job (WP-01).
 */
export interface TwinPatch {
  set: { path: string; value: unknown }[];
  addElements?: Element[];
  addJunctions?: Junction[];
  removeElementIds?: string[];
}
export const EMPTY_PATCH: TwinPatch = { set: [] };
