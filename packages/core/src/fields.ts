/**
 * Input fields with known, estimated and unknown states (ARCH 5.1). Owner: WP-00.
 */
import type { Ival } from './ival.ts';

export type InputSource =
  | { kind: 'stated' }
  | { kind: 'measured'; how: 'bill' | 'meter' | 'survey' }
  | { kind: 'document'; doc: 'epc' | 'lease' | 'survey'; ref?: string }
  | { kind: 'default'; pluginId: string }
  | { kind: 'derived'; from: string[] }
  | { kind: 'calibrated'; posterior: Ival<number> };

export type NumField =
  | { state: 'known'; value: number; source: InputSource }
  | { state: 'estimated'; value: number; range: [number, number]; source: InputSource }
  | { state: 'unknown'; range: [number, number]; material: boolean; source: InputSource };

export type Choice<E extends string> =
  | { state: 'known'; value: E; source: InputSource }
  | { state: 'estimated'; value: E; options: E[]; source: InputSource }
  | { state: 'unknown'; options: E[]; material: boolean; source: InputSource };

/** Three-valued (Kleene) truth. */
export type Tri = true | false | 'unknown';

/** Central value of a numeric field: the value, or the range midpoint when unknown. */
export function numCentral(f: NumField): number {
  return f.state === 'unknown' ? f.range[0] + (f.range[1] - f.range[0]) / 2 : f.value;
}

/** Range of a numeric field: a point when known. */
export function numRange(f: NumField): Ival<number> {
  if (f.state === 'known') return { lo: f.value, hi: f.value };
  return { lo: f.range[0], hi: f.range[1] };
}

/** Value of a choice when known or estimated, else undefined. */
export function choiceValue<E extends string>(c: Choice<E>): E | undefined {
  return c.state === 'unknown' ? undefined : c.value;
}

/** True when the field is unknown and marked material (drives the score band, AC-H2). */
export function isMaterialUnknown(f: NumField | Choice<string>): boolean {
  return f.state === 'unknown' && f.material;
}

export const known = (value: number, source: InputSource = { kind: 'stated' }): NumField => ({
  state: 'known',
  value,
  source,
});

/** Kleene conjunction. */
export function triAnd(...xs: Tri[]): Tri {
  let unknown = false;
  for (const x of xs) {
    if (x === false) return false;
    if (x === 'unknown') unknown = true;
  }
  return unknown ? 'unknown' : true;
}
/** Kleene disjunction. */
export function triOr(...xs: Tri[]): Tri {
  let unknown = false;
  for (const x of xs) {
    if (x === true) return true;
    if (x === 'unknown') unknown = true;
  }
  return unknown ? 'unknown' : false;
}
/** Kleene negation. */
export function triNot(x: Tri): Tri {
  return x === 'unknown' ? 'unknown' : !x;
}
