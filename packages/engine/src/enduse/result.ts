/**
 * Real energy result assembly (WP-18): quantises the hourly model once to whole Wh per month,
 * then derives EUI (exact central value over conditioned area), bills (exact months summing to
 * the total), carbon, water and comfort, each with an evidence node (provenance `computed`, seal
 * `modelled`, R11: numbers are never `proved`).
 */
import type {
  BuildingResult,
  CompiledBuilding,
  EndUse,
  EvidenceGraph,
  EvidenceId,
  EvidenceNode,
  EvidenceValue,
  IsoDate,
  ResultStamp,
  Setting,
  SettingId,
  TariffBill,
  Unit,
} from '@ibasho/core';
import { END_USES, isZoneTwin, Q } from '@ibasho/core';
import type { EnergyRun } from './model.ts';
import { domesticBill, HT_II_A, htBill, ukBill } from './tariffs.ts';

export const REAL_ENERGY_VERSION = '0.1.0' as const;

export interface MoneyCtx {
  currency: 'INR' | 'GBP';
  flats?: number;
}

/** Defaults when a setting is absent (the same ids and values as the Preview setting defs). */
const DEFAULTS: Record<string, number> = {
  'money.tariff.elec.rate': 8.8,
  'money.tariff.elec.demand': 500,
  'money.tariff.elec.powerFactor': 0.95,
  'money.scheme.gruhaJyothi': 0,
  'carbon.grid.factor': 716,
  'comfort.dhw.solarShare': 0,
};
export function settingNumber(settings: readonly Setting[], id: SettingId): number {
  const s = settings.find((x) => x.id === id);
  return s && typeof s.value === 'number' ? s.value : (DEFAULTS[id] ?? 0);
}

class Ev {
  private readonly nodes: EvidenceNode[] = [];
  private n = 0;
  private readonly id: string;
  constructor(id: string) {
    this.id = id;
  }
  add(
    quantity: string,
    value: EvidenceValue,
    unit: Unit,
    formula: string,
    inputs: EvidenceId[] = [],
    month?: number,
  ): EvidenceId {
    const id = `ev_re_${this.id}_energy_${(this.n++).toString(36).padStart(3, '0')}` as EvidenceId;
    this.nodes.push({
      id,
      quantity,
      subject: {
        homeId: this.id,
        buildingId: this.id,
        mode: 'standard',
        ...(month !== undefined ? { month } : {}),
      },
      value,
      unit,
      formula: { id: formula, doc: 'packages/engine/src/enduse/README.md' },
      inputs: inputs.map((i) => ({ id: i, role: 'input' })),
      provenance: {
        kind: 'computed',
        plugin: { id: 'real.energy', version: REAL_ENERGY_VERSION },
        grade: 'estimate',
      },
      seal: 'modelled',
      rounding: { mode: 'sig', value: 3 },
    });
    return id;
  }
  graph(): EvidenceGraph {
    return {
      schema: 'ibasho.evidence/1',
      nodes: [...this.nodes].sort((a, b) => (a.id < b.id ? -1 : 1)),
      external: [],
    };
  }
}

const r1 = (x: number) => Math.round(x * 10) / 10;

export function totalWh(endUses: BuildingResult['endUses']): bigint {
  let s = 0n;
  for (const u of END_USES) for (const v of endUses[u]) if (v !== 'unknown') s += v;
  return s;
}

export function buildRealResult(
  compiled: CompiledBuilding,
  run: EnergyRun,
  money: MoneyCtx,
  settings: readonly Setting[],
  inputsHash: string,
  stamp: ResultStamp,
  asOf: IsoDate,
): BuildingResult {
  const id = isZoneTwin(compiled.twin) ? compiled.twin.buildingId : compiled.twin.id;
  const ev = new Ev(id);
  const endUses = Object.fromEntries(
    END_USES.map((u) => [u, run.wh[u].map((v) => BigInt(Math.round(v)))]),
  ) as Record<EndUse, bigint[]>;
  const nca = compiled.quantities.ncaMm2;
  const total = totalWh(endUses);
  const euiQ = nca > 0n ? Q.of(total * 1000n, nca) : Q.ZERO;
  const eui = Q.toNumber(euiQ);
  // Range: model form and unknown inputs (U-values, glazing, schedules) about +/-12%, more for untyped rooms.
  const spread = 0.12 + 0.3 * run.untypedShare;
  const lo = r1(eui * (1 - spread));
  const hi = r1(eui * (1 + spread));
  const ncaEv = ev.add('geom.nca', { fixed: nca.toString(), unit: 'mm2' }, 'mm2', 'geom.nca');
  const useEv: EvidenceId[] = [];
  for (const u of END_USES) {
    endUses[u].forEach((v, m) => {
      useEv.push(
        ev.add(`enduse.${u}.${m}`, { fixed: v.toString(), unit: 'Wh' }, 'Wh', 'ISO13790-5R1C+plant', [], m),
      );
    });
  }
  const totalEv = ev.add('enduse.total', { fixed: total.toString(), unit: 'Wh' }, 'Wh', 'sum', useEv);
  ev.add('eui.site.central', { exact: euiQ }, 'kWh/m2.yr', 'eui = sum(enduse) / nca', [totalEv, ncaEv]);
  ev.add('eui.site', { interval: { lo, hi } }, 'kWh/m2.yr', 'eui.range', [totalEv, ncaEv]);
  const gfa = compiled.quantities.gfaMm2;
  if (gfa > 0n) {
    const g = Q.toNumber(Q.of(total * 1000n, gfa));
    ev.add(
      'eui.site.gfa',
      { interval: { lo: r1(g * (1 - spread)), hi: r1(g * (1 + spread)) } },
      'kWh/m2.yr',
      'eui.range',
      [totalEv],
    );
  }
  ev.add(
    'energy.unmet_hours',
    { float: run.unmetHours },
    'h/yr',
    'occupied hours more than 1 K above the cooling set point',
  );
  const sourceFactor = money.currency === 'INR' ? 3 : 1.5;
  const gasUses = (u: EndUse) =>
    (u === 'heating' && run.heatingFuel === 'gas') || (u === 'hot-water' && run.dhwFuel === 'gas');
  const elecByMonth = Array.from({ length: 12 }, (_, m) =>
    END_USES.filter((u) => !gasUses(u)).reduce((s, u) => s + (endUses[u][m] as bigint), 0n),
  );
  const bills: TariffBill[] = [];
  if (money.currency === 'INR') {
    if (money.flats)
      bills.push(
        domesticBill(elecByMonth, money.flats, settingNumber(settings, 'money.scheme.gruhaJyothi') > 0),
      );
    else {
      const pf = settingNumber(settings, 'money.tariff.elec.powerFactor') || HT_II_A.powerFactor;
      const tariff = {
        ...HT_II_A,
        paisePerKvah: Math.round(settingNumber(settings, 'money.tariff.elec.rate') * 100),
        rupeesPerKva: settingNumber(settings, 'money.tariff.elec.demand'),
        powerFactor: pf,
      };
      bills.push(
        htBill(
          elecByMonth,
          run.peakKwByMonth.map((k) => k / pf),
          tariff,
          { peakPm: Math.round(run.todShare.peak * 1000), dayPm: Math.round(run.todShare.day * 1000) },
        ),
      );
    }
  } else {
    bills.push(ukBill(elecByMonth, 'electricity', 24.5, 60));
    const gas = Array.from({ length: 12 }, (_, m) =>
      END_USES.filter(gasUses).reduce((s, u) => s + (endUses[u][m] as bigint), 0n),
    );
    if (gas.some((v) => v > 0n)) bills.push(ukBill(gas, 'gas', 6.2, 31));
  }
  const unit: Unit = money.currency === 'INR' ? 'micro-paise' : 'micro-pence';
  for (const b of bills) {
    const months = b.byMonth.map((v, m) =>
      ev.add(`bill.${b.carrier}.${m}`, { fixed: v.toString(), unit }, unit, b.tariffId, [], m),
    );
    ev.add(`bill.${b.carrier}.total`, { fixed: b.total.toString(), unit }, unit, 'sum', months);
  }
  const factor =
    money.currency === 'INR' ? BigInt(Math.round(settingNumber(settings, 'carbon.grid.factor'))) : 207n;
  const elecTotal = elecByMonth.reduce((s, v) => s + (v > 0n ? v : 0n), 0n);
  const gasTotal = END_USES.filter(gasUses).reduce((s, u) => s + endUses[u].reduce((a, v) => a + v, 0n), 0n);
  const op = (elecTotal * factor + gasTotal * 183n) / 1000n;
  ev.add('carbon.op', { fixed: op.toString(), unit: 'gCO2e/yr' }, 'gCO2e/yr', 'carbon = kWh x factor');
  const litres = run.waterL.map((l) => BigInt(Math.round(l)));
  return {
    inputsHash,
    stamp,
    endUses,
    eui: {
      site: { lo, hi },
      source: { lo: r1(lo * sourceFactor), hi: r1(hi * sourceFactor) },
      partial: false,
    },
    conditionedM2: Number(nca) / 1e6,
    bills,
    water: { litresByMonth: litres },
    carbon: {
      op,
      factorIds: money.currency === 'INR' ? ['cea.baseline.v20'] : ['desnz.2025.elec', 'desnz.2025.gas'],
    },
    comfort: run.comfort.map((c) => ({
      roomId: c.roomId,
      model: c.model,
      fanAirSpeedMs: 0.8,
      fanHours: { lo: c.fanHours[0], hi: c.fanHours[1] },
      acHours: c.acHours.map((a) => ({ setpointC: a.setpointC, hours: { lo: a.hours[0], hi: a.hours[1] } })),
      occupiedHours: c.occupiedHours,
    })),
    codes: [],
    ratings: [],
    evidence: ev.graph(),
    asOf,
  };
}
