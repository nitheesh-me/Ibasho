/**
 * Home catalogue for the headless tools (ARCH 14 `ibasho_list_homes`). Owner: WP-12.
 *
 * Sources, in order:
 * - fixtures: `packages/fixtures/src/homes/*.twin.json` (read from disk; never imported);
 * - saved homes: `~/.config/ibasho/homes/*.ibasho` (a twin, or an export envelope with `twin`).
 *
 * Every twin is parsed with `parseTwin` from `@ibasho/core/schemas` (untrusted input).
 * Ids are `fixture:<name>` and `file:<name>`; a bare `gh1` resolves to `fixture:gh1`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { HomeTwin } from '@ibasho/core';
import { parseTwin } from '@ibasho/core/schemas';

export interface HomeEntry {
  id: string;
  kind: 'fixture' | 'file';
  twinId: string;
  label: string;
  path: string;
}

export interface HomeCatalog {
  list(): HomeEntry[];
  /** Parsed twin, or throws `UnknownHomeError`. */
  get(id: string): { entry: HomeEntry; twin: HomeTwin };
}

export class UnknownHomeError extends Error {
  constructor(id: string, known: string[]) {
    super(`unknown home "${id}". Known homes: ${known.join(', ') || 'none'}. Call ibasho_list_homes.`);
    this.name = 'UnknownHomeError';
  }
}

const MAX_BYTES = 8 * 1024 * 1024;

function readJson(path: string): unknown {
  if (statSync(path).size > MAX_BYTES) throw new Error(`${path} is larger than the import limit`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** A `.ibasho` file is either a bare twin or an envelope with a `twin` field (WP-08 export). */
export function twinFromFile(json: unknown): HomeTwin {
  const env = json as { twin?: unknown } | null;
  return parseTwin(env && typeof env === 'object' && 'twin' in env ? env.twin : json);
}

function scan(dir: string, suffix: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(suffix))
      .sort()
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

export function fileCatalog(opts: { fixturesDir: string; homesDir: string }): HomeCatalog {
  const entries = (): HomeEntry[] => {
    const out: HomeEntry[] = [];
    for (const path of scan(opts.fixturesDir, '.twin.json')) {
      const name = basename(path, '.twin.json');
      out.push({ id: `fixture:${name}`, kind: 'fixture', twinId: name, label: `Fixture ${name}`, path });
    }
    for (const path of scan(opts.homesDir, '.ibasho')) {
      const name = basename(path, '.ibasho');
      out.push({ id: `file:${name}`, kind: 'file', twinId: name, label: `Saved home ${name}`, path });
    }
    return out;
  };
  return {
    list: entries,
    get(id) {
      const all = entries();
      const want = id.includes(':') ? id : `fixture:${id}`;
      const entry = all.find((e) => e.id === want) ?? all.find((e) => e.id === `file:${id}`);
      if (!entry)
        throw new UnknownHomeError(
          id,
          all.map((e) => e.id),
        );
      const json = readJson(entry.path);
      return { entry, twin: entry.kind === 'fixture' ? parseTwin(json) : twinFromFile(json) };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Number-free summary (`ibasho_get_home`)

export interface FieldSummary {
  path: string;
  state: 'known' | 'estimated' | 'unknown';
  source: string;
  material?: boolean;
  /** Categorical value only; numeric inputs are read through evidence (`ibasho_simulate`). */
  value?: string;
}

function isField(
  x: unknown,
): x is { state: string; source: { kind: string }; value?: unknown; material?: boolean } {
  const f = x as { state?: unknown; source?: unknown } | null;
  return (
    !!f &&
    typeof f === 'object' &&
    (f.state === 'known' || f.state === 'estimated' || f.state === 'unknown') &&
    typeof f.source === 'object'
  );
}

/** Every input field with its state and provenance; categorical values only. */
export function fieldSummaries(twin: HomeTwin): FieldSummary[] {
  const out: FieldSummary[] = [];
  const walk = (x: unknown, path: string) => {
    if (isField(x)) {
      const s: FieldSummary = { path, state: x.state as FieldSummary['state'], source: x.source.kind };
      if (x.state === 'unknown') s.material = x.material === true;
      if (typeof x.value === 'string') s.value = x.value;
      out.push(s);
      return;
    }
    if (Array.isArray(x)) {
      x.forEach((v, i) => {
        const id = (v as { id?: unknown } | null)?.id;
        walk(v, `${path}[${typeof id === 'string' ? id : i}]`);
      });
      return;
    }
    if (x && typeof x === 'object') {
      for (const [k, v] of Object.entries(x)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(twin, '');
  return out;
}

export function homeSummary(entry: HomeEntry, twin: HomeTwin) {
  const fields = fieldSummaries(twin);
  const byKind: Record<string, string[]> = {};
  for (const e of twin.elements) byKind[e.kind] = [...(byKind[e.kind] ?? []), e.id];
  return {
    id: entry.id,
    twinId: twin.id,
    kind: entry.kind,
    region: twin.region,
    climatePackId: twin.climatePackId,
    archetypeId: twin.archetypeId,
    builtForm: twin.form.builtForm,
    district: twin.location.district ?? null,
    elements: byKind,
    junctions: twin.junctions.map((j) => j.id),
    systems: {
      space: { systemId: twin.systems.space.systemId, fuel: twin.systems.space.fuel },
      dhw: {
        systemId: twin.systems.dhw.systemId,
        fuel: twin.systems.dhw.fuel,
        class: twin.systems.dhw.class,
      },
    },
    designations: {
      conservationArea: twin.legal.designations.conservationArea,
      article23Land: twin.legal.designations.article23Land,
      article4RemovedClasses: twin.legal.designations.article4RemovedClasses,
    },
    checksRecorded: twin.checks.map((c) => ({ kind: c.kind, result: c.result, at: c.at })),
    done: twin.done.map((d) => ({ measureId: d.measureId, optionId: d.optionId, at: d.at })),
    known: fields.filter((f) => f.state === 'known'),
    estimated: fields.filter((f) => f.state === 'estimated'),
    unknown: fields.filter((f) => f.state === 'unknown'),
    note: 'Numeric inputs are not shown here. Read numbers through evidence: ibasho_simulate returns each value with its evidence id.',
  };
}
