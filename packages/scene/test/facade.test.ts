/** Facade detail and roof radiation (round 6). */
import type { BuildingDoc } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import gb1 from '../../fixtures/src/buildings/gb1.building.json' with { type: 'json' };
import gb4 from '../../fixtures/src/buildings/gb4.building.json' with { type: 'json' };
import { facadeCounts, facadeOf } from '../src/city/facade.ts';
import { heroFromDoc } from '../src/city/hero.ts';
import { roofGrid } from '../src/city/kernels.worker.ts';
import { previewRoofRadiation } from '../src/city/preview.ts';

describe('facade detail from the document', () => {
  it('gives every glazed outdoor segment panes, heads, sills and jambs, and invents no shading', () => {
    const f = facadeOf(gb1 as unknown as BuildingDoc);
    const c = facadeCounts(f);
    expect(c.glass).toBeGreaterThan(40);
    expect(c.frame).toBeGreaterThanOrEqual(c.glass * 3);
    expect(c.shade).toBe(0);
    // Panes face out: every glass matrix has a unit normal column that is horizontal.
    for (const s of f)
      for (const m of s.glass) {
        const e = m.elements;
        expect(Math.abs(e[9]!)).toBeLessThan(1e-9);
      }
  });

  it('draws the document overhangs (chajjas) as shade pieces', () => {
    const c = facadeCounts(facadeOf(gb4 as unknown as BuildingDoc));
    expect(c.shade).toBeGreaterThan(0);
  });
});

describe('roof radiation grid', () => {
  it('is finite on the roof, empty off it, and lower where a taller neighbour shades', () => {
    const doc = gb1 as unknown as BuildingDoc;
    const hero = heroFromDoc(doc);
    const grid = roofGrid(hero);
    const place = { lat: 17.4453, lon: 78.349, tzHours: 5.5 };
    const open = previewRoofRadiation(hero, [], place, grid);
    const onRoof = [...open].filter((v) => !Number.isNaN(v));
    expect(onRoof.length).toBeGreaterThan(100);
    expect(Math.min(...onRoof)).toBeGreaterThan(1200);
    // A 60 m tower just south of the building shades part of the roof.
    const b = hero.box;
    const tower = {
      id: 't',
      ring: [
        [b.minE, b.minN - 30],
        [b.maxE, b.minN - 30],
        [b.maxE, b.minN - 10],
        [b.minE, b.minN - 10],
      ] as [number, number][],
      z1: 60,
    };
    const shaded = previewRoofRadiation(hero, [tower], place, grid);
    const lo = Math.min(...[...shaded].filter((v) => !Number.isNaN(v)));
    expect(lo).toBeLessThan(Math.min(...onRoof) - 50);
  });
});
