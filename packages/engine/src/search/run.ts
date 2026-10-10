/**
 * The factorised exhaustive search (SPEC R9, ARCH 6). Owner: WP-02.
 *
 * Steps (ARCH 6):
 * 1. plan the choice groups and the package product;
 * 2. heavy: one full physics run per (heavy key, mode), the key being the heavy options plus the
 *    DHW class the package leaves the home with (the factorisation assumption);
 * 3. light: systems, renewables and delivered per (package, mode) on the cached heavy run;
 * 4. rules per package (Kleene, WP-03), plus the memory built-in;
 * 5. fixed-point bookkeeping on the your-home run and the target test;
 * 6. front, witnesses, picks and the needs-check lane;
 * 7. eager evidence for the baseline, front and picks, and the certificate.
 *
 * The pipeline runner (WP-01) owns stage order and quantisation; this file only calls it.
 * Obligations returned by rules are recorded but not yet applied (PLACEHOLDER until M-B: an
 * obligation re-keys the heavy run, ARCH 6 step 4); no M-0 rule obliges anything.
 */
import {
  canonicalHash,
  canonicalJson,
  compareStrings,
  createEvidenceGraphBuilder,
  type EvidenceGraph,
  FUELS,
  type FuelMonthly,
  type HomeTwin,
  type MeasureModel,
  PACKAGE_STATUS,
  type PackageSpec,
  type PackageTable,
  RUN_MODES,
  type RunMode,
  type SearchProgress,
  type SearchRequest,
  type SearchResult,
  type SimResult,
  type Wh,
} from '@ibasho/core';
import { SPEC_HASH } from '@ibasho/spec-gen';
import { addBookkeeping } from '../evidence/index.ts';
import { bills } from '../finance/index.ts';
import {
  applyPatch,
  type HeavyRun,
  packagePatch,
  runHeavy,
  runLight,
  simulate,
  splitPatch,
} from '../pipeline/index.ts';
import { evaluateRules, homeFacts, moneyFact, ownerFacts, packageFacts } from '../rules/index.ts';
import { type BookkeepCtx, bookkeep, type RowMoney } from './bookkeeping.ts';
import { emitCertificate, flatFuelMonth } from './certificate.ts';
import type { SearchEnv } from './env.ts';
import { picks as choosePicks, NO_WITNESS, type Outcome, paretoFront, witnesses } from './pareto.ts';
import { BASELINE_ID, type GroupPlan, NONE, packageId, planGroups, rowPackage } from './plan.ts';
import type { Slicer } from './slicer.ts';

export class SearchError extends Error {
  override name = 'SearchError';
}

/** Built-in rule ids the search adds itself (SPEC 9 built-ins). */
export const BUILTIN_MEMORY = 'BUILTIN.MEMORY';
export const BUILTIN_TARGET = 'BUILTIN.TARGET';

/** Everything a finished search keeps for lazy evidence and later bookkeeping-only reruns. */
export interface SearchState {
  req: SearchRequest;
  env: SearchEnv;
  plan: GroupPlan;
  rows: PackageSpec[];
  money: RowMoney[];
  result: SearchResult;
}

export type ProgressFn = (p: SearchProgress) => void;

function packageOptionIds(p: PackageSpec): string[] {
  return [...Object.values(p.options), ...Object.values(p.subOptions ?? {})].filter((o) => o !== NONE);
}

/** Memory built-in: a rejected option id, or any option of a rejected measure id, blocks. */
function rejectedBy(p: PackageSpec, rejected: readonly string[], modelOf: ReadonlyMap<string, MeasureModel>) {
  return packageOptionIds(p).some((o) => rejected.includes(o) || rejected.includes(modelOf.get(o)?.id ?? ''));
}

function meetsTarget(req: SearchRequest, m: RowMoney): boolean {
  const saves = (m.flows.b[0] ?? 0n) > 0n;
  const cuts = m.carbonAnnualG > 0n;
  const t = req.target;
  switch (t.kind) {
    case 'default':
      return saves && cuts;
    case 'custom':
      return (!t.saveMoneyYear1 || saves) && (!t.cutRunningCarbon || cuts);
    case 'epc-band-at-least':
      // PLACEHOLDER until M-B: needs the `epc-proxy/rating` plugin (SPEC R3). Refuse, never guess.
      throw new SearchError('the EPC band target needs the rating proxy, which lands at M-B');
  }
}

/** Run one search to completion (or until the slicer throws `SearchCancelled`). */
export async function runSearch(
  req: SearchRequest,
  env: SearchEnv,
  slicer: Slicer,
  onProgress?: ProgressFn,
): Promise<SearchState> {
  const jobId = slicer.jobId;
  const progress = (phase: SearchProgress['phase'], done: number, total: number) =>
    onProgress?.({ jobId, phase, done, total });
  const { twin, owner, asOf } = req;
  if (!Number.isInteger(owner.horizonYears) || owner.horizonYears < 1)
    throw new SearchError('owner.horizonYears must be a positive integer');
  const cfg = env.pipeline;

  // 1. Plan.
  const plan = planGroups(env.measures, env.allowOptions);
  progress('plan', 1, 1);
  const n = plan.packageCount;
  const rows: PackageSpec[] = [];
  const heavyKeys: string[] = [];
  const keyIndex = new Map<string, number>();
  const heavyTwins: HomeTwin[] = [];
  const heavyPatchHash: string[] = [];
  const heavyIdx = new Uint32Array(n);
  const lightTwins: HomeTwin[] = [];
  for (let r = 0; r < n; r++) {
    const p = rowPackage(plan.groups, r);
    rows.push(p);
    const { heavy, light } = splitPatch(packagePatch(twin, p, env.measures));
    const heavyTwin = applyPatch(twin, heavy);
    const heavyOpts = plan.groups
      .filter((g) => g.weight === 'heavy' && p.options[g.id] !== undefined)
      .map((g) => p.options[g.id]!);
    const key = `${packageId(heavyOpts)}|dhw=${heavyTwin.systems.dhw.class}`;
    const hHash = canonicalHash(heavy);
    let k = keyIndex.get(key);
    if (k === undefined) {
      k = heavyKeys.length;
      keyIndex.set(key, k);
      heavyKeys.push(key);
      heavyTwins.push(heavyTwin);
      heavyPatchHash.push(hHash);
    } else if (heavyPatchHash[k] !== hHash) {
      throw new SearchError(`heavy key ${key} has two different heavy patches (factorisation broken)`);
    }
    heavyIdx[r] = k;
    lightTwins.push(applyPatch(heavyTwin, light));
    await slicer.tick();
  }

  // 2. Heavy runs, and each key's delivered energy with its own systems (certificate reference).
  const heavyRuns: Record<RunMode, HeavyRun[]> = { rating: [], standard: [], 'your-home': [] };
  const heavyDelivered = {} as Record<RunMode, BigInt64Array>;
  const slots = FUELS.length * 12;
  let done = 0;
  for (const mode of RUN_MODES) {
    heavyDelivered[mode] = new BigInt64Array(heavyKeys.length * slots);
    for (let k = 0; k < heavyKeys.length; k++) {
      const h = runHeavy(heavyTwins[k]!, { mode, asOf }, cfg);
      heavyRuns[mode].push(h);
      heavyDelivered[mode].set(flatFuelMonth(runLight(h, heavyTwins[k]!, cfg).result.deliveredWh), k * slots);
      progress('heavy', ++done, heavyKeys.length * RUN_MODES.length);
      await slicer.tick();
    }
  }

  // 3. Light runs.
  const results: Record<RunMode, SimResult>[] = [];
  for (let r = 0; r < n; r++) {
    const byMode = {} as Record<RunMode, SimResult>;
    for (const mode of RUN_MODES) {
      const h = heavyRuns[mode][heavyIdx[r]!]!;
      byMode[mode] = runLight(h, lightTwins[r]!, cfg, { mode, asOf, pkg: rows[r]! }).result;
    }
    results.push(byMode);
    progress('light', r + 1, n);
    await slicer.tick();
  }
  const baselineRow = 0;
  if (rows[baselineRow]!.id !== BASELINE_ID) throw new SearchError('row 0 must be the empty package');

  // 5 (before 4: rules read the package cost). Bookkeeping on your-home.
  const baseDelivered = results[baselineRow]!['your-home'].deliveredWh;
  const bctx: BookkeepCtx = {
    env,
    twin,
    owner,
    asOf,
    baseDelivered,
    baseBills: bills(baseDelivered, env.tariffs),
  };
  const money: RowMoney[] = [];
  for (let r = 0; r < n; r++) {
    money.push(bookkeep(bctx, rows[r]!, results[r]!['your-home'].deliveredWh));
    progress('bookkeeping', r + 1, n);
    await slicer.tick();
  }

  // 4. Rules, memory and target.
  const rules = env.rulePacks.flatMap((p) => p.rules);
  const home = homeFacts(twin);
  const ownerF = ownerFacts(owner);
  const optionFacts = new Map<string, Record<string, unknown>>();
  for (const g of plan.groups) {
    for (const o of g.options) {
      if (o === NONE) continue;
      const m = plan.modelOf.get(o)!;
      optionFacts.set(o, { ...m.facts(twin, o) });
    }
  }
  const status = new Uint8Array(n);
  const ruleIds: string[][] = [];
  const targetMet: boolean[] = [];
  for (let r = 0; r < n; r++) {
    const p = rows[r]!;
    const ids = packageOptionIds(p);
    const options = ids.map((o) => {
      const m = plan.modelOf.get(o)!;
      return { optionId: o, kind: m.measureKind, facts: m.facts(twin, o) };
    });
    const m = money[r]!;
    const ev = evaluateRules(rules, {
      region: twin.region,
      asOf,
      home,
      owner: ownerF,
      options,
      pkg: packageFacts({ optionIds: ids, capex: m.grossCost }),
      checks: twin.checks,
    });
    const f = ev.feasibility;
    const why = new Set<string>([
      ...(f.blockedBy ?? []),
      ...(f.unknownBy ?? []).map((u) => u.ruleId),
      ...f.checks.map((c) => c.ruleId),
    ]);
    const rejected = rejectedBy(p, req.memory.rejected, plan.modelOf);
    if (rejected) why.add(BUILTIN_MEMORY);
    const meets = meetsTarget(req, m);
    targetMet.push(meets);
    let s: number;
    if (rejected || f.status === 'blocked') s = PACKAGE_STATUS.blocked;
    else if (f.status === 'needs-check') s = PACKAGE_STATUS['needs-check'];
    else if (!meets) {
      s = PACKAGE_STATUS['target-miss'];
      why.add(BUILTIN_TARGET);
    } else s = PACKAGE_STATUS.feasible;
    status[r] = s;
    ruleIds.push([...why].sort(compareStrings));
    progress('rules', r + 1, n);
    await slicer.tick();
  }
  // Costs ride in the certificate facts (see certificate.ts) as decimal strings.
  for (const g of plan.groups) {
    for (const o of g.options) {
      if (o === NONE) continue;
      const c = env.costs.get(o);
      if (!c) throw new SearchError(`no measure-cost for option ${o}`);
      const k = c.cost(twin, asOf);
      const f = optionFacts.get(o)!;
      f['c.lo'] = k.lo.toString();
      f['c.mid'] = k.mid.toString();
      f['c.hi'] = k.hi.toString();
      f['c.vatRate'] = `${k.vatRate.n}/${k.vatRate.d}`;
      f['c.lifetimeYears'] = plan.modelOf.get(o)!.lifetimeYears;
      // Keeps the budget fact in range for rules (throws beyond 2^53 micro-pence).
      moneyFact(k.hi);
    }
  }

  // 6. Front, witnesses, picks, needs-check lane.
  const outcomes: Outcome[] = [];
  for (let r = 0; r < n; r++) {
    if (status[r] === PACKAGE_STATUS.feasible)
      outcomes.push({
        row: r,
        n0: money[r]!.n0,
        carbon: money[r]!.lifetimeCarbonG,
        npv: money[r]!.flows.npv,
      });
  }
  const frontO = paretoFront(outcomes);
  const wit = witnesses(outcomes, frontO);
  const witness = new Uint32Array(n).fill(NO_WITNESS);
  for (const [row, w] of wit) witness[row] = w;
  const front = Uint32Array.from(frontO.map((o) => o.row));
  const pk = choosePicks(outcomes, baselineRow);
  const needsCheck = Uint32Array.from(
    rows.flatMap((_, r) => (status[r] === PACKAGE_STATUS['needs-check'] && targetMet[r] ? [r] : [])),
  );
  progress('front', 1, 1);

  // Package table.
  const lightGroups = plan.groups.filter((g) => g.weight === 'light');
  const lightOpts = new Uint16Array(n * lightGroups.length);
  for (const [r, p] of rows.entries()) {
    for (const [j, g] of lightGroups.entries()) {
      lightOpts[r * lightGroups.length + j] = g.options.indexOf(p.options[g.id] ?? NONE);
    }
  }
  const packages: PackageTable = {
    ids: rows.map((p) => p.id),
    heavyIdx,
    lightOpts,
    lightGroups: lightGroups.map((g) => g.id),
    status,
    n0: BigInt64Array.from(money.map((m) => m.n0)),
    npv: BigInt64Array.from(money.map((m) => m.flows.npv)),
    carbonSaved: BigInt64Array.from(money.map((m) => m.lifetimeCarbonG)),
    witness,
    ruleIds,
  };

  // 7. Certificate and eager evidence.
  const delivered = results.map((byMode) => {
    const o = {} as Record<RunMode, FuelMonthly<Wh>>;
    for (const mode of RUN_MODES) o[mode] = byMode[mode].deliveredWh;
    return o;
  });
  const certificate = emitCertificate({
    asOf,
    owner,
    target: req.target,
    memory: req.memory,
    groups: plan.groups,
    optionFacts,
    tariffs: [...env.tariffs.values()].sort((a, b) => compareStrings(a.id, b.id)),
    carbon: env.carbon,
    trajectory: env.trajectory,
    grants: env.grants,
    rulePacks: env.rulePacks,
    ...(env.value ? { value: env.value } : {}),
    baseline: delivered[baselineRow]!,
    heavyKeys,
    heavyDelivered,
    heavyIdx,
    rowDelivered: delivered,
    money,
    status,
    witness,
    ruleIds,
    front,
    picks: pk,
    needsCheck,
  });
  const eagerRows = [
    ...new Set([
      baselineRow,
      ...front,
      ...[pk.leastUpfront, pk.bestReturn, pk.lowestRunningCarbon].filter((x) => x !== undefined),
    ]),
  ];
  const builder = createEvidenceGraphBuilder();
  for (const r of eagerRows) {
    addPackageEvidence(builder, { req, env, rows, money, results }, r);
    progress('evidence', builder.size, builder.size);
    await slicer.tick();
  }
  const graph: EvidenceGraph = builder.build();
  const hash = canonicalHash({ certificate, twin: canonicalHash(twin), fingerprint: env.fingerprint });
  const result: SearchResult = {
    hash,
    specHash: SPEC_HASH,
    baseline: results[baselineRow]!,
    heavy: { keys: heavyKeys, deliveredWh: heavyDelivered },
    packages,
    front,
    picks: pk,
    needsCheck,
    graph,
    certificate,
  };
  return { req, env, plan, rows, money, result };
}

/**
 * Physics (all modes, from a full `simulate`) and bookkeeping evidence for one row. The full run is
 * compared with the factorised one: a mismatch means the factorisation assumption broke (AC-7).
 */
export function addPackageEvidence(
  builder: ReturnType<typeof createEvidenceGraphBuilder>,
  s: {
    req: SearchRequest;
    env: SearchEnv;
    rows: readonly PackageSpec[];
    money: readonly RowMoney[];
    results?: readonly Record<RunMode, SimResult>[];
  },
  r: number,
): void {
  const pkg = s.rows[r]!;
  for (const mode of RUN_MODES) {
    const run = simulate(
      { twin: s.req.twin, mode, asOf: s.req.asOf, ...(pkg.id === BASELINE_ID ? {} : { pkg }) },
      s.env.pipeline,
    );
    const expected = s.results?.[r]?.[mode];
    if (expected && canonicalJson(expected.deliveredWh) !== canonicalJson(run.result.deliveredWh)) {
      throw new SearchError(`light path differs from full simulation for ${pkg.id} in ${mode}`);
    }
    builder.addDrafts(run.drafts);
  }
  addBookkeeping(builder, s.req.twin.id, pkg.id, s.money[r]!);
}
