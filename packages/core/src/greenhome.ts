/**
 * Green Home Score and retrofit engine contracts (Lloyds Megathon brief, problem statement 2).
 * Owner: WP-00 (contract); WP-25 implements in `packs/green-home` and generates the synthetic
 * portfolio in `packages/fixtures/src/portfolio`.
 *
 * Plain JSON shapes (numbers, strings, null) so the portfolio tables, labels and assessments can be
 * stored and shipped as files. Energy is kWh a year or a month, money whole pounds, carbon kg CO2e.
 * `null` always means missing or unknown, never zero.
 */
import type { IsoDate } from './common.ts';
import type { Band } from './twin.ts';

// ---------------------------------------------------------------------------------------------
// Portfolio tables (brief section 9)

export type GhPropertyType = 'detached' | 'semi-detached' | 'end-terrace' | 'mid-terrace' | 'bungalow' | 'flat';
export const GH_PROPERTY_TYPES: readonly GhPropertyType[] = [
  'detached',
  'semi-detached',
  'end-terrace',
  'mid-terrace',
  'bungalow',
  'flat',
];

export type GhHeating =
  | 'gas-boiler-old'
  | 'gas-boiler-condensing'
  | 'electric-storage'
  | 'heat-pump';
export type GhWall = 'solid-uninsulated' | 'solid-insulated' | 'cavity-unfilled' | 'cavity-filled' | 'timber-frame';
export type GhGlazing = 'single' | 'double-old' | 'double' | 'triple';
export type GhControls = 'none' | 'programmer' | 'programmer-thermostat' | 'smart-thermostat';
export type GhRegion = 'London' | 'South East' | 'North West' | 'Yorkshire' | 'Scotland';
export type GhSplit = 'train' | 'validation' | 'test';

/** One home (table "Properties"). Everything here is known at prediction time. */
export interface GhProperty {
  propertyId: string;
  customerId: string;
  propertyType: GhPropertyType;
  yearBuilt: number;
  floorAreaM2: number;
  bedrooms: number;
  storeys: number;
  /** For flats: which floor (sets whether the flat has a roof and a ground floor). */
  flatLevel?: 'ground' | 'mid' | 'top';
  /** Recorded EPC band and SAP points from the latest certificate (may be out of date). */
  energyRating: Band | null;
  sapRating: number | null;
  epcDate: IsoDate | null;
  heating: GhHeating;
  heatingAgeYears: number | null;
  insulation: {
    /** Loft insulation depth in mm; null when unknown; 'no-loft' for flats below the top floor. */
    loftMm: number | null | 'no-loft';
    wall: GhWall | null;
    floorInsulated: boolean | null;
  };
  glazing: GhGlazing | null;
  /** Installed solar PV, kWp (0 when none). */
  solarKwp: number;
  smartControls: GhControls | null;
  region: GhRegion;
  /** Current estimated market value (the baseline for value impact), distinct from sale prices. */
  valueGBP: number;
  valueAsOf: IsoDate;
  /** Planning or practical constraints that make a retrofit infeasible. */
  constraints: { conservationArea: boolean; listed: boolean; flatRoofAccess: boolean; tenure: 'owner' | 'landlord' | 'tenant' };
  split: GhSplit;
}

/** Monthly metered energy (table "Energy usage"). `null` is a missing reading, never zero. */
export interface GhUsageRow {
  propertyId: string;
  /** `YYYY-MM`. */
  month: string;
  /** Grid electricity imported, kWh. */
  electricityKwh: number | null;
  /** Gas consumed, kWh (0 for homes with no gas supply). */
  gasKwh: number | null;
}

export type GhRetrofitId = 'loft' | 'cavity-wall' | 'solid-wall' | 'floor' | 'glazing' | 'smart-thermostat' | 'heat-pump' | 'solar';
export const GH_RETROFIT_ORDER: readonly GhRetrofitId[] = [
  'loft',
  'cavity-wall',
  'solid-wall',
  'floor',
  'glazing',
  'smart-thermostat',
  'heat-pump',
  'solar',
];

/** Table "Retrofit catalogue". */
export interface GhRetrofit {
  id: GhRetrofitId;
  name: string;
  /** Engine measure and option used to model it. */
  measureId: string;
  optionId: string;
  applicability: string;
  costGBP: { lo: number; hi: number };
  typicalImpact: string;
  sources: { id: string; title: string; url?: string }[];
}

/** Table "Emissions factors". */
export interface GhEmissionFactor {
  fuel: 'electricity' | 'gas';
  kgCo2ePerKwh: number;
  source: string;
  url: string;
  year: number;
}

export interface GhRetrofitHistoryRow {
  propertyId: string;
  retrofit: GhRetrofitId;
  completionDate: IsoDate;
}

export interface GhSaleRow {
  propertyId: string;
  date: IsoDate;
  priceGBP: number;
  energyRatingAtSale: Band | null;
}

/**
 * Reference labels from the documented simulator (not available at prediction time). Generated
 * from hidden true characteristics, so agreement measures consistency with the simulator only.
 */
export interface GhLabel {
  propertyId: string;
  split: GhSplit;
  /** Reference improvement potential, percent of annual purchased energy, or null if unavailable. */
  improvementPotentialPct: number | null;
  /** Rank by potential within the split (1 = most potential). */
  potentialRank: number | null;
  /** Retrofits feasible and relevant under the true characteristics. */
  feasible: GhRetrofitId[];
  /** Reference package savings per fuel, kWh a year (negative = increase). */
  packageSavingKwh: { electricity: number; gas: number } | null;
  /** Reference value change of the package, percent of current value. */
  valueImpactPct: number | null;
}

// ---------------------------------------------------------------------------------------------
// Outputs

export interface GhAnnualFuel {
  /** Annualised kWh, or null when too few months are available. */
  kwh: number | null;
  monthsUsed: number;
  monthsMissing: number;
  method: 'twelve-months' | 'seasonal-scaling' | 'insufficient';
}
export interface GhAnnualised {
  window: { from: string; to: string };
  electricity: GhAnnualFuel;
  gas: GhAnnualFuel;
  /** Purchased energy per m² a year, or null when any fuel is unavailable. */
  intensityKwhM2: number | null;
}

export type GhComponentId =
  | 'energy-efficiency'
  | 'consumption-intensity'
  | 'insulation'
  | 'heating'
  | 'glazing'
  | 'renewables'
  | 'smart-controls';
export const GH_COMPONENTS: readonly { id: GhComponentId; weight: { n: number; d: number } }[] = [
  { id: 'energy-efficiency', weight: { n: 1, d: 4 } },
  { id: 'consumption-intensity', weight: { n: 1, d: 5 } },
  { id: 'insulation', weight: { n: 3, d: 20 } },
  { id: 'heating', weight: { n: 3, d: 20 } },
  { id: 'glazing', weight: { n: 1, d: 10 } },
  { id: 'renewables', weight: { n: 1, d: 10 } },
  { id: 'smart-controls', weight: { n: 1, d: 20 } },
];

export type GhBand = 'Highly efficient' | 'Good' | 'Moderate' | 'Poor' | 'Very poor';

export interface GhComponent {
  id: GhComponentId;
  label: string;
  weight: { n: number; d: number };
  /** 0 to 100, from the documented monotone mapping. */
  subScore: number;
  /** weight times sub-score, points of the 100. */
  contribution: number;
  /** The input the mapping read, in words ("SAP 54 (E)", "212 kWh/m² a year"). */
  input: string;
  /** How the input was obtained: recorded, metered, modelled (fallback), or assumed (unknown). */
  basis: 'recorded' | 'metered' | 'modelled' | 'assumed';
}

export interface GreenHomeScore {
  /** Rounded to the nearest integer (halves up), 0 to 100. */
  score: number;
  /** The unrounded weighted sum. */
  exact: number;
  band: GhBand;
  components: GhComponent[];
}

export interface PoorHomeFlag {
  flagged: boolean;
  band: GhBand;
  issues: { id: string; text: string; component: GhComponentId }[];
}

export interface GhFuelEnergy {
  electricityKwh: number;
  gasKwh: number;
  totalKwh: number;
}

export interface ImprovementPotential {
  status: 'available' | 'unavailable';
  /** 100 x (E_baseline - E_after) / E_baseline on purchased energy (grid import plus gas). */
  pct: number | null;
  baseline: GhFuelEnergy | null;
  after: GhFuelEnergy | null;
  /** Why unavailable, or how it was computed. */
  note: string;
}

/** Positive values are savings; negative values are increases. */
export interface GhSaving {
  electricityKwh: number;
  gasKwh: number;
  totalKwh: number;
  carbonKg: number;
}

export interface GhRecommendation {
  retrofitId: GhRetrofitId;
  name: string;
  /** Position in the interaction order (1 = do first). */
  order: number;
  suitability: 'High' | 'Medium' | 'Low';
  /** Saving when added after the retrofits before it in the list (so the list sums to the package). */
  saving: GhSaving;
  costGBP: { lo: number; hi: number };
  reason: string;
  estimate: true;
}

export interface GhPackage {
  retrofitIds: GhRetrofitId[];
  /** Modelled for the whole package at once, never a sum of separate estimates. */
  saving: GhSaving;
  baseline: GhFuelEnergy;
  after: GhFuelEnergy;
  costGBP: { lo: number; hi: number };
  ratingBefore: Band | null;
  ratingAfter: Band | null;
  estimate: true;
}

export interface GhValueImpact {
  status: 'available' | 'unavailable';
  currentValueGBP: number;
  ratingFrom: Band | null;
  ratingTo: Band | null;
  upliftPct: { lo: number; hi: number } | null;
  valueGBP: { lo: number; hi: number } | null;
  method: string;
  caveat: string;
}

export interface GhAssessment {
  propertyId: string;
  asOf: IsoDate;
  annualised: GhAnnualised;
  score: GreenHomeScore;
  poor: PoorHomeFlag;
  potential: ImprovementPotential;
  recommendations: GhRecommendation[];
  infeasible: { retrofitId: GhRetrofitId; reason: string }[];
  package: GhPackage | null;
  value: GhValueImpact;
  /** Missing or conflicting data the person should know about. */
  warnings: string[];
  factors: GhEmissionFactor[];
}

/** Score band from a rounded score (brief section 2). */
export function ghBand(score: number): GhBand {
  if (score >= 80) return 'Highly efficient';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Moderate';
  if (score >= 30) return 'Poor';
  return 'Very poor';
}
