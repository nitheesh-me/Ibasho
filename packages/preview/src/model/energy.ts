/**
 * Preview energy model: monthly end uses per zone from loads, envelope conduction, solar gains
 * and ventilation, with fan-first comfort and a range that widens for unknowns (R33). It is a
 * plausible stand-in shaped exactly like WP-18's output; it is never sealed (R26).
 */
import type { CompiledBuilding, EndUse, FacadeBin, SiteResult, ZoneTwin } from '@ibasho/core';
import { END_USES, facadeBin, isZoneTwin, Q } from '@ibasho/core';
import type { MonthlyClimate } from './climate.gen.ts';
import { surfaceSun } from './solar.ts';
import { DWELLING, loadsFor } from './space-types.ts';

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** Domestic hot water demand by month relative to the mean (winter showers, Hyderabad). */
const DHW_SEASON_HYD = [1.6, 1.4, 0.8, 0.3, 0.2, 0.2, 0.2, 0.2, 0.3, 0.6, 1.1, 1.5];

/**
 * Reference design for the code baseline (R35, ECSBC 2024 standard design, composite climate;
 * estimates until WP-19): same geometry, code envelope, glazing and lighting.
 */
export const STANDARD_DESIGN: EnergyParams = {
  uWall: 0.4,
  uRoof: 0.33,
  uWin: 3.0,
  shgc: 0.27,
  lpdScale: 0.9,
  roofAbsorptance: 0.6,
};

/** Design levers the optimiser turns (all optional; defaults are the building as drawn). */
export interface EnergyParams {
  wwrScale?: Partial<Record<FacadeBin, number>>;
  shgc?: number;
  uWin?: number;
  uWall?: number;
  uRoof?: number;
  roofAbsorptance?: number;
  /** Extra projection factor from new overhangs, per facade bin. */
  pf?: Partial<Record<FacadeBin, number>>;
  lpdScale?: number;
  setpointC?: number;
  daylightControls?: boolean;
  pvKwp?: number;
  /** Share of domestic hot water from solar heaters (0 to 1). */
  dhwSolarShare?: number;
}

export interface EnergyCore {
  /** Wh per month per end use (PV negative). */
  wh: Record<EndUse, number[]>;
  conditionedM2: number;
  /** Peak electrical demand per month, kW: diversified lights and plugs plus cooling at its peak. */
  peakKw: number[];
  persons: number;
  /** Relative half-width of the EUI range. */
  spread: number;
  untypedShare: number;
  heatingFuel: 'gas' | 'electricity' | 'none';
  waterL: number[];
  /** Share of energy in the morning and evening peak (06 to 10, 18 to 22) and the day (10 to 18). */
  todShare: { peak: number; day: number };
  comfort: {
    roomId: string;
    fanHours: [number, number];
    acHours: { setpointC: number; hours: [number, number] }[];
    occupiedHours: number;
  }[];
}

const zero = () => Array.from({ length: 12 }, () => 0);

function systemOf(t: ZoneTwin): { cop: number; fans: number; pumps: number; central: boolean } {
  const ids = t.systems.map((s) => s.systemId).join(' ');
  if (/chiller/.test(ids)) return { cop: 3.4, fans: 0.24, pumps: 0.11, central: true };
  if (/vrf/.test(ids)) return { cop: 3.6, fans: 0.12, pumps: 0, central: false };
  return { cop: 3.0, fans: 0.06, pumps: 0, central: false };
}

export function energyModel(
  c: CompiledBuilding,
  clim: MonthlyClimate,
  p: EnergyParams = {},
  radiation?: SiteResult,
): EnergyCore {
  const wh = Object.fromEntries(END_USES.map((u) => [u, zero()])) as Record<EndUse, number[]>;
  const peakKw = zero();
  const waterL = zero();
  const comfort: EnergyCore['comfort'] = [];
  if (!isZoneTwin(c.twin))
    return {
      wh,
      conditionedM2: 0,
      peakKw,
      persons: 0,
      spread: 0.3,
      untypedShare: 1,
      heatingFuel: 'none',
      waterL,
      todShare: { peak: 0.25, day: 0.6 },
      comfort,
    };
  const t = c.twin;
  const heatingClimate = clim.lat > 35;
  const sys = systemOf(t);
  const sp = p.setpointC ?? 24;
  const shgc = p.shgc ?? 0.62;
  const uWin = p.uWin ?? 5.6;
  const uWall = p.uWall ?? (heatingClimate ? 1.6 : 1.9);
  const uRoof = p.uRoof ?? (heatingClimate ? 0.6 : 1.8);
  const absorb = p.roofAbsorptance ?? 0.75;
  const shadeOf = new Map<string, number[]>();
  for (const w of radiation?.windows ?? []) {
    const base = w.id.replace(/@\d+$/, '');
    if (!shadeOf.has(base))
      shadeOf.set(
        base,
        w.shadingFactor.map((q) => Q.toNumber(q)),
      );
  }
  const sunCache = new Map<number, number[]>();
  const irrFor = (azMdeg: number) => {
    const k = Math.round(azMdeg / 5000);
    let v = sunCache.get(k);
    if (!v) {
      v = surfaceSun(clim, k * 5, 90).irr;
      sunCache.set(k, v);
    }
    return v;
  };
  const roofIrr = surfaceSun(clim, 180, 0).irr;
  const bySurfaceZone = new Map<string, ZoneTwin['surfaces']>();
  for (const s of t.surfaces) {
    const l = bySurfaceZone.get(s.zoneId) ?? [];
    l.push(s);
    bySurfaceZone.set(s.zoneId, l);
  }
  let condM2 = 0;
  let totalM2 = 0;
  let untypedM2 = 0;
  let persons = 0;
  let dwellers = 0;
  let baseKw = 0;
  let dayWh = 0;
  let allDayWh = 0;
  const coolDay = zero();
  const coolAlways = zero();
  for (const z of t.zones) {
    const a = Number(z.floorMm2) / 1e6;
    const vol = Number(z.volumeMm3) / 1e9;
    const { loads, typed } = loadsFor(z.spaceTypeIds[0]);
    const always = loads.hours >= 24;
    totalM2 += a;
    if (!typed) untypedM2 += a;
    const cond = z.conditioned && loads.conditioned;
    if (cond) condM2 += a;
    persons += loads.occ * a;
    if (DWELLING.has(z.spaceTypeIds[0] ?? '')) dwellers += loads.occ * a;
    // Coincident peak: lights at 0.8, plugs at 0.7, 24 h loads at full power.
    baseKw += ((always ? loads.lpd + loads.epd : loads.lpd * 0.8 + loads.epd * 0.7) * a) / 1000;
    let uaWall = 0;
    let uaWin = 0;
    const solar = zero();
    let roofA = 0;
    for (const s of bySurfaceZone.get(z.id) ?? []) {
      const am2 = Number(s.areaMm2) / 1e6;
      if (s.boundary !== 'outdoors') continue;
      if (s.kind === 'wall') uaWall += am2 * uWall;
      if (s.kind === 'roof') roofA += am2;
      if (s.kind === 'window') {
        const bin = facadeBin(s.azimuthMdeg);
        const area = am2 * (p.wwrScale?.[bin] ?? 1);
        uaWin += area * uWin;
        const irr = irrFor(s.azimuthMdeg);
        const sh = shadeOf.get(s.id);
        const pfCut = 1 - Math.min(0.6, (p.pf?.[bin] ?? 0) * 0.9);
        for (let m = 0; m < 12; m++)
          solar[m] = (solar[m] as number) + area * shgc * (irr[m] as number) * (sh?.[m] ?? 1) * pfCut;
      }
    }
    for (let m = 0; m < 12; m++) {
      const occH = (loads.hours * loads.days * (DAYS[m] as number)) / 7;
      const dl = p.daylightControls && loads.lpd >= 8 ? 0.78 : 1;
      // Diversity: lights and plug loads are not all on for every occupied hour (24/7 loads are).
      const light = loads.lpd * (p.lpdScale ?? 1) * dl * a * occH * (always ? 1 : 0.75);
      const equip = loads.epd * a * occH * (always ? 1 : 0.6);
      wh.lighting[m] = (wh.lighting[m] as number) + light;
      wh.equipment[m] = (wh.equipment[m] as number) + equip;
      if (always) allDayWh += light + equip;
      else dayWh += light + equip;
      if (!cond) continue;
      const tm = clim.tC[m] as number;
      const rh = clim.rhPct[m] as number;
      if (heatingClimate) {
        const dT = Math.max(0, 16 - tm);
        const hloss = (uaWall + uaWin + roofA * uRoof + 0.33 * 0.7 * vol) * dT * 24 * (DAYS[m] as number);
        const gains = (light + equip) * 0.5 + (solar[m] as number) * 0.5;
        wh.heating[m] = (wh.heating[m] as number) + Math.max(0, hloss - gains) / 0.85;
        continue;
      }
      // Homes switch the AC on only in warm months (fans first, R40); offices run it all year.
      const homeUse = DWELLING.has(z.spaceTypeIds[0] ?? '') ? Math.max(0, Math.min(1, (tm - 23) / 5)) : 1;
      const acH = always ? 24 * (DAYS[m] as number) : occH * loads.acShare * homeUse;
      const dT = Math.max(0, tm + 4 - sp);
      const conduction = (uaWall + uaWin) * dT * acH;
      const solAir = tm + (absorb * (roofIrr[m] as number)) / ((DAYS[m] as number) * 12 * 25);
      const roofG = roofA * uRoof * Math.max(0, solAir - sp) * acH;
      const vent = 0.33 * 1.5 * vol * dT * acH * (1 + Math.max(0, rh - 60) / 80);
      const internal =
        (light + equip) * 0.9 * (always ? 1 : loads.acShare * homeUse) + 75 * loads.occ * a * acH;
      const solarG = (solar[m] as number) * Math.min(1, loads.hours / 10) * loads.acShare * homeUse;
      const thermal = Math.max(0, conduction + roofG + vent + internal + solarG);
      const cop = loads.epd > 200 ? 2.6 : sys.cop * (1 + (sp - 24) * 0.03);
      const elec = thermal / cop;
      wh.cooling[m] = (wh.cooling[m] as number) + elec;
      wh.fans[m] = (wh.fans[m] as number) + elec * sys.fans;
      wh.pumps[m] = (wh.pumps[m] as number) + elec * sys.pumps;
      const hvac = elec * (1 + sys.fans + sys.pumps);
      if (always) coolAlways[m] = (coolAlways[m] as number) + hvac / (24 * (DAYS[m] as number));
      else coolDay[m] = (coolDay[m] as number) + hvac / Math.max(1, acH);
    }
  }
  for (let m = 0; m < 12; m++) {
    // Domestic hot water: 20 L of hot water a person a day at the yearly mean, heated 20 K at 90%,
    // mostly in winter (Hyderabad), less any solar share. Non-residential hot water is negligible.
    const litres = dwellers * 20 * (heatingClimate ? 1 : (DHW_SEASON_HYD[m] as number)) * (DAYS[m] as number);
    waterL[m] = litres + (persons - dwellers) * 15 * (DAYS[m] as number) * (5 / 7);
    wh['hot-water'][m] = (litres * 4.186 * 20 * (1 - (p.dhwSolarShare ?? 0))) / 3.6 / 0.9;
    wh.other[m] =
      ((wh.lighting[m] as number) + (wh.equipment[m] as number)) * (t.zones.length > 8 ? 0.03 : 0.01);
    const kwp = p.pvKwp ?? 0;
    wh.pv[m] = -kwp * (clim.ghiKwhM2[m] as number) * 0.78 * 1000;
    // Cooling at its peak runs about 1.5 times its occupied-hours mean.
    peakKw[m] = baseKw + ((coolDay[m] as number) * 1.5 + (coolAlways[m] as number) * 1.2) / 1000;
  }
  const hot = (s: number) =>
    clim.tC.reduce((acc, tm, m) => acc + (tm + 4 > s ? (DAYS[m] as number) : 0), 0) / 365;
  for (const z of t.zones.filter((zz) => zz.conditioned).slice(0, 8)) {
    const { loads } = loadsFor(z.spaceTypeIds[0]);
    const occupied = Math.round(loads.hours * loads.days * 52);
    const fan = occupied * (1 - hot(28)) * 0.85;
    comfort.push({
      roomId: z.roomIds[0] as string,
      fanHours: [Math.round(fan * 0.9), Math.round(Math.min(occupied, fan * 1.1))],
      acHours: [24, 26].map((s) => ({
        setpointC: s,
        hours: [Math.round(occupied * hot(s) * 0.9), Math.round(occupied * hot(s))] as [number, number],
      })),
      occupiedHours: occupied,
    });
  }
  const untypedShare = totalM2 > 0 ? untypedM2 / totalM2 : 0;
  // Time of day: daytime loads mostly 10 to 18, a quarter in the morning and evening peaks.
  const dayShare = dayWh + allDayWh > 0 ? dayWh / (dayWh + allDayWh) : 0.6;
  return {
    wh,
    conditionedM2: condM2,
    peakKw,
    persons,
    spread: 0.16 + 0.3 * untypedShare,
    untypedShare,
    heatingFuel: heatingClimate ? 'gas' : 'none',
    waterL,
    todShare: {
      peak: 0.25 * dayShare + (8 / 24) * (1 - dayShare),
      day: 0.65 * dayShare + (8 / 24) * (1 - dayShare),
    },
    comfort,
  };
}
