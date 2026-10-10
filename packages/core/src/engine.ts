/**
 * Engine plugin contracts and physics stage IO (ARCH 5.3). Owner: WP-00.
 * Stage IO shapes are the thin M-0 versions; WP-01 extends them through INTERFACES requests.
 */
import type { Grade, IsoDate, MessageKey, Monthly, RegionCode, RunMode } from './common.ts';
import type { EvidenceDraft, EvidenceGraph } from './evidence/types.ts';
import type { Q } from './exact/q.ts';
import type { Tri } from './fields.ts';
import type { MicroPence, Wh } from './fixed/index.ts';
import type { Ival } from './ival.ts';
import type { MeasureKind } from './measure-kinds.ts';
import type { PluginBase } from './plugin/types.ts';
import type { FactId, Rule } from './rules.ts';
import type { Band, BuiltForm, Element, HomeTwin, JunctionKind, MeterData, TwinPatch } from './twin.ts';
import type { Fuel, FuelMonthly, Month, Unit } from './units.ts';

// ---------------------------------------------------------------------------------------------
// Climate

export type AnchorZone = 'uk-temperate' | 'in-warm-humid' | 'in-composite';

/** 8760 hourly values (non-leap year), local standard time, January 1st 00:00 first. */
export interface HourlyClimate {
  thetaE: Float64Array;
  ghi: Float64Array;
  dhi: Float64Array;
  windMs?: Float64Array;
  rh?: Float64Array;
  source: 'tmy' | 'synthesised';
}

export interface ClimateMonth {
  /** Mean external temperature, °C. */
  thetaE: number;
  thetaMax: number;
  thetaMin: number;
  /** Global and diffuse horizontal irradiation, kWh/m² per month. */
  ghi: number;
  dhi: number;
  /** Relative humidity, %. */
  rh: number;
  windMs: number;
}

export interface ClimatePack extends PluginBase<'climate'> {
  location: { lat: number; lon: number; name: MessageKey };
  zone: AnchorZone;
  months: ClimateMonth[];
  design: { thetaEdC: number; grade: Grade };
  /** TMY (London in T1); else synthesised from months. */
  hourly?: () => Promise<HourlyClimate>;
  /** Monthly irradiation on a plane, kWh/m² per month. dmath only. */
  irradiance(azimuthDeg: number, tiltDeg: number): number[];
}

// ---------------------------------------------------------------------------------------------
// Packages and owner context

/** A retrofit package: one option (or `none`) per choice group. */
export interface PackageSpec {
  /** Canonical id: sorted `optionId`s joined by `+`, or `baseline` for the empty package. */
  id: string;
  /** groupId to optionId; absent group means `none`. */
  options: Record<string, string>;
  /** Sub-measure choices (e.g. `sub-hob`), groupId to optionId. */
  subOptions?: Record<string, string>;
}

export interface OwnerCtx {
  tenure: 'owner' | 'tenant' | 'landlord' | 'leaseholder' | 'unknown';
  /** Real discount rate in ppb (3.5% = 35_000_000n). */
  discountRatePpb: bigint;
  horizonYears: number;
  budget?: MicroPence;
  rights?: { roof: Tri; externalWalls: Tri; windows: Tri };
}

/** Picks come from the target set (SPEC R7). */
export type Target =
  | { kind: 'default' }
  | { kind: 'epc-band-at-least'; band: Band }
  | { kind: 'custom'; saveMoneyYear1: boolean; cutRunningCarbon: boolean };

// ---------------------------------------------------------------------------------------------
// Physics stages

export interface StageCtx {
  mode: RunMode;
  asOf: IsoDate;
  climate: ClimatePack;
  twin: HomeTwin;
  pkg?: PackageSpec;
}

export interface GeometryElement {
  id: string;
  kind: Element['kind'];
  zone: Element['zone'];
  areaM2: number;
  u: number;
  g?: number;
  orientationDeg?: number;
  tiltDeg?: number;
}
export interface GeometryOut {
  twin: HomeTwin;
  tfaM2: number;
  volumeM3: number;
  livingAreaM2: number;
  exposedAreaM2: number;
  elements: GeometryElement[];
  junctions: { id: string; kind: JunctionKind; lengthM: number; psi: number }[];
}
export interface FabricOut {
  /** Σ A·U + Σ ψ·L + y·A_rest, W/K. */
  htrWK: number;
  byElementWK: Record<string, number>;
  byJunctionWK: Record<string, number>;
  yRestWK: number;
  hlpWm2K: number;
  tmpKJm2K: number;
}
export interface VentOut {
  ninfAch: number;
  nEffAch: Monthly<number>;
  hveWK: Monthly<number>;
}
export interface GainsIn {
  geometry: GeometryOut;
  fabric: FabricOut;
  occupancyN: number;
}
export interface GainsOut {
  solarW: Monthly<number>;
  opaqueW: Monthly<number>;
  internalW: Monthly<number>;
}
export interface BalanceIn {
  geometry: GeometryOut;
  fabric: FabricOut;
  vent: VentOut;
  gains: GainsOut;
}
export interface DemandMonthly {
  qhKWh: Monthly<number>;
  util: Monthly<number>;
  thetaIC: Monthly<number>;
}
export interface CoolingMonthly {
  qcKWh: Monthly<number>;
  qlatKWh: Monthly<number>;
}
export interface DhwIn {
  geometry: GeometryOut;
  occupancyN: number;
}
export interface DhwMonthly {
  qwKWh: Monthly<number>;
  cylinderLossKWh: Monthly<number>;
}
export interface SystemsIn {
  demand: DemandMonthly;
  cooling: CoolingMonthly;
  dhw: DhwMonthly;
  systems: HomeTwin['systems'];
}
export interface RenewIn {
  geometry: GeometryOut;
  /** Electricity demand before PV, kWh per month (self-use β depends on it). */
  electricityKWh: Monthly<number>;
}
export interface RenewOut {
  pvYieldKWh: Monthly<number>;
  selfUseKWh: Monthly<number>;
  exportKWh: Monthly<number>;
  solarThermalKWh: Monthly<number>;
}
export interface DeliveredIn {
  systems: FuelMonthly<number>;
  renew: RenewOut;
}

/** Typed per stage (DEC TE-6). `delivered` is the quantisation boundary (integer Wh). */
export interface StageIO {
  geometry: { in: HomeTwin; out: GeometryOut };
  fabric: { in: GeometryOut; out: FabricOut };
  ventilation: { in: GeometryOut; out: VentOut };
  gains: { in: GainsIn; out: GainsOut };
  'heat-balance': { in: BalanceIn; out: DemandMonthly };
  cooling: { in: BalanceIn; out: CoolingMonthly };
  dhw: { in: DhwIn; out: DhwMonthly };
  systems: { in: SystemsIn; out: FuelMonthly<number> };
  renewables: { in: RenewIn; out: RenewOut };
  delivered: { in: DeliveredIn; out: FuelMonthly<bigint> };
}
export type StageName = keyof StageIO;
export const STAGE_ORDER: readonly StageName[] = [
  'geometry',
  'fabric',
  'ventilation',
  'gains',
  'heat-balance',
  'cooling',
  'dhw',
  'systems',
  'renewables',
  'delivered',
];

export interface PhysicsStage<S extends StageName = StageName> extends PluginBase<'physics-stage'> {
  stage: S;
  modes: RunMode[];
  run(input: StageIO[S]['in'], ctx: StageCtx): { output: StageIO[S]['out']; evidence: EvidenceDraft[] };
}

/** 5R1C in T1, rooms in T5. */
export interface ThermalModel extends PluginBase<'thermal-model'> {
  zones: string[];
  run(
    twin: HomeTwin,
    pkgPatch: TwinPatch,
    climate: HourlyClimate,
    ctx: StageCtx,
  ): { zoneTempsC: Float64Array[]; hotHours: number; coldHours: number; evidence: EvidenceDraft[] };
}

// ---------------------------------------------------------------------------------------------
// Simulation results

/** One run mode of one simulated twin (baseline or package). */
export interface SimResult {
  mode: RunMode;
  homeId: string;
  packageId: string;
  /** Delivered energy, integer Wh per fuel and month (quantised once). */
  deliveredWh: FuelMonthly<bigint>;
  /** PV export, integer Wh per month. */
  exportWh: Monthly<bigint>;
  qhKWh: Monthly<number>;
  qcKWh: Monthly<number>;
  comfort?: { hotHours: number; coldHours: number };
}
/** What `EngineApi.simulate` returns: one `SimResult` per requested mode plus their evidence. */
export interface SimBundle {
  hash: string;
  byMode: Partial<Record<RunMode, SimResult>>;
  graph: EvidenceGraph;
}
export type SimFn = (twin: HomeTwin, patch: TwinPatch, mode: RunMode) => SimResult;

// ---------------------------------------------------------------------------------------------
// Measures and costs

export interface MeasureOptionParam {
  value: number | string;
  min?: number;
  max?: number;
  unit?: Unit;
}
export interface MeasureOption {
  id: string;
  title: MessageKey;
  params: Record<string, MeasureOptionParam>;
}

/** Engine half of a measure (packs/<pack>/src/engine). Joined to cost, rules, ui and content by option id. */
export interface MeasureModel extends PluginBase<'measure'> {
  group: string;
  /** heavy = changes demand. */
  weight: 'heavy' | 'light';
  options: MeasureOption[];
  measureKind: MeasureKind;
  touches: Element['kind'][];
  /** Pure parameter deltas. */
  apply(twin: HomeTwin, optionId: string): TwinPatch;
  /** R19. */
  junctionEffects?(twin: HomeTwin, optionId: string): { junctionId: string; psiAfter: number }[];
  /** e.g. cylinder, hob, gas-disconnect. */
  subMeasures?: { id: string; group: string }[];
  lifetimeYears: number;
  conflicts?: string[];
  prereq?: string[];
  /** Inputs for rules (RP 4). */
  facts(twin: HomeTwin, optionId: string): Record<FactId, Tri | number | string>;
}

export interface MeasureCost extends PluginBase<'measure-cost'> {
  optionId: string;
  cost(
    twin: HomeTwin,
    asOf: IsoDate,
  ): { lo: MicroPence; mid: MicroPence; hi: MicroPence; vatRate: Q; grade: Grade };
  omDeltaPerYear?: MicroPence;
  replacements?: { atYear: number; cost: MicroPence }[];
}

// ---------------------------------------------------------------------------------------------
// Money, carbon, grants

/** Telescopic slab table. `uptoWh` null means unbounded. Prices in micro-pence (or micro-paise) per Wh. */
export interface SlabTable {
  period: 'month' | 'year';
  slabs: { uptoWh: Wh | null; price: bigint }[];
  standingPerDay: MicroPence;
}

export interface TariffPlugin extends PluginBase<'tariff'> {
  fuel: Fuel;
  currency: 'GBP' | 'INR';
  bill(
    whByMonth: Wh[],
    ctx: { days: number[]; sanctionedLoadKW?: number },
  ): { total: MicroPence; byMonth: MicroPence[]; slabs?: SlabTable };
}
export interface ExportTariffPlugin extends PluginBase<'export-tariff'> {
  currency: 'GBP' | 'INR';
  credit(exportWhByMonth: Wh[]): { total: MicroPence; byMonth: MicroPence[] };
}
export interface CarbonPack extends PluginBase<'carbon'> {
  /** µg CO2e per Wh. */
  factor(fuel: Fuel, month: Month): bigint;
  includesTD: boolean;
}
export interface CarbonTrajectory extends PluginBase<'carbon-trajectory'> {
  /** µg CO2e per Wh in a calendar year. */
  factor(fuel: Fuel, year: number): bigint;
}
export interface GrantPlugin extends PluginBase<'grant'> {
  eligible(
    twin: HomeTwin,
    owner: OwnerCtx,
    pkg: PackageSpec,
    asOf: IsoDate,
  ): { amount: MicroPence; conditions: MessageKey[]; stacksWith: string[]; obliges?: string[] } | null;
}
/** Loans and finance products (T1: loan stub). */
export interface FinancePlugin extends PluginBase<'finance'> {
  product: 'loan' | 'mortgage-addition' | 'salary-sacrifice';
  /** Annual rate in ppb and term. */
  aprPpb: bigint;
  termMonths: number;
  maxAmount?: MicroPence;
}
/** Value uplift by EPC band transition (SF 4.2, R16). Fractions of property value. */
export interface ValueEvidencePlugin extends PluginBase<'value-evidence'> {
  uplift(from: Band, to: Band): { low: Q; central: Q; high: Q } | null;
}
export interface EpcProxy extends PluginBase<'epc-proxy'> {
  sap(ratingResult: SimResult): { sap: number; band: Band; nearThreshold: boolean };
}
/** Unweighted side indicators only (water, flood). Never part of the score. */
export interface IndicatorPlugin extends PluginBase<'indicator'> {
  indicatorId: string;
  unit: Unit;
  compute(twin: HomeTwin, sim: SimResult): number | null;
}

// ---------------------------------------------------------------------------------------------
// Rules, regions, constructions, archetypes, systems

export interface RulePackPlugin extends PluginBase<'rule-pack'> {
  rules: Rule[];
}
export interface RegionPlugin extends PluginBase<'region'> {
  region: RegionCode;
  currency: 'GBP' | 'INR';
  locale: string;
  defaultClimatePackId: string;
}
export interface ConstructionPlugin extends PluginBase<'construction'> {
  element: Element['kind'];
  u: number;
  uRange?: Ival<number>;
  /** Areal heat capacity κ, kJ/m²K. */
  kappaKJm2K?: number;
  description: MessageKey;
}
export interface ArchetypeSeedInput {
  region: RegionCode;
  builtForm: BuiltForm;
  ageBand: string;
  floorAreaM2?: number;
  location: { lat: number; lon: number };
}
export interface ArchetypePlugin extends PluginBase<'archetype'> {
  builtForm: BuiltForm;
  ageBands: string[];
  /** Build a full twin with defaulted fields (each tagged `{ kind: 'default', pluginId }`). */
  seed(input: ArchetypeSeedInput): HomeTwin;
}
export interface SystemPlugin extends PluginBase<'system'> {
  category: 'boiler' | 'heat-pump' | 'direct-electric' | 'ac' | 'geyser' | 'district' | 'other';
  fuel: Fuel;
  /** Seasonal efficiency or SCOP central value. */
  efficiency: number;
  efficiencyRange?: Ival<number>;
}

// ---------------------------------------------------------------------------------------------
// Calibration and search

export interface ActualWeather {
  /** Heating degree days per month of the bill period, base 15.5 °C. */
  hdd: Monthly<number>;
  source: 'open-meteo' | 'climatology';
}
export interface CalibrationPosterior {
  thetaC: Ival<number>;
  ninfAch: Ival<number>;
  uWall: Ival<number>;
  /** Effect of calibration on annual delivered energy, percent. */
  effectPct: Ival<number>;
  dataQuality: 'meter' | 'kwh' | 'money' | 'direct-debit' | 'none';
  evidence: EvidenceDraft[];
}
export interface CalibrationPlugin extends PluginBase<'calibration'> {
  fit(twin: HomeTwin, meters: MeterData, weather: ActualWeather | null, sim: SimFn): CalibrationPosterior;
}

export interface ChoiceGroup {
  id: string;
  weight: 'heavy' | 'light';
  /** Includes `none` when the group may be left out. */
  options: string[];
}
export interface SearchPlan {
  groups: ChoiceGroup[];
  heavyCount: number;
  packageCount: number;
  /** False above the completeness limits (R9); the certificate then says so. */
  complete: boolean;
}
export interface SearchStrategy extends PluginBase<'search-strategy'> {
  plan(groups: ChoiceGroup[]): SearchPlan;
  complete: boolean;
}
