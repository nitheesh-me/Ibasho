/**
 * The Shape step: a 3 by 3 grid of UK home types (SPEC 5.2, UX 5.2). Owner: WP-08.
 *
 * PLACEHOLDER (local adapter): `ArchetypePlugin.seed()` is not in `pack-home-uk` yet (WP-01,
 * M-A). Until it is, only the types this adapter can draw honestly are offered: the solid brick
 * terrace, seeded from the GH1 survey with every surveyed value turned into an estimate. The other
 * tiles are shown, labelled as not drawn yet, and cannot be picked. "Not sure" starts from the most
 * common type near you (the terrace here) and says so.
 */
import type { BuiltForm } from '@ibasho/core';

export type ThumbKind = 'terrace' | 'semi' | 'flat' | 'bungalow' | 'detached' | 'unsure';

export interface ArchetypeTile {
  id: string;
  label: string;
  /** One sentence for people who cannot see the drawing. */
  alt: string;
  builtForm: BuiltForm;
  /** Age band as `ArchetypeSeedInput.ageBand`. */
  ageBand: string;
  thumb: ThumbKind;
  /** Archetype id written to the twin. */
  archetypeId: string;
  /** True when this build can seed a twin for the tile. */
  seedable: boolean;
}

const tile = (t: Omit<ArchetypeTile, 'seedable'>, seedable = false): ArchetypeTile => ({ ...t, seedable });

export const ARCHETYPES: readonly ArchetypeTile[] = [
  tile(
    {
      id: 'terrace-solid',
      label: 'Victorian or Edwardian terrace',
      alt: 'A two-storey brick terrace with a pitched slate roof and neighbours on both sides.',
      builtForm: 'mid-terrace',
      ageBand: '1900-1929',
      thumb: 'terrace',
      archetypeId: 'uk-mid-terrace-1900-1929',
    },
    true,
  ),
  tile({
    id: 'semi-1930s',
    label: '1930s semi',
    alt: 'A two-storey house joined to one neighbour, with a bay window and a hipped roof.',
    builtForm: 'semi-detached',
    ageBand: '1930-1949',
    thumb: 'semi',
    archetypeId: 'uk-semi-1930-1949',
  }),
  tile({
    id: 'semi-postwar',
    label: 'Post-war semi',
    alt: 'A plain two-storey house joined to one neighbour, with cavity brick walls.',
    builtForm: 'semi-detached',
    ageBand: '1950-1966',
    thumb: 'semi',
    archetypeId: 'uk-semi-1950-1966',
  }),
  tile({
    id: 'flat-1960s',
    label: '1960s or 70s flat',
    alt: 'A flat in a low block with a flat roof and long rows of windows.',
    builtForm: 'flat',
    ageBand: '1967-1975',
    thumb: 'flat',
    archetypeId: 'uk-flat-1967-1975',
  }),
  tile({
    id: 'estate-1990s',
    label: '1990s or 2000s estate house',
    alt: 'A detached two-storey house on an estate, with a small gable over the door.',
    builtForm: 'detached',
    ageBand: '1991-2002',
    thumb: 'detached',
    archetypeId: 'uk-detached-1991-2002',
  }),
  tile({
    id: 'bungalow',
    label: 'Bungalow',
    alt: 'A single-storey house with a wide pitched roof.',
    builtForm: 'detached',
    ageBand: '1950-1966',
    thumb: 'bungalow',
    archetypeId: 'uk-bungalow-1950-1966',
  }),
  tile({
    id: 'new-build',
    label: 'New build (after 2012)',
    alt: 'A recent two-storey house with large windows and a simple gable roof.',
    builtForm: 'semi-detached',
    ageBand: '2012-onwards',
    thumb: 'semi',
    archetypeId: 'uk-semi-2012-onwards',
  }),
  tile({
    id: 'converted-flat',
    label: 'Converted flat',
    alt: 'A flat on one floor of an older house that has been split into flats.',
    builtForm: 'flat',
    ageBand: '1900-1929',
    thumb: 'flat',
    archetypeId: 'uk-converted-flat-1900-1929',
  }),
  tile(
    {
      id: 'not-sure',
      label: 'Not sure',
      alt: 'A question mark: we start from the most common home near you and keep every range wide.',
      builtForm: 'mid-terrace',
      ageBand: '1900-1929',
      thumb: 'unsure',
      archetypeId: 'uk-mid-terrace-1900-1929',
    },
    true,
  ),
];

export function archetypeById(id: string): ArchetypeTile | undefined {
  return ARCHETYPES.find((a) => a.id === id);
}
