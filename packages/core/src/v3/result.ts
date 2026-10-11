/**
 * Building results: end uses, EUI, bills, water, carbon, comfort, code and rating rows
 * (ARCH 15.4, SPEC R33 to R40, SPEC 22). Owner: WP-00 (contract); WP-18, WP-19, WP-02 compute,
 * WP-13 records Preview fixtures.
 */
import type { Grade, IsoDate } from '../common.ts';
import type { EvidenceGraph } from '../evidence/types.ts';
import type { Tri } from '../fields.ts';
import type { Ival } from '../ival.ts';
import type { Month, Unit } from '../units.ts';
import type { Party } from './building.ts';
import type { MetricId } from './metrics.ts';
import type { ResultStamp } from './provenance.ts';

export type EndUse =
  | 'cooling'
  | 'heating'
  | 'lighting'
  | 'equipment'
  | 'fans'
  | 'pumps'
  | 'hot-water'
  | 'other'
  | 'pv';
/** Order is normative (end-use bars, certificate columns). PV is generation, drawn negative. */
export const END_USES: readonly EndUse[] = [
  'cooling',
  'heating',
  'lighting',
  'equipment',
  'fans',
  'pumps',
  'hot-water',
  'other',
  'pv',
];

export type Carrier = 'electricity' | 'water' | 'diesel' | 'gas' | 'lpg';

/** One carrier's bill per month, exact in the money pack's minor unit (micro-paise or micro-pence). */
export interface TariffBill {
  carrier: Carrier;
  tariffId: string;
  currency: 'INR' | 'GBP';
  byMonth: readonly bigint[];
  total: bigint;
  /** Months where consumption crossed a category cliff (AC-BR2). */
  cliffMonths: Month[];
  /** kVA demand charges included, when the tariff has them. */
  demandKva?: number;
}

export interface WaterBalance {
  /** Litres per month. */
  litresByMonth: readonly bigint[];
  bill?: TariffBill;
  /** Litres per month saved by fixtures versus the reference (LEED and EDGE water). */
  savedByMonth?: readonly bigint[];
}

/** Fan-first comfort (R40): hours comfortable with fans alone, then with AC per set point. */
export interface ComfortHours {
  roomId: string;
  model: 'IMAC-MM' | 'IMAC-NV' | 'ASHRAE55-adaptive' | 'EN16798' | 'fixed-band';
  fanAirSpeedMs?: number;
  fanHours: Ival;
  acHours: { setpointC: number; hours: Ival }[];
  occupiedHours: number;
}

/** Applicability ladder (R34). The word "compliant" never appears. */
export type Applicability =
  | 'reference'
  | 'partial'
  | 'adoption-unconfirmed'
  | 'professional'
  | 'not-a-certificate';
export const APPLICABILITY: readonly Applicability[] = [
  'reference',
  'partial',
  'adoption-unconfirmed',
  'professional',
  'not-a-certificate',
];

export interface CodeRow {
  ruleId: string;
  edition: string;
  /** Pre-check: `true` passes, `false` fails, `'unknown'` when a fact is missing. */
  status: Tri;
  margin?: { value: number; unit: Unit };
  applicability: Applicability;
  grade: Grade;
  metric?: MetricId;
  /** Highest tier passed for tiered rules (1 Compliant, 2 Plus, 3 Super). */
  tier?: 1 | 2 | 3;
  clause?: string;
  /** Facts the status could not read. */
  unknownFacts?: string[];
}

/** One rating scheme on the ladder (R36): estimate, not a certification. */
export interface RatingRow {
  scheme: string;
  edition: string;
  metric: MetricId;
  value: Ival | 'unknown';
  points: { likely: number | 'unknown'; possible?: number };
  level: { likely: string | 'unknown'; possible?: string };
  applicability: Applicability;
  grade: Grade;
}

/** A code baseline run (R35): reference design EUI and the ratio read by targets and points. */
export interface BaselineRow {
  code: string;
  builderId: string;
  eui: Ival;
  /** Proposed over baseline, as a range. */
  ratio: Ival;
}

/** Fair split share (SPEC 22 `split.*`): sums exactly to the bill (AC-BR3). */
export interface SplitShare {
  party: Party;
  carrier: Carrier;
  amount: bigint;
}

export interface BuildingResult {
  inputsHash: string;
  stamp: ResultStamp;
  /** Wh per month, twelve values, or unknown per month. */
  endUses: Record<EndUse, readonly (bigint | 'unknown')[]>;
  /** kWh/m²·yr on conditioned area. `partial` when any end use is unknown (R33, AC-BR1). */
  eui: {
    site: Ival;
    source: Ival;
    partial: boolean;
    missing?: EndUse[];
    target?: { value: Ival; source: string };
  };
  conditionedM2: number;
  bills: TariffBill[];
  water?: WaterBalance;
  /** Operational carbon, gCO2e per year, with the factors used (R39). */
  carbon: { op: bigint; factorIds: string[]; saved?: bigint };
  comfort: ComfortHours[];
  codes: CodeRow[];
  ratings: RatingRow[];
  baselines?: BaselineRow[];
  split?: SplitShare[];
  evidence: EvidenceGraph;
  asOf: IsoDate;
}

/** True when the EUI must be labelled partial: any month of any end use is unknown. */
export function euiIsPartial(endUses: BuildingResult['endUses']): boolean {
  return END_USES.some((u) => endUses[u].some((v) => v === 'unknown'));
}
