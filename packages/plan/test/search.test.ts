import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { BuildingDoc, CityTile, Place } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import { buildPlaceIndex, editDistance, normaliseName, searchPlaces } from '../src/index.ts';

const root = join(import.meta.dirname, '..', '..', '..');
const tiles = (pack: string): CityTile[] => {
  const dir = join(root, 'packs', pack, 'src/engine/tiles');
  return readdirSync(dir).map(
    (f) => JSON.parse(gunzipSync(readFileSync(join(dir, f))).toString()) as CityTile,
  );
};
const doc = (id: string) =>
  JSON.parse(
    readFileSync(join(root, 'packages/fixtures/src/buildings', `${id}.building.json`), 'utf8'),
  ) as BuildingDoc;

const index = buildPlaceIndex({
  cities: [
    { city: 'city-hyderabad', tiles: tiles('city-hyderabad') },
    { city: 'city-london', tiles: tiles('city-london') },
  ],
  buildings: [
    { doc: doc('gb1'), city: 'city-hyderabad', contextIds: ['osm_r2829427'] },
    { doc: doc('gb2'), city: 'city-hyderabad', contextIds: ['osm_w187896823', 'osm_w211078709'] },
    { doc: doc('gh1'), city: 'city-london' },
  ],
  places: JSON.parse(
    readFileSync(join(root, 'packages/fixtures/src/buildings/places.json'), 'utf8'),
  ) as Place[],
});
const top = (q: string) => searchPlaces(index, q)[0];

describe('place search', () => {
  it('normalises case and diacritics; edit distance', () => {
    expect(normaliseName('  Vindhyā  Bhavan! ')).toBe('vindhya bhavan');
    expect(editDistance('vindya', 'vindhya')).toBe(1);
  });

  it('finds the hero by name, alias, prefix, typo and case', () => {
    for (const q of ['Vindhya', 'vindhya bhavan', 'VINDH', 'Vindya', 'vindhyā']) {
      const h = top(q);
      expect(h?.id, q).toBe('gb1');
      expect(h?.source).toBe('merged');
      expect(h?.contextIds).toEqual(['osm_r2829427']);
    }
  });

  it('finds campus buildings by common names', () => {
    expect(top('KCIS')?.name).toBe('Kohli Research Block');
    expect(top('Nilgiri')?.name).toBe('Nilgiri');
    expect(top('Himalaya')?.id).toBe('gb2');
    expect(top('Bakul')?.name).toBe('Bakul Nivas');
    expect(top('OBH')?.name).toContain('Palash');
  });

  it('finds floors and rooms within a building', () => {
    const f = top('Vindhya floor 2');
    expect(f?.kind).toBe('storey');
    expect(f?.name).toBe('Second floor');
    expect(f?.buildingId).toBe('gb1');
    expect(top('vindhya cellar')?.storeyId).toBe('st_b1');
    expect(top('Vindhya ground floor')?.storeyId).toBe('st_1');
    expect(top('auditorium')?.name).toBe('Auditorium');
    expect(top('seminar hall')?.kind).toBe('room');
    expect(top('SBI bank')?.name).toBe('SBI Bank and ATM');
    expect(top('C-STAR')?.name).toBe('C-STAR Incubator');
    expect(top('building science')?.name).toBe('Centre for IT in Building Science');
    expect(top('robotics lab')?.name).toContain('Robotics Lab');
    expect(top('IIIT library')?.name).toBe('IIIT Library');
    const lib = top('library');
    expect(lib?.storeyName).toBe('First floor');
  });

  it('finds the campus as a place and Himalaya blocks as parts', () => {
    for (const q of ['IIIT', 'IIIT Hyderabad', 'IIITH', 'campus']) expect(top(q)?.kind, q).toBe('place');
    const sh = top('Shodh');
    expect(sh?.kind).toBe('building');
    expect(sh?.id).toBe('gb2#shodh');
    expect(top('dlf cyber city')?.name).toBe('dlf');
  });

  it('filters and limits; nothing for nonsense', () => {
    expect(searchPlaces(index, 'block', { kinds: ['building'], limit: 3 })).toHaveLength(3);
    expect(searchPlaces(index, 'terrace', { city: 'city-london', kinds: ['building'] })[0]?.id).toBe('gh1');
    expect(searchPlaces(index, 'qqqzzz')).toEqual([]);
    expect(searchPlaces(index, '')).toEqual([]);
  });
});
