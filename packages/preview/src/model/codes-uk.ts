/**
 * Preview pre-checks for new buildings in England (SPEC 27): Approved Document L 2021, the Future
 * Homes and Buildings Standard 2025 targets, Approved Document O (overheating, dwellings) and the
 * London Plan energy hierarchy (Policy SI 2, major developments in Greater London). Thresholds and
 * notional specifications are estimates (grade `estimate`) until a `codes-uk` pack reads them from
 * the documents. The energy ratios use site EUI from the Preview model as a proxy for the
 * primary energy and carbon comparisons the documents define; rows say so.
 */
import type {
  BaselineRow,
  BuildingDoc,
  BuildingResult,
  CodeRow,
  CompiledBuilding,
  Place,
  RatingRow,
} from '@ibasho/core';

const r1 = (x: number) => Math.round(x * 10) / 10;
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const vsMax = (lo: number, hi: number, limit: number): CodeRow['status'] =>
  hi <= limit ? true : lo > limit ? false : 'unknown';
const vsMin = (lo: number, hi: number, limit: number): CodeRow['status'] =>
  lo >= limit ? true : hi < limit ? false : 'unknown';

/** Dwelling-type buildings (Part O and the domestic notional apply). */
export const UK_DWELLING_TYPES = new Set(['apartments', 'rental', 'single-family']);

/** Greater London, roughly (London Plan applies; Part O high risk location in central London). */
export function inGreaterLondon(p: Place | undefined): boolean {
  return !!p && p.lat > 51.28 && p.lat < 51.7 && p.lon > -0.51 && p.lon < 0.34;
}
export function inCentralLondon(p: Place | undefined): boolean {
  return !!p && p.lat > 51.48 && p.lat < 51.56 && p.lon > -0.2 && p.lon < -0.02;
}

/** Existing buildings (permit before Part L 2021 came in) keep the existing-home rows only. */
export function isNewBuildUk(doc: BuildingDoc | undefined): boolean {
  return !doc?.permitDate || doc.permitDate >= '2022-06-15';
}

export interface UkCodes {
  codes: CodeRow[];
  ratings: RatingRow[];
  baselines: BaselineRow[];
}

/**
 * `notionalEui` and `fhsEui` are the Preview model's EUI for the same geometry with the Part L 2021
 * notional and the Future Homes notional specifications; `fossil` is true when the design burns gas.
 */
export function ukCodes(
  doc: BuildingDoc | undefined,
  compiled: CompiledBuilding,
  energy: BuildingResult,
  place: Place | undefined,
  notionalEui: number,
  fhsEui: number,
): UkCodes {
  const typeId = doc?.typeId ?? 'office';
  const dwelling = UK_DWELLING_TYPES.has(typeId);
  const eui = energy.eui.site;
  const ratio = { lo: r3(eui.lo / notionalEui), hi: r3(eui.hi / notionalEui) };
  const fossil = energy.bills.some((b) => b.carrier === 'gas');
  const baselines: BaselineRow[] = [
    {
      code: 'Part L 2021',
      builderId: 'preview.baseline.partl-notional',
      eui: { lo: r1(notionalEui * 0.95), hi: r1(notionalEui * 1.05) },
      ratio,
    },
  ];
  const codes: CodeRow[] = [];
  const app: CodeRow['applicability'] = 'partial';
  const pl = vsMax(ratio.lo, ratio.hi, 1);
  codes.push({
    ruleId: 'UK.PARTL.ENERGY',
    edition: '2021',
    status: pl,
    metric: 'epi.ratio',
    margin: { value: r3(1 - (ratio.lo + ratio.hi) / 2), unit: '1' },
    applicability: app,
    grade: 'estimate',
    clause: `AD L 2021 ${dwelling ? 'vol 1' : 'vol 2'}: primary energy and CO2 at most the notional building's (proxy: site EUI ratio)`,
    ...(pl === 'unknown' ? { unknownFacts: ['studio.code.range-straddles-limit'] } : {}),
  });
  codes.push({
    ruleId: 'UK.PARTL.FABRIC',
    edition: '2021',
    status: 'unknown',
    metric: 'u.wall',
    applicability: app,
    grade: 'estimate',
    clause: `AD L 2021 limiting U-values (${dwelling ? 'wall 0.26, roof 0.16, window 1.6' : 'wall 0.26, roof 0.18, window 1.6'} W/m²K)`,
    unknownFacts: ['b.wall.u', 'b.roof.u', 'z.glazing.u'],
  });
  const fr = { lo: r3(eui.lo / fhsEui), hi: r3(eui.hi / fhsEui) };
  const fhs: CodeRow['status'] = fossil ? false : vsMax(fr.lo, fr.hi, 1);
  codes.push({
    ruleId: 'UK.FHS.2025',
    edition: '2025',
    status: fhs,
    metric: 'epi.ratio',
    margin: { value: r3(1 - (fr.lo + fr.hi) / 2), unit: '1' },
    applicability: 'adoption-unconfirmed',
    grade: 'announced',
    clause: `Future ${dwelling ? 'Homes' : 'Buildings'} Standard: no fossil fuel heating, heat pump, notional fabric about wall 0.18, roof 0.11, window 1.2 W/m²K (proxy: site EUI ratio)`,
    ...(fossil
      ? { unknownFacts: [] }
      : fhs === 'unknown'
        ? { unknownFacts: ['studio.code.range-straddles-limit'] }
        : {}),
  });
  if (dwelling) {
    // AD O simplified method, Table 1.1: maximum glazing area as a share of floor area for the most
    // glazed facade; high risk (central London) 15% without cross ventilation, else 18% (moderate 18 / 25).
    const high = inCentralLondon(place);
    const floor = Number(compiled.quantities.ncaMm2) / 1e6;
    const most = Math.max(0, ...compiled.quantities.facades.map((f) => Number(f.openingMm2) / 1e6));
    const pct = floor > 0 ? (most / floor) * 100 : 0;
    const limit = high ? { lo: 15, hi: 18 } : { lo: 18, hi: 25 };
    const st: CodeRow['status'] = pct <= limit.lo ? true : pct > limit.hi ? false : 'unknown';
    codes.push({
      ruleId: 'UK.PARTO.GLAZING',
      edition: '2021',
      status: st,
      metric: 'wwr',
      margin: { value: r1(limit.lo - pct), unit: '%' },
      applicability: app,
      grade: 'estimate',
      clause: `AD O simplified method: most glazed facade ${r1(pct)}% of floor area against ${limit.lo}% (${limit.hi}% with cross ventilation), ${high ? 'high' : 'moderate'} risk location`,
      ...(st === 'unknown' ? { unknownFacts: ['z.crossVentilation'] } : {}),
    });
  }
  if (inGreaterLondon(place)) {
    const gia = Number(compiled.quantities.gfaMm2) / 1e6;
    const flats = dwelling ? Math.round(gia / 70) : 0;
    const major = gia >= 1000 || flats >= 10;
    const saving = { lo: r1((1 - ratio.hi) * 100), hi: r1((1 - ratio.lo) * 100) };
    const si2 = major ? vsMin(saving.lo, saving.hi, 35) : 'unknown';
    codes.push({
      ruleId: 'LONDON.PLAN.SI2',
      edition: '2021',
      status: si2,
      metric: 'savings.pct',
      margin: { value: r1((saving.lo + saving.hi) / 2 - 35), unit: '%' },
      applicability: major ? 'partial' : 'not-a-certificate',
      grade: 'estimate',
      clause:
        'London Plan SI 2: major developments net zero carbon, at least 35% on-site reduction beyond Part L 2021, the rest offset (proxy: site EUI against the notional)',
      ...(major ? {} : { unknownFacts: ['b.major'] }),
    });
    codes.push({
      ruleId: 'LONDON.PLAN.BE-LEAN',
      edition: '2021',
      status: 'unknown',
      metric: 'savings.pct',
      applicability: major ? 'partial' : 'not-a-certificate',
      grade: 'estimate',
      clause: `Be Lean: at least ${dwelling ? 10 : 15}% saving from energy efficiency alone (fabric and services, before renewables)`,
      unknownFacts: ['b.fabric'],
    });
  }
  return { codes, ratings: [], baselines };
}
