/**
 * FIXTURE quantities from twin fields, for the stage before the engine result lands.
 * Owner: WP-07. Steady state at one named condition: element loss U A delta T, junction loss
 * psi L delta T, interior surface temperature theta_in - U R_si delta T (SV 3.3). Ventilation
 * and zone temperatures are rough SAP-style placeholders, tagged `twin-fixture`; the engine's
 * evidence (`fromGraph`) replaces every number here.
 */
import type { Element, HomeTwin } from '@ibasho/core';
import { numCentral } from '@ibasho/core';
import type { ElementFlow, JunctionFlow, LeakPath, SceneCondition, SceneQuantities, ZoneTemp } from './types.ts';

export const JANUARY_NIGHT: SceneCondition = {
  thetaInC: 20,
  thetaOutC: 4,
  label: 'a typical January night, 4 °C outside',
};

/** Internal surface resistance by heat flow direction (BS EN ISO 6946), m2K/W. */
export function rsi(kind: Element['kind']): number {
  if (kind === 'roof' || kind === 'rooflight') return 0.1;
  if (kind === 'floor') return 0.17;
  return 0.13;
}

export function surfaceTemp(u: number, kind: Element['kind'], c: SceneCondition): number {
  return c.thetaInC - u * rsi(kind) * (c.thetaInC - c.thetaOutC);
}

export function fromTwin(twin: HomeTwin, condition: SceneCondition = JANUARY_NIGHT): SceneQuantities {
  const dT = condition.thetaInC - condition.thetaOutC;
  const elements: ElementFlow[] = twin.elements.map((e) => {
    const u = numCentral(e.u);
    const areaM2 = numCentral(e.areaM2);
    const ua = u * areaM2;
    return {
      elementId: e.id,
      watts: ua * dT,
      ua,
      u,
      areaM2,
      surfaceC: surfaceTemp(u, e.kind, condition),
    };
  });
  const junctions: JunctionFlow[] = twin.junctions.map((j) => {
    const psi = numCentral(j.psi);
    const lengthM = numCentral(j.lengthM);
    return { junctionId: j.id, psi, lengthM, wPerM: psi * dT, watts: psi * lengthM * dT };
  });

  // Ventilation placeholder: SAP 10.2 section 2 style infiltration sum, sheltered.
  const storeys = numCentral(twin.form.storeys);
  const volume = numCentral(twin.form.footprintM2) * storeys * numCentral(twin.form.storeyHeightM);
  const chimneyM3h = numCentral(twin.ventilation.chimneysOpen) * 80 + numCentral(twin.ventilation.chimneysBlocked) * 20;
  const fanM3h = numCentral(twin.ventilation.extractFans) * 10;
  const floorType = twin.ventilation.floorType.state === 'unknown' ? undefined : twin.ventilation.floorType.value;
  const structural = 0.35 + (floorType === 'suspended-unsealed' ? 0.2 : floorType === 'suspended-sealed' ? 0.1 : 0);
  const draught = 0.25 - 0.2 * numCentral(twin.ventilation.draughtProofedFrac);
  const flueAch = volume > 0 ? (chimneyM3h + fanM3h) / volume : 0;
  const shelter = 1 - 0.075 * numCentral(twin.ventilation.shelteredSides);
  const ninf = (flueAch + structural + 0.05 + draught) * shelter;
  const hve = 0.33 * ninf * volume;
  const ventilationW = hve * dT;
  const leaks: LeakPath[] = [];
  const chimneyShare = ninf > 0 ? ((chimneyM3h / Math.max(volume, 1)) * shelter) / ninf : 0;
  if (chimneyShare > 0) leaks.push({ kind: 'chimney', watts: ventilationW * chimneyShare });
  const openings = twin.elements.filter((e) => e.kind === 'window' || e.kind === 'door');
  const perim = openings.map((o) => 2 * Math.sqrt(Math.max(numCentral(o.areaM2), 0.01)) * 2);
  const perimTotal = perim.reduce((s, p) => s + p, 0);
  // Frames take the draught share; the rest leaks through boards and fabric, not drawn as a path.
  const gapW = ventilationW * (1 - chimneyShare) * 0.45;
  openings.forEach((o, i) => {
    if (perimTotal > 0) leaks.push({ elementId: o.id, kind: 'gaps', watts: (gapW * perim[i]!) / perimTotal });
  });

  const set = numCentral(twin.occupancy.setpointC);
  const zones: ZoneTemp[] = [
    { zone: 'living', tempC: set - 1.2 },
    { zone: 'rest', tempC: set - 3.1 },
  ];
  return {
    source: 'twin-fixture',
    condition: { ...condition, thetaInC: condition.thetaInC },
    elements,
    junctions,
    zones,
    ventilationW,
    leaks,
  };
}
