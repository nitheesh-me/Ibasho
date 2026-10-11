/**
 * Stage outputs to studio views (SPEC 19, 21, 22, 23, 25). Owner: WP-08.
 *
 * The stages are agent A's Preview providers (`@ibasho/preview`), with outputs in the core
 * contracts (`CompiledBuilding`, `SiteResult`, `BuildingResult`, `CodesOut`, `OptimiseResult`).
 * A view is what the panels read: evidence ids for every number (Preview sealed, so `Num` draws
 * the dashed underline and no seal) plus plain numbers for drawing marks. Swapping a stage to a
 * real provider changes nothing here: the contracts are the same.
 */
import type {
  BuildingDoc,
  BuildingResult,
  CodeRow,
  CodesOut,
  CompiledBuilding,
  EndUse,
  EvidenceId,
  EvidenceNode,
  FacadeBin,
  OptimiseResult,
  PlanCheck,
  SiteResult,
  StageId,
  StageOut,
  Tier,
} from '@ibasho/core';
import { FACADE_BINS, facadeBin } from '@ibasho/core';
import { type FacadeMeter, facadeMeters, overallWwrPm, quickQuantities, spaceFunction } from '@ibasho/editor';
import type { LadderRow } from '@ibasho/ui';
import { EvBag } from './ev.ts';
import type { Levers } from './settings.ts';

export interface GeometryView {
  gfa: EvidenceId;
  nca: EvidenceId;
  wwr: EvidenceId;
  gfaM2: number;
  ncaM2: number;
  wwrPm: number;
  rooms: number;
  untyped: number;
  untypedShare: number;
  meters: FacadeMeter[];
  checks: PlanCheck[];
  storeys: { id: string; name: string; areaM2: number; area: EvidenceId }[];
}
export interface SunView {
  roof: EvidenceId;
  roofH: number;
  facades: { bin: FacadeBin; ev: EvidenceId; h: number }[];
  neighbourLoss: EvidenceId;
  site: SiteResult;
}
export interface RadiationView {
  roof: EvidenceId;
  roofKwh: number;
  facades: { bin: FacadeBin; ev: EvidenceId; kwh: number }[];
  min: EvidenceId;
  max: EvidenceId;
  site: SiteResult;
}
export interface DaylightView {
  sda: EvidenceId;
  ase: EvidenceId;
  ecbc: EvidenceId;
  ecbcShare: number;
  storeys: { id: string; name: string; ev: EvidenceId; share: number }[];
  rooms: Record<string, number>;
  site: SiteResult;
}
export interface EnergyView {
  eui: EvidenceId;
  euiMid: number;
  euiLo: number;
  euiHi: number;
  source: EvidenceId;
  partial: boolean;
  missing: EndUse[];
  target: EvidenceId;
  targetMid: number;
  bands: { label: string; ev: EvidenceId }[];
  endUses: { use: EndUse; ev: EvidenceId; kwh: number; unknown?: boolean }[];
  monthlyKwh: number[];
  bill: EvidenceId;
  billRs: number;
  carbon: EvidenceId;
  fanHours: EvidenceId;
  acHours: EvidenceId;
  result: BuildingResult;
}
export interface CodesView {
  rows: { row: CodeRow; title: string; reading?: EvidenceId; limitText?: string }[];
  ladder: LadderRow[];
  savings: EvidenceId;
  savingsLo: number;
  savingsHi: number;
  baseline: EvidenceId;
  out: CodesOut;
}
export interface Cand {
  id: string;
  label: string;
  levers: Levers;
  capexRs: number;
  opexRs: number;
  eui: number;
  feasible: boolean;
  front: boolean;
}
export interface OptimiseView {
  candidates: Cand[];
  picks: { role: string; label: string; cand: Cand; capex: EvidenceId; opex: EvidenceId; eui: EvidenceId }[];
  tried: EvidenceId;
  frontCount: EvidenceId;
  goalLabel: string;
  out: OptimiseResult;
}
export interface StageViews {
  geometry: GeometryView;
  sun: SunView;
  radiation: RadiationView;
  daylight: DaylightView;
  energy: EnergyView;
  codes: CodesView;
  optimise: OptimiseView;
}
export interface StageResult<S extends StageId> {
  view: StageViews[S];
  nodes: EvidenceNode[];
}

export interface ViewCtx {
  key: string;
  placeId: string;
  variantId: string;
  doc: BuildingDoc;
  tier: Tier;
  /** Outputs so far in this job (geometry is needed by the site views). */
  outputs: Partial<StageOut>;
}

const conditioned = (id: string | undefined) => spaceFunction(id)?.conditioned ?? true;
const sig = (tier: Tier, fin = 3) => (tier === 'rough' ? 2 : fin);

/** Facade bin of a mesh surface (true azimuth), or roof. */
function binsOf(compiled: CompiledBuilding | undefined, doc: BuildingDoc) {
  const by = new Map<string, { kind: string; bin?: FacadeBin }>();
  for (const s of compiled?.meshes.surfaces ?? []) {
    by.set(s.id, {
      kind: s.kind,
      ...(s.kind === 'wall' || s.kind === 'window'
        ? { bin: facadeBin(s.azimuthMdeg + (compiled?.placement ? 0 : doc.rotationMdeg)) }
        : {}),
    });
  }
  return by;
}

function groupByBin<T>(
  site: SiteResult,
  compiled: CompiledBuilding | undefined,
  doc: BuildingDoc,
  pick: (s: SiteResult['surfaces'][number]) => number | undefined,
) {
  const bins = binsOf(compiled, doc);
  const acc = new Map<FacadeBin, number[]>();
  const roof: number[] = [];
  for (const s of site.surfaces) {
    const v = pick(s);
    if (v === undefined || !Number.isFinite(v)) continue;
    const m = bins.get(s.id);
    if (m?.kind === 'roof') roof.push(v);
    else if (m?.bin) acc.set(m.bin, [...(acc.get(m.bin) ?? []), v]);
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    facades: FACADE_BINS.filter((b) => acc.has(b)).map((bin) => ({ bin, v: mean(acc.get(bin) ?? []) })),
    roof: mean(roof),
  } as { facades: { bin: FacadeBin; v: number }[]; roof: number; _?: T };
}

export function geometryView(c: ViewCtx, compiled: CompiledBuilding, bag: EvBag): GeometryView {
  const q = quickQuantities(c.doc, conditioned);
  const meters = facadeMeters(c.doc);
  const wwrPm = overallWwrPm(meters);
  const gfaM2 = Number(compiled.quantities.gfaMm2) / 1e6;
  const ncaM2 = Number(compiled.quantities.ncaMm2) / 1e6;
  const names = new Map(c.doc.storeys.map((s) => [s.id, s.name]));
  return {
    gfa: bag.num('geom.gfa', gfaM2, 'm2', 3, 'Gross floor area (compile, exact mm²)'),
    nca: bag.num('geom.nca', ncaM2, 'm2', 3, 'Conditioned area (compile)'),
    wwr: bag.num('geom.wwr.overall', wwrPm / 10, '%', 2, 'Window over gross wall, above grade'),
    gfaM2,
    ncaM2,
    wwrPm,
    rooms: q.rooms,
    untyped: q.untyped,
    untypedShare: q.untypedShare,
    meters,
    checks: compiled.checks,
    storeys: compiled.quantities.storeys.map((s) => {
      const a = Number(s.gfaMm2) / 1e6;
      return {
        id: s.storeyId,
        name: names.get(s.storeyId) ?? s.storeyId,
        areaM2: a,
        area: bag.num(`geom.storey.${s.storeyId}`, a, 'm2', 3),
      };
    }),
  };
}

export function sunView(c: ViewCtx, site: SiteResult, bag: EvBag): SunView {
  const g = groupByBin(site, c.outputs.geometry, c.doc, (s) =>
    s.sunHours ? (s.sunHours.dailyMean.lo + s.sunHours.dailyMean.hi) / 2 : undefined,
  );
  const w = c.tier === 'rough' ? 0.12 : c.tier === 'refined' ? 0.06 : 0.03;
  const lost = site.ledger.reduce((s, l) => s + Number(l.lostWh), 0) / 1000;
  return {
    roof: bag.range('site.sunhours.roof', g.roof * (1 - w), g.roof * (1 + w), 'h/day', sig(c.tier, 2)),
    roofH: g.roof || 1,
    facades: g.facades.map((f) => ({
      bin: f.bin,
      h: f.v,
      ev: bag.range(`site.sunhours.${f.bin}`, f.v * (1 - w), f.v * (1 + w), 'h/day', sig(c.tier, 2)),
    })),
    neighbourLoss: bag.num(
      'site.ledger.total',
      lost,
      'kWh',
      2,
      'Sun the neighbours take from this building (shading ledger)',
    ),
    site,
  };
}

export function radiationView(c: ViewCtx, site: SiteResult, bag: EvBag): RadiationView {
  const g = groupByBin(site, c.outputs.geometry, c.doc, (s) =>
    s.irrWhm2 === 'unknown' ? undefined : s.irrWhm2.reduce((a, b) => a + Number(b), 0) / 1000,
  );
  const w = c.tier === 'rough' ? 0.1 : c.tier === 'refined' ? 0.05 : 0.02;
  const all = g.facades.map((f) => f.v);
  return {
    roof: bag.range('site.irr.roof', g.roof * (1 - w), g.roof * (1 + w), 'kWh/m2', sig(c.tier, 2)),
    roofKwh: g.roof || 1,
    facades: g.facades.map((f) => ({
      bin: f.bin,
      kwh: f.v,
      ev: bag.range(`site.irr.${f.bin}`, f.v * (1 - w), f.v * (1 + w), 'kWh/m2', sig(c.tier, 2)),
    })),
    min: bag.num('site.irr.min', all.length ? Math.min(...all) : 0, 'kWh/m2', 2),
    max: bag.num('site.irr.max', g.roof, 'kWh/m2', 2),
    site,
  };
}

export function daylightView(c: ViewCtx, site: SiteResult, bag: EvBag): DaylightView {
  const byRoom = new Map(site.rooms.map((r) => [r.id, r]));
  const rooms: Record<string, number> = {};
  const mid = (i: { lo: number; hi: number } | undefined) => (i ? (i.lo + i.hi) / 200 : undefined);
  let tot = 0;
  let lit = 0;
  let sdaSum = 0;
  let aseSum = 0;
  const storeys: DaylightView['storeys'] = [];
  for (const s of c.doc.storeys) {
    let sa = 0;
    let sl = 0;
    for (const r of s.rooms) {
      const d = byRoom.get(r.id);
      const share = mid(d?.ecbcShare) ?? mid(d?.sda) ?? 0;
      rooms[r.id] = share;
      if (!conditioned(r.spaceTypeId)) continue;
      const xs = r.floor.outer.map((p) => p[0]);
      const ys = r.floor.outer.map((p) => p[1]);
      const a = ((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))) / 1e6 || 1;
      sa += a;
      sl += a * share;
      sdaSum += a * (mid(d?.sda) ?? share);
      aseSum += a * (mid(d?.ase) ?? 0);
    }
    const share = sa > 0 ? sl / sa : 0;
    tot += sa;
    lit += sl;
    storeys.push({
      id: s.id,
      name: s.name,
      share,
      ev: bag.range(`day.ecbc_share.${s.id}`, 100 * share * 0.94, 100 * Math.min(1, share * 1.04), '%', 2),
    });
  }
  const share = tot > 0 ? lit / tot : 0;
  const w = c.tier === 'rough' ? 0.12 : 0.05;
  return {
    sda: bag.range(
      'day.sda.building',
      (100 * sdaSum * (1 - w)) / Math.max(1, tot),
      (100 * sdaSum * (1 + w)) / Math.max(1, tot),
      '%',
      sig(c.tier, 2),
      'sDA300/50, Preview tier T0',
    ),
    ase: bag.range(
      'day.ase.building',
      (100 * aseSum * (1 - w)) / Math.max(1, tot),
      (100 * aseSum * (1 + w)) / Math.max(1, tot),
      '%',
      2,
      'ASE1000,250',
    ),
    ecbc: bag.range(
      'day.ecbc_share.building',
      100 * share * (1 - w),
      100 * Math.min(1, share * (1 + w)),
      '%',
      sig(c.tier, 2),
      'ECBC daylit area share',
    ),
    ecbcShare: share,
    storeys,
    rooms,
    site,
  };
}

const MONTHS = 12;
const sumWh = (xs: readonly (bigint | 'unknown')[]) =>
  xs.reduce<number>((s, v) => s + (v === 'unknown' ? 0 : Number(v)), 0);

export function energyView(c: ViewCtx, res: BuildingResult, bag: EvBag): EnergyView {
  const uses: EndUse[] = [
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
  const endUses = uses
    .map((use) => {
      const months = res.endUses[use];
      const unknown = months.some((v) => v === 'unknown');
      const wh = sumWh(months);
      return {
        use,
        kwh: wh / 1000,
        unknown,
        ev: bag.fixed(`enduse.${use}`, BigInt(Math.round(wh)), 'Wh', c.tier === 'rough' ? 1e7 : 1e6),
      };
    })
    .filter((u) => u.unknown || u.kwh !== 0)
    .map((u) => (u.unknown ? u : { use: u.use, kwh: u.kwh, ev: u.ev }));
  const monthlyKwh = Array.from({ length: MONTHS }, (_, m) =>
    uses.reduce((s, u) => s + (res.endUses[u][m] === 'unknown' ? 0 : Number(res.endUses[u][m])) / 1000, 0),
  );
  const bill = res.bills
    .filter((b) => b.carrier === 'electricity' || b.carrier === 'diesel')
    .reduce((s, b) => s + b.total, 0n);
  const lo = res.eui.site.lo;
  const hi = res.eui.site.hi;
  const target = res.eui.target ? (res.eui.target.value.lo + res.eui.target.value.hi) / 2 : 140;
  const fan = res.comfort.map((x) => x.fanHours);
  const ac = res.comfort
    .map((x) => x.acHours[0]?.hours)
    .filter((x): x is { lo: number; hi: number } => Boolean(x));
  const avg = (xs: { lo: number; hi: number }[], k: 'lo' | 'hi') =>
    xs.length ? xs.reduce((s, x) => s + x[k], 0) / xs.length : 0;
  return {
    eui: bag.range('eui.site', lo, hi, 'kWh/m2.yr', sig(c.tier, 2), 'Site energy over conditioned area'),
    euiMid: (lo + hi) / 2,
    euiLo: lo,
    euiHi: hi,
    source: bag.range('eui.source', res.eui.source.lo, res.eui.source.hi, 'kWh/m2.yr', 2),
    partial: res.eui.partial,
    missing: res.eui.missing ?? [],
    target: bag.num('eui.target', target, 'kWh/m2.yr', 3, res.eui.target?.source ?? 'Code standard design'),
    targetMid: target,
    bands: [
      { label: 'Five star', ev: bag.num('bench.bee.5', 90, 'kWh/m2.yr', 2, 'BEE star band (estimate)') },
      { label: 'Three star', ev: bag.num('bench.bee.3', 130, 'kWh/m2.yr', 2, 'BEE star band (estimate)') },
      { label: 'One star', ev: bag.num('bench.bee.1', 175, 'kWh/m2.yr', 2, 'BEE star band (estimate)') },
      { label: 'Typical', ev: bag.num('bench.typical', 240, 'kWh/m2.yr', 2, 'Typical stock (estimate)') },
    ],
    endUses,
    monthlyKwh,
    bill: bag.fixed('bill.electricity', bill, 'micro-paise/yr', c.tier === 'rough' ? 1e13 : 1e12),
    billRs: Number(bill) / 1e8,
    carbon: bag.fixed('carbon.op', res.carbon.op, 'gCO2e/yr', c.tier === 'rough' ? 1e7 : 1e6),
    fanHours: bag.range(
      'comfort.fan_hours.mean',
      avg(fan, 'lo'),
      avg(fan, 'hi'),
      'h/yr',
      2,
      'IMAC adaptive, fan-first',
    ),
    acHours: bag.range('comfort.ac_hours.mean', avg(ac, 'lo'), avg(ac, 'hi'), 'h/yr', 2),
    result: res,
  };
}

const CODE_TITLE: Record<string, string> = {
  'TSECBC.SCOPE': 'Telangana ECBC applies to this building',
  'ECBC.ENV.WWR': 'Window to wall ratio at most 40%',
  'ECBC.ENV.SHGC': 'Glass solar heat gain within the limit',
  'ECBC.ENV.UWALL': 'Wall U-value within the limit',
  'ECBC.ENV.UROOF': 'Roof U-value within the limit',
  'ECBC.LTG.LPD': 'Lighting power within the building area allowance',
  'ECSBC.EPI': 'Energy performance index against the standard design',
  'ECSBC.EPI-RATIO': 'Energy use against the ECSBC reference design',
  'MOP.2026.RATING': 'Mandatory rating at 20,000 m² (draft rule)',
  'ENS.RETV': 'Envelope heat gain (RETV) at most 15 W/m²',
  'ENS.UROOF': 'Roof U-value at most 1.2 (homes)',
  'ENS.OPENABLE': 'Openable window area for ventilation',
  'RULES.IN.ROOF-RIGHTS': 'Who may use the roof',
  'UK.EPC.ESTIMATE': 'Energy Performance Certificate band, estimated',
};

const WORDS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];
const LADDER_STEPS: Record<string, { level: string; atLeast: number }[]> = {
  'GHMC-stars': [5, 10, 15, 20, 25, 30].map((s, i) => ({
    level: `${WORDS[i]} star${i ? 's' : ''}`,
    atLeast: s,
  })),
  LEED: [
    { level: 'Points begin', atLeast: 6 },
    { level: 'Half the points', atLeast: 26 },
    { level: 'All points', atLeast: 50 },
  ],
  IGBC: [
    { level: 'Entry', atLeast: 10 },
    { level: 'Gold', atLeast: 25 },
    { level: 'Platinum', atLeast: 40 },
  ],
  EDGE: [
    { level: 'EDGE', atLeast: 20 },
    { level: 'Advanced', atLeast: 40 },
  ],
};
const SCHEME_NAME: Record<string, string> = {
  'GHMC-stars': 'GHMC stars',
  LEED: 'LEED energy',
  IGBC: 'IGBC',
  EDGE: 'EDGE energy',
};

export function codesView(_c: ViewCtx, out: CodesOut, bag: EvBag): CodesView {
  const base = out.baselines[0];
  const sLo = base ? 100 * (1 - base.ratio.hi) : 0;
  const sHi = base ? 100 * (1 - base.ratio.lo) : 0;
  const rows = out.codes.map((row) => {
    const reading =
      row.margin && row.margin.unit !== 'm2'
        ? bag.num(
            `code.${row.ruleId}.margin`,
            row.margin.value,
            row.margin.unit,
            2,
            'Margin to the limit (positive is inside)',
          )
        : undefined;
    return {
      row,
      title: CODE_TITLE[row.ruleId] ?? row.ruleId,
      ...(reading ? { reading } : {}),
      ...(row.status === 'unknown' && row.unknownFacts?.length
        ? { limitText: `Missing: ${row.unknownFacts.join(', ')}.` }
        : {}),
    };
  });
  const ladder: LadderRow[] = [
    {
      scheme: 'ECSBC tiers',
      edition: '2024',
      steps: [
        { level: 'Base tier', atLeast: 0 },
        { level: 'Plus', atLeast: 14 },
        { level: 'Super', atLeast: 25 },
      ],
      applicability: 'not-a-certificate',
      estimate: true,
    },
    ...out.ratings
      .filter((r) => LADDER_STEPS[r.scheme])
      .map((r) => ({
        scheme: SCHEME_NAME[r.scheme] ?? r.scheme,
        edition: r.edition,
        steps: LADDER_STEPS[r.scheme] ?? [],
        applicability: r.applicability,
        estimate: r.grade === 'estimate' || r.grade === 'announced',
      })),
  ];
  return {
    rows,
    ladder,
    savings: bag.range('base.savings', sLo, sHi, '%', 2, 'One minus proposed over baseline EUI'),
    savingsLo: sLo,
    savingsHi: sHi,
    baseline: bag.num(
      'base.eui',
      base ? (base.eui.lo + base.eui.hi) / 2 : 0,
      'kWh/m2.yr',
      2,
      base ? `${base.code} standard design` : 'Standard design',
    ),
    out,
  };
}

/** Design ops from the optimiser to the studio's what-if levers (one tap "Try as a what-if"). */
const OP_LEVER: Record<string, [string, number | string, string]> = {
  addOverhang: ['shading', 'chajja', 'overhangs'],
  setGlazing: ['glazing', 'low-e', 'low-e glass'],
  setRoofFinish: ['roof', 'cool', 'cool roof'],
  setLPD: ['lighting', 'led', 'LED lighting'],
  addDaylightControls: ['daylight', 'on', 'daylight controls'],
  setSetpoint: ['setpoint', 26, 'set point 26 °C'],
  addPV: ['pv', 50, 'roof PV'],
  setWallAssembly: ['wall', 'insulated', 'insulated walls'],
};

export function optimiseView(_c: ViewCtx, out: OptimiseResult, bag: EvBag): OptimiseView {
  const idx = (id: string) => out.objectives.findIndex((o) => o.id === id);
  const [ic, io, ie] = [idx('capex'), idx('opex'), idx('eui')];
  const front = new Set(out.front);
  const candidates: Cand[] = out.candidates.map((k) => {
    const levers: Levers = {};
    const words: string[] = [];
    for (const op of k.ops) {
      const m = OP_LEVER[(op as { op: string }).op];
      if (m && !(m[0] in levers)) {
        levers[m[0]] = m[1];
        words.push(m[2]);
      }
    }
    return {
      id: k.id,
      label: words.length ? words.join(', ') : 'As it is',
      levers,
      capexRs: ic >= 0 ? Number(k.axes[ic]) : 0,
      opexRs: io >= 0 ? Number(k.axes[io]) : 0,
      eui: ie >= 0 ? Number(k.axes[ie]) / 1000 : 0,
      feasible: k.feasible,
      front: front.has(k.id),
    };
  });
  const byId = new Map(candidates.map((x) => [x.id, x]));
  const ROLE: Record<string, string> = {
    'least-upfront': 'Least upfront',
    'best-return': 'Best return',
    'lowest-carbon': 'Lowest running carbon',
    'lowest-energy': 'Lowest energy',
    'lowest-running': 'Lowest running cost',
  };
  const picks: OptimiseView['picks'] = [];
  for (const p of out.picks) {
    const cand = p.id === 'none' ? undefined : byId.get(p.id);
    if (!cand) continue;
    picks.push({
      role: p.role,
      label: ROLE[p.role] ?? p.role,
      cand,
      capex: bag.fixed(
        `opt.${p.role}.capex`,
        BigInt(Math.round(cand.capexRs)) * 100_000_000n,
        'micro-paise',
        1e13,
      ),
      opex: bag.fixed(
        `opt.${p.role}.opex`,
        BigInt(Math.round(cand.opexRs)) * 100_000_000n,
        'micro-paise/yr',
        1e13,
      ),
      eui: bag.num(`opt.${p.role}.eui`, cand.eui, 'kWh/m2.yr', 2),
    });
  }
  return {
    candidates,
    picks,
    tried: bag.num('opt.tried', out.tried, '1', 4),
    frontCount: bag.num('opt.front', out.front.length, '1', 3),
    goalLabel: 'The best bundles for upfront cost, running cost and energy use',
    out,
  };
}

/** Build the view for one stage output. */
export function viewFor<S extends StageId>(stage: S, c: ViewCtx, output: StageOut[S]): StageResult<S> {
  const bag = new EvBag(c.key, { buildingId: c.doc.id, placeId: c.placeId, variantId: c.variantId });
  const o = output as unknown;
  const view =
    stage === 'geometry'
      ? geometryView(c, o as CompiledBuilding, bag)
      : stage === 'sun'
        ? sunView(c, o as SiteResult, bag)
        : stage === 'radiation'
          ? radiationView(c, o as SiteResult, bag)
          : stage === 'daylight'
            ? daylightView(c, o as SiteResult, bag)
            : stage === 'energy'
              ? energyView(c, o as BuildingResult, bag)
              : stage === 'codes'
                ? codesView(c, o as CodesOut, bag)
                : optimiseView(c, o as OptimiseResult, bag);
  return { view: view as StageViews[S], nodes: bag.nodes };
}
