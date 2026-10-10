/**
 * Helpers shared by the UK measure models. Owner: WP-01.
 *
 * Local adapter: the engine half restates each measure's id, group, weight and kind instead of
 * importing `../../ids.ts`, because dependency-cruiser rule `l1-imports-l0-only` does not yet allow
 * a pack engine half to import its own pack's `src/ids.ts` (INTERFACES request to WP-00 on the
 * blackboard). `test/gh1.test.ts` ("measure models follow the frozen ids") checks every model
 * against `ids.ts`, so the ids stay single-sourced in effect. Switch back to the import once the
 * rule allows it.
 */
import type { MeasureKind, MeasureModel, MeasureOption, NumField, Provenance } from '@ibasho/core';

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
