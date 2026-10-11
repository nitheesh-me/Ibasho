/**
 * Preview optimiser (SPEC 25, R37, R38): exhaustive over eight design levers (256 options) with
 * the Preview energy model, N-axis Pareto front with dominance witnesses, picks per role, Morris
 * style screening from the same runs, and an overhang sweep. Integer axes: capex in whole rupees
 * or pounds, opex in whole currency a year, EUI in milli kWh/m²·yr, carbon in kg a year.
 */
import type {
  BuildingDoc,
  Candidate,
  CompiledBuilding,
  DesignOp,
  FacadeBin,
  Objective,
  OptimiseResult,
  RecRole,
  ResultStamp,
  ScopedGoal,
  Setting,
  SiteResult,
} from '@ibasho/core';
import { dominates, isZoneTwin, Q } from '@ibasho/core';
import type { MonthlyClimate } from './climate.gen.ts';
import { type EnergyParams, energyModel } from './energy.ts';
import { EvidenceBuilder } from './evidence.ts';
import { buildEnergyResult, euiExact, type MoneyCtx, totalWh } from './result.ts';

interface Lever {
  id: string;
  params: (base: EnergyParams, ctx: LeverCtx) => EnergyParams;
  ops: (ctx: LeverCtx) => DesignOp[];
  /** Capital cost in whole currency units. */
  cost: (ctx: LeverCtx) => number;
  needsCheck?: (ctx: LeverCtx) => boolean;
}

interface LeverCtx {
  inr: boolean;
  bins: FacadeBin[];
  sunnyBins: FacadeBin[];
  windowM2: number;
  sunnyWindowM2: number;
  wallM2: number;
  roofM2: number;
  floorM2: number;
  roofId: string;
  sharedRoof: boolean;
}

const SUNNY: FacadeBin[] = ['E', 'SE', 'S', 'SW', 'W', 'NW'];
const fx = (inr: boolean, rupees: number, pounds: number) => (inr ? rupees : pounds);

export const LEVERS: readonly Lever[] = [
  {
    id: 'shade',
    params: (b, c) => ({ ...b, pf: Object.fromEntries(c.sunnyBins.map((x) => [x, 0.45])) }),
    ops: (c) =>
      c.sunnyBins.map(
        (facade) => ({ op: 'addOverhang', facade, depth: { grid: 'overhang.depth', index: 2 } }) as DesignOp,
      ),
    cost: (c) => c.sunnyWindowM2 * fx(c.inr, 4500, 300),
  },
  {
    id: 'glazing',
    params: (b) => ({ ...b, shgc: 0.3, uWin: 2.8 }),
    ops: (c) =>
      c.bins.map((facade) => ({ op: 'setGlazing', target: { facade }, productId: 'low-e-dgu' }) as DesignOp),
    cost: (c) => c.windowM2 * fx(c.inr, 9000, 550),
  },
  {
    id: 'cool-roof',
    params: (b) => ({ ...b, roofAbsorptance: 0.3, uRoof: Math.min(b.uRoof ?? 1.8, 1.2) }),
    ops: () => [{ op: 'setRoofFinish', presetId: 'cool-roof-white' }],
    cost: (c) => c.roofM2 * fx(c.inr, 450, 40),
  },
  {
    id: 'led',
    params: (b) => ({ ...b, lpdScale: 0.65 }),
    ops: () => [{ op: 'setLPD', value: { grid: 'lpd.scale', index: 1 } }],
    cost: (c) => c.floorM2 * fx(c.inr, 450, 35),
  },
  {
    id: 'daylight',
    params: (b) => ({ ...b, daylightControls: true }),
    ops: () => [{ op: 'addDaylightControls' }],
    cost: (c) => c.floorM2 * fx(c.inr, 250, 20),
  },
  {
    id: 'setpoint',
    params: (b) => ({ ...b, setpointC: 26 }),
    ops: () => [{ op: 'setSetpoint', kind: 'cool', value: { grid: 'setpoint.cool', index: 2 } }],
    cost: () => 0,
  },
  {
    id: 'pv',
    params: (b, c) => ({ ...b, pvKwp: Math.floor((c.roofM2 * 0.5) / 6.5) }),
    ops: (c) => [{ op: 'addPV', roofId: c.roofId, coverage: { grid: 'pv.coverage', index: 2 } }],
    cost: (c) => Math.floor((c.roofM2 * 0.5) / 6.5) * fx(c.inr, 50_000, 1_500),
    needsCheck: (c) => c.sharedRoof,
  },
  {
    id: 'wall',
    params: (b) => ({ ...b, uWall: 0.6 }),
    ops: () => [{ op: 'setWallAssembly', constructionId: 'aac-200-insulated' }],
    cost: (c) => c.wallM2 * fx(c.inr, 2800, 180),
  },
];

export function optimiseModel(
  doc: BuildingDoc | undefined,
  compiled: CompiledBuilding,
  clim: MonthlyClimate,
  money: MoneyCtx,
  settings: readonly Setting[],
  objectives: readonly Objective[],
  goals: readonly ScopedGoal[],
  stamp: ResultStamp,
  inputsHash: string,
  seed: string,
  /** Evaluate only the first `limit` options (rough and refined tiers). */
  limit?: number,
  /** Base levers and radiation of the energy stage (the baseline option reproduces its bill). */
  from: { params?: EnergyParams; radiation?: SiteResult } = {},
): OptimiseResult {
  const t = compiled.twin;
  const id = isZoneTwin(t) ? t.buildingId : t.id;
  const ev = new EvidenceBuilder(id, 'optimise');
  const q = compiled.quantities;
  const inr = money.currency === 'INR';
  const bins = q.facades.map((f) => f.bin);
  const sunnyBins = bins.filter((b) => SUNNY.includes(b));
  const ctx: LeverCtx = {
    inr,
    bins,
    sunnyBins,
    windowM2: q.facades.reduce((s, f) => s + Number(f.openingMm2), 0) / 1e6,
    sunnyWindowM2:
      q.facades.filter((f) => SUNNY.includes(f.bin)).reduce((s, f) => s + Number(f.openingMm2), 0) / 1e6,
    wallM2: q.facades.reduce((s, f) => s + Number(f.grossMm2 - f.openingMm2), 0) / 1e6,
    roofM2: Number(q.roofMm2) / 1e6,
    floorM2: Number(q.gfaMm2) / 1e6,
    roofId: doc?.roofs[0]?.id ?? 'rf_main',
    sharedRoof: doc?.tenure?.decides.roof === 'association',
  };
  const levers = LEVERS.filter((l) => !(l.id === 'setpoint' && clim.lat > 35));
  const n = levers.length;
  const nca = q.ncaMm2;
  const evals: {
    mask: number;
    axes: bigint[];
    capex: number;
    opex: number;
    eui: number;
    /** Energy use before rooftop generation, kWh/m²·yr (what "lowest energy" ranks). */
    euiGross: number;
    ops: DesignOp[];
    needsCheck: boolean;
  }[] = [];
  const count = Math.min(1 << n, limit ?? 1 << n);
  for (let mask = 0; mask < count; mask++) {
    let params: EnergyParams = {};
    let capex = 0;
    const ops: DesignOp[] = [];
    let needsCheck = false;
    levers.forEach((l, i) => {
      if (!(mask & (1 << i))) return;
      params = l.params(params, ctx);
      capex += l.cost(ctx);
      ops.push(...l.ops(ctx));
      if (l.needsCheck?.(ctx)) needsCheck = true;
    });
    const core = energyModel(compiled, clim, { ...from.params, ...params }, from.radiation);
    const res = buildEnergyResult(compiled, core, money, settings, '', stamp, '2026-01-01');
    const wh = totalWh(res.endUses);
    const bill = res.bills.reduce((s, b) => s + b.total, 0n) / 100_000_000n;
    const eui = euiExact(wh, nca);
    const euiMilli = BigInt(Math.round(Q.toNumber(eui) * 1000));
    const carbonKg = res.carbon.op / 1000n;
    const capexInt = BigInt(Math.round(capex));
    const all = { capex: capexInt, opex: bill, eui: euiMilli, carbon: carbonKg } as Record<string, bigint>;
    const axes = objectives.map((o) => all[o.id] ?? 0n);
    const pvWh = res.endUses.pv.reduce<bigint>((t, v) => t + (v === 'unknown' ? 0n : v), 0n);
    const euiGross = Q.toNumber(euiExact(wh - pvWh, nca));
    evals.push({ mask, axes, capex, opex: Number(bill), eui: Q.toNumber(eui), euiGross, ops, needsCheck });
  }
  const budget = goals.find((g) => g.goal.kind === 'budget' && g.strength === 'must')?.goal;
  const budgetMax =
    budget && budget.kind === 'budget' ? Number(budget.max / 100_000_000n) : Number.POSITIVE_INFINITY;
  const candidates: Candidate[] = evals.map((e) => {
    const cid = `c${e.mask.toString(2).padStart(n, '0')}`;
    const feasible = e.capex <= budgetMax;
    const evid = ev.add(`opt.${cid}`, { cat: e.axes.join(',') }, 'ids', 'preview.optimise.axes');
    return {
      id: cid,
      ops: e.ops,
      axes: e.axes,
      feasible,
      ...(feasible ? {} : { blockedBy: ['budget'] }),
      ...(e.needsCheck ? { needsCheck: true } : {}),
      evidence: [evid],
    };
  });
  const feasible = candidates.filter((c) => c.feasible);
  const front = feasible.filter(
    (c) => !feasible.some((o) => o !== c && dominates(o.axes, c.axes, objectives)),
  );
  const witnesses = feasible
    .filter((c) => !front.includes(c))
    .map((c) => ({
      dominated: c.id,
      by: (front.find((f) => dominates(f.axes, c.axes, objectives)) as Candidate).id,
    }));
  const byId = new Map(evals.map((e, i) => [candidates[i]?.id as string, e]));
  const base = evals[0] as (typeof evals)[number];
  /**
   * Picks (R37): each role ranks the front by its own measure, ties to the cheaper bundle. Roles
   * mean different things, so they rarely agree: running cost counts rooftop generation, energy
   * counts use before generation (efficiency), best return needs some outlay to return on.
   */
  const pick = (
    role: RecRole,
    score: (e: (typeof evals)[number]) => number,
    among: readonly Candidate[] = front,
  ) => {
    const pool = among.filter((c) => c.id !== candidates[0]?.id);
    let best: Candidate | undefined;
    let bestS = Number.POSITIVE_INFINITY;
    let bestCap = Number.POSITIVE_INFINITY;
    for (const c of pool) {
      const e = byId.get(c.id) as (typeof evals)[number];
      const sc = score(e);
      if (sc < bestS - 1e-9 || (Math.abs(sc - bestS) <= 1e-9 && e.capex < bestCap)) {
        bestS = sc;
        bestCap = e.capex;
        best = c;
      }
    }
    const e = best && Number.isFinite(bestS) ? byId.get(best.id) : undefined;
    return {
      role,
      id: best && e ? best.id : ('none' as const),
      label: `optimise.pick.${role}`,
      ...(role === 'lowest-energy' && e ? { euiBeforeGeneration: Math.round(e.euiGross * 10) / 10 } : {}),
    };
  };
  const picks = [
    pick('least-upfront', (e) => (e.eui < base.eui ? e.capex : Number.POSITIVE_INFINITY)),
    pick('lowest-running', (e) => e.opex),
    // Efficiency before generation: rooftop PV makes the net front favour PV, so this role looks
    // across every feasible bundle (it may sit just off the cost front, by design).
    pick(
      'lowest-energy',
      (e) => e.euiGross,
      candidates.filter((c) => c.feasible),
    ),
    pick('best-return', (e) =>
      e.capex > 0 && base.opex - e.opex > 0 ? e.capex / (base.opex - e.opex) : Number.POSITIVE_INFINITY,
    ),
  ];
  // Morris style screening on EUI from the exhaustive runs.
  const screening = levers.map((l, i) => {
    const effects: number[] = [];
    for (const e of evals) {
      const other = evals[e.mask | (1 << i)];
      if (!(e.mask & (1 << i)) && other) effects.push(other.eui - e.eui);
    }
    const k = Math.max(1, effects.length);
    const mu = effects.reduce((s, x) => s + Math.abs(x), 0) / k;
    const mean = effects.reduce((s, x) => s + x, 0) / k;
    const sigma = Math.sqrt(effects.reduce((s, x) => s + (x - mean) * (x - mean), 0) / k);
    return { axis: l.id, muStar: Math.round(mu * 100) / 100, sigma: Math.round(sigma * 100) / 100 };
  });
  // Overhang depth sweep on the sunniest facade.
  const sweepBin = sunnyBins[0];
  const sweeps = sweepBin
    ? [
        {
          target: `facade:${sweepBin}`,
          param: 'overhang.depth',
          grid: 'overhang.depth',
          points: [0, 1, 2, 3, 4].map((index) => {
            const core = energyModel(
              compiled,
              clim,
              { ...from.params, pf: { ...from.params?.pf, [sweepBin]: index * 0.2 } },
              from.radiation,
            );
            const res = buildEnergyResult(compiled, core, money, settings, '', stamp, '2026-01-01');
            const euiMilli = BigInt(Math.round(Q.toNumber(euiExact(totalWh(res.endUses), nca)) * 1000));
            const all = {
              capex: BigInt(Math.round(index * 0.2 * ctx.sunnyWindowM2 * fx(inr, 4500, 300))),
              opex: res.bills.reduce((s, b) => s + b.total, 0n) / 100_000_000n,
              eui: euiMilli,
              carbon: res.carbon.op / 1000n,
            } as Record<string, bigint>;
            const axes = objectives.map((o) => all[o.id] ?? 0n);
            return {
              index,
              axes,
              evidence: [
                ev.add(
                  `opt.sweep.overhang.${index}`,
                  { cat: axes.join(',') },
                  'ids',
                  'preview.optimise.sweep',
                ),
              ],
            };
          }),
        },
      ]
    : [];
  return {
    inputsHash,
    stamp,
    objectives: [...objectives],
    method: 'exhaustive',
    seed,
    screening,
    tried: candidates.length,
    candidates,
    front: front.map((c) => c.id),
    witnesses,
    picks,
    sweeps,
    evidence: ev.graph(),
  };
}
