/**
 * A portfolio property as an Ibasho home twin, so the existing home physics (SAP 10.2 style
 * monthly heat balance, BP 3) and the UK measure models compute every energy figure. Owner: WP-25.
 *
 * The geometry is a simple box from floor area, storeys and built form (RdSAP 10 conventions):
 * the twin carries no drawn plan, only areas. Fabric U-values come from the recorded insulation
 * and glazing through RdSAP 10 style tables. Where a field is unknown the age band default is
 * used and the assessment says so. `hidden` lets the label simulator use the true values of a home
 * (actual U-values, set point, occupancy) that the recorded data does not show.
 */
import type {
  BuiltForm,
  ControlType,
  Element,
  GhProperty,
  GhRegion,
  GhWall,
  HomeTwin,
  NumField,
  RegionCode,
} from '@ibasho/core';

/** Values the label simulator knows and the model does not (see the portfolio README). */
export interface HiddenTruth {
  /** Multiplies every fabric U-value (workmanship, moisture, unrecorded changes). */
  uFactor: number;
  setpointC: number;
  heatingHours: number;
  people: number;
  /** Multiplies appliance and lighting electricity (household behaviour). */
  applianceFactor: number;
  /** True loft depth when the recorded one is wrong or missing. */
  loftMm?: number | 'no-loft';
  wall?: GhWall;
}

const known = (value: number, ref = 'portfolio'): NumField => ({
  state: 'known',
  value,
  source: { kind: 'document', doc: 'survey', ref },
});
const est = (value: number, lo: number, hi: number): NumField => ({
  state: 'estimated',
  value,
  range: [lo, hi],
  source: { kind: 'default', pluginId: 'green-home-defaults' },
});

/** Climate pack by region (the nearest of the three UK climates the climate pack carries). */
export function climateOfRegion(r: GhRegion): string {
  if (r === 'Scotland') return 'climate-edinburgh';
  if (r === 'North West' || r === 'Yorkshire') return 'climate-manchester';
  return 'climate-london';
}
const regionCode = (r: GhRegion): RegionCode => (r === 'Scotland' ? 'GB-SCT' : 'GB-ENG');

/** RdSAP 10 Table 16: loft U by insulation depth, W/m²K. */
const LOFT_U: readonly [number, number][] = [
  [0, 2.3],
  [12, 1.5],
  [25, 1.0],
  [50, 0.68],
  [75, 0.5],
  [100, 0.4],
  [150, 0.3],
  [200, 0.21],
  [250, 0.17],
  [270, 0.16],
  [300, 0.14],
];
export function loftU(mm: number): number {
  let u = 2.3;
  for (const [d, v] of LOFT_U) if (mm >= d) u = v;
  return u;
}

/** Wall U and construction id by type and age (RdSAP 10 Tables 6 to 8, simplified). */
export function wallOf(wall: GhWall, yearBuilt: number): { u: number; constructionId: string } {
  switch (wall) {
    case 'solid-uninsulated':
      return { u: yearBuilt < 1900 ? 2.1 : 1.7, constructionId: 'solid-brick-230' };
    case 'solid-insulated':
      return { u: 0.35, constructionId: 'solid-brick-230-ewi' };
    case 'cavity-unfilled':
      return { u: yearBuilt < 1976 ? 1.5 : 1.0, constructionId: 'cavity-unfilled' };
    case 'cavity-filled':
      // Built-in insulation after 1996 follows Part L of the day (0.45, 0.35 from 2003, 0.28 from 2010).
      return {
        u: yearBuilt < 1976 ? 0.55 : yearBuilt < 1996 ? 0.45 : yearBuilt < 2003 ? 0.45 : yearBuilt < 2010 ? 0.35 : 0.28,
        constructionId: 'cavity-filled',
      };
    case 'timber-frame':
      return { u: yearBuilt < 1983 ? 0.8 : 0.4, constructionId: 'timber-frame' };
  }
}

/** Age-band default wall when the record is missing (RdSAP 10 age bands, typical construction). */
export function defaultWall(yearBuilt: number): GhWall {
  if (yearBuilt < 1930) return 'solid-uninsulated';
  if (yearBuilt < 1996) return 'cavity-unfilled';
  return 'cavity-filled';
}

export const GLAZING_UG = {
  single: { u: 4.8, g: 0.85, id: 'window-single' },
  'double-old': { u: 2.8, g: 0.76, id: 'window-double-pre2002' },
  double: { u: 1.6, g: 0.72, id: 'window-double-a-rated' },
  triple: { u: 1.1, g: 0.63, id: 'window-triple' },
} as const;

const BUILT_FORM: Record<GhProperty['propertyType'], BuiltForm> = {
  detached: 'detached',
  'semi-detached': 'semi-detached',
  'end-terrace': 'end-terrace',
  'mid-terrace': 'mid-terrace',
  bungalow: 'detached',
  flat: 'flat',
};

/** Exposed wall sides (of four) by type: detached 4, semi and end 3, mid 2, flats 2. */
const EXPOSED_SIDES: Record<GhProperty['propertyType'], number> = {
  detached: 4,
  'semi-detached': 3,
  'end-terrace': 3,
  'mid-terrace': 2,
  bungalow: 4,
  flat: 2,
};

const CONTROLS: Record<NonNullable<GhProperty['smartControls']>, ControlType> = {
  none: 'none',
  programmer: 'programmer-only',
  'programmer-thermostat': 'programmer-thermostat',
  'smart-thermostat': 'zone-control',
};

/** Occupants by bedrooms (SAP 10.2 Table 1b gives similar figures by floor area). */
export function peopleOf(bedrooms: number): number {
  return [1.4, 1.6, 2.1, 2.6, 3.0, 3.3][Math.min(5, Math.max(0, bedrooms))] as number;
}

const rect = (w: number, h: number): Element['geometry'] => ({
  polygon: [
    [0, 0, 0],
    [w, 0, 0],
    [w, h, 0],
    [0, h, 0],
  ],
});

const r2 = (x: number) => Math.round(x * 100) / 100;

/** Houses and bungalows have a loft unless recorded otherwise; flats never do. */
export function hasLoft(p: GhProperty): boolean {
  return p.propertyType !== 'flat' && p.insulation.loftMm !== 'no-loft';
}

/** The property as a twin (recorded values, or the hidden truth for the label simulator). */
export function buildTwin(p: GhProperty, hidden?: HiddenTruth): HomeTwin {
  const storeys = Math.max(1, p.storeys);
  const height = 2.5;
  const footprint = p.floorAreaM2 / storeys;
  const ratio = p.propertyType === 'mid-terrace' || p.propertyType === 'end-terrace' ? 1.6 : 1.2;
  const width = Math.sqrt(footprint / ratio);
  const depth = footprint / width;
  const sides = EXPOSED_SIDES[p.propertyType];
  const uf = hidden?.uFactor ?? 1;
  const wallType = hidden?.wall ?? p.insulation.wall ?? defaultWall(p.yearBuilt);
  const w = wallOf(wallType, p.yearBuilt);
  const glazKind = p.glazing ?? (p.yearBuilt >= 2003 ? 'double' : 'double-old');
  // Windows in homes built after 2010 meet Part L 2010 (1.4 W/m²K).
  const glaz = glazKind === 'double' && p.yearBuilt >= 2010 ? { ...GLAZING_UG.double, u: 1.4 } : GLAZING_UG[glazKind];
  const windowArea = 0.17 * p.floorAreaM2;
  const doorArea = p.propertyType === 'flat' ? 1.9 : 3.8;
  // Exposed wall length: front and rear widths, plus depths for exposed sides.
  const lenFront = width;
  const lenSide = depth;
  const exposedLen = 2 * lenFront + Math.max(0, sides - 2) * lenSide;
  const gross = exposedLen * height * storeys;
  const frontGross = lenFront * height * storeys;
  const sideGross = lenSide * height * storeys;
  const els: Element[] = [];
  const front = 180;
  const wallEl = (id: string, area: number, az: number): Element => ({
    id,
    kind: 'wall',
    zone: 'both',
    orientationDeg: az,
    tiltDeg: 90,
    areaM2: known(r2(Math.max(1, area))),
    constructionId: w.constructionId,
    u: known(r2(w.u * uf)),
    geometry: rect(r2(area / (height * storeys)), height * storeys),
  });
  const winFront = windowArea * (sides > 2 ? 0.4 : 0.5);
  const winRear = windowArea * (sides > 2 ? 0.4 : 0.5);
  const winSide = sides > 2 ? (windowArea * 0.2) / (sides - 2) : 0;
  els.push(wallEl('wall-front', frontGross - winFront - doorArea / 2, front));
  els.push(wallEl('wall-rear', frontGross - winRear - doorArea / 2, (front + 180) % 360));
  for (let s = 0; s < sides - 2; s++) els.push(wallEl(`wall-side-${s + 1}`, sideGross - winSide, s === 0 ? 90 : 270));
  const party = 4 - sides;
  for (let s = 0; s < party; s++)
    els.push({
      id: `party-${s + 1}`,
      kind: 'party-wall',
      zone: 'both',
      areaM2: known(r2(sideGross)),
      constructionId: 'party-solid',
      u: known(0),
      geometry: rect(r2(lenSide), height * storeys),
    });
  const win = (id: string, area: number, parentId: string): Element => ({
    id,
    kind: 'window',
    zone: 'both',
    parentId,
    areaM2: known(r2(area)),
    constructionId: glaz.id,
    u: known(r2(glaz.u * (uf > 1 ? 1 + (uf - 1) / 2 : 1))),
    g: known(glaz.g),
    frameFactor: known(0.7),
    geometry: rect(r2(Math.sqrt(area)), r2(Math.sqrt(area))),
  });
  els.push(win('win-front', winFront, 'wall-front'));
  els.push(win('win-rear', winRear, 'wall-rear'));
  for (let s = 0; s < sides - 2; s++) els.push(win(`win-side-${s + 1}`, winSide, `wall-side-${s + 1}`));
  els.push({
    id: 'door-front',
    kind: 'door',
    zone: 'both',
    parentId: 'wall-front',
    areaM2: known(doorArea),
    constructionId: 'door-solid',
    u: known(3),
    geometry: rect(1, doorArea),
  });
  const loftMm = hidden?.loftMm ?? p.insulation.loftMm;
  const roofed = p.propertyType !== 'flat' || p.flatLevel === 'top';
  if (roofed) {
    const isLoft = loftMm !== 'no-loft' && p.propertyType !== 'flat';
    const mm = typeof loftMm === 'number' ? loftMm : 100;
    els.push({
      id: 'roof',
      kind: 'roof',
      zone: 'both',
      tiltDeg: 0,
      areaM2: known(r2(footprint)),
      constructionId: isLoft ? `loft-joists-${mm}mm` : 'flat-roof',
      u: known(r2((isLoft ? loftU(mm) : p.yearBuilt < 1980 ? 1.5 : 0.35) * uf)),
      geometry: rect(r2(width), r2(depth)),
    });
  }
  const grounded = p.propertyType !== 'flat' || p.flatLevel === 'ground';
  if (grounded) {
    const ins = p.insulation.floorInsulated ?? p.yearBuilt >= 2000;
    els.push({
      id: 'floor',
      kind: 'floor',
      zone: 'both',
      tiltDeg: 0,
      areaM2: known(r2(footprint)),
      constructionId: p.yearBuilt < 1930 ? 'suspended-timber' : 'solid-concrete',
      u: known(r2((ins ? (p.yearBuilt >= 2010 ? 0.18 : 0.25) : 0.7) * uf)),
      geometry: rect(r2(width), r2(depth)),
    });
  }
  void gross;
  const heating = p.heating;
  const space =
    heating === 'gas-boiler-old'
      ? { systemId: 'gas-non-condensing', fuel: 'gas' as const }
      : heating === 'gas-boiler-condensing'
        ? { systemId: 'gas-combi-condensing', fuel: 'gas' as const }
        : heating === 'heat-pump'
          ? { systemId: 'ashp-air-water', fuel: 'electricity' as const }
          : { systemId: 'direct-electric', fuel: 'electricity' as const };
  const dhw =
    heating === 'gas-boiler-condensing'
      ? { ...space, class: 'combi' as const }
      : heating === 'gas-boiler-old'
        ? { ...space, class: 'cylinder' as const }
        : heating === 'heat-pump'
          ? { ...space, class: 'cylinder' as const }
          : { systemId: 'electric-immersion', fuel: 'electricity' as const, class: 'cylinder' as const };
  const gasHome = heating === 'gas-boiler-old' || heating === 'gas-boiler-condensing';
  const ageYears = p.heatingAgeYears ?? 12;
  // Boilers lose about 0.5 percentage points of seasonal efficiency a year past ten (SPEC 14 decay).
  const boilerEff = heating === 'gas-boiler-old' ? 0.7 : 0.84;
  const decay = Math.max(0, ageYears - 10) * 0.005;
  const twin: HomeTwin = {
    schema: 'ibasho.twin/2',
    id: p.propertyId,
    version: 1,
    region: regionCode(p.region),
    climatePackId: climateOfRegion(p.region),
    location: { lat: p.region === 'Scotland' ? 55.95 : p.region === 'London' ? 51.5 : 53.5, lon: -1.5 },
    archetypeId: `uk-${p.propertyType}`,
    form: {
      builtForm: BUILT_FORM[p.propertyType],
      storeys: known(storeys),
      storeyHeightM: known(height),
      footprintM2: known(r2(footprint)),
      perimeterM: known(r2(2 * (width + depth))),
      frontAzimuthDeg: known(front),
      roof: { state: 'known', value: p.propertyType === 'flat' ? 'flat' : 'pitched', source: { kind: 'stated' } },
      pitchDeg: known(35),
    },
    zones: { livingAreaFrac: est(0.3, 0.2, 0.4) },
    elements: els,
    junctions: [],
    ventilation: {
      chimneysOpen: known(p.yearBuilt < 1930 ? 1 : 0),
      chimneysBlocked: known(0),
      extractFans: known(p.yearBuilt >= 1990 ? 2 : 1),
      draughtProofedFrac: known(p.glazing === 'single' ? 0.2 : 0.9),
      floorType: {
        state: 'known',
        value: p.yearBuilt < 1930 ? 'suspended-unsealed' : 'solid',
        source: { kind: 'stated' },
      },
      shelteredSides: known(4 - sides),
      system: { state: 'known', value: 'natural', source: { kind: 'stated' } },
    },
    systems: {
      space: { ...space, ...(heating !== 'heat-pump' && gasHome ? { efficiency: known(r2(boilerEff - decay)) } : {}) },
      dhw: { ...dhw, ...(gasHome ? { efficiency: known(r2(boilerEff - decay - 0.04)) } : {}) },
      hob: { state: 'known', value: gasHome ? 'gas' : 'electric', source: { kind: 'stated' } },
      emitters: { kOversize: est(1.2, 1, 1.5) },
      controls: { state: 'known', value: CONTROLS[p.smartControls ?? 'programmer'], source: { kind: 'stated' } },
      ...(p.solarKwp > 0
        ? {
            pv: [
              {
                id: 'pv-existing',
                kWp: known(p.solarKwp),
                azimuthDeg: 180,
                tiltDeg: p.propertyType === 'flat' ? 10 : 35,
                overshading: 'average' as const,
              },
            ],
          }
        : {}),
    },
    occupancy: {
      people: known(hidden?.people ?? peopleOf(p.bedrooms)),
      setpointC: known(hidden?.setpointC ?? 20),
      heatingHours: known(hidden?.heatingHours ?? 9),
    },
    site: { overshading: { state: 'known', value: 'average', source: { kind: 'stated' } } },
    legal: {
      tenure: { state: 'known', value: p.constraints.tenure, source: { kind: 'stated' } },
      designations: {
        conservationArea: p.constraints.conservationArea,
        article23Land: false,
        listedGrade: { state: 'known', value: p.constraints.listed ? 'II' : 'none', source: { kind: 'stated' } },
        article4RemovedClasses: [],
      },
      supply: { phases: known(1), looped: false },
    },
    checks: [],
    done: [],
  };
  return twin;
}
