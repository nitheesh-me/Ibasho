/**
 * Estimated EPC band from the rating-mode run (`epc-proxy/rating`, SPEC R3, SF 3.1). Owner: WP-02.
 *
 * The rating run (WP-01) follows SAP 10.2 and RdSAP 10 conventions. This plugin prices its
 * delivered energy at RdSAP 10 Table 32 prices and standing charges (BP 7.1), credits PV export at
 * the Table 32 export price, and applies the published SAP energy cost rating:
 *
 *   ECF = 0.36 * cost_pounds / (TFA + 45)
 *   SAP = 117 - 121 * log10(ECF)   if ECF >= 3.5
 *   SAP = 100 - 13.95 * ECF        if ECF <  3.5
 *
 * The cost is exact (integer micro-pence); the rating is a float through `@ibasho/dmath` and is
 * quantised once to a whole SAP point, as on a certificate. Bands use SPEC 8 thresholds. The result
 * is a proxy, not an EPC: it always carries one band either side (SPEC 8, until AC-R1 passes), and
 * `nearThreshold` says whether the rating is within 3 points of a band edge (SF 3.1).
 *
 * The 0.36 deflator is the SAP 10.2 value recalled by the reviewer and not yet re-read against the
 * SAP PDF (grade `estimate`, R17 badge); SAP 2012 used 0.42 (SF 3.1).
 *
 * Contract gap: core `EpcProxy.sap(ratingResult)` has no floor area. The plugin also offers
 * `sapFor(ratingResult, tfaM2)`, which the engine uses; `sap` alone throws. INTERFACES asks WP-00
 * for a floor area argument.
 */
import {
  type Band,
  type EpcProxy,
  FUELS,
  type Fuel,
  type MicroPence,
  quantise,
  type SimResult,
} from '@ibasho/core';
import { log10 } from '@ibasho/dmath';
import { provenance, RDSAP_10_T32, SAP_10_2_RATING } from './sources.ts';
import { pencePerKwhToMicroPencePerWh } from './tariffs.ts';

export class EpcProxyError extends Error {
  override name = 'EpcProxyError';
}

/** RdSAP 10 Table 32 unit prices (p/kWh) and standing charges (pounds per year), BP 7.1. */
export const RDSAP_10_PRICES: Readonly<Partial<Record<Fuel, { unitPence: string; standingPounds: string }>>> =
  {
    electricity: { unitPence: '13.19', standingPounds: '54' },
    gas: { unitPence: '3.48', standingPounds: '120' },
    oil: { unitPence: '7.64', standingPounds: '0' },
  };
/** RdSAP 10 Table 32 export price, p/kWh (BP 7.1). */
export const RDSAP_10_EXPORT_PENCE = '13.19';
/** SAP 10.2 energy cost deflator (section 13). */
export const SAP_DEFLATOR = 0.36;

/** SPEC 8 thresholds, best first. Mirrors `BAND_THRESHOLDS` in `@ibasho/spec-gen` (Lean `sapBand`). */
const THRESHOLDS: readonly [Band, number][] = [
  ['A', 92],
  ['B', 81],
  ['C', 69],
  ['D', 55],
  ['E', 39],
  ['F', 21],
];

export function bandOfSap(sap: number): Band {
  for (const [b, min] of THRESHOLDS) if (sap >= min) return b;
  return 'G';
}

const POUND = 100_000_000n;

/** Annual running cost of a rating run at RdSAP 10 prices, micro-pence (exact). */
export function ratingCost(r: SimResult): MicroPence {
  let total = 0n;
  for (const f of FUELS) {
    let wh = 0n;
    for (const x of r.deliveredWh[f]) wh += x;
    const used = r.deliveredWh[f].some((x) => x !== 0n);
    if (!used && f !== 'electricity') continue;
    const p = RDSAP_10_PRICES[f];
    if (!p) throw new EpcProxyError(`RdSAP 10 Table 32 price for ${f} is not in this pack`);
    total += wh * pencePerKwhToMicroPencePerWh(p.unitPence);
    total += BigInt(p.standingPounds) * POUND;
  }
  let exported = 0n;
  for (const x of r.exportWh) exported += x;
  total -= exported * pencePerKwhToMicroPencePerWh(RDSAP_10_EXPORT_PENCE);
  return total;
}

export interface SapEstimate {
  /** Whole SAP points (quantised once). */
  sap: number;
  band: Band;
  nearThreshold: boolean;
  /** Exact cost at RdSAP prices, micro-pence per year. */
  costMicroPence: MicroPence;
  ecf: number;
}

/** SAP rating proxy for a rating-mode run of a home with floor area `tfaM2`. */
export function sapEstimate(r: SimResult, tfaM2: number): SapEstimate {
  if (r.mode !== 'rating') throw new EpcProxyError(`the EPC proxy needs a rating run, got ${r.mode}`);
  if (!(tfaM2 > 0)) throw new EpcProxyError('floor area must be positive');
  const cost = ratingCost(r);
  const ecf = (SAP_DEFLATOR * (Number(cost) / Number(POUND))) / (tfaM2 + 45);
  const raw = ecf >= 3.5 ? 117 - 121 * log10(ecf) : 100 - 13.95 * ecf;
  const sap = Number(quantise(raw));
  const nearThreshold = THRESHOLDS.some(([, t]) => sap - t < 3 && t - sap <= 3);
  return { sap, band: bandOfSap(sap), nearThreshold, costMicroPence: cost, ecf };
}

/** `EpcProxy` plus the floor-area entry point the engine calls (see the contract gap above). */
export interface EpcProxyWithArea extends EpcProxy {
  sapFor(ratingResult: SimResult, tfaM2: number): { sap: number; band: Band; nearThreshold: boolean };
}

export const epcProxyRating: EpcProxyWithArea = {
  kind: 'epc-proxy',
  id: 'epc-proxy/rating',
  version: '0.1.0',
  title: 'money.epc-proxy.rating',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([RDSAP_10_T32, SAP_10_2_RATING], 'estimate'),
  sap() {
    throw new EpcProxyError('epc-proxy/rating needs the floor area: call sapFor(ratingResult, tfaM2)');
  },
  sapFor(r, tfaM2) {
    const e = sapEstimate(r, tfaM2);
    return { sap: e.sap, band: e.band, nearThreshold: e.nearThreshold };
  },
};
