/**
 * Certificate emitter input, `ibasho.cert/2` (ARCH 8.3). Owner: WP-02 (emitter); the type is
 * generated from Lean into `@ibasho/spec-gen` (WP-04).
 *
 * Trusted inputs (physics and pack data) and claimed outputs, columnar. Encodings:
 * - `baseline[mode]`: int64 [fuel][month] (core `FUELS` order), integer Wh.
 * - `heavy.delivered[mode]`: int64 [key][fuel][month]: delivered energy of each heavy key's twin
 *   with its own (unchanged) systems.
 * - `light.delivered`: int64 records, per package row in order:
 *   `heavyIdx, n, then n pairs (slot, delta)`, slot = modeIdx * 72 + fuelIdx * 12 + month (modes in
 *   core `RUN_MODES` order), delta = package delivered - heavy key delivered (non-zero only).
 * - `claimed.status` u8 (core `PACKAGE_STATUS`), `n0`, `npv`, `carbonSaved` int64 (micro-pence,
 *   micro-pence, grams of lifetime carbon), `witness` u32 (`0xffffffff` = none).
 * - `front`, `needsCheck` u32 rows.
 * - Group facts carry the option's measure facts (`m.*`) plus its costs as decimal strings in
 *   micro-pence (`c.lo`, `c.mid`, `c.hi`), `c.lifetimeYears` and `c.vatRate` (rational wire).
 *   PLACEHOLDER: costs ride in the facts until the certificate gains a `packs.costs` slot
 *   (INTERFACES request to WP-04).
 * - Pack data: tariffs as slab tables, carbon as (fuel, month) factors, the trajectory by year,
 *   grants with their dates and per-row applied amounts, rule packs as rules, value as uplift
 *   rationals for every band pair. All integers are decimal strings.
 */
import {
  BANDS,
  type CarbonPack,
  type CarbonTrajectory,
  type ChoiceGroup,
  FUELS,
  type Fuel,
  type FuelMonthly,
  type IsoDate,
  MONTHS,
  type OwnerCtx,
  Q,
  RUN_MODES,
  type RulePackPlugin,
  type RunMode,
  type Target,
  type TariffPlugin,
  type ValueEvidencePlugin,
  type Wh,
} from '@ibasho/core';
import { type CertGroup, type Certificate, type CertPackData, SPEC_HASH } from '@ibasho/spec-gen';
import type { RowMoney } from './bookkeeping.ts';
import { i64b64, u8b64, u32b64 } from './wire.ts';

export const ENGINE_VERSION = '0.1.0';

/** int64 [fuel][month] flattened. */
export function flatFuelMonth(v: FuelMonthly<Wh>): bigint[] {
  const out: bigint[] = [];
  for (const f of FUELS) for (const m of MONTHS) out.push(v[f][m]!);
  return out;
}

function tariffData(t: TariffPlugin): CertPackData {
  const zero = t.bill(
    MONTHS.map(() => 0n),
    { days: MONTHS.map(() => 1) },
  );
  const used = t.bill(
    MONTHS.map(() => 1n),
    { days: MONTHS.map(() => 1) },
  );
  const slabs = used.slabs;
  const data: Record<string, unknown> = {
    fuel: t.fuel,
    currency: t.currency,
    validFrom: t.validFrom,
    validTo: t.validTo,
  };
  if (slabs) {
    data.period = slabs.period;
    data.slabs = slabs.slabs.map((s) => ({
      uptoWh: s.uptoWh === null ? null : s.uptoWh.toString(),
      price: s.price.toString(),
    }));
    data.standingPerDay = slabs.standingPerDay.toString();
    data.standingWhenUnused = zero.total > 0n;
  }
  return { id: t.id, version: t.version, data };
}

function carbonData(c: CarbonPack): CertPackData {
  const factors: Partial<Record<Fuel, string[]>> = {};
  for (const f of FUELS) {
    try {
      factors[f] = MONTHS.map((m) => c.factor(f, m).toString());
    } catch {
      // The pack has no factor for this fuel; the certificate omits it (never a zero).
    }
  }
  return { id: c.id, version: c.version, data: { unit: 'ug/Wh', includesTD: c.includesTD, factors } };
}

function trajectoryData(t: CarbonTrajectory, firstYear: number, years: number): CertPackData {
  const factors: Partial<Record<Fuel, string[]>> = {};
  for (const f of FUELS) {
    try {
      const row: string[] = [];
      for (let y = 0; y < years; y++) row.push(t.factor(f, firstYear + y).toString());
      factors[f] = row;
    } catch {
      // No factor for this fuel.
    }
  }
  return { id: t.id, version: t.version, data: { unit: 'ug/Wh', firstYear, years, factors } };
}

function valueData(v: ValueEvidencePlugin | undefined): CertPackData {
  if (!v) return { id: 'none', version: '0.0.0', data: null };
  const uplift: Record<string, { low: string; central: string; high: string }> = {};
  for (const a of BANDS) {
    for (const b of BANDS) {
      const u = v.uplift(a, b);
      if (u)
        uplift[`${a}>${b}`] = { low: Q.toWire(u.low), central: Q.toWire(u.central), high: Q.toWire(u.high) };
    }
  }
  return { id: v.id, version: v.version, data: { uplift } };
}

function ownerWire(o: OwnerCtx): Record<string, unknown> {
  const out: Record<string, unknown> = {
    tenure: o.tenure,
    discountRatePpb: o.discountRatePpb.toString(),
    horizonYears: o.horizonYears,
  };
  if (o.budget !== undefined) out.budget = o.budget.toString();
  if (o.rights !== undefined) out.rights = o.rights;
  return out;
}

export interface CertInput {
  asOf: IsoDate;
  owner: OwnerCtx;
  target: Target;
  memory: { rejected: string[]; completed: string[] };
  groups: readonly ChoiceGroup[];
  optionFacts: ReadonlyMap<string, Record<string, unknown>>;
  tariffs: readonly TariffPlugin[];
  carbon: CarbonPack;
  trajectory: CarbonTrajectory;
  grants: readonly {
    id: string;
    version: string;
    validFrom?: IsoDate;
    validTo?: IsoDate;
    regions?: string[];
  }[];
  rulePacks: readonly RulePackPlugin[];
  value?: ValueEvidencePlugin;
  baseline: Record<RunMode, FuelMonthly<Wh>>;
  heavyKeys: readonly string[];
  /** [mode] -> [key][fuel][month] flattened. */
  heavyDelivered: Record<RunMode, BigInt64Array>;
  heavyIdx: Uint32Array;
  /** [row][mode] delivered. */
  rowDelivered: readonly Record<RunMode, FuelMonthly<Wh>>[];
  money: readonly RowMoney[];
  status: Uint8Array;
  witness: Uint32Array;
  ruleIds: readonly string[][];
  front: Uint32Array;
  picks: Certificate['picks'];
  needsCheck: Uint32Array;
}

const SLOTS = FUELS.length * 12;

export function emitCertificate(i: CertInput): Certificate {
  const light: bigint[] = [];
  i.rowDelivered.forEach((byMode, r) => {
    const k = i.heavyIdx[r]!;
    const pairs: bigint[] = [];
    RUN_MODES.forEach((mode, mi) => {
      const flat = flatFuelMonth(byMode[mode]);
      const ref = i.heavyDelivered[mode];
      for (let s = 0; s < SLOTS; s++) {
        const d = flat[s]! - ref[k * SLOTS + s]!;
        if (d !== 0n) pairs.push(BigInt(mi * SLOTS + s), d);
      }
    });
    light.push(BigInt(k), BigInt(pairs.length / 2), ...pairs);
  });

  const appliedBy = new Map<string, string[][]>();
  i.money.forEach((m, r) => {
    for (const g of m.grants) {
      const list = appliedBy.get(g.grantId) ?? [];
      list.push([String(r), g.amount.toString()]);
      appliedBy.set(g.grantId, list);
    }
  });
  const firstYear = Number(i.asOf.slice(0, 4));
  const groups: CertGroup[] = i.groups.map((g) => {
    const facts: CertGroup['facts'] = {};
    for (const o of g.options) {
      if (o === 'none') continue;
      const f = i.optionFacts.get(o);
      if (!f) throw new Error(`no facts recorded for option ${o}`);
      facts[o] = f as CertGroup['facts'][string];
    }
    return { id: g.id, options: [...g.options], facts };
  });

  return {
    schema: 'ibasho.cert/2',
    specHash: SPEC_HASH,
    engine: { version: ENGINE_VERSION },
    packs: {
      tariffs: i.tariffs.map(tariffData),
      carbon: carbonData(i.carbon),
      trajectory: trajectoryData(i.trajectory, firstYear, i.owner.horizonYears),
      grants: i.grants.map((g) => ({
        id: g.id,
        version: g.version,
        data: {
          validFrom: g.validFrom,
          validTo: g.validTo,
          regions: g.regions,
          applied: appliedBy.get(g.id) ?? [],
        },
      })),
      rules: i.rulePacks.map((p) => ({ id: p.id, version: p.version, data: { rules: p.rules } })),
      value: valueData(i.value),
    },
    context: {
      owner: ownerWire(i.owner),
      target: { ...i.target },
      memory: { rejected: [...i.memory.rejected], completed: [...i.memory.completed] },
      asOf: i.asOf,
    },
    groups,
    baseline: {
      rating: i64b64(flatFuelMonth(i.baseline.rating)),
      standard: i64b64(flatFuelMonth(i.baseline.standard)),
      'your-home': i64b64(flatFuelMonth(i.baseline['your-home'])),
    },
    heavy: {
      keys: [...i.heavyKeys],
      delivered: {
        rating: i64b64(i.heavyDelivered.rating),
        standard: i64b64(i.heavyDelivered.standard),
        'your-home': i64b64(i.heavyDelivered['your-home']),
      },
    },
    light: { delivered: i64b64(light) },
    claimed: {
      status: u8b64(i.status),
      n0: i64b64(i.money.map((m) => m.n0)),
      npv: i64b64(i.money.map((m) => m.flows.npv)),
      carbonSaved: i64b64(i.money.map((m) => m.lifetimeCarbonG)),
      witness: u32b64(i.witness),
      ruleIds: i.ruleIds.map((r) => [...r]),
    },
    front: u32b64(i.front),
    picks: { ...i.picks },
    needsCheck: u32b64(i.needsCheck),
  };
}
