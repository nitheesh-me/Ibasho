/**
 * Onboarding answers to a home twin (SPEC 5.2). Owner: WP-08.
 *
 * PLACEHOLDER (local adapter until WP-01 ships `ArchetypePlugin.seed()`): the seedable tiles start
 * from the GH1 survey twin. Every value that came from that survey or from the GH1 household is
 * re-tagged as a default of this adapter and shown as an estimate (AC-G2); planning designations
 * become unknown, because they belong to GH1's street, not yours. Then the answers are applied and
 * the result goes through the core schema like any untrusted input.
 */
import type { HomeTwin, InputSource, IsoDate } from '@ibasho/core';
import { parseTwin } from '@ibasho/core/schemas';
import gh1Json from '../../../../packages/fixtures/src/homes/gh1.twin.json' with { type: 'json' };
import { type HomeEntry, homeFromTwin, today } from '../home/sample.ts';
import { type ArchetypeTile, archetypeById } from './archetypes.ts';
import { type Place, placeById } from './places.ts';
import { applyTune } from './questions.ts';

export type Tenure = 'owner' | 'tenant' | 'landlord';
export type BoilerAge = 'under-5' | '5-10' | '10-15' | 'over-15';

export interface Answers {
  placeId: string | null;
  /** Postcode area letters, when the place came from a postcode. Kept on this device only. */
  postcodeArea?: string | undefined;
  tileId: string | null;
  /** Tune question id to choice id; a missing key means "Not sure". */
  tune: Record<string, string>;
  tenure: Tenure | null;
  people: number | null;
  boilerAge: BoilerAge | null;
}

export const EMPTY_ANSWERS: Answers = {
  placeId: null,
  tileId: null,
  tune: {},
  tenure: null,
  people: null,
  boilerAge: null,
};

/** Boiler age bands as an estimate in years (central value and range). */
export const BOILER_AGE: Record<BoilerAge, { label: string; value: number; range: [number, number] }> = {
  'under-5': { label: 'Under 5 years', value: 3, range: [0, 5] },
  '5-10': { label: '5 to 10 years', value: 8, range: [5, 10] },
  '10-15': { label: '10 to 15 years', value: 12, range: [10, 15] },
  'over-15': { label: 'Over 15 years', value: 18, range: [15, 25] },
};

export const TENURE_LINES: Record<Tenure, { label: string; line: string }> = {
  owner: { label: 'I own it', line: 'You can change anything, subject to planning.' },
  tenant: { label: 'I rent it', line: 'We will separate what you can do from what you can ask for.' },
  landlord: { label: 'I rent it out', line: 'We will look for the cheapest path and show who benefits.' },
};

const ADAPTER_ID = 'web-onboarding-adapter';

type Field = { state: string; source: InputSource; value?: unknown; range?: unknown; options?: unknown };

const isField = (x: unknown): x is Field =>
  typeof x === 'object' && x !== null && 'state' in x && 'source' in x;

/** Turn every surveyed or stated value of the base twin into an estimate from this adapter. */
function asEstimates(node: unknown, pluginId: string): void {
  if (Array.isArray(node)) {
    for (const x of node) asEstimates(x, pluginId);
    return;
  }
  if (typeof node !== 'object' || node === null) return;
  if (isField(node)) {
    const kind = node.source.kind;
    if (kind === 'document' || kind === 'stated' || kind === 'measured') {
      node.source = { kind: 'default', pluginId };
      if (node.state === 'known') {
        node.state = 'estimated';
        if (typeof node.value === 'number') node.range = [node.value, node.value];
        else node.options = [node.value];
      }
    }
    return;
  }
  for (const v of Object.values(node)) asEstimates(v, pluginId);
}

export class SeedError extends Error {}

export function newHomeId(rand: () => number = Math.random): string {
  return `home-${Math.floor(rand() * 36 ** 8)
    .toString(36)
    .padStart(8, '0')}`;
}

/** Seed a twin from the answers. Throws `SeedError` when the place or tile is missing or not seedable. */
export function seedTwin(a: Answers, id: string): HomeTwin {
  const place: Place | undefined = a.placeId ? placeById(a.placeId) : undefined;
  const tile: ArchetypeTile | undefined = a.tileId ? archetypeById(a.tileId) : undefined;
  if (!place) throw new SeedError('choose where your home is first');
  if (!tile?.seedable) throw new SeedError('choose a home type we can draw');

  const t = structuredClone(gh1Json) as unknown as HomeTwin;
  const pluginId = `${ADAPTER_ID}:${tile.id}`;
  asEstimates(t, pluginId);
  t.id = id;
  t.version = 1;
  t.region = place.region;
  t.climatePackId = place.climatePackId;
  t.location = { lat: place.lat, lon: place.lon, district: place.name };
  t.archetypeId = tile.archetypeId;
  t.form.builtForm = tile.builtForm;
  t.legal.designations = {
    conservationArea: 'unknown',
    article23Land: 'unknown',
    listedGrade: {
      state: 'unknown',
      options: ['I', 'II*', 'II', 'none'],
      material: true,
      source: { kind: 'default', pluginId },
    },
    article4RemovedClasses: [],
  };
  t.legal.supply.looped = 'unknown';
  delete t.legal.epc;
  delete t.meters;
  t.checks = [];
  t.done = [];

  applyTune(t, a.tune);
  if (a.tenure) t.legal.tenure = { state: 'known', value: a.tenure, source: { kind: 'stated' } };
  if (a.people) t.occupancy.people = { state: 'known', value: a.people, source: { kind: 'stated' } };
  if (a.boilerAge) {
    const b = BOILER_AGE[a.boilerAge];
    t.systems.boilerAgeYears = {
      state: 'estimated',
      value: b.value,
      range: b.range,
      source: { kind: 'stated' },
    };
  }
  return parseTwin(t);
}

export function homeName(a: Answers): string {
  const place = a.placeId ? placeById(a.placeId) : undefined;
  return place ? `Your home in ${place.name}` : 'Your home';
}

/** The home onboarding reveals. */
export function seedHome(a: Answers, id: string = newHomeId(), asOf: IsoDate = today()): HomeEntry {
  return homeFromTwin(seedTwin(a, id), homeName(a), asOf);
}
