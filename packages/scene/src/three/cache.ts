/**
 * Geometry cache per house model, so the house, highlights and the lens share buffers.
 * Owner: WP-07.
 */
import type { BufferGeometry } from 'three';
import type { HouseModel, Opening, Surface } from '../twin/house.ts';
import { type OpeningParts, openingParts, stairsGeometry, surfaceCap, surfaceGeometry } from './geometry.ts';

interface Entry {
  surfaces: Map<string, BufferGeometry>;
  caps: Map<string, BufferGeometry>;
  openings: Map<string, OpeningParts>;
  stairs: BufferGeometry[];
}

const cache = new WeakMap<HouseModel, Entry>();

function entry(h: HouseModel): Entry {
  let e = cache.get(h);
  if (!e) {
    e = { surfaces: new Map(), caps: new Map(), openings: new Map(), stairs: [] };
    cache.set(h, e);
  }
  return e;
}

export function geometryOf(h: HouseModel, s: Surface): BufferGeometry {
  const e = entry(h);
  let g = e.surfaces.get(s.key);
  if (!g) {
    g = surfaceGeometry(s);
    e.surfaces.set(s.key, g);
  }
  return g;
}

/** Interior face of a surface nudged inwards (lens) or outer face nudged out. */
export function capOf(h: HouseModel, s: Surface, side: 'inner' | 'outer'): BufferGeometry {
  const e = entry(h);
  const k = `${s.key}:${side}`;
  let g = e.caps.get(k);
  if (!g) {
    g = surfaceCap(s, 0.004, side);
    e.caps.set(k, g);
  }
  return g;
}

export function partsOf(h: HouseModel, o: Opening): OpeningParts {
  const e = entry(h);
  let p = e.openings.get(o.elementId);
  if (!p) {
    p = openingParts(o);
    e.openings.set(o.elementId, p);
  }
  return p;
}

export function stairsOf(h: HouseModel): BufferGeometry[] {
  const e = entry(h);
  if (e.stairs.length === 0 && h.stairs.length > 0) e.stairs = h.stairs.map(stairsGeometry);
  return e.stairs;
}

export function disposeHouse(h: HouseModel): void {
  const e = cache.get(h);
  if (!e) return;
  for (const g of e.surfaces.values()) g.dispose();
  for (const g of e.caps.values()) g.dispose();
  for (const p of e.openings.values()) {
    p.frame.dispose();
    p.glass?.dispose();
    p.sill?.dispose();
    p.lintel.dispose();
    p.leaf?.dispose();
  }
  for (const g of e.stairs) g.dispose();
  cache.delete(h);
}
