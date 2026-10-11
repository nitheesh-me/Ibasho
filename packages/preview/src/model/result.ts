/**
 * Preview energy result assembly: quantises the model to Wh, then derives EUI, bills, water,
 * carbon and comfort with exact identities (P2): EUI central equals the end-use sum over the
 * conditioned area, every bill total equals its months, carbon equals energy times the factor.
 */
import type {
  BuildingResult,
  CompiledBuilding,
  EndUse,
  IsoDate,
  ResultStamp,
  Setting,
  TariffBill,
} from '@ibasho/core';
import { END_USES, isZoneTwin, Q } from '@ibasho/core';
import { settingNumber } from '../settings.ts';
import type { EnergyCore } from './energy.ts';
import { EvidenceBuilder } from './evidence.ts';
import { domesticBill, HT_II_A, htBill, ukBill } from './money.ts';

export interface MoneyCtx {
  currency: 'INR' | 'GBP';
  /** Apartments are billed per flat on slabs. */
  flats?: number;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Total Wh across end uses (PV negative), exact. */
export function totalWh(endUses: BuildingResult['endUses']): bigint {
  let s = 0n;
  for (const u of END_USES) for (const v of endUses[u]) if (v !== 'unknown') s += v;
  return s;
}

/** EUI central value as an exact rational in kWh/m²·yr (Wh * 1000 / mm²). */
export const euiExact = (wh: bigint, conditionedMm2: bigint): Q =>
  conditionedMm2 > 0n ? Q.of(wh * 1000n, conditionedMm2) : Q.ZERO;

export function buildEnergyResult(
  compiled: CompiledBuilding,
  core: EnergyCore,
  money: MoneyCtx,
  settings: readonly Setting[],
  inputsHash: string,
  stamp: ResultStamp,
  asOf: IsoDate,
): BuildingResult {
  const id = isZoneTwin(compiled.twin) ? compiled.twin.buildingId : compiled.twin.id;
  const ev = new EvidenceBuilder(id, 'energy');
  const endUses = Object.fromEntries(
    END_USES.map((u) => [u, core.wh[u].map((v) => BigInt(Math.round(v)))]),
  ) as Record<EndUse, bigint[]>;
  const nca = compiled.quantities.ncaMm2;
  const total = totalWh(endUses);
  const euiQ = euiExact(total, nca);
  const eui = Q.toNumber(euiQ);
  const lo = r1(eui * (1 - core.spread));
  const hi = r1(eui * (1 + core.spread));
  const ncaEv = ev.fixed('geom.nca', nca, 'mm2', 'geom.nca');
  const useEv: string[] = [];
  for (const u of END_USES) {
    endUses[u].forEach((v, m) => {
      useEv.push(ev.fixed(`enduse.${u}.${m}`, v, 'Wh', 'preview.enduse', { subject: { month: m } }));
    });
  }
  const totalEv = ev.fixed('enduse.total', total, 'Wh', 'sum', { inputs: useEv as `ev_${string}`[] });
  ev.exact('eui.site.central', euiQ, 'kWh/m2.yr', 'eui = sum(enduse) / nca', { inputs: [totalEv, ncaEv] });
  ev.interval('eui.site', lo, hi, 'kWh/m2.yr', 'preview.eui.range', {
    inputs: [totalEv, ncaEv],
    doc: 'EUI per conditioned floor area (geom.nca); eui.site.gfa gives it per gross floor area (BEE uses built-up area)',
  });
  const gfa = compiled.quantities.gfaMm2;
  if (gfa > 0n) {
    const g = Q.toNumber(euiExact(total, gfa));
    const gfaEv = ev.fixed('geom.gfa', gfa, 'mm2', 'geom.gfa');
    ev.interval(
      'eui.site.gfa',
      r1(g * (1 - core.spread)),
      r1(g * (1 + core.spread)),
      'kWh/m2.yr',
      'preview.eui.range',
      {
        inputs: [totalEv, gfaEv],
        doc: 'EUI per gross floor area',
      },
    );
  }
  const sourceFactor = money.currency === 'INR' ? 3 : 1.5;
  ev.interval('eui.source', r1(lo * sourceFactor), r1(hi * sourceFactor), 'kWh/m2.yr', 'preview.eui.source');

  const elecWh = END_USES.filter(
    (u) => !((u === 'heating' || u === 'hot-water') && core.heatingFuel === 'gas'),
  ).map((u) => endUses[u]);
  const elecByMonth = Array.from({ length: 12 }, (_, m) =>
    elecWh.reduce((s, arr) => s + (arr[m] as bigint), 0n),
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
          core.peakKw.map((k) => k / pf),
          tariff,
          { peakPm: Math.round(core.todShare.peak * 1000), dayPm: Math.round(core.todShare.day * 1000) },
        ),
      );
    }
  } else {
    bills.push(ukBill(elecByMonth, 'electricity', 24.5, 60));
    if (core.heatingFuel === 'gas') {
      const gas = endUses.heating.map((v, m) => v + (endUses['hot-water'][m] as bigint));
      bills.push(ukBill(gas, 'gas', 6.2, 31));
    }
  }
  for (const b of bills) {
    const months = b.byMonth.map((v, m) =>
      ev.fixed(
        `bill.${b.carrier}.${m}`,
        v,
        money.currency === 'INR' ? 'micro-paise' : 'micro-pence',
        'preview.tariff',
        { subject: { month: m } },
      ),
    );
    ev.fixed(
      `bill.${b.carrier}.total`,
      b.total,
      money.currency === 'INR' ? 'micro-paise' : 'micro-pence',
      'sum',
      { inputs: months },
    );
    if (b.cliffMonths.length) ev.cat('bill.cliff_months', b.cliffMonths.join(','), 'preview.tariff.cliff');
  }
  const factor =
    money.currency === 'INR' ? BigInt(Math.round(settingNumber(settings, 'carbon.grid.factor'))) : 207n;
  const elecTotal = elecByMonth.reduce((s, v) => s + (v > 0n ? v : 0n), 0n);
  const gasTotal =
    core.heatingFuel === 'gas'
      ? [...endUses.heating, ...endUses['hot-water']].reduce((s, v) => s + v, 0n)
      : 0n;
  const op = (elecTotal * factor + gasTotal * 183n) / 1000n;
  ev.fixed('carbon.op', op, 'gCO2e/yr', 'carbon = kWh * factor');
  const litres = core.waterL.map((l) => BigInt(Math.round(l)));
  litres.forEach((l, m) => {
    ev.fixed(`water.l.${m}`, l, 'L', 'preview.water', { subject: { month: m } });
  });
  for (const c of core.comfort) {
    ev.interval(`comfort.fan_hours.${c.roomId}`, c.fanHours[0], c.fanHours[1], 'h/yr', 'preview.comfort', {
      subject: { roomId: c.roomId },
    });
  }
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
    comfort: core.comfort.map((c) => ({
      roomId: c.roomId,
      model: money.currency === 'INR' ? 'IMAC-MM' : 'EN16798',
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
