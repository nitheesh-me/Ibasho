/**
 * Twin patches: apply, compose and split (heavy or light). Owner: WP-01.
 *
 * `TwinPatch.set` paths are JSON Pointers (RFC 6901) into the twin. Application order is fixed:
 * every `set` in order (paths address the input twin), then `removeElementIds` (junctions that name
 * a removed element go too), then `addElements` and `addJunctions`. Because `set` runs before any
 * removal or addition, patches from several measures computed against the same base twin compose
 * by concatenation without index drift.
 *
 * Factorisation (ARCH 6, SPEC R9): a `set` is light when it only changes what the systems,
 * renewables and delivered stages read; everything else is heavy and keys a full simulation.
 */
import type { HomeTwin, MeasureModel, PackageSpec, TwinPatch } from '@ibasho/core';
import { compareStrings } from '@ibasho/core';

export class PatchError extends Error {
  override name = 'PatchError';
}

function cloneJson<T>(v: T): T {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => cloneJson(x)) as T;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = cloneJson(x);
  return out as T;
}

const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);

export function parsePointer(path: string): string[] {
  if (!path.startsWith('/')) throw new PatchError(`not a JSON pointer: ${JSON.stringify(path)}`);
  return path
    .slice(1)
    .split('/')
    .map((t) => {
      const tok = t.replace(/~1/g, '/').replace(/~0/g, '~');
      if (FORBIDDEN.has(tok)) throw new PatchError(`forbidden pointer token ${tok}`);
      return tok;
    });
}

function setAt(root: unknown, path: string, value: unknown): void {
  const toks = parsePointer(path);
  let cur: unknown = root;
  for (let i = 0; i < toks.length - 1; i++) {
    const t = toks[i]!;
    const next: unknown = Array.isArray(cur) ? cur[indexOf(cur, t, path)] : (cur as Record<string, unknown>)?.[t];
    if (next === null || typeof next !== 'object') throw new PatchError(`path ${path} does not exist at ${t}`);
    cur = next;
  }
  const last = toks[toks.length - 1]!;
  if (Array.isArray(cur)) cur[indexOf(cur, last, path)] = cloneJson(value);
  else if (cur !== null && typeof cur === 'object') (cur as Record<string, unknown>)[last] = cloneJson(value);
  else throw new PatchError(`path ${path} has no parent object`);
}

function indexOf(arr: unknown[], tok: string, path: string): number {
  if (!/^(0|[1-9]\d*)$/.test(tok)) throw new PatchError(`bad array index ${tok} in ${path}`);
  const i = Number(tok);
  if (i >= arr.length) throw new PatchError(`index ${i} out of range in ${path}`);
  return i;
}

/** Apply a patch to a copy of the twin. The input twin is never mutated. */
export function applyPatch(twin: HomeTwin, patch: TwinPatch): HomeTwin {
  const out = cloneJson(twin);
  for (const s of patch.set) setAt(out, s.path, s.value);
  if (patch.removeElementIds?.length) {
    const gone = new Set(patch.removeElementIds);
    out.elements = out.elements.filter((e) => !gone.has(e.id));
    out.junctions = out.junctions.filter((j) => !j.elementIds.some((id) => gone.has(id)));
  }
  if (patch.addElements?.length) out.elements.push(...cloneJson(patch.addElements));
  if (patch.addJunctions?.length) out.junctions.push(...cloneJson(patch.addJunctions));
  return out;
}

/** Concatenate patches (each computed against the same base twin). */
export function composePatches(patches: readonly TwinPatch[]): TwinPatch {
  const out: TwinPatch = { set: [] };
  const add: NonNullable<TwinPatch['addElements']> = [];
  const addJ: NonNullable<TwinPatch['addJunctions']> = [];
  const rm: string[] = [];
  for (const p of patches) {
    out.set.push(...p.set);
    if (p.addElements) add.push(...p.addElements);
    if (p.addJunctions) addJ.push(...p.addJunctions);
    if (p.removeElementIds) rm.push(...p.removeElementIds);
  }
  if (add.length) out.addElements = add;
  if (addJ.length) out.addJunctions = addJ;
  if (rm.length) out.removeElementIds = rm;
  return out;
}

/**
 * Paths read only by the light stages (systems, renewables, delivered). Controls, the DHW class
 * and cooling systems are read by heavy stages and therefore stay heavy (ARCH 6).
 */
const LIGHT_PREFIXES = [
  '/systems/space',
  '/systems/dhw/systemId',
  '/systems/dhw/fuel',
  '/systems/dhw/efficiency',
  '/systems/dhw/sizeKW',
  '/systems/dhw/installedYear',
  '/systems/boilerAgeYears',
  '/systems/pv',
  '/systems/battery',
  '/systems/hob',
  '/systems/emitters',
];

export function isLightPath(path: string): boolean {
  return LIGHT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Split a patch into its heavy part (keys a full simulation) and its light part. */
export function splitPatch(patch: TwinPatch): { heavy: TwinPatch; light: TwinPatch } {
  const heavy: TwinPatch = { set: patch.set.filter((s) => !isLightPath(s.path)) };
  if (patch.addElements) heavy.addElements = patch.addElements;
  if (patch.addJunctions) heavy.addJunctions = patch.addJunctions;
  if (patch.removeElementIds) heavy.removeElementIds = patch.removeElementIds;
  return { heavy, light: { set: patch.set.filter((s) => isLightPath(s.path)) } };
}

/**
 * The patch for a package: every chosen option's `MeasureModel.apply` against the base twin, in
 * group order (sorted), main options before sub-options. `none` means no change.
 */
export function packagePatch(twin: HomeTwin, pkg: PackageSpec, measures: readonly MeasureModel[]): TwinPatch {
  const byOption = new Map<string, MeasureModel>();
  for (const m of measures) for (const o of m.options) byOption.set(o.id, m);
  const choices = [
    ...Object.entries(pkg.options).sort(([a], [b]) => compareStrings(a, b)),
    ...Object.entries(pkg.subOptions ?? {}).sort(([a], [b]) => compareStrings(a, b)),
  ];
  const patches: TwinPatch[] = [];
  for (const [group, optionId] of choices) {
    if (optionId === 'none') continue;
    const model = byOption.get(optionId);
    if (!model) throw new PatchError(`package ${pkg.id}: no measure model for option ${optionId} (group ${group})`);
    patches.push(model.apply(twin, optionId));
  }
  return composePatches(patches);
}
