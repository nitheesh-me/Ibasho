/**
 * Real code pre-checks, baselines and rating ladders (WP-19, V-5; SPEC 23, R34 to R36).
 *
 * - India: ECSBC 2024 (with the ECBC 2017 values it keeps) prescriptive rows read declared design
 *   values (`StageIn.codes.params`) and the compiled geometry; anything not declared is unknown,
 *   never the energy model's assumed default. The performance row runs the real energy engine on
 *   the same geometry with the standard design and tests the EPI ratio by tier. Eco Niwas Samhita
 *   RETV, roof U and openable area for homes; NBC openings for habitable rooms; TSECBC scope in
 *   Telangana; the 2026 draft rating rule.
 * - England: Part L 2021 against the notional building (carbon), limiting fabric values, the Future
 *   Homes and Buildings Standard (heat pump notional, no fossil fuel), Part O simplified method for
 *   homes, the London Plan energy hierarchy in Greater London.
 * - Everywhere: ASHRAE 90.1-2022 Appendix G (baseline generated from the proposed geometry: Table
 *   G3 envelope and lighting, WWR capped at 40%), PCI against PCIt.
 * - Ratings on one savings axis: GHMC stars, LEED v4.1 (cost and GHG) and v5 energy, LEED indoor
 *   water, IGBC, GRIHA, EDGE energy, the BEE office star band.
 *
 * Statuses are met (true), not met (false) or unknown; a range that straddles a limit is unknown.
 * The words "compliant" and "certified" are never used.
 */
import type {
  BaselineRow,
  BuildingDoc,
  BuildingResult,
  CodeRow,
  CompiledBuilding,
  EnergyParams,
  FacadeBin,
  Place,
  RatingRow,
  RatingSchemePlugin,
  SiteContext,
  StageIn,
  TypeLibrary,
} from '@ibasho/core';
import { END_USES, editionFor, isZoneTwin, ratingStepFor } from '@ibasho/core';
import { computeRealEnergy } from '../enduse/provider.ts';
import { resolveSpace } from '../zones/library.ts';
import type { CodesCatalogue, Limit, Tiers } from './catalogue.ts';

const r1 = (x: number) => Math.round(x * 10) / 10;
const r3 = (x: number) => Math.round(x * 1000) / 1000;
type Status = CodeRow['status'];
const vsMax = (lo: number, hi: number, limit: number): Status =>
  hi <= limit ? true : lo > limit ? false : 'unknown';
const vsMin = (lo: number, hi: number, limit: number): Status =>
  lo >= limit ? true : hi < limit ? false : 'unknown';
const STRADDLE = 'studio.code.range-straddles-limit';
const NEAR = 'studio.code.near-threshold';
const RESIDENTIAL = new Set(['apartments', 'rental', 'single-family']);
const DAY24 = new Set(['hotel', 'hospital']);

/** Highest tier (1 to 3) whose upper limit `value` meets, or undefined. */
function tierMax(value: number, t: Tiers): 1 | 2 | 3 | undefined {
  return value <= t[2] ? 3 : value <= t[1] ? 2 : value <= t[0] ? 1 : undefined;
}

export function inIndia(p: Place | undefined): boolean {
  return !!p && p.lat >= 6 && p.lat <= 37.5 && p.lon >= 68 && p.lon <= 97.5;
}
export function inTelangana(p: Place | undefined): boolean {
  return !!p && p.lat >= 15.8 && p.lat <= 19.95 && p.lon >= 77.2 && p.lon <= 81.4;
}
export function inEngland(p: Place | undefined): boolean {
  return !!p && p.lat >= 49.8 && p.lat <= 55.9 && p.lon >= -6.5 && p.lon <= 1.8;
}
export function inGreaterLondon(p: Place | undefined): boolean {
  return !!p && p.lat > 51.28 && p.lat < 51.7 && p.lon > -0.51 && p.lon < 0.34;
}
export function inCentralLondon(p: Place | undefined): boolean {
  return !!p && p.lat > 51.48 && p.lat < 51.56 && p.lon > -0.2 && p.lon < -0.02;
}

/** Which code families apply: the place's packs, else by location. */
export function familiesFor(
  codePackIds: readonly string[],
  site: SiteContext | undefined,
): { india: boolean; uk: boolean } {
  const p = site?.place;
  const india = codePackIds.some((c) => c.endsWith('-in')) || (codePackIds.length === 0 && inIndia(p));
  const uk =
    !india && (codePackIds.some((c) => c.endsWith('-uk')) || (codePackIds.length === 0 && inEngland(p)));
  return { india, uk };
}

/** Annual total Wh (PV netted) of a result. */
export function totalWh(r: BuildingResult): number {
  let s = 0;
  for (const u of END_USES) for (const v of r.endUses[u]) if (v !== 'unknown') s += Number(v);
  return s;
}
const annual = (r: BuildingResult, u: (typeof END_USES)[number]) =>
  r.endUses[u].reduce<number>((s, v) => s + (v === 'unknown' ? 0 : Number(v)), 0);

/** Proposed EUI range (from the energy result) and its central value. */
function euiOf(r: BuildingResult): { lo: number; hi: number; mid: number } {
  return { lo: r.eui.site.lo, hi: r.eui.site.hi, mid: (r.eui.site.lo + r.eui.site.hi) / 2 };
}

/** Area-weighted lighting power density of the design, W/m² (type library typical times the lever). */
export function designLpd(
  compiled: CompiledBuilding,
  lib: TypeLibrary,
  params: EnergyParams | undefined,
): number {
  if (!isZoneTwin(compiled.twin)) return 0;
  let w = 0;
  let a = 0;
  for (const z of compiled.twin.zones) {
    const m2 = Number(z.floorMm2) / 1e6;
    w += resolveSpace(lib, z.spaceTypeIds[0]).space.lpdWm2.typical * m2;
    a += m2;
  }
  return a > 0 ? (w / a) * (params?.lpdScale ?? 1) : 0;
}

export interface CodesRun {
  codes: CodeRow[];
  ratings: RatingRow[];
  baselines: BaselineRow[];
}

interface Ctx {
  input: StageIn['codes'];
  cat: CodesCatalogue;
  lib: TypeLibrary;
  /** Rough tier: no baseline runs, performance rows unknown, no ratings. */
  rough: boolean;
  typeId: string;
  bua: number;
  place: Place | undefined;
  eui: { lo: number; hi: number; mid: number };
}

function row(
  ruleId: string,
  edition: string,
  status: Status,
  lim: Pick<Limit<unknown>, 'clause' | 'grade'>,
  extra: Partial<CodeRow> = {},
): CodeRow {
  return {
    ruleId,
    edition,
    status,
    applicability: 'partial',
    grade: lim.grade,
    clause: lim.clause,
    ...extra,
  };
}

/** EUI of the same geometry with another specification, on the real engine (same site and weather). */
function specEui(x: Ctx, spec: EnergyParams): { eui: number; result: BuildingResult } {
  const result = computeRealEnergy(
    {
      compiled: x.input.compiled,
      ...(x.input.site ? { site: x.input.site } : {}),
      settings: [],
      params: spec,
      asOf: x.input.asOf,
    },
    x.lib,
  );
  const m2 = Number(x.input.compiled.quantities.ncaMm2) / 1e6;
  return { eui: m2 > 0 ? totalWh(result) / 1000 / m2 : 0, result };
}

function ladder(
  s: RatingSchemePlugin,
  value: { lo: number; hi: number } | 'unknown',
  applicability: RatingRow['applicability'],
  edition?: string,
): RatingRow {
  const grade = s.provenance?.grade ?? 'estimate';
  if (value === 'unknown')
    return {
      scheme: s.scheme,
      edition: edition ?? s.edition,
      metric: s.metric,
      value,
      points: { likely: 'unknown' },
      level: { likely: 'unknown' },
      applicability,
      grade,
    };
  const likely = ratingStepFor(s.steps, (value.lo + value.hi) / 2);
  const possible = ratingStepFor(s.steps, value.hi);
  return {
    scheme: s.scheme,
    edition: edition ?? s.edition,
    metric: s.metric,
    value: { lo: r1(value.lo), hi: r1(value.hi) },
    points: { likely: likely?.points ?? 0, ...(possible ? { possible: possible.points } : {}) },
    level: { likely: likely?.level ?? 'none', ...(possible ? { possible: possible.level } : {}) },
    applicability,
    grade,
  };
}

const schemeById = (cat: CodesCatalogue, id: string) => cat.ratings.find((s) => s.id === id);

// ---------------------------------------------------------------------------------------------
// ASHRAE 90.1 Appendix G (everywhere, non-residential and multifamily)

function appG(x: Ctx, out: CodesRun): { improvementPct?: { lo: number; hi: number } } {
  const g = x.cat.appG;
  const hot = (x.place?.lat ?? 17) < 35;
  const env = hot ? g.envelope.hot : g.envelope.mixed;
  const lpdBase = g.lpd.value[x.typeId] ?? 10.8;
  const lpdDesign = designLpd(x.input.compiled, x.lib, undefined);
  const wwrScale: Partial<Record<FacadeBin, number>> = {};
  for (const f of x.input.compiled.quantities.facades) {
    const wwr = f.grossMm2 > 0n ? Number(f.openingMm2) / Number(f.grossMm2) : 0;
    if (wwr > g.wwrCap.value) wwrScale[f.bin] = g.wwrCap.value / wwr;
  }
  const spec: EnergyParams = { ...env.value, lpdScale: lpdDesign > 0 ? lpdBase / lpdDesign : 1, wwrScale };
  const bpf = g.bpf.value[x.typeId] ?? 0.5;
  if (x.rough) {
    out.codes.push(
      row('GL.A90.PRM', '90.1-2022', 'unknown', env, {
        metric: 'pci',
        unknownFacts: ['studio.code.baseline-pending'],
        clause: `${env.clause}; PCI at most PCIt`,
      }),
    );
    return {};
  }
  const base = specEui(x, spec);
  // Energy stands in for cost (one electricity tariff); plug loads are the unregulated part.
  const baseTotal = totalWh(base.result);
  const unreg = annual(base.result, 'equipment');
  const pcit = baseTotal > 0 ? (unreg + bpf * (baseTotal - unreg)) / baseTotal : bpf;
  const pci = { lo: x.eui.lo / base.eui, hi: x.eui.hi / base.eui };
  const st = vsMax(pci.lo, pci.hi, pcit);
  out.baselines.push({
    code: 'ASHRAE 90.1-2022 App G',
    builderId: 'real.baseline.ashrae-appg',
    eui: { lo: r1(base.eui * 0.97), hi: r1(base.eui * 1.03) },
    ratio: { lo: r3(pci.lo), hi: r3(pci.hi) },
  });
  out.codes.push(
    row('GL.A90.PRM', '90.1-2022', st, g.bpf, {
      metric: 'pci',
      margin: { value: r3(pcit - (pci.lo + pci.hi) / 2), unit: '1' },
      applicability: 'professional',
      clause: `Appendix G: PCI ${r3((pci.lo + pci.hi) / 2)} against PCIt ${r3(pcit)} (BPF ${bpf}); baseline envelope ${env.clause}, lighting ${lpdBase} W/m², WWR at most 40%; same plant as proposed, energy as the cost proxy`,
      ...(st === 'unknown' ? { unknownFacts: [STRADDLE] } : {}),
    }),
  );
  return { improvementPct: { lo: (1 - pci.hi / pcit) * 100, hi: (1 - pci.lo / pcit) * 100 } };
}

// ---------------------------------------------------------------------------------------------
// India

function india(x: Ctx, out: CodesRun): { savingsPct?: { lo: number; hi: number } } {
  const c = x.cat.india;
  const p = x.input.params ?? {};
  const { applicability } = editionFor(x.cat.indiaEditions, x.input.doc.permitDate);
  const app = applicability;
  const ed = 'ECSBC 2024';
  const q = x.input.compiled.quantities;
  const near = (limit: number): Status => (Math.abs(x.bua - limit) < x.bua * 0.1 ? 'unknown' : x.bua > limit);
  const res = RESIDENTIAL.has(x.typeId);
  /** Share of habitable floor area whose rooms reach the NBC opening ratio, and the rooms that do not. */
  const habitableOpenings = () => {
    if (!isZoneTwin(x.input.compiled.twin)) return undefined;
    const t = x.input.compiled.twin;
    let ok = 0;
    let all = 0;
    let short = 0;
    for (const z of t.zones) {
      const sp = resolveSpace(x.lib, z.spaceTypeIds[0]).space;
      const floor = Number(z.floorMm2);
      if (!sp.habitable || floor <= 0) continue;
      const open = t.surfaces
        .filter((s) => s.zoneId === z.id && (s.kind === 'window' || s.kind === 'door'))
        .reduce((s, w) => s + Number(w.areaMm2), 0);
      all += floor;
      if (open / floor >= c.nbc.openingRatio.value) ok += floor;
      else short += z.roomIds.length;
    }
    return all > 0 ? { share: ok / all, short } : undefined;
  };
  // Openings drawn to size decide; a window ratio rule is an estimate, so a shortfall stays unknown.
  const drawnOpenings = x.input.doc.storeys.every((st) =>
    st.rooms.every((r) =>
      r.segments.every(
        (g) => g.window.kind === 'none' || g.window.kind === 'single' || g.window.kind === 'detailed',
      ),
    ),
  );
  const nbc = habitableOpenings();
  if (nbc !== undefined) {
    out.codes.push(
      row(
        'NBC.OPENINGS',
        '2016',
        nbc.share >= 0.999 ? true : drawnOpenings ? false : 'unknown',
        c.nbc.openingRatio,
        {
          metric: 'opening.ratio',
          margin: { value: r1(nbc.share * 100 - 100), unit: '%' },
          applicability: 'reference',
          ...(nbc.share < 0.999 && !drawnOpenings ? { unknownFacts: ['z.openingM2'] } : {}),
          clause: `${c.nbc.openingRatio.clause}: ${r1(nbc.share * 100)}% of habitable floor area meets it with the window sizes as estimated${nbc.short ? `, ${nbc.short} rooms short (inner rooms need a light well, a court or a borrowed light opening)` : ''}`,
        },
      ),
    );
  }
  if (res) {
    // Eco Niwas Samhita: RETV over walls and windows (roof excluded); undeclared U or SHGC is a range.
    const k = c.ens.coeff.value;
    let lo = 0;
    let hi = 0;
    let env = 0;
    const uw = p.uWall !== undefined ? [p.uWall, p.uWall] : [1.5, 2.5];
    const un = p.uWin !== undefined ? [p.uWin, p.uWin] : [4.5, 5.8];
    const sg = p.shgc !== undefined ? [p.shgc, p.shgc] : [0.45, 0.75];
    for (const f of q.facades) {
      const w = c.ens.omega.value[f.bin] ?? 1;
      const aw = Number(f.openingMm2) / 1e6;
      const ao = Number(f.grossMm2 - f.openingMm2) / 1e6;
      env += aw + ao;
      lo +=
        k.a * (uw[0] as number) * ao * w +
        k.b * (un[0] as number) * aw * w +
        k.c * (sg[0] as number) * aw * w;
      hi +=
        k.a * (uw[1] as number) * ao * w +
        k.b * (un[1] as number) * aw * w +
        k.c * (sg[1] as number) * aw * w;
    }
    const retv = { lo: env ? lo / env : 0, hi: env ? hi / env : 0 };
    const rs = vsMax(retv.lo, retv.hi, c.ens.retvMax.value);
    const missing = [
      p.uWall === undefined ? 'b.wall.u' : '',
      p.uWin === undefined ? 'z.glazing.u' : '',
      p.shgc === undefined ? 'z.glazing.shgc' : '',
    ].filter(Boolean);
    out.codes.push(
      row('ENS.RETV', '2018', rs, c.ens.retvMax, {
        metric: 'retv',
        margin: { value: r1(c.ens.retvMax.value - (retv.lo + retv.hi) / 2), unit: 'W/m2' },
        applicability: app,
        ...(rs === 'unknown' ? { unknownFacts: missing.length ? missing : [STRADDLE] } : {}),
      }),
    );
    out.codes.push(
      p.uRoof !== undefined
        ? row('ENS.UROOF', '2018', p.uRoof <= c.ens.roofU.value, c.ens.roofU, {
            metric: 'u.roof',
            margin: { value: r3(c.ens.roofU.value - p.uRoof), unit: 'W/m2K' },
            applicability: app,
          })
        : row('ENS.UROOF', '2018', 'unknown', c.ens.roofU, {
            metric: 'u.roof',
            applicability: app,
            unknownFacts: ['b.roof.u'],
          }),
    );
    const floor = Number(q.ncaMm2) / 1e6;
    const winA = q.facades.reduce((s, f) => s + Number(f.openingMm2), 0) / 1e6;
    const wfr = {
      lo: floor ? (winA * c.ens.openableShare.lo) / floor : 0,
      hi: floor ? (winA * c.ens.openableShare.hi) / floor : 0,
    };
    const ws = vsMin(wfr.lo, wfr.hi, c.ens.wfrOp.value);
    out.codes.push(
      row('ENS.OPENABLE', '2018', ws, c.ens.wfrOp, {
        metric: 'wfr.op',
        margin: { value: r3((wfr.lo + wfr.hi) / 2 - c.ens.wfrOp.value), unit: '1' },
        applicability: app,
        ...(ws === 'unknown' ? { unknownFacts: ['z.openableM2'] } : {}),
      }),
    );
    out.codes.push(
      row('MOP.2026.RATING', '2026 draft', near(c.scope.mopBuaM2.value), c.scope.mopBuaM2, {
        applicability: 'adoption-unconfirmed',
        margin: { value: Math.round(x.bua - c.scope.mopBuaM2.value), unit: 'm2' },
      }),
    );
    return {};
  }
  // Non-residential: scope.
  const kva = Math.max(0, ...x.input.energy.bills.map((b) => b.demandKva ?? 0));
  const scopeSt: Status = kva >= c.scope.contractDemandKva.value ? true : kva > 0 ? false : 'unknown';
  out.codes.push(
    row('ECSBC.SCOPE', ed, scopeSt, c.scope.contractDemandKva, {
      margin: { value: Math.round(kva - c.scope.contractDemandKva.value), unit: 'kVA' },
      applicability: app,
      ...(scopeSt === 'unknown' ? { unknownFacts: ['b.contractDemandKva'] } : {}),
    }),
  );
  if (inTelangana(x.place)) {
    const ts = near(c.scope.tsecbcBuaM2.value);
    out.codes.push(
      row('TSECBC.SCOPE', '2014', ts, c.scope.tsecbcBuaM2, {
        margin: { value: Math.round(x.bua - c.scope.tsecbcBuaM2.value), unit: 'm2' },
        applicability: 'reference',
        ...(ts === 'unknown' ? { unknownFacts: [NEAR] } : {}),
      }),
    );
  }
  const mop = near(c.scope.mopBuaM2.value);
  out.codes.push(
    row('MOP.2026.RATING', '2026 draft', mop, c.scope.mopBuaM2, {
      applicability: 'adoption-unconfirmed',
      margin: { value: Math.round(x.bua - c.scope.mopBuaM2.value), unit: 'm2' },
      ...(mop === 'unknown' ? { unknownFacts: [NEAR] } : {}),
    }),
  );
  // Prescriptive envelope.
  const gross = q.facades.reduce((s, f) => s + Number(f.grossMm2), 0);
  const open = q.facades.reduce((s, f) => s + Number(f.openingMm2), 0);
  const wwr = gross > 0 ? open / gross : 0;
  out.codes.push(
    row('ECSBC.ENV.WWR', ed, wwr <= c.envelope.wwrMax.value, c.envelope.wwrMax, {
      metric: 'wwr',
      margin: { value: r1((c.envelope.wwrMax.value - wwr) * 100), unit: '%' },
      applicability: app,
    }),
  );
  const uRow = (
    ruleId: string,
    metric: CodeRow['metric'],
    v: number | undefined,
    lim: Limit<Tiers>,
    fact: string,
  ) => {
    if (v === undefined)
      return row(ruleId, ed, 'unknown', lim, {
        metric: metric as NonNullable<CodeRow['metric']>,
        applicability: app,
        unknownFacts: [fact],
      });
    const tier = tierMax(v, lim.value);
    return row(ruleId, ed, tier !== undefined, lim, {
      metric: metric as NonNullable<CodeRow['metric']>,
      margin: { value: r3(lim.value[0] - v), unit: 'W/m2K' },
      applicability: app,
      ...(tier ? { tier } : {}),
    });
  };
  out.codes.push(
    uRow(
      'ECSBC.ENV.UROOF',
      'u.roof',
      p.uRoof,
      DAY24.has(x.typeId) ? c.envelope.roofU24h : c.envelope.roofU,
      'b.roof.u',
    ),
  );
  out.codes.push(uRow('ECSBC.ENV.UWALL', 'u.wall', p.uWall, c.envelope.wallU, 'b.wall.u'));
  out.codes.push(uRow('ECSBC.ENV.UWIN', 'u.window', p.uWin, c.envelope.windowU, 'z.glazing.u'));
  if (p.shgc === undefined)
    out.codes.push(
      row('ECSBC.ENV.SHGC', ed, 'unknown', c.envelope.shgcMax, {
        metric: 'shgc.eff',
        applicability: app,
        unknownFacts: ['z.glazing.shgc'],
      }),
    );
  else {
    const tier = tierMax(p.shgc, c.envelope.shgcMax.value);
    out.codes.push(
      row('ECSBC.ENV.SHGC', ed, tier !== undefined, c.envelope.shgcMax, {
        metric: 'shgc.eff',
        margin: { value: r3(c.envelope.shgcMax.value[0] - p.shgc), unit: '1' },
        applicability: app,
        ...(tier ? { tier } : {}),
      }),
    );
  }
  if (p.roofAbsorptance === undefined)
    out.codes.push(
      row('ECSBC.ENV.COOLROOF', ed, 'unknown', c.envelope.coolRoofReflectance, {
        metric: 'sr.roof',
        applicability: app,
        unknownFacts: ['b.roof.reflectance'],
      }),
    );
  else {
    const sr = 1 - p.roofAbsorptance;
    out.codes.push(
      row(
        'ECSBC.ENV.COOLROOF',
        ed,
        sr >= c.envelope.coolRoofReflectance.value,
        c.envelope.coolRoofReflectance,
        {
          metric: 'sr.roof',
          margin: { value: r3(sr - c.envelope.coolRoofReflectance.value), unit: '1' },
          applicability: app,
        },
      ),
    );
  }
  // Lighting power (building area method by type).
  const lpdLim = c.lpd[x.typeId] ?? c.lpd['office'];
  if (lpdLim) {
    const lpd = designLpd(x.input.compiled, x.lib, x.input.params);
    const tier = tierMax(lpd, lpdLim.value);
    out.codes.push(
      row('ECSBC.LTG.LPD', ed, tier !== undefined, lpdLim, {
        metric: 'lpd',
        margin: { value: r1(lpdLim.value[0] - lpd), unit: 'W/m2' },
        applicability: app,
        ...(tier ? { tier } : {}),
      }),
    );
  }
  // Daylight: the ECSBC metric is a UDI share; only a site result that computed it can answer.
  const rooms = x.input.daylight?.rooms.filter((r) => r.ecbcShare) ?? [];
  if (rooms.length === 0)
    out.codes.push(
      row('ECSBC.DAYLIGHT', ed, 'unknown', c.daylightShare, {
        metric: 'udi.share',
        applicability: app,
        unknownFacts: ['z.udiShare'],
      }),
    );
  else {
    const share =
      rooms.reduce((s, r) => s + ((r.ecbcShare?.lo ?? 0) + (r.ecbcShare?.hi ?? 0)) / 2, 0) / rooms.length;
    const tier =
      share >= c.daylightShare.value[2]
        ? 3
        : share >= c.daylightShare.value[1]
          ? 2
          : share >= c.daylightShare.value[0]
            ? 1
            : undefined;
    out.codes.push(
      row('ECSBC.DAYLIGHT', ed, tier !== undefined, c.daylightShare, {
        metric: 'udi.share',
        margin: { value: r1(share - c.daylightShare.value[0]), unit: '%' },
        applicability: app,
        ...(tier ? { tier } : {}),
      }),
    );
  }
  // Renewables share of contract demand (Plus and Super tiers only).
  if (kva > 0) {
    const share = (p.pvKwp ?? 0) / kva;
    const tier = share >= c.renewableShare.value[2] ? 3 : share >= c.renewableShare.value[1] ? 2 : 1;
    out.codes.push(
      row('ECSBC.RE-SHARE', ed, true, c.renewableShare, {
        metric: 're.share.cd',
        tier: tier as 1 | 2 | 3,
        margin: { value: r3(share), unit: '1' },
        applicability: app,
        clause: `${c.renewableShare.clause}: rooftop PV is ${r1(share * 100)}% of contract demand (no share needed for the ECSBC tier)`,
      }),
    );
  }
  // Whole building performance.
  if (x.rough) {
    out.codes.push(
      row('ECSBC.EPI-RATIO', ed, 'unknown', c.epiRatio, {
        metric: 'epi.ratio',
        applicability: app,
        unknownFacts: ['studio.code.baseline-pending'],
      }),
    );
    return {};
  }
  const lpdStd = lpdLim ? lpdLim.value[0] : 9.5;
  const lpdNow = designLpd(x.input.compiled, x.lib, undefined);
  const std = specEui(x, {
    ...c.standardDesign,
    lpdScale: lpdNow > 0 ? lpdStd / lpdNow : 1,
    ...(DAY24.has(x.typeId) ? { uRoof: c.envelope.roofU24h.value[0] } : {}),
  });
  const ratio = { lo: x.eui.lo / std.eui, hi: x.eui.hi / std.eui };
  const st = vsMax(ratio.lo, ratio.hi, c.epiRatio.value[0]);
  const tier =
    ratio.hi <= c.epiRatio.value[2]
      ? 3
      : ratio.hi <= c.epiRatio.value[1]
        ? 2
        : ratio.hi <= c.epiRatio.value[0]
          ? 1
          : undefined;
  out.baselines.push({
    code: 'ECSBC 2024',
    builderId: 'real.baseline.ecsbc-standard',
    eui: { lo: r1(std.eui * 0.97), hi: r1(std.eui * 1.03) },
    ratio: { lo: r3(ratio.lo), hi: r3(ratio.hi) },
  });
  out.codes.push(
    row('ECSBC.EPI-RATIO', ed, st, c.epiRatio, {
      metric: 'epi.ratio',
      margin: { value: r3(1 - (ratio.lo + ratio.hi) / 2), unit: '1' },
      applicability: app,
      ...(tier ? { tier } : {}),
      ...(st === 'unknown' ? { unknownFacts: [STRADDLE] } : {}),
    }),
  );
  return { savingsPct: { lo: (1 - ratio.hi) * 100, hi: (1 - ratio.lo) * 100 } };
}

// ---------------------------------------------------------------------------------------------
// England

function england(x: Ctx, out: CodesRun): void {
  const u = x.cat.uk;
  const doc: BuildingDoc = x.input.doc;
  const dwelling = RESIDENTIAL.has(x.typeId);
  const newBuild = !doc.permitDate || doc.permitDate >= '2022-06-15';
  if (!newBuild) {
    out.codes.push({
      ruleId: 'UK.EPC.ESTIMATE',
      edition: 'SAP 10.2',
      status: 'unknown',
      applicability: 'not-a-certificate',
      grade: 'estimate',
      clause: 'Existing home: an EPC needs an RdSAP assessment',
      unknownFacts: ['h.wall.u', 'h.roof.u'],
    });
    return;
  }
  const p = x.input.params ?? {};
  const lim = dwelling ? u.limitingDwelling : u.limitingNonDom;
  const fabric: [string, number | undefined, number][] = [
    ['b.wall.u', p.uWall, lim.value.wall],
    ['b.roof.u', p.uRoof, lim.value.roof],
    ['z.glazing.u', p.uWin, lim.value.window],
  ];
  const missing = fabric.filter((f) => f[1] === undefined).map((f) => f[0]);
  const fails = fabric.some((f) => f[1] !== undefined && (f[1] as number) > f[2]);
  out.codes.push(
    row('UK.PARTL.FABRIC', '2021', fails ? false : missing.length ? 'unknown' : true, lim, {
      metric: 'u.wall',
      ...(missing.length && !fails ? { unknownFacts: missing } : {}),
    }),
  );
  if (dwelling) {
    const high = inCentralLondon(x.place);
    const floor = Number(x.input.compiled.quantities.ncaMm2) / 1e6;
    const most = Math.max(0, ...x.input.compiled.quantities.facades.map((f) => Number(f.openingMm2) / 1e6));
    const pct = floor > 0 ? (most / floor) * 100 : 0;
    const band = high ? u.partO.value.high : u.partO.value.moderate;
    const st: Status = pct <= band.lo ? true : pct > band.hi ? false : 'unknown';
    out.codes.push(
      row('UK.PARTO.GLAZING', '2021', st, u.partO, {
        metric: 'wwr',
        margin: { value: r1(band.lo - pct), unit: '%' },
        clause: `${u.partO.clause}: most glazed facade ${r1(pct)}% of floor area, ${high ? 'high' : 'moderate'} risk location`,
        ...(st === 'unknown' ? { unknownFacts: ['z.crossVentilation'] } : {}),
      }),
    );
  }
  const fossil = x.input.energy.bills.some(
    (b) => b.carrier === 'gas' || b.carrier === 'lpg' || b.carrier === 'diesel',
  );
  if (x.rough) {
    out.codes.push(
      row('UK.PARTL.CO2', '2021', 'unknown', dwelling ? u.notionalDwelling : u.notionalNonDom, {
        metric: 'epi.ratio',
        unknownFacts: ['studio.code.baseline-pending'],
      }),
    );
    out.codes.push(
      row('UK.FHS.2025', '2025', fossil ? false : 'unknown', u.fhsNotional, {
        metric: 'epi.ratio',
        applicability: 'adoption-unconfirmed',
        ...(fossil ? {} : { unknownFacts: ['studio.code.baseline-pending'] }),
      }),
    );
    return;
  }
  const notional = specEui(x, (dwelling ? u.notionalDwelling : u.notionalNonDom).value);
  const fhs = specEui(x, u.fhsNotional.value);
  const co2 = (r: BuildingResult) => {
    const gas = r.bills.some((b) => b.carrier === 'gas');
    const elec = END_USES.filter((e) => !(gas && (e === 'heating' || e === 'hot-water'))).reduce(
      (s, e) => s + annual(r, e),
      0,
    );
    const g = gas ? annual(r, 'heating') + annual(r, 'hot-water') : 0;
    return (Math.max(0, elec) * u.carbon.value.electricity + g * u.carbon.value.gas) / 1000;
  };
  const spread = (x.eui.hi - x.eui.lo) / Math.max(1e-9, 2 * x.eui.mid);
  const mine = co2(x.input.energy);
  const ratio = {
    lo: (mine * (1 - spread)) / co2(notional.result),
    hi: (mine * (1 + spread)) / co2(notional.result),
  };
  const pl = vsMax(ratio.lo, ratio.hi, 1);
  out.baselines.push({
    code: 'Part L 2021',
    builderId: 'real.baseline.partl-notional',
    eui: { lo: r1(notional.eui * 0.97), hi: r1(notional.eui * 1.03) },
    ratio: { lo: r3(ratio.lo), hi: r3(ratio.hi) },
  });
  out.codes.push(
    row('UK.PARTL.CO2', '2021', pl, dwelling ? u.notionalDwelling : u.notionalNonDom, {
      metric: 'epi.ratio',
      margin: { value: r3(1 - (ratio.lo + ratio.hi) / 2), unit: '1' },
      clause: `${(dwelling ? u.notionalDwelling : u.notionalNonDom).clause}: emission rate at most the notional building's (SAP 10.2 factors)`,
      ...(pl === 'unknown' ? { unknownFacts: [STRADDLE] } : {}),
    }),
  );
  const fr = { lo: x.eui.lo / fhs.eui, hi: x.eui.hi / fhs.eui };
  const fs: Status = fossil ? false : vsMax(fr.lo, fr.hi, 1);
  out.codes.push(
    row('UK.FHS.2025', '2025', fs, u.fhsNotional, {
      metric: 'epi.ratio',
      margin: { value: r3(1 - (fr.lo + fr.hi) / 2), unit: '1' },
      applicability: 'adoption-unconfirmed',
      clause: `${u.fhsNotional.clause}${fossil ? '; the design burns fossil fuel' : ''}`,
      ...(fs === 'unknown' ? { unknownFacts: [STRADDLE] } : {}),
    }),
  );
  if (inGreaterLondon(x.place)) {
    const lp = u.londonPlan;
    const homes = dwelling ? Math.round(x.bua / 70) : 0;
    const major = x.bua >= lp.majorGiaM2 || homes >= lp.majorHomes;
    const saving = { lo: (1 - ratio.hi) * 100, hi: (1 - ratio.lo) * 100 };
    const si2: Status = major ? vsMin(saving.lo, saving.hi, lp.onSiteSaving.value) : 'unknown';
    out.codes.push(
      row('LONDON.PLAN.SI2', '2021', si2, lp.onSiteSaving, {
        metric: 'savings.pct',
        margin: { value: r1((saving.lo + saving.hi) / 2 - lp.onSiteSaving.value), unit: '%' },
        applicability: major ? 'partial' : 'not-a-certificate',
        ...(major ? (si2 === 'unknown' ? { unknownFacts: [STRADDLE] } : {}) : { unknownFacts: ['b.major'] }),
      }),
    );
    // Be Lean: the saving before renewables (PV added back).
    const pvWh = -annual(x.input.energy, 'pv');
    const lean = (mine + (pvWh * u.carbon.value.electricity) / 1000) / co2(notional.result);
    const leanSaving = (1 - lean) * 100;
    const bar = dwelling ? lp.beLeanDwelling : lp.beLeanNonDom;
    out.codes.push(
      row('LONDON.PLAN.BE-LEAN', '2021', major ? leanSaving >= bar.value : 'unknown', bar, {
        metric: 'savings.pct',
        margin: { value: r1(leanSaving - bar.value), unit: '%' },
        applicability: major ? 'partial' : 'not-a-certificate',
        ...(major ? {} : { unknownFacts: ['b.major'] }),
      }),
    );
  }
}

// ---------------------------------------------------------------------------------------------

export function evaluateCodes(
  input: StageIn['codes'],
  cat: CodesCatalogue,
  lib: TypeLibrary,
  rough = false,
): CodesRun {
  const out: CodesRun = { codes: [], ratings: [], baselines: [] };
  const typeId = input.doc.typeId;
  const x: Ctx = {
    input,
    cat,
    lib,
    rough,
    typeId,
    bua: Number(input.compiled.quantities.gfaMm2) / 1e6,
    place: input.site?.place,
    eui: euiOf(input.energy),
  };
  const fam = familiesFor(input.codePackIds, input.site);
  let savings: { lo: number; hi: number } | undefined;
  if (fam.india) savings = india(x, out).savingsPct;
  if (fam.uk) england(x, out);
  const res = RESIDENTIAL.has(typeId);
  const tall =
    res && input.doc.storeys.filter((s) => !s.belowGrade).reduce((n, s) => n + s.multiplier, 0) >= 4;
  const improvement = !res || tall ? appG(x, out).improvementPct : undefined;
  if (rough) return out;
  // Ratings on one savings axis.
  const R = (id: string) => schemeById(cat, id);
  const add = (
    id: string,
    v: { lo: number; hi: number } | 'unknown' | undefined,
    app: RatingRow['applicability'],
    ed?: string,
  ) => {
    const s = R(id);
    if (s && v !== undefined) out.ratings.push(ladder(s, v, app, ed));
  };
  if (fam.india && savings) {
    add(
      'ratings.ghmc-stars',
      savings,
      inTelangana(x.place) ? 'partial' : 'not-a-certificate',
      'TSECBC 2014 (savings against the ECSBC standard design)',
    );
    add(
      'ratings.griha-energy',
      savings,
      'not-a-certificate',
      'v2019 energy optimisation (savings against the ECSBC standard design)',
    );
    add(
      'ratings.edge-energy',
      savings,
      'not-a-certificate',
      'v3 energy part only (water and materials not assessed)',
    );
  }
  if (improvement) {
    add(
      'ratings.leed41-ea-cost',
      improvement,
      'not-a-certificate',
      'v4.1 EAc cost (improvement below PCIt, energy as the cost proxy)',
    );
    add(
      'ratings.leed41-ea-ghg',
      improvement,
      'not-a-certificate',
      'v4.1 EAc GHG (single fuel, same as cost)',
    );
    add(
      'ratings.leed5-eee',
      improvement,
      'not-a-certificate',
      'v5 Enhanced Energy Efficiency (against the 90.1 baseline)',
    );
    add(
      'ratings.igbc-energy',
      improvement,
      'not-a-certificate',
      'Green New Buildings v3 energy (against the 90.1 baseline)',
    );
    add(
      'ratings.leed41-we-indoor',
      'unknown',
      'not-a-certificate',
      'v4.1 WEc indoor (fixture flow rates not given)',
    );
  }
  if (fam.india && typeId === 'office') {
    const gfa = Number(input.compiled.quantities.gfaMm2) / 1e6;
    const nca = Number(input.compiled.quantities.ncaMm2) / 1e6;
    const k = gfa > 0 ? nca / gfa : 1;
    // Headroom below 190 kWh/m²·yr built-up EPI (1 star at 190, then a star per 25).
    add(
      'ratings.bee-star-office',
      { lo: 190 - x.eui.hi * k, hi: 190 - x.eui.lo * k },
      'not-a-certificate',
      'existing offices, composite (needs a year of metered bills)',
    );
  }
  return out;
}

/** Rough tier and its cheaper sibling: prescriptive and scope rows only. */
export const evaluateCodesRough = (
  input: StageIn['codes'],
  cat: CodesCatalogue,
  lib: TypeLibrary,
): CodesRun => evaluateCodes(input, cat, lib, true);
