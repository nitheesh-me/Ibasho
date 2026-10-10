/**
 * FAKE engine for MCP contract tests. Implements the `EngineApi` contract with fixed, labelled
 * values so the tests exercise wiring and grounding, never physics. Not a fixture of truth.
 */
import {
  type Certificate,
  canonicalHash,
  type EngineApi,
  type EvidenceGraph,
  type EvidenceId,
  type EvidenceNode,
  PACKAGE_STATUS,
  type RunMode,
  type SearchResult,
  type SimBundle,
  type SimResult,
  type Unit,
} from '@ibasho/core';

const MONTHS12 = <T>(v: T) => [v, v, v, v, v, v, v, v, v, v, v, v] as const;

export function node(
  homeId: string,
  quantity: string,
  fixed: string,
  unit: Unit,
  mode: RunMode,
  packageId?: string,
): EvidenceNode {
  const id =
    `ev_${canonicalHash({ homeId, quantity, packageId: packageId ?? null, mode, fixed }).slice(0, 10)}` as EvidenceId;
  const subject: EvidenceNode['subject'] = { homeId, mode };
  if (packageId) subject.packageId = packageId;
  return {
    id,
    quantity,
    subject,
    value: { fixed, unit },
    unit,
    formula: { id: 'FAKE-1', doc: 'fake engine for tests' },
    inputs: [],
    provenance: {
      kind: 'computed',
      sources: [{ id: 'fake', title: 'Fake', clause: '3.2', retrieved: '2026-10-11' }],
    },
    seal: 'modelled',
    rounding: { mode: 'sig', value: 3 },
  };
}

function graph(nodes: EvidenceNode[]): EvidenceGraph {
  return {
    schema: 'ibasho.evidence/1',
    nodes: [...nodes].sort((a, b) => (a.id < b.id ? -1 : 1)),
    external: [],
  };
}

function sim(homeId: string, pkgId: string, mode: RunMode, gasWh: bigint): SimResult {
  return {
    mode,
    homeId,
    packageId: pkgId,
    deliveredWh: {
      electricity: MONTHS12(0n),
      gas: MONTHS12(gasWh),
      oil: MONTHS12(0n),
      lpg: MONTHS12(0n),
      biomass: MONTHS12(0n),
      district: MONTHS12(0n),
    },
    exportWh: MONTHS12(0n),
    qhKWh: MONTHS12(0),
    qcKWh: MONTHS12(0),
  } as SimResult;
}

export const FAKE_PACKAGES = [
  'baseline',
  'loft-300',
  'heat-ashp-radiators-plus+loft-300',
  'wall-iwi-woodfibre',
];

export interface FakeEngine extends EngineApi {
  calls: { method: string; arg: unknown }[];
}

export function fakeEngine(): FakeEngine {
  const nodes = new Map<string, EvidenceNode>();
  const keep = (ns: EvidenceNode[]) => {
    for (const n of ns) nodes.set(n.id, n);
    return ns;
  };
  const calls: FakeEngine['calls'] = [];
  const unsupported = () => Promise.reject(new Error('fake engine: not implemented'));

  const api: FakeEngine = {
    calls,
    init: async () => {},
    async simulate(req) {
      calls.push({
        method: 'simulate',
        arg: { twin: req.twin.id, pkg: req.pkg?.id ?? null, modes: req.modes },
      });
      const homeId = req.twin.id;
      const pkgId = req.pkg?.id ?? 'baseline';
      const withPkg = pkgId !== 'baseline';
      const byMode: SimBundle['byMode'] = {};
      const ns: EvidenceNode[] = [];
      for (const mode of req.modes) {
        byMode[mode] = sim(homeId, pkgId, mode, withPkg ? 900_000n : 1_250_000n);
        ns.push(
          node(
            homeId,
            'energy.delivered.gas',
            withPkg ? '10800000' : '15000000',
            'Wh',
            mode,
            withPkg ? pkgId : undefined,
          ),
        );
        ns.push(
          node(
            homeId,
            'money.bill.gas',
            withPkg ? '75600000000' : '105000000000',
            'micro-pence/yr',
            mode,
            withPkg ? pkgId : undefined,
          ),
        );
        if (withPkg) ns.push(node(homeId, 'acct.saving.gas', '4200000', 'Wh', mode, pkgId));
      }
      return {
        hash: canonicalHash({ homeId, pkgId, modes: req.modes, setpoint: req.twin.occupancy.setpointC }),
        byMode,
        graph: graph(keep(ns)),
      };
    },
    async search(req) {
      calls.push({
        method: 'search',
        arg: {
          twin: req.twin.id,
          memory: req.memory,
          owner: {
            ...req.owner,
            discountRatePpb: String(req.owner.discountRatePpb),
            budget: req.owner.budget === undefined ? null : String(req.owner.budget),
          },
        },
      });
      const homeId = req.twin.id;
      const ids = FAKE_PACKAGES.filter((p) => !req.memory.rejected.some((m) => p.includes(m)));
      const ns: EvidenceNode[] = [];
      for (const p of ids.slice(0, 2)) {
        ns.push(node(homeId, 'fin.n0', p === 'baseline' ? '0' : '1500', 'GBP', 'standard', p));
        ns.push(node(homeId, 'fin.npv', p === 'baseline' ? '0' : '2100', 'GBP', 'standard', p));
      }
      ns.push(node(homeId, 'energy.delivered.gas', '15000000', 'Wh', 'standard'));
      const n = ids.length;
      const status = new Uint8Array(n);
      const witness = new Uint32Array(n).fill(0xffffffff);
      const ruleIds: string[][] = ids.map(() => []);
      ids.forEach((p, i) => {
        if (p.includes('ashp')) {
          status[i] = PACKAGE_STATUS['needs-check'];
          ruleIds[i] = ['UK.DNO.HP.LOOPED'];
        }
        if (p.startsWith('wall-iwi')) {
          status[i] = PACKAGE_STATUS.feasible;
          witness[i] = 1;
        }
      });
      const result: SearchResult = {
        hash: canonicalHash({ homeId, ids, memory: req.memory }),
        specHash: 'spec-fake',
        baseline: {
          rating: sim(homeId, 'baseline', 'rating', 1n),
          standard: sim(homeId, 'baseline', 'standard', 1n),
          'your-home': sim(homeId, 'baseline', 'your-home', 1n),
        },
        heavy: {
          keys: [],
          deliveredWh: {
            rating: new BigInt64Array(),
            standard: new BigInt64Array(),
            'your-home': new BigInt64Array(),
          },
        },
        packages: {
          ids,
          heavyIdx: new Uint32Array(n),
          lightOpts: new Uint16Array(0),
          lightGroups: [],
          status,
          n0: new BigInt64Array(n),
          npv: new BigInt64Array(n),
          carbonSaved: new BigInt64Array(n),
          witness,
          ruleIds,
        },
        front: Uint32Array.from([0, 1]),
        picks: { leastUpfront: 0, bestReturn: 1, lowestRunningCarbon: 1 },
        needsCheck: Uint32Array.from(ids.flatMap((p, i) => (p.includes('ashp') ? [i] : []))),
        graph: graph(keep(ns)),
        certificate: { schema: 'ibasho.cert/2', specHash: 'spec-fake' } as unknown as Certificate,
      };
      return { jobId: 'job-1', result: Promise.resolve(result) };
    },
    cancel: () => {},
    async evidence(_hash, ids) {
      if (!Array.isArray(ids)) return [];
      return ids.flatMap((id) => {
        const n = nodes.get(id);
        return n ? [n] : [];
      });
    },
    uncertainty: unsupported,
    calibrate: unsupported,
    valueOfInformation: unsupported,
    flips: unsupported,
    noise: unsupported,
  };
  return api;
}
