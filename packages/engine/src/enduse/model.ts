/**
 * The real energy model (WP-18, V-4): every zone of the compiled building is an hourly 5R1C
 * network (ISO 13790 Annex C, the ISO 52016-1 simplified route) driven by the place's weather,
 * the space type's schedules, occupancy, lighting and plug loads (with daylight dimming), outdoor
 * air per ASHRAE 62.1 (NBC Part 8 uses the same rates) plus 0.3 ACH infiltration, window and
 * opaque solar gains with the site stage's shading factors, and ideal heating and cooling to the
 * space type's set points. The plant turns loads into end uses: DX split or VRF or a chilled water
 * plant with its pumps, AHU fans and tower; precision cooling for data centres; ceiling fans first
 * in homes (IMAC); gas boilers or heat pumps in the UK; hot water from mains temperature; PV.
 */
import type {
  CompiledBuilding,
  EndUse,
  EnergyParams,
  FacadeBin,
  SiteResult,
  TypeLibrary,
  ZoneTwin,
} from '@ibasho/core';
import { END_USES, facadeBin, isZoneTwin, Q } from '@ibasho/core';
import {
  AHU,
  CEILING_FAN,
  copAt,
  dhwWh,
  HEATERS,
  humidityRatio,
  imacBand,
  PRECISION,
  plantFor,
  pvWh,
} from '../systems/index.ts';
import { expandSchedule, resolveSpace } from '../zones/library.ts';
import { simulateRc } from '../zones/rc.ts';
import {
  HOURS,
  type HourlyWeather,
  MONTH_START,
  monthOfHour,
  type SunPath,
  surfaceIrradiance,
} from '../zones/weather.ts';

const DWELLING = new Set(['living', 'bedroom', 'kitchen']);
const SENSIBLE_PER_PERSON = 75;
const LATENT_PER_PERSON = 55;
/** Indoor humidity ratio held by cooling coils, g/kg (24 degC, 50% RH). */
const W_IN = 9.3;

export interface EnergyRun {
  /** Wh per month per end use (PV negative). */
  wh: Record<EndUse, number[]>;
  /** Electrical demand per hour, W (all electric end uses, PV not netted). */
  elecW: Float64Array;
  peakKwByMonth: number[];
  conditionedM2: number;
  persons: number;
  untypedShare: number;
  heatingFuel: 'gas' | 'electricity' | 'none';
  dhwFuel: 'gas' | 'electricity';
  waterL: number[];
  /** Occupied hours a conditioned zone sat outside its set point by more than 1 K (unmet). */
  unmetHours: number;
  comfort: {
    roomId: string;
    model: 'IMAC-MM' | 'EN16798';
    fanHours: [number, number];
    acHours: { setpointC: number; hours: [number, number] }[];
    occupiedHours: number;
  }[];
  /** Share of electricity in the 06 to 10 and 18 to 22 peaks and in the 10 to 18 window. */
  todShare: { peak: number; day: number };
}

const zero12 = () => Array.from({ length: 12 }, () => 0);

function addMonthly(target: number[], hourly: Float64Array): void {
  for (let m = 0; m < 12; m++) {
    const a = MONTH_START[m] as number;
    const b = m === 11 ? HOURS : (MONTH_START[m + 1] as number);
    let s = 0;
    for (let h = a; h < b; h++) s += hourly[h] as number;
    target[m] = (target[m] as number) + s;
  }
}

/** Per surface solar series, cached by 5 degree azimuth bin and tilt. */
function irradianceCache(w: HourlyWeather, sun: SunPath) {
  const c = new Map<string, Float64Array>();
  return (azMdeg: number, tiltDeg: number): Float64Array => {
    const bin = Math.round(azMdeg / 5000) * 5;
    const key = `${bin}:${tiltDeg}`;
    let v = c.get(key);
    if (!v) {
      v = surfaceIrradiance(w, sun, bin, tiltDeg);
      c.set(key, v);
    }
    return v;
  };
}

export function runEnergyModel(
  compiled: CompiledBuilding,
  lib: TypeLibrary,
  w: HourlyWeather,
  sun: SunPath,
  params: EnergyParams = {},
  radiation?: SiteResult,
): EnergyRun {
  const wh = Object.fromEntries(END_USES.map((u) => [u, zero12()])) as Record<EndUse, number[]>;
  const elecW = new Float64Array(HOURS);
  const heatingClimate = w.lat > 35;
  const out: EnergyRun = {
    wh,
    elecW,
    peakKwByMonth: zero12(),
    conditionedM2: 0,
    persons: 0,
    untypedShare: 0,
    heatingFuel: heatingClimate ? (params.heatPumpScop ? 'electricity' : 'gas') : 'none',
    dhwFuel: heatingClimate && !params.heatPumpScop ? 'gas' : 'electricity',
    waterL: zero12(),
    unmetHours: 0,
    comfort: [],
    todShare: { peak: 0.25, day: 0.6 },
  };
  if (!isZoneTwin(compiled.twin)) return out;
  const t: ZoneTwin = compiled.twin;
  const plant = plantFor(t.systems.map((s) => s.systemId));
  const irr = irradianceCache(w, sun);
  const pfOf = new Map(
    compiled.quantities.openings.map((o) => [o.id, o.pf ? Number(o.pf.n) / Number(o.pf.d) : 0]),
  );
  const shadeOf = new Map<string, number[]>();
  for (const x of radiation?.windows ?? []) {
    const base = x.id.replace(/@\d+$/, '');
    if (!shadeOf.has(base))
      shadeOf.set(
        base,
        x.shadingFactor.map((q) => Q.toNumber(q)),
      );
  }
  const surfacesByZone = new Map<string, ZoneTwin['surfaces']>();
  for (const s of t.surfaces) {
    const l = surfacesByZone.get(s.zoneId) ?? [];
    l.push(s);
    surfacesByZone.set(s.zoneId, l);
  }
  const uWall = params.uWall ?? (heatingClimate ? 1.6 : 1.9);
  const uRoof = params.uRoof ?? (heatingClimate ? 0.6 : 1.8);
  const uWin = params.uWin ?? (heatingClimate ? 2.8 : 5.6);
  const g = params.shgc ?? 0.62;
  const roofAbs = params.roofAbsorptance ?? 0.75;
  const lpdScale = params.lpdScale ?? 1;
  const wOut = new Float64Array(HOURS);
  for (let h = 0; h < HOURS; h++) wOut[h] = humidityRatio(w.tC[h] as number, w.rh[h] as number);
  const cooling = new Float64Array(HOURS);
  const fans = new Float64Array(HOURS);
  const pumps = new Float64Array(HOURS);
  const lighting = new Float64Array(HOURS);
  const equipment = new Float64Array(HOURS);
  const heating = new Float64Array(HOURS);
  let totalM2 = 0;
  let untypedM2 = 0;

  for (const z of t.zones) {
    const af = Number(z.floorMm2) / 1e6;
    if (af <= 0) continue;
    const vol = Number(z.volumeMm3) / 1e9;
    const { space, typed } = resolveSpace(lib, z.spaceTypeIds[0]);
    totalM2 += af;
    if (!typed) untypedM2 += af;
    const conditioned = z.conditioned && space.conditioned;
    if (conditioned) out.conditionedM2 += af;
    const persons = (space.densityPer100m2.typical * af) / 100;
    out.persons += persons;
    const isHome = DWELLING.has(space.spaceTypeId);
    const occ = expandSchedule(lib, space.schedules.occupancy);
    const lightS = expandSchedule(lib, space.schedules.lighting);
    const equipS = expandSchedule(lib, space.schedules.equipment);
    const hvacS = expandSchedule(lib, space.schedules.hvac);
    const always = space.epdWm2.typical > 200;
    const precision = space.spaceTypeId === 'data-centre';
    // Envelope conductances and solar apertures.
    let htrW = 0;
    let htrOp = 0;
    let winArea = 0;
    const solar = new Float64Array(HOURS);
    for (const s of surfacesByZone.get(z.id) ?? []) {
      if (s.boundary !== 'outdoors') continue;
      const a = Number(s.areaMm2) / 1e6;
      if (a <= 0) continue;
      if (s.kind === 'window') {
        const bin: FacadeBin = facadeBin(s.azimuthMdeg);
        const area = a * (params.wwrScale?.[bin] ?? 1);
        winArea += area;
        htrW += area * uWin;
        const series = irr(s.azimuthMdeg, 90);
        const sh = shadeOf.get(s.id);
        const pf = (pfOf.get(s.id) ?? 0) + (params.pf?.[bin] ?? 0);
        const cut = 1 - Math.min(0.6, pf * 0.9);
        // Frame factor 0.8 and internal blinds or curtains 0.75 (typical occupied rooms).
        const k = area * g * 0.8 * 0.75 * cut;
        for (let h = 0; h < HOURS; h++)
          solar[h] = (solar[h] as number) + k * (series[h] as number) * (sh?.[monthOfHour(h)] ?? 1);
      } else if (s.kind === 'wall') {
        htrOp += a * uWall;
        const series = irr(s.azimuthMdeg, 90);
        const k = 0.6 * 0.04 * uWall * a;
        for (let h = 0; h < HOURS; h++) solar[h] = (solar[h] as number) + k * (series[h] as number);
      } else if (s.kind === 'roof') {
        htrOp += a * uRoof;
        const series = irr(0, 0);
        const k = roofAbs * 0.04 * uRoof * a;
        for (let h = 0; h < HOURS; h++) solar[h] = (solar[h] as number) + k * (series[h] as number);
      }
    }
    // Internal gains and ventilation, hour by hour.
    const phiInt = new Float64Array(HOURS);
    const hve = new Float64Array(HOURS);
    const heatSet = new Float64Array(HOURS).fill(Number.NaN);
    const coolSet = new Float64Array(HOURS).fill(Number.NaN);
    const lpd = space.lpdWm2.typical * lpdScale;
    const epd = space.epdWm2.typical;
    // Outdoor air (L/s): ASHRAE 62.1 Rp and Ra, or the space's minimum air changes (labs) if higher.
    const voz = Math.max(
      space.rpLsPerPerson.typical * persons + space.raLsPerM2.typical * af,
      ((space.minAirChangesPerHour?.typical ?? 0) * vol * 1000) / 3600,
    );
    // Infiltration: 0.3 ACH, 0.8 ACH for older homes in a heating climate (SAP 10.2 range), W/K at 1.2 J/L K.
    const ach = heatingClimate && isHome ? 0.8 : 0.3;
    const inf = ach * vol * (1000 / 3600) * 1.2;
    const wfr = af > 0 ? winArea / af : 0;
    const coolC = params.setpointC ?? space.coolSetC.typical;
    const heatC = space.heatSetC.typical;
    const zLight = new Float64Array(HOURS);
    const zEquip = new Float64Array(HOURS);
    for (let h = 0; h < HOURS; h++) {
      const o = occ[h] as number;
      let dim = 1;
      if (params.daylightControls && lpd > 0 && space.daylightLux) {
        // Work-plane daylight from GHI: 110 lm/W efficacy, a daylight factor of about 0.1 x glazing to floor ratio.
        const lux = (w.ghi[h] as number) * 110 * Math.min(0.08, 0.1 * wfr);
        dim = 1 - 0.8 * Math.min(1, lux / space.daylightLux.typical);
      }
      const lw = lpd * af * (lightS[h] as number) * dim;
      const ew = epd * af * (equipS[h] as number);
      zLight[h] = lw;
      zEquip[h] = ew;
      phiInt[h] = lw + ew + SENSIBLE_PER_PERSON * persons * o;
      const on = (hvacS[h] as number) > 0;
      hve[h] = inf + (on || o > 0 ? 1.2 * voz : 0);
      if (conditioned && on) {
        coolSet[h] = coolC;
        if (heatingClimate) heatSet[h] = heatC;
      }
    }
    // Homes: fans first, the AC only when the air would sit above the IMAC band with fans (R40).
    const rc = simulateRc(
      { af, htrW, htrOp, cmJ: 165_000 * af },
      { te: w.tC, hve, phiInt, phiSol: solar, heatSet, coolSet },
    );
    let rcFinal = rc;
    if (isHome && !heatingClimate) {
      const cs = new Float64Array(HOURS).fill(Number.NaN);
      for (let h = 0; h < HOURS; h++) {
        const band = imacBand(w.monthlyTC[monthOfHour(h)] as number);
        if (!Number.isNaN(coolSet[h] as number) && (rc.free[h] as number) > band.upperWithFan)
          cs[h] = coolSet[h] as number;
      }
      rcFinal = simulateRc(
        { af, htrW, htrOp, cmJ: 165_000 * af },
        { te: w.tC, hve, phiInt, phiSol: solar, heatSet, coolSet: cs },
      );
    }
    // Plant: electricity per hour for cooling, fans and pumps; heating; ceiling fans.
    let peakCool = 0;
    for (let h = 0; h < HOURS; h++) peakCool = Math.max(peakCool, rcFinal.cool[h] as number);
    const supplyLs = peakCool / (1.2 * AHU.supplyDeltaK);
    let fanHours = 0;
    const acHours: Record<number, number> = { 24: 0, 26: 0 };
    let occupied = 0;
    for (let h = 0; h < HOURS; h++) {
      const te = w.tC[h] as number;
      const qs = rcFinal.cool[h] as number;
      let ql = 0;
      if (qs > 0) {
        ql =
          LATENT_PER_PERSON * persons * (occ[h] as number) +
          1.2 * voz * 2.5 * Math.max(0, (wOut[h] as number) - W_IN);
      }
      const q = qs + ql;
      if (q > 0) {
        if (precision) {
          cooling[h] = (cooling[h] as number) + q / PRECISION.cop;
          fans[h] = (fans[h] as number) + q * PRECISION.fanShare;
        } else {
          cooling[h] = (cooling[h] as number) + q / copAt(plant, te, coolC);
          fans[h] = (fans[h] as number) + q * plant.fanShare;
          pumps[h] = (pumps[h] as number) + q * plant.pumpShare;
          if (plant.kind === 'chilled-water' && !isHome)
            fans[h] = (fans[h] as number) + AHU.sfpWPerLs * supplyLs * AHU.partLoad;
        }
      }
      const qh = rcFinal.heat[h] as number;
      if (qh > 0)
        heating[h] =
          (heating[h] as number) + (params.heatPumpScop ? qh / params.heatPumpScop : qh / HEATERS.gasBoiler);
      // Ceiling fans in homes and naturally ventilated hours of habitable rooms.
      if (
        isHome &&
        !heatingClimate &&
        (occ[h] as number) > 0.2 &&
        (rcFinal.air[h] as number) > CEILING_FAN.onAboveC &&
        !(qs > 0)
      ) {
        // Half: family members share rooms, so not every room's fans run at once.
        fans[h] =
          (fans[h] as number) + (af / CEILING_FAN.m2PerFan) * CEILING_FAN.watts * (occ[h] as number) * 0.5;
      }
      if ((occ[h] as number) > 0.2 && space.habitable) {
        occupied++;
        const band = imacBand(w.monthlyTC[monthOfHour(h)] as number);
        if ((rc.free[h] as number) <= band.upperWithFan) fanHours++;
        if ((rc.free[h] as number) > 24) acHours[24] = (acHours[24] as number) + 1;
        if ((rc.free[h] as number) > 26) acHours[26] = (acHours[26] as number) + 1;
        if (
          conditioned &&
          !Number.isNaN(coolSet[h] as number) &&
          (rcFinal.air[h] as number) > (coolSet[h] as number) + 1
        )
          out.unmetHours++;
      }
      lighting[h] = (lighting[h] as number) + (zLight[h] as number);
      equipment[h] = (equipment[h] as number) + (zEquip[h] as number);
    }
    if (conditioned && space.habitable && out.comfort.length < 12) {
      out.comfort.push({
        roomId: z.roomIds[0] as string,
        model: heatingClimate ? 'EN16798' : 'IMAC-MM',
        fanHours: [Math.round(fanHours * 0.95), Math.min(occupied, Math.round(fanHours * 1.05))],
        acHours: [24, 26].map((s) => ({
          setpointC: s,
          hours: [
            Math.round((acHours[s] as number) * 0.95),
            Math.min(occupied, Math.round((acHours[s] as number) * 1.05)),
          ] as [number, number],
        })),
        occupiedHours: occupied,
      });
    }
    // Hot water: daily litres from the space type, persons present.
    const dhw = space.dhwLPerPersonDay;
    if (dhw !== 'unknown') {
      for (let m = 0; m < 12; m++) {
        const a = MONTH_START[m] as number;
        const b = m === 11 ? HOURS : (MONTH_START[m + 1] as number);
        let presence = 0;
        for (let h = a; h < b; h++) presence += occ[h] as number;
        // Person-days: occupancy hours over a 12 hour stay (24 h for homes, hotels, wards).
        const personDays = (persons * presence) / (isHome || always ? 24 : 12);
        out.waterL[m] = (out.waterL[m] as number) + personDays * dhw.typical;
      }
    }
  }
  // Hot water energy from mains temperature (India: monthly air + 2, delivered at 45; UK: SAP style mains, 55).
  for (let m = 0; m < 12; m++) {
    const tm = w.monthlyTC[m] as number;
    const mains = heatingClimate ? 6 + 0.45 * tm : tm + 2;
    const delivery = heatingClimate ? 55 : 45;
    const eff =
      params.heatPumpScop && heatingClimate
        ? params.heatPumpScop
        : out.dhwFuel === 'gas'
          ? HEATERS.gasBoiler
          : HEATERS.electricGeyser;
    const solarShare = params.dhwSolarShare ?? 0;
    wh['hot-water'][m] = dhwWh(out.waterL[m] as number, mains, delivery, eff) * (1 - solarShare);
  }
  // PV on the roof: tilted to latitude, facing south.
  const pv = new Float64Array(HOURS);
  if (params.pvKwp) {
    const poa = irr(180_000, Math.round(Math.min(35, Math.max(10, w.lat))));
    for (let h = 0; h < HOURS; h++) pv[h] = -pvWh(params.pvKwp, poa[h] as number, w.tC[h] as number);
  }
  addMonthly(wh.cooling, cooling);
  addMonthly(wh.fans, fans);
  addMonthly(wh.pumps, pumps);
  addMonthly(wh.lighting, lighting);
  addMonthly(wh.equipment, equipment);
  addMonthly(wh.heating, heating);
  addMonthly(wh.pv, pv);
  // Lifts, controls and other building loads: 2% of lighting and plug loads in larger buildings.
  for (let m = 0; m < 12; m++)
    wh.other[m] =
      ((wh.lighting[m] as number) + (wh.equipment[m] as number)) * (t.zones.length > 8 ? 0.02 : 0.005);
  // Hourly electricity and peaks; time of day shares.
  let peakWh = 0;
  let dayWh = 0;
  let total = 0;
  for (let h = 0; h < HOURS; h++) {
    let e =
      (cooling[h] as number) +
      (fans[h] as number) +
      (pumps[h] as number) +
      (lighting[h] as number) +
      (equipment[h] as number);
    if (out.heatingFuel === 'electricity') e += heating[h] as number;
    elecW[h] = e;
    const m = monthOfHour(h);
    out.peakKwByMonth[m] = Math.max(out.peakKwByMonth[m] as number, e / 1000);
    const hod = h % 24;
    if ((hod >= 6 && hod < 10) || (hod >= 18 && hod < 22)) peakWh += e;
    else if (hod >= 10 && hod < 18) dayWh += e;
    total += e;
  }
  out.todShare = total > 0 ? { peak: peakWh / total, day: dayWh / total } : out.todShare;
  out.untypedShare = totalM2 > 0 ? untypedM2 / totalM2 : 0;
  return out;
}
