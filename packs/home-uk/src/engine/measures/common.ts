/**
 * Helpers shared by the UK measure models. Owner: WP-01.
 *
 * Each model restates its id, group, weight and kind through `identity`; `test/measures.test.ts`
 * checks every model against `../../ids.ts`, so the ids stay single-sourced in effect.
 */
import {
  type Element,
  type HomeTwin,
  type JunctionKind,
  type MeasureKind,
  type MeasureModel,
  type MeasureOption,
  type NumField,
  numCentral,
  type Provenance,
  type TwinPatch,
} from '@ibasho/core';

export const BP_6_1 = {
  id: 'bp-6-1',
  title: 'Building Physics Brief 6.1, UK retrofit measure catalogue',
  retrieved: '2026-10-10',
} as const;

export function provenance(extra: Provenance['sources'], grade: Provenance['grade']): Provenance {
  return { sources: [BP_6_1, ...extra], lastChecked: '2026-10-11', grade };
}

/** A value a measure sets, tagged with the measure as its default source. */
export function measureValue(value: number, measureId: string): NumField {
  return { state: 'known', value, source: { kind: 'default', pluginId: measureId } };
}

/** The option of a measure, or a clear error. */
export function optionOf(model: Pick<MeasureModel, 'id' | 'options'>, optionId: string): MeasureOption {
  const o = model.options.find((x) => x.id === optionId);
  if (!o) throw new Error(`measure ${model.id} has no option ${optionId}`);
  return o;
}

/** Numeric parameter of an option. */
export function param(o: MeasureOption, name: string): number {
  const p = o.params[name];
  if (!p || typeof p.value !== 'number') throw new Error(`option ${o.id} has no numeric param ${name}`);
  return p.value;
}

/** Id, group, weight and kind of a measure (must equal `ids.ts`; checked by test). */
export function identity(id: string, group: string, weight: 'heavy' | 'light', measureKind: MeasureKind) {
  return { id, group, weight, measureKind } as const;
}

/** SAP 10.2 Table K1 (primary) and SAP 2012 Table K1 accredited-detail values (secondary). */
export const SAP_K1 = {
  id: 'sap-10-2-k1',
  title: 'SAP 10.2 Table K1 default psi values; accredited values from SAP 2012 Table K1',
  url: 'https://files.bregroup.com/SAP/SAP%2010.2%20-%2011-04-2023.pdf',
  clause: 'Appendix K, Table K1',
  retrieved: '2026-10-11',
} as const;

/** Element indices of a kind, optionally filtered. */
export function indicesOf(twin: HomeTwin, kind: Element['kind'], keep: (e: Element) => boolean = () => true): number[] {
  const out: number[] = [];
  twin.elements.forEach((e, i) => {
    if (e.kind === kind && keep(e)) out.push(i);
  });
  return out;
}

/** U after adding a layer: 1 / (1/U0 + d/lambda) (BP 3.2). */
export function addLayer(u0: number, thicknessM: number, lambda: number): number {
  return 1 / (1 / u0 + thicknessM / lambda);
}

/**
 * Junction psi changes for the junctions that touch the given elements (SPEC R19). `psiAfter` maps
 * a junction kind to its new psi; `direction` keeps only changes that lower (`lower`) or raise
 * (`raise`) psi. Returns the patch entries and the effect list (`junctionEffects`).
 */
export function junctionChanges(
  twin: HomeTwin,
  elementIds: ReadonlySet<string>,
  psiAfter: Partial<Record<JunctionKind, number>>,
  direction: 'lower' | 'raise',
  pluginId: string,
): { set: TwinPatch['set']; effects: { junctionId: string; psiAfter: number }[] } {
  const set: TwinPatch['set'] = [];
  const effects: { junctionId: string; psiAfter: number }[] = [];
  twin.junctions.forEach((j, i) => {
    const after = psiAfter[j.kind];
    if (after === undefined || !j.elementIds.some((id) => elementIds.has(id))) return;
    const before = numCentral(j.psi);
    if (direction === 'lower' ? after >= before : after <= before) return;
    set.push({ path: `/junctions/${i}/psi`, value: measureValue(after, pluginId) });
    effects.push({ junctionId: j.id, psiAfter: after });
  });
  return { set, effects };
}
