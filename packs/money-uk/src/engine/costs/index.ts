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
 * Every SPEC 9 option is costed (heavy and light groups, the `cylinder-new` and
 * `hob-induction-gas-disconnect` sub-measures, the `assess-moisture` and `assess-pas2035`
 * assessments), plus the like-for-like boiler that the counterfactual (A_cf) and the "If nothing
 * is done" run replace. Items that are not energy-saving materials (the hob, the assessments, a gas
 * boiler) always carry 20% VAT.
 *
 * The ASHP cost still includes a new cylinder when it replaces a combi, because the home-uk ASHP
 * model has no `sub-cylinder` choice yet. When WP-01 adds it, the cylinder moves to
 * `cost-cylinder-new` only (tracked on the blackboard, INTERFACES).
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
import {
  BP_6_1,
  DESNZ_BATTERY_COSTS,
  DESNZ_PV_COSTS,
  EST_DRAUGHT,
  EST_LOFT,
  EST_SOLID_WALL,
  IBASHO_ESTIMATE,
  MVHR_COSTS,
  provenance,
  SAP_10_2_T4,
  VAT_ESM,
  WHICH_ASHP,
  WHICH_FLOOR,
} from '../sources.ts';

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

/** Apply VAT and the ESTIMATE spread to a net central cost. `vat: 'standard'` is always 20%. */
function priced(net: MicroPence, asOf: IsoDate, grade: Grade, vat: 'esm' | 'standard' = 'esm') {
  const vatRate = vat === 'esm' ? esmVatRate(asOf) : VAT_STANDARD;
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
export function tfaM2(twin: HomeTwin): number {
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

/** Area of every element of `kind`, m2. */
function areaOf(twin: HomeTwin, kind: HomeTwin['elements'][number]['kind']): number {
  let a = 0;
  for (const e of twin.elements) if (e.kind === kind) a += numCentral(e.areaM2);
  return a;
}
/** Net external wall area, m2 (party walls excluded; openings are separate elements). */
export const externalWallAreaM2 = (twin: HomeTwin): number => areaOf(twin, 'wall');
/** Ground floor area, m2. */
export const floorAreaM2 = (twin: HomeTwin): number => areaOf(twin, 'floor');
/** Window area, m2. */
export const windowAreaM2 = (twin: HomeTwin): number => areaOf(twin, 'window');
/** Radiator count: the twin's radiators, else one per 12 m2 of floor (ESTIMATE). */
export function radiatorCount(twin: HomeTwin): number {
  return twin.systems.emitters.radiators?.length ?? Math.ceil(tfaM2(twin) / 12);
}

/** Radiators replaced by `radiators+`: 60% of the radiators, rounded up (ESTIMATE). */
export function radiatorsReplaced(twin: HomeTwin): number {
  return Math.ceil((radiatorCount(twin) * 6) / 10);
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

/** An option whose central net cost is `fixed + perUnit * quantity(twin)`. */
function linearCost(
  optionId: string,
  sources: SourceRef[],
  grade: Grade,
  fixed: string,
  perUnit: string,
  quantity: (twin: HomeTwin) => number,
  what: string,
  extra: Partial<Pick<MeasureCost, 'replacements' | 'omDeltaPerYear'>> = {},
  vat: 'esm' | 'standard' = 'esm',
): MeasureCost {
  return {
    ...base(optionId, sources, grade),
    ...extra,
    cost(twin, asOf) {
      return priced(linear(pounds(fixed), pounds(perUnit), centi(quantity(twin), what)), asOf, grade, vat);
    },
  };
}

/** A fixed-price option (no twin scaling). */
function fixedCost(
  optionId: string,
  sources: SourceRef[],
  grade: Grade,
  net: string,
  vat: 'esm' | 'standard',
): MeasureCost {
  return { ...base(optionId, sources, grade), cost: (_twin, asOf) => priced(pounds(net), asOf, grade, vat) };
}

/** EWI 100 mm: 2,500 pounds plus 130 per m2 of external wall (BP 6.1, EST). */
export const costWallEwi = linearCost(
  'wall-ewi-100',
  [EST_SOLID_WALL],
  'secondary',
  '2500',
  '130',
  externalWallAreaM2,
  'wall area',
);
/** IWI wood fibre: 2,000 pounds plus 95 per m2 of external wall (BP 6.1, EST). */
export const costWallIwi = linearCost(
  'wall-iwi-woodfibre',
  [EST_SOLID_WALL],
  'secondary',
  '2000',
  '95',
  externalWallAreaM2,
  'wall area',
);
/** Suspended timber floor: 500 pounds plus 35 per m2 of ground floor (BP 6.1, Which?). */
export const costFloor = linearCost(
  'floor-suspended-insulation',
  [WHICH_FLOOR],
  'secondary',
  '500',
  '35',
  floorAreaM2,
  'floor area',
);
/** Secondary low-E glazing: 200 pounds per m2 of window (BP 6.1, EST era benchmark). */
export const costGlazingSecondary = linearCost(
  'glazing-secondary-lowe',
  [],
  'estimate',
  '0',
  '200',
  windowAreaM2,
  'window area',
);
/** A-rated double glazing: 450 pounds per m2 of window (BP 6.1, EST era benchmark). */
export const costGlazingDouble = linearCost(
  'glazing-double-a',
  [],
  'estimate',
  '0',
  '450',
  windowAreaM2,
  'window area',
);
/** TRVs plus weather compensation: 350 pounds plus 40 per radiator (BP 6.1). */
export const costControls = linearCost(
  'controls-trv-weather-comp',
  [SAP_10_2_T4],
  'estimate',
  '350',
  '40',
  radiatorCount,
  'radiators',
);
/** MVHR: 3,500 pounds plus 50 per m2 of floor (BP 6.1, Trade2base). */
export const costMvhr = linearCost('vent-mvhr', [MVHR_COSTS], 'secondary', '3500', '50', tfaM2, 'floor area');

/** Inverter replacement at year 12 for PV (BP 6.1). */
export const PV_INVERTER = pounds('1000');
function pvCost(optionId: string, kWp: number): MeasureCost {
  return linearCost(optionId, [DESNZ_PV_COSTS], 'secondary', '1000', '1550', () => kWp, 'kWp', {
    replacements: [{ atYear: 12, cost: PV_INVERTER }],
  });
}
/** PV: 1,000 pounds plus 1,550 per kWp, inverter 1,000 at year 12 (BP 6.1, DESNZ MCS data). */
export const costPv2 = pvCost('pv-2kwp', 2);
export const costPv3 = pvCost('pv-3kwp', 3);
export const costPv4 = pvCost('pv-4kwp', 4);

/** Battery: 1,500 pounds plus 650 per kWh (BP 6.1, DESNZ medians). */
export const costBattery5 = linearCost(
  'battery-5kwh',
  [DESNZ_BATTERY_COSTS],
  'secondary',
  '1500',
  '650',
  () => 5,
  'kWh',
);
export const costBattery10 = linearCost(
  'battery-10kwh',
  [DESNZ_BATTERY_COSTS],
  'secondary',
  '1500',
  '650',
  () => 10,
  'kWh',
);

/** Solar thermal 3 m2: 3,000 pounds plus 700 per m2 of collector (BP 6.1, estimate). */
export const costSolarThermal = linearCost(
  'solar-thermal-3m2',
  [],
  'estimate',
  '3000',
  '700',
  () => 3,
  'collector area',
);

/** Cylinder jacket and pipe lagging: 30 to 150 pounds (BP 6.1, SAP Table 2), central 90. */
export const costCylinderJacket: MeasureCost = {
  ...base('cylinder-jacket', [SAP_10_2_T4], 'estimate'),
  cost(_twin, asOf) {
    const p = priced(pounds('90'), asOf, 'estimate');
    const vat = (x: MicroPence) => x + mulDiv(x, p.vatRate.n, p.vatRate.d);
    return { ...p, lo: vat(pounds('30')), hi: vat(pounds('150')) };
  },
};

/** New hot water cylinder as its own sub-option (SPEC 9), 1,600 pounds (ESTIMATE). */
export const costCylinderNew = fixedCost('cylinder-new', [IBASHO_ESTIMATE], 'estimate', '1600', 'esm');
/** Induction hob plus gas cap-off: 600 pounds hob, 400 pounds disconnection (ESTIMATE, 20% VAT). */
export const costHobInduction = fixedCost(
  'hob-induction-gas-disconnect',
  [IBASHO_ESTIMATE],
  'estimate',
  '1000',
  'standard',
);
/** BS 5250 / BS EN 15026 moisture risk assessment for IWI (`ENG.MOIST.IWI`), 900 pounds (ESTIMATE, 20% VAT). */
export const costAssessMoisture = fixedCost(
  'assess-moisture',
  [IBASHO_ESTIMATE],
  'estimate',
  '900',
  'standard',
);
/** PAS 2035 retrofit assessment and coordination (`UK.PAS2035`), 1,000 pounds (ESTIMATE, 20% VAT). */
export const costAssessPas2035 = fixedCost(
  'assess-pas2035',
  [IBASHO_ESTIMATE],
  'estimate',
  '1000',
  'standard',
);
/**
 * Like-for-like gas combi boiler, keyed by the `system` plugin id: the A_cf counterfactual and the
 * replacement that falls due in the "If nothing is done" run. 3,000 pounds installed (ESTIMATE, 20% VAT).
 */
export const costBoilerGasCombi = fixedCost(
  'gas-combi-condensing',
  [IBASHO_ESTIMATE],
  'estimate',
  '3000',
  'standard',
);

/** System replacement costs by `system` plugin id (A_cf, do-nothing replacements). */
export const UK_SYSTEM_COSTS: readonly MeasureCost[] = [costBoilerGasCombi];

export const UK_MEASURE_COSTS: readonly MeasureCost[] = [
  costLoft270,
  costLoft300,
  costDraught,
  costAshp,
  costAshpRadiatorsPlus,
  costWallEwi,
  costWallIwi,
  costFloor,
  costGlazingSecondary,
  costGlazingDouble,
  costControls,
  costMvhr,
  costPv2,
  costPv3,
  costPv4,
  costBattery5,
  costBattery10,
  costSolarThermal,
  costCylinderJacket,
  costCylinderNew,
  costHobInduction,
  costAssessMoisture,
  costAssessPas2035,
];
