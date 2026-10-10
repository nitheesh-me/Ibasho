/** House build invariants: the model the WebGL builder, SVG renderer, picking and outline share. */
import type { HomeTwin } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import { centroid, dot, length, sub } from '../src/twin/frame.ts';
import { buildHouse, drawnIds } from '../src/twin/house.ts';
import { house, twin } from './helpers.ts';

const EPS = 1e-6;
const within = (x: number, lo: number, hi: number, tol = 1e-3): boolean => x >= lo - tol && x <= hi + tol;

describe('house model', () => {
  it('is deterministic: the same twin builds the same model', () => {
    expect(JSON.stringify(buildHouse(twin))).toBe(JSON.stringify(house));
  });

  it('gives every surface a unique key, a unit right-handed frame and positive thickness', () => {
    const keys = house.surfaces.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of house.surfaces) {
      const { u, v, n } = s.frame;
      expect(Math.abs(length(u) - 1)).toBeLessThan(EPS);
      expect(Math.abs(length(v) - 1)).toBeLessThan(EPS);
      expect(Math.abs(length(n) - 1)).toBeLessThan(EPS);
      expect(Math.abs(dot(u, n))).toBeLessThan(EPS);
      expect(Math.abs(dot(v, n))).toBeLessThan(EPS);
      expect(s.thickness).toBeGreaterThan(0);
      expect(s.polygon.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every polygon planar', () => {
    for (const s of house.surfaces) {
      const o = s.frame.origin;
      for (const p of [...s.polygon, ...s.holes.flat()])
        expect(Math.abs(dot(sub(p, o), s.frame.n))).toBeLessThan(1e-4);
    }
  });

  it('points outer walls, roof slopes and gables away from the house centre', () => {
    const f = house.footprint;
    const c = [(f.x0 + f.x1) / 2, house.eavesY / 2, (f.z0 + f.z1) / 2] as const;
    for (const s of house.surfaces) {
      if (s.role !== 'wall' && s.role !== 'roof-slope' && s.role !== 'gable') continue;
      const m = centroid(s.polygon);
      const out = [m[0] - c[0], 0, m[2] - c[2]] as [number, number, number];
      expect(dot(s.frame.n, out), s.key).toBeGreaterThan(0);
    }
  });

  it('draws every twin element once, and only twin elements', () => {
    const ids = drawnIds(house).elements;
    const twinIds = new Set(twin.elements.map((e) => e.id));
    for (const id of twinIds) expect(ids.has(id), id).toBe(true);
    for (const id of ids) expect(twinIds.has(id), id).toBe(true);
    const own = house.surfaces.filter((s) => s.key.startsWith('el:'));
    expect(new Set(own.map((s) => s.elementId)).size).toBe(own.length);
  });

  it('keeps every junction with its id, kind and a positive length', () => {
    expect(house.junctions.map((j) => j.junctionId).sort()).toEqual(twin.junctions.map((j) => j.id).sort());
    for (const j of house.junctions) expect(j.lengthM).toBeGreaterThan(0);
  });

  it('has the ridge at or above the eaves and the eaves at the storey height', () => {
    expect(house.ridgeY).toBeGreaterThanOrEqual(house.eavesY);
    expect(house.eavesY).toBeGreaterThanOrEqual(house.storeys * house.storeyHeight - EPS);
    expect(house.bounds.max[1]).toBeGreaterThanOrEqual(house.ridgeY - EPS);
  });

  it('nests the inner box inside the footprint', () => {
    const { footprint: f, inner: i } = house;
    expect(i.x0).toBeGreaterThan(f.x0);
    expect(i.x1).toBeLessThan(f.x1);
    expect(i.x0).toBeLessThan(i.x1);
    expect(i.z0).toBeLessThan(i.z1);
    expect(i.z0).toBeGreaterThanOrEqual(f.z0);
    expect(i.z1).toBeLessThanOrEqual(f.z1);
  });

  it('places rooms inside the inner box, on their storey, and covers both SAP zones', () => {
    const i = house.inner;
    for (const r of house.rooms) {
      expect(within(r.min[0], i.x0, i.x1) && within(r.max[0], i.x0, i.x1), r.id).toBe(true);
      expect(within(r.min[2], i.z0, i.z1) && within(r.max[2], i.z0, i.z1), r.id).toBe(true);
      expect(r.storey).toBeGreaterThanOrEqual(0);
      expect(r.storey).toBeLessThan(house.storeys);
      expect(r.min[1]).toBeCloseTo(r.storey * house.storeyHeight, 3);
    }
    expect(new Set(house.rooms.map((r) => r.zone))).toEqual(new Set(['living', 'rest']));
  });

  it('places each opening inside its host wall, with a positive size', () => {
    for (const o of house.openings) {
      expect(o.width).toBeGreaterThan(0);
      expect(o.height).toBeGreaterThan(0);
      if (!o.hostId) continue;
      const host = house.surfaces.find((s) => s.elementId === o.hostId && s.key.startsWith('el:'));
      expect(host, o.elementId).toBeDefined();
      const f = host!.frame;
      const us = host!.polygon.map((p) => dot(sub(p, f.origin), f.u));
      const vs = host!.polygon.map((p) => dot(sub(p, f.origin), f.v));
      for (const p of o.polygon) {
        expect(within(dot(sub(p, f.origin), f.u), Math.min(...us), Math.max(...us)), o.elementId).toBe(true);
        expect(within(dot(sub(p, f.origin), f.v), Math.min(...vs), Math.max(...vs)), o.elementId).toBe(true);
      }
    }
  });

  it('builds one intermediate floor per storey above the ground, each with a stair void', () => {
    const floors = house.surfaces.filter((s) => s.role === 'intermediate-floor');
    expect(floors.length).toBe(house.storeys - 1);
    for (const f of floors) expect(f.holes.length).toBe(house.stairs.length > 0 ? 1 : 0);
  });

  it('survives a twin without a pitched roof or chimneys', () => {
    const flat: HomeTwin = {
      ...twin,
      form: { ...twin.form, roof: { ...twin.form.roof, value: 'flat' } as typeof twin.form.roof },
    };
    const h = buildHouse(flat);
    expect(h.surfaces.some((s) => s.role === 'roof-slope')).toBe(false);
    expect(h.ridgeY).toBe(h.eavesY);
    expect(h.chimneys.length).toBe(0);
  });
});
