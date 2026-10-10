/**
 * Solar PV and battery (BP 3.11, 6.1, SAP 10.2 Appendix M). Owner: WP-01.
 * - `pv-2kwp`, `pv-3kwp`, `pv-4kwp`: one array on the roof slope nearer south (the front slope if
 *   the front faces within 90 degrees of south, else the rear), tilted at the roof pitch (35 degrees
 *   if unknown), with the site's overshading class. The renewables stage computes yield and self-use.
 * - `battery-5kwh`, `battery-10kwh`: usable capacity for the SAP M1 self-use coefficients
 *   (requires PV, `prereq`).
 * Facts (`m.pv.*`, `m.battery.*`): kWp, export power per phase (kWp as an inverter proxy, for the
 * G98 and G99 rules), roof azimuth, front elevation.
 */
import { choiceValue, type HomeTwin, type MeasureModel, numCentral, type PvArray, type TwinPatch } from '@ibasho/core';
import { identity, measureValue, optionOf, param, provenance } from './common.ts';

const PV_MAG = {
  id: 'pv-magazine-desnz-2025',
  title: 'pv magazine on DESNZ MCS solar cost data (2025)',
  url: 'https://www.pv-magazine.com/2025/06/12/uk-small-scale-solar-costs-tumble-as-competition-heats-up-for-installers/',
  retrieved: '2026-10-10',
} as const;
const SAP_M = {
  id: 'sap-10-2-appendix-m',
  title: 'SAP 10.2 Appendix M1, photovoltaics and battery self-use',
  url: 'https://files.bregroup.com/SAP/SAP%2010.2%20-%2011-04-2023.pdf',
  clause: 'Appendix M1',
  retrieved: '2026-10-11',
} as const;

export function pvRoof(twin: HomeTwin): { azimuthDeg: number; tiltDeg: number; front: boolean } {
  const front = numCentral(twin.form.frontAzimuthDeg);
  const off = (((front - 180) % 360) + 540) % 360 - 180;
  const useFront = Math.abs(off) <= 90;
  const az = useFront ? front : (front + 180) % 360;
  const pitch = twin.form.pitchDeg ? numCentral(twin.form.pitchDeg) : 35;
  const flat = choiceValue(twin.form.roof) === 'flat';
  return { azimuthDeg: az, tiltDeg: flat ? 10 : pitch, front: useFront };
}

export const pvMeasure: MeasureModel = {
  kind: 'measure',
  ...identity('pv', 'pv', 'light', 'pv'),
  version: '0.2.0',
  title: 'measure.pv.title',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([PV_MAG, SAP_M], 'secondary'),
  options: [2, 3, 4].map((k) => ({
    id: `pv-${k}kwp`,
    title: `measure.pv-${k}kwp.title`,
    params: { kWp: { value: k, unit: 'kW' } },
  })),
  touches: ['roof'],
  lifetimeYears: 25,
  apply(twin, optionId): TwinPatch {
    const kwp = param(optionOf(pvMeasure, optionId), 'kWp');
    const r = pvRoof(twin);
    const array: PvArray = {
      id: 'pv-main',
      kWp: measureValue(kwp, 'pv'),
      azimuthDeg: r.azimuthDeg,
      tiltDeg: r.tiltDeg,
      overshading: choiceValue(twin.site.overshading) ?? 'average',
    };
    return { set: [{ path: '/systems/pv', value: [array] }] };
  },
  facts(twin, optionId) {
    const kwp = param(optionOf(pvMeasure, optionId), 'kWp');
    const r = pvRoof(twin);
    return {
      'm.pv.kWp': kwp,
      'm.pv.exportKwPerPhase': kwp / Math.max(1, numCentral(twin.legal.supply.phases)),
      'm.pv.azimuthDeg': r.azimuthDeg,
      'm.pv.frontSlope': r.front,
    };
  },
};

export const batteryMeasure: MeasureModel = {
  kind: 'measure',
  ...identity('battery', 'battery', 'light', 'battery'),
  version: '0.2.0',
  title: 'measure.battery.title',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([SAP_M], 'secondary'),
  options: [5, 10].map((k) => ({
    id: `battery-${k}kwh`,
    title: `measure.battery-${k}kwh.title`,
    params: { usableKWh: { value: k, unit: 'kWh' } },
  })),
  touches: [],
  lifetimeYears: 12,
  prereq: ['pv'],
  apply(_twin, optionId): TwinPatch {
    const kwh = param(optionOf(batteryMeasure, optionId), 'usableKWh');
    return { set: [{ path: '/systems/battery', value: measureValue(kwh, 'battery') }] };
  },
  facts(_twin, optionId) {
    return { 'm.battery.usableKWh': param(optionOf(batteryMeasure, optionId), 'usableKWh') };
  },
};
