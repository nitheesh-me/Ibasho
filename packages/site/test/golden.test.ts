import type { SiteResult } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import { computeSite, drain, ledgerCloses, surfaceJobFor } from '../src/index.ts';
import { golden, previewOf, RESOLUTIONS } from './inputs.ts';

const ASOF = '2026-10-11' as const;
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? `${x}n` : x));

describe('Vindhya Bhavan (gb1), real stages against the Preview contract', () => {
  const { compiled, site } = golden('gb1');
  const resolution = RESOLUTIONS.sketch;
  const input = { compiled, site, resolution };
  let sun: SiteResult;
  let rad: SiteResult;
  let day: SiteResult;

  it('runs sun, radiation and daylight at sketch resolution', () => {
    sun = computeSite('sun', input, 'final', ASOF);
    rad = computeSite('radiation', { ...input, sun }, 'final', ASOF);
    day = computeSite('daylight', { ...input, sun }, 'refined', ASOF);
    expect(sun.stamp.impl).toBe('real');
    expect(day.method).toBe('T1');
  }, 120_000);

  it('reports the same surfaces and rooms as the Preview, in the same shapes', () => {
    const ids = (r: { id: string }[]) => r.map((x) => x.id).sort();
    expect(ids(rad.surfaces)).toEqual(ids(previewOf('gb1', 'radiation').surfaces));
    expect(ids(day.rooms)).toEqual(ids(previewOf('gb1', 'daylight').rooms));
    for (const s of sun.surfaces) {
      expect(s.irrWhm2).toBe('unknown');
      expect(s.sunHours?.monthly?.length).toBe(12);
      expect(s.svf).toBeDefined();
    }
    for (const s of rad.surfaces) expect(s.irrWhm2 === 'unknown' ? 0 : s.irrWhm2.length).toBe(12);
    for (const w of rad.windows) expect(w.shadingFactor.length).toBe(12);
    for (const r of day.rooms) {
      expect(r.sda && r.sda.lo <= r.sda.hi).toBe(true);
      expect(r.ase && r.ase.lo <= r.ase.hi).toBe(true);
    }
    expect(sun.unknownHeightIds?.length).toBeGreaterThan(0);
  });

  it('closes the shading ledger exactly for every receiver (AC-LK3)', () => {
    const a = drain(surfaceJobFor(input, 'final').job);
    expect(ledgerCloses(a)).toEqual({ ok: true, bad: [] });
    expect(a.ledger.length).toBeGreaterThan(10);
  }, 120_000);

  it('roof irradiation stays within 10% below the open-sky value; walls are lower', () => {
    const annual = (id: string) => {
      const s = rad.surfaces.find((x) => x.id === id);
      return s && s.irrWhm2 !== 'unknown' ? s.irrWhm2.reduce((t, v) => t + Number(v), 0) / 1000 : 0;
    };
    const roofs = rad.surfaces.filter((s) => s.id.endsWith('_roof')).map((s) => annual(s.id));
    const walls = rad.surfaces.filter((s) => s.id.endsWith('_wall')).map((s) => annual(s.id));
    const mean = (a: number[]) => a.reduce((t, v) => t + v, 0) / a.length;
    expect(mean(roofs)).toBeGreaterThan(1907 * 0.9);
    expect(mean(roofs)).toBeLessThan(1907 * 1.01);
    expect(mean(walls)).toBeLessThan(mean(roofs) * 0.6);
  });

  it('is deterministic across runs (fresh caches give the same bytes)', () => {
    const again = drain(surfaceJobFor(input, 'rough').job);
    const twice = drain(surfaceJobFor(input, 'rough').job);
    expect(json(again)).toBe(json(twice));
  }, 120_000);
});
