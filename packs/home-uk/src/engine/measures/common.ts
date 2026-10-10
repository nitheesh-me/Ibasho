/**
 * Helpers shared by the UK measure models. Owner: WP-01.
 */
import type { MeasureModel, MeasureOption, NumField, Provenance } from '@ibasho/core';
import { GROUPS, MEASURES, type MeasureId } from '../../ids.ts';

export const BP_6_1 = {
  id: 'bp-6-1',
  title: 'Building Physics Brief 6.1, UK retrofit measure catalogue',
  retrieved: '2026-10-10',
} as const;

export function provenance(extra: Provenance['sources'], grade: Provenance['grade']): Provenance {
  return { sources: [BP_6_1, ...extra], lastChecked: '2026-10-11', grade };
}

/** A value a measure sets, tagged with the measure as its default source. */
export function measureValue(value: number, measureId: MeasureId): NumField {
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

/** Group, weight and kind of a measure, read from the frozen ids. */
export function identity(id: MeasureId) {
  const m = MEASURES[id];
  const group = m.group as keyof typeof GROUPS;
  return { id, group: m.group, weight: GROUPS[group].weight, measureKind: m.kind } as const;
}
