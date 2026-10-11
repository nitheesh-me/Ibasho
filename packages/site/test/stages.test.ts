import type { JobCtx, SiteResult, StageIn } from '@ibasho/core';
import { canonicalHash } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import {
  computeSite,
  drain,
  ledgerCloses,
  SiteCancelled,
  setSiteYielder,
  siteSun,
  surfaceJobFor,
} from '../src/index.ts';
import { RESOLUTIONS } from './inputs.ts';
import { HYDERABAD, LONDON, neighbour, rect, siteOf, synthBuilding } from './synth.ts';

const ASOF = '2026-10-11' as const;
const res = RESOLUTIONS.standard;
const kwh = (r: SiteResult, id: string) => {
  const s = r.surfaces.find((x) => x.id === id);
  if (!s || s.irrWhm2 === 'unknown') throw new Error(`no ${id}`);
  return s.irrWhm2.reduce((a, b) => a + Number(b), 0) / 1000;
};
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? `${x}n` : x));

// A 20 m by 10 m single room box, 3.5 m high, windows on every side (edges: 0 south, 1 east, 2 north, 3 west).
const box = synthBuilding('box', [
  { id: 'rm_box', ring: rect(-10000, -5000, 10000, 5000), wwr: { 0: 0.3, 1: 0.3, 2: 0.3, 3: 0.3 } },
]);

describe('single box, no context (golden)', () => {
  const input: StageIn['sun'] = { compiled: box, site: siteOf(HYDERABAD), resolution: res };
  const sun = computeSite('sun', input, 'final', ASOF);
  const rad = computeSite('radiation', { ...input, sun }, 'final', ASOF);

  it('the roof receives the annual global horizontal irradiation of the weather file (within 1%)', () => {
    expect(Math.abs(kwh(rad, 'rm_box_roof') - 1907) / 1907).toBeLessThan(0.01);
  });

  it('walls see half the sky, the roof all of it', () => {
    const svf = (id: string) => {
      const q = sun.surfaces.find((s) => s.id === id)?.svf;
      return q ? Number(q.n) / Number(q.d) : -1;
    };
    expect(svf('rm_box_roof')).toBeGreaterThan(0.99);
    expect(Math.abs(svf('sg_box_0_wall') - 0.5)).toBeLessThan(0.01);
  });

  it('Hyderabad facades: south gets most in winter, north gets sun from May to July', () => {
    const south = sun.surfaces.find((s) => s.id === 'sg_box_0_wall')?.sunHours?.monthly ?? [];
    const north = sun.surfaces.find((s) => s.id === 'sg_box_2_wall')?.sunHours?.monthly ?? [];
    expect(south[11] as number).toBeGreaterThan(6);
    expect(north[11] as number).toBe(0);
    expect(north[5] as number).toBeGreaterThan(1);
    expect(kwh(rad, 'sg_box_0_wall')).toBeGreaterThan(kwh(rad, 'sg_box_2_wall'));
    // East and west are near mirror images.
    expect(
      Math.abs(kwh(rad, 'sg_box_1_wall') - kwh(rad, 'sg_box_3_wall')) / kwh(rad, 'sg_box_1_wall'),
    ).toBeLessThan(0.08);
  });

  it('nothing shades a lone box: no ledger, shading factors 1', () => {
    expect(rad.ledger).toEqual([]);
    for (const w of rad.windows)
      for (const q of w.shadingFactor) expect(Number(q.n) / Number(q.d)).toBeGreaterThan(0.99);
    expect(rad.stamp.impl).toBe('real');
    expect(rad.kernel).toBe('cpu');
  });

  it('is deterministic: the same inputs give the same bytes', () => {
    const again = computeSite('radiation', { ...input, sun }, 'final', ASOF);
    expect(json(again)).toBe(json(rad));
  });

  it('London: the roof matches the PVGIS annual GHI, the south wall beats the north', () => {
    const l = { compiled: box, site: siteOf(LONDON), resolution: res };
    const s = computeSite('sun', l, 'final', ASOF);
    const r = computeSite('radiation', { ...l, sun: s }, 'final', ASOF);
    expect(kwh(r, 'rm_box_roof')).toBeGreaterThan(900);
    expect(kwh(r, 'rm_box_roof')).toBeLessThan(1200);
    expect(kwh(r, 'sg_box_0_wall')).toBeGreaterThan(1.4 * kwh(r, 'sg_box_2_wall'));
  });
});

describe('courtyard (self shading) and a neighbour (context shading)', () => {
  // Four wings around a 12 m courtyard, 12 m high.
  const H = 12000;
  const court = synthBuilding('court', [
    { id: 'rm_s', ring: rect(-18000, -18000, 18000, -6000), height: H, inner: [2] },
    { id: 'rm_n', ring: rect(-18000, 6000, 18000, 18000), height: H, inner: [0] },
    { id: 'rm_w', ring: rect(-18000, -6000, -6000, 6000), height: H, inner: [0, 2] },
    { id: 'rm_e', ring: rect(6000, -6000, 18000, 6000), height: H, inner: [0, 2] },
  ]);
  const input: StageIn['sun'] = { compiled: court, site: siteOf(HYDERABAD), resolution: res };
  const sun = computeSite('sun', input, 'final', ASOF);
  const rad = computeSite('radiation', { ...input, sun }, 'final', ASOF);

  it('courtyard walls see less sky and less sun than street walls', () => {
    const svf = (id: string) => {
      const q = sun.surfaces.find((s) => s.id === id)?.svf;
      return q ? Number(q.n) / Number(q.d) : -1;
    };
    // rm_w edge 1 faces east into the court; rm_e edge 1 faces east to the street.
    expect(svf('sg_w_1_wall')).toBeLessThan(0.35);
    expect(svf('sg_e_1_wall')).toBeGreaterThan(0.49);
    expect(kwh(rad, 'sg_w_1_wall')).toBeLessThan(0.75 * kwh(rad, 'sg_e_1_wall'));
  });

  it('the ledger names the building itself for courtyard self shading and closes exactly (AC-LK3)', () => {
    const job = surfaceJobFor(input, 'final');
    const a = drain(job.job);
    expect(ledgerCloses(a).ok).toBe(true);
    expect(rad.ledger.some((l) => l.receiver === 'sg_w_1_wall' && l.blocker === 'court')).toBe(true);
    expect(rad.ledger.every((l) => l.lostWh > 0n)).toBe(true);
  });

  it('a tall neighbour to the south takes sun from the south wall, and is named', () => {
    const hero = synthBuilding('hero', [
      { id: 'rm_h', ring: rect(-10000, -5000, 10000, 5000), wwr: { 0: 0.3 } },
    ]);
    const site = siteOf(HYDERABAD, [
      neighbour('osm_tower', rect(-20000, -35000, 20000, -15000), 40000),
      neighbour('osm_ghost', rect(-20000, 15000, 20000, 35000), 'unknown'),
    ]);
    const i2 = { compiled: hero, site, resolution: res };
    const s2 = computeSite('sun', i2, 'final', ASOF);
    const r2 = computeSite('radiation', { ...i2, sun: s2 }, 'final', ASOF);
    const free = computeSite(
      'radiation',
      { compiled: hero, site: siteOf(HYDERABAD), resolution: res, sun: s2 },
      'final',
      ASOF,
    );
    expect(kwh(r2, 'sg_h_0_wall')).toBeLessThan(0.7 * kwh(free, 'sg_h_0_wall'));
    expect(r2.ledger.find((l) => l.receiver === 'sg_h_0_wall')?.blocker).toBe('osm_tower');
    expect(r2.unknownHeightIds).toEqual(['osm_ghost']);
    const win = r2.windows.find((w) => w.id === 'sg_h_0_win');
    const dec = win?.shadingFactor[11];
    expect(dec && Number(dec.n) / Number(dec.d)).toBeLessThan(0.6);
    expect(ledgerCloses(drain(surfaceJobFor(i2, 'final').job)).ok).toBe(true);
  });
});

describe('daylight (T1 simplified sDA, exact ASE)', () => {
  const room = (id: string, wwr: Record<number, number>, depth = 6000) =>
    synthBuilding(id, [{ id: `rm_${id}`, ring: rect(0, 0, 8000, depth), wwr, spaceType: 'office' }]);
  const run = (b: ReturnType<typeof synthBuilding>, place = HYDERABAD) => {
    const i = { compiled: b, site: siteOf(place), resolution: res };
    const sun = computeSite('sun', i, 'final', ASOF);
    return computeSite('daylight', { ...i, sun }, 'final', ASOF);
  };

  it('a south window gets direct sun (ASE) and a north one nearly none in Hyderabad', () => {
    const south = run(room('ds', { 0: 0.4 })).rooms[0];
    const north = run(room('dn', { 2: 0.4 })).rooms[0];
    expect(south?.tier).toBe('T1');
    expect(((south?.ase?.lo ?? 0) + (south?.ase?.hi ?? 0)) / 2).toBeGreaterThan(
      ((north?.ase?.lo ?? 0) + (north?.ase?.hi ?? 0)) / 2,
    );
  });

  it('more glass gives more daylight, a deeper room less', () => {
    const mid = (r: SiteResult) => {
      const x = r.rooms[0]?.sda;
      return x ? (x.lo + x.hi) / 2 : -1;
    };
    const small = mid(run(room('a', { 2: 0.15 })));
    const big = mid(run(room('b', { 2: 0.5 })));
    const deep = mid(run(room('c', { 2: 0.5 }, 14000)));
    expect(big).toBeGreaterThan(small);
    expect(deep).toBeLessThan(big);
    for (const v of [small, big, deep]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('rooms with no windows report zero; rooms not regularly occupied are left out', () => {
    const dark = run(room('dk', {}));
    expect(dark.rooms[0]?.sda).toEqual({ lo: 0, hi: 0 });
    const store = run(
      synthBuilding('st', [
        { id: 'rm_st', ring: rect(0, 0, 5000, 5000), wwr: { 0: 0.3 }, spaceType: 'store' },
      ]),
    );
    expect(store.rooms).toEqual([]);
  });
});

describe('stage provider: progressive and cancellable', () => {
  setSiteYielder(() => Promise.resolve());
  const ctx = (signal = { aborted: false, addEventListener() {}, removeEventListener() {} }): JobCtx => ({
    jobId: 'j1',
    generation: 1,
    signal,
    resolution: res,
    deviceFactor: 1,
  });
  const input = { compiled: box, site: siteOf(HYDERABAD), resolution: res };

  it('emits rough and refined partials, then the final, with rising fractions', async () => {
    const events = [];
    for await (const e of siteSun.run(input, ctx())) events.push(e);
    const tiers = events.filter((e) => e.partial || e.final).map((e) => e.tier);
    expect(tiers).toEqual(['rough', 'refined', 'final']);
    const fr = events.map((e) => e.fraction);
    expect([...fr].sort((a, b) => a - b)).toEqual(fr);
    expect(events.at(-1)?.final?.stamp.impl).toBe('real');
    expect(canonicalHash(json(events.at(-1)?.final))).toBe(
      canonicalHash(json(computeSite('sun', input, 'final', ASOF))),
    );
  });

  it('stops with SiteCancelled once the signal aborts', async () => {
    const signal = { aborted: false, addEventListener() {}, removeEventListener() {} };
    const seen: string[] = [];
    await expect(
      (async () => {
        for await (const e of siteSun.run(
          { ...input, compiled: synthBuilding('box2', [{ id: 'rm_b2', ring: rect(0, 0, 30000, 30000) }]) },
          ctx(signal),
        )) {
          seen.push(e.tier);
          signal.aborted = true;
        }
      })(),
    ).rejects.toBeInstanceOf(SiteCancelled);
    expect(seen.length).toBe(1);
  });
});
