/**
 * Measure costs (`measure-cost`, BUILD_PLAN 2 "one measure, five owners, one id"). Owner: WP-02.
 *
 * One plugin per option id in `packs/home-uk/src/ids.ts`. BP 6.1 cost model: `cost = fixed +
 * perUnit * quantity`, scaled by twin geometry, in micro-pence. Prices are 2025/26 and already at
 * 0% VAT for energy-saving materials, which runs to 31 March 2027 (SF 5.5); after that date the
 * cost switches to 20% VAT automatically through the VAT rule below.
 *
 * Ranges: BP 6.1 gives central models only, so lo and hi are ESTIMATE spreads (80% and 130% of
 * mid) until quote data arrives (M-F quote check).
 *
 * M-0 costs the five options the home-uk engine half models (loft 270 and 300, draught-proofing,
 * ASHP and ASHP with radiators+). PLACEHOLDER until M-B: the other SPEC 9 options, the cylinder
 * and hob sub-measures as their own options, and the moisture and PAS 2035 assessments.
 */
import {
  type Grade,
  type HomeTwin,
  type IsoDate,
  type MeasureCost,
  type MicroPence,
  microPenceFromPounds,
  mulDiv,
  numCentral,
  Q,
  quantise,
  type SourceRef,
} from '@ibasho/core';
import { BP_6_1, EST_DRAUGHT, EST_LOFT, provenance, VAT_ESM, WHICH_ASHP } from '../sources.ts';

export class CostError extends Error {
  override name = 'CostError';
}

/** Last day of 0% VAT on energy-saving materials (SF 5.5). */
export const ESM_ZERO_VAT_TO: IsoDate = '2027-03-31';
const VAT_STANDARD = Q.of(1, 5);

/** VAT rate on energy-saving materials and their installation on `asOf`. */
export function esmVatRate(asOf: IsoDate): Q {
  return asOf <= ESM_ZERO_VAT_TO ? Q.ZERO : VAT_STANDARD;
}

/** Quantity in hundredths (m2 to centi-m2), quantised once, half even. */
function centi(x: number, what: string): bigint {
  if (!Number.isFinite(x) || x < 0) throw new CostError(`${what} must be a finite non-negative number`);
  return quantise(x * 100);
}

const pounds = (s: string): MicroPence => microPenceFromPounds(s);

/** fixed + perUnit * quantity, the quantity given in hundredths of a unit. */
function linear(fixed: MicroPence, perUnit: MicroPence, quantityCenti: bigint): MicroPence {
  return fixed + mulDiv(perUnit, quantityCenti, 100n);
}

/** Apply VAT and the ESTIMATE spread to a net central cost. */
function priced(net: MicroPence, asOf: IsoDate, grade: Grade) {
  const vatRate = esmVatRate(asOf);
  const mid = net + mulDiv(net, vatRate.n, vatRate.d);
  return { lo: mulDiv(mid, 4n, 5n), mid, hi: mulDiv(mid, 13n, 10n), vatRate, grade };
}

function base(optionId: string, sources: SourceRef[], grade: Grade) {
  return {
    kind: 'measure-cost' as const,
    id: `cost-${optionId}`,
    version: '0.1.0' as const,
    title: `money.cost.${optionId}`,
    regions: ['GB' as const],
    side: 'engine' as const,
    provenance: provenance([BP_6_1, VAT_ESM, ...sources], grade),
    optionId,
  };
}

// ---------------------------------------------------------------------------------------------
// Quantities from the twin

/** Loft-ceiling roof area, m2 (every `roof` element that is not rafters or flat). */
export function loftAreaM2(twin: HomeTwin): number {
  let a = 0;
  for (const e of twin.elements) {
    if (e.kind === 'roof' && !/rafter|flat/.test(e.constructionId)) a += numCentral(e.areaM2);
  }
  return a;
}

/** Windows, doors and rooflights. */
export function openingCount(twin: HomeTwin): number {
  return twin.elements.filter((e) => e.kind === 'window' || e.kind === 'door' || e.kind === 'rooflight')
    .length;
}

/** Floor area, m2: footprint times storeys. */
function tfaM2(twin: HomeTwin): number {
  return numCentral(twin.form.footprintM2) * numCentral(twin.form.storeys);
}

/** Design temperature difference for sizing, K: 21 degC inside, about -2 degC outside (BP 3.10). */
const SIZING_DELTA_T = 23;
/** Infiltration assumed for sizing, ach (ESTIMATE, a leaky pre-1919 home). */
const SIZING_ACH = 1.5;

/**
 * Heat pump size for costing, whole kW, between 4 and 16. ESTIMATE: fabric A*U of every exposed
 * element plus 0.33 * n * V, times the design difference. PLACEHOLDER until WP-01's `hp.size_kw`
 * (BP 3.10 design load, M-A) is available to cost plugins; the INTERFACES entry tracks it.
 */
export function heatPumpSizeKw(twin: HomeTwin): number {
  let h = 0;
  for (const e of twin.elements) {
    if (e.kind === 'party-wall') continue;
    h += numCentral(e.areaM2) * numCentral(e.u);
  }
  const volume = tfaM2(twin) * numCentral(twin.form.storeyHeightM);
  h += 0.33 * SIZING_ACH * volume;
  const kw = Math.ceil((h * SIZING_DELTA_T) / 1000);
  return Math.min(16, Math.max(4, kw));
}

/** Radiators replaced by `radiators+`: 60% of the radiators, rounded up (ESTIMATE). */
export function radiatorsReplaced(twin: HomeTwin): number {
  const count = twin.systems.emitters.radiators?.length ?? Math.ceil(tfaM2(twin) / 12);
  return Math.ceil((count * 6) / 10);
}

// ---------------------------------------------------------------------------------------------
// Plugins

function loftCost(optionId: 'loft-270' | 'loft-300', perM2: string): MeasureCost {
  return {
    ...base(optionId, [EST_LOFT], 'secondary'),
    cost(twin, asOf) {
      const net = linear(pounds('300'), pounds(perM2), centi(loftAreaM2(twin), 'loft area'));
      return priced(net, asOf, 'secondary');
    },
  };
}

/** Loft to 300 mm: 300 pounds plus 10 pounds per m2 of loft (BP 6.1, EST). */
export const costLoft300 = loftCost('loft-300', '10');
/** Loft to 270 mm: ESTIMATE 300 pounds plus 9 pounds per m2 (one less roll per 10 m2 than 300 mm). */
export const costLoft270 = loftCost('loft-270', '9');

/** Draught-proofing: 150 pounds plus 15 per opening, plus 50 per open chimney balloon (BP 6.1). */
export const costDraught: MeasureCost = {
  ...base('draught-proofing-chimney-balloon', [EST_DRAUGHT], 'secondary'),
  cost(twin, asOf) {
    const chimneys = Math.round(numCentral(twin.ventilation.chimneysOpen));
    const net = pounds('150') + pounds('15') * BigInt(openingCount(twin)) + pounds('50') * BigInt(chimneys);
    return priced(net, asOf, 'secondary');
  },
};

/** New hot water cylinder when a heat pump replaces a combi (SPEC 9). ESTIMATE 1,600 pounds. */
export const CYLINDER_NEW = pounds('1600');
/** One radiator replaced for radiators+: 450 pounds (BP 6.1, installer estimate). */
export const RADIATOR_REPLACED = pounds('450');

function ashpNet(twin: HomeTwin, radiatorsPlus: boolean): MicroPence {
  let net = pounds('6500') + pounds('700') * BigInt(heatPumpSizeKw(twin));
  if (twin.systems.dhw.class === 'combi' || twin.systems.dhw.class === 'instant') net += CYLINDER_NEW;
  if (radiatorsPlus) net += RADIATOR_REPLACED * BigInt(radiatorsReplaced(twin));
  return net;
}

/** ASHP: 6,500 pounds plus 700 per kW (BP 6.1, Which?), plus a cylinder when replacing a combi. */
export const costAshp: MeasureCost = {
  ...base('heat-ashp', [WHICH_ASHP], 'estimate'),
  cost: (twin, asOf) => priced(ashpNet(twin, false), asOf, 'estimate'),
};
/** ASHP with radiators+: the ASHP cost plus 450 pounds per replaced radiator (BP 6.1). */
export const costAshpRadiatorsPlus: MeasureCost = {
  ...base('heat-ashp-radiators-plus', [WHICH_ASHP], 'estimate'),
  cost: (twin, asOf) => priced(ashpNet(twin, true), asOf, 'estimate'),
};

export const UK_MEASURE_COSTS: readonly MeasureCost[] = [
  costLoft270,
  costLoft300,
  costDraught,
  costAshp,
  costAshpRadiatorsPlus,
];
