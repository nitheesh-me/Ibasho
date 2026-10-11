/**
 * Merged city geometry (DESIGN_SYSTEM 13.8: context merged per pack, analysis paint as vertex
 * attributes, no new draw calls). Owner: WP-07.
 */
import type { ContextBuilding, Mm } from '@ibasho/core';
import { BufferAttribute, BufferGeometry, ShapeUtils, Vector2 } from 'three';
import { ccw, type EN } from './frame.ts';
import type { HeroSurface } from './hero.ts';

export interface ContextMass {
  id: string;
  ring: EN[];
  /** Courtyards and light wells, clockwise (pack `holes`). */
  holes: EN[][];
  /** Metres. */
  lo: number;
  likely: number;
  hi: number;
  source: ContextBuilding['height']['source'];
  levels?: number;
  name?: string;
  sources: string[];
  /** Height entered by the person (closes the band). */
  user?: number;
}

export function massesOf(
  buildings: readonly ContextBuilding[],
  overrides: Readonly<Record<string, Mm>> = {},
): ContextMass[] {
  return buildings.map((b) => {
    const user = overrides[b.id];
    const ring = ccw(b.footprint.map(([x, y]) => [x / 1000, y / 1000] as EN));
    const holes = (b.holes ?? []).map((h) => ccw(h.map(([x, y]) => [x / 1000, y / 1000] as EN)).reverse());
    return {
      id: b.id,
      ring,
      holes,
      lo: b.height.lo / 1000,
      likely: b.height.likely / 1000,
      hi: b.height.hi / 1000,
      source: b.height.source,
      ...(b.levels !== undefined ? { levels: b.levels } : {}),
      ...(b.name ? { name: b.name } : {}),
      sources: b.sources ?? [],
      ...(user !== undefined ? { user: user / 1000 } : {}),
    };
  });
}

/** Height the model is drawn and cast at: the person's value, else the likely height. */
export const drawnHeight = (m: ContextMass): number => m.user ?? m.likely;

/** Wall value relative to roofs, so masses separate by value at night and by day. */
const WALL_SHADE = 0.84;

class Builder {
  pos: number[] = [];
  nor: number[] = [];
  idx: number[] = [];
  extra: number[] = [];
  /** Shade per vertex: 1 on roofs, lower on walls (card in its own shade). */
  shade: number[] = [];
  private v = 0;
  vertex(x: number, y: number, z: number, n: readonly number[], e = 0): number {
    this.pos.push(x, y, z);
    this.nor.push(n[0]!, n[1]!, n[2]!);
    this.extra.push(e);
    const k = n[1]! > 0.5 ? 1 : WALL_SHADE;
    this.shade.push(k, k, k);
    return this.v++;
  }
  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
  }
  geometry(extraName?: string, shade = false): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    if (shade) g.setAttribute('color', new BufferAttribute(new Float32Array(this.shade), 3));
    if (extraName) g.setAttribute(extraName, new BufferAttribute(new Float32Array(this.extra), 1));
    g.setIndex(
      this.pos.length / 3 > 65535
        ? new BufferAttribute(new Uint32Array(this.idx), 1)
        : new BufferAttribute(new Uint16Array(this.idx), 1),
    );
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Extrude a ring (and its holes) from y0 to y1: walls plus a roof cap. */
function prism(
  b: Builder,
  ring: readonly EN[],
  y0: number,
  y1: number,
  tag: number,
  cap = true,
  holes: readonly EN[][] = [],
): void {
  for (const r of [ring, ...holes])
    for (let i = 0; i < r.length; i++) {
      const p = r[i]!;
      const q = r[(i + 1) % r.length]!;
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (len < 1e-3) continue;
      const n = [(q[1] - p[1]) / len, 0, (q[0] - p[0]) / len];
      const a = b.vertex(p[0], y0, -p[1], n, tag);
      const c = b.vertex(q[0], y0, -q[1], n, tag);
      const d = b.vertex(q[0], y1, -q[1], n, tag);
      const e = b.vertex(p[0], y1, -p[1], n, tag);
      b.tri(a, c, d);
      b.tri(a, d, e);
    }
  if (!cap) return;
  const all = [...ring, ...holes.flat()];
  const tris = ShapeUtils.triangulateShape(
    ring.map(([e, n]) => new Vector2(e, n)),
    holes.map((h) => h.map(([e, n]) => new Vector2(e, n))),
  );
  const base = all.map(([e, n]) => b.vertex(e, y1, -n, [0, 1, 0], tag));
  for (const [i, j, k] of tris) {
    const A = all[i!]!;
    const B = all[j!]!;
    const C = all[k!]!;
    const up = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]) > 0;
    if (up) b.tri(base[i!]!, base[j!]!, base[k!]!);
    else b.tri(base[i!]!, base[k!]!, base[j!]!);
  }
}

/** All context masses in one geometry; `aBid` holds the mass index for picking. */
export function contextGeometry(
  masses: readonly ContextMass[],
  height: (m: ContextMass) => number,
): BufferGeometry {
  const b = new Builder();
  masses.forEach((m, i) => {
    prism(b, m.ring, 0, height(m), i, true, m.holes);
  });
  return b.geometry('aBid', true);
}

/** Footprint outlines at the top and bottom plus vertical corners, for ink or dashed lines. */
export function outlineGeometry(rings: readonly { ring: EN[]; h: number }[]): BufferGeometry {
  const pos: number[] = [];
  for (const { ring, h } of rings) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i]!;
      const q = ring[(i + 1) % ring.length]!;
      pos.push(p[0], h, -p[1], q[0], h, -q[1]);
      pos.push(p[0], 0.05, -p[1], q[0], 0.05, -q[1]);
      pos.push(p[0], 0.05, -p[1], p[0], h, -p[1]);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  return g;
}

/** The uncertain top band of each estimated mass: from the drawn height up to `hi`. */
export function ghostGeometry(bands: readonly { ring: EN[]; from: number; to: number }[]): BufferGeometry {
  const b = new Builder();
  for (const band of bands) if (band.to - band.from > 0.2) prism(b, band.ring, band.from, band.to, 0, false);
  return b.geometry();
}

/** Flat polygons on a horizontal plane (penumbra bands, roads). */
export function flatGeometry(polys: readonly EN[][], y: number): BufferGeometry {
  const b = new Builder();
  for (const poly of polys) {
    if (poly.length < 3) continue;
    const tris = ShapeUtils.triangulateShape(
      poly.map(([e, n]) => new Vector2(e, n)),
      [],
    );
    const base = poly.map(([e, n]) => b.vertex(e, y, -n, [0, 1, 0]));
    for (const [i, j, k] of tris) {
      const A = poly[i!]!;
      const B = poly[j!]!;
      const C = poly[k!]!;
      const up = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]) > 0;
      if (up) b.tri(base[i!]!, base[j!]!, base[k!]!);
      else b.tri(base[i!]!, base[k!]!, base[j!]!);
    }
  }
  return b.geometry();
}

/** Road ribbons as quads per segment. */
export function roadPolys(roads: readonly { points: EN[]; width: number }[]): EN[][] {
  const out: EN[][] = [];
  for (const r of roads) {
    for (let i = 0; i + 1 < r.points.length; i++) {
      const p = r.points[i]!;
      const q = r.points[i + 1]!;
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const nx = (-(q[1] - p[1]) / len) * (r.width / 2);
      const ny = ((q[0] - p[0]) / len) * (r.width / 2);
      const ex = ((q[0] - p[0]) / len) * (r.width / 2);
      const ey = ((q[1] - p[1]) / len) * (r.width / 2);
      out.push([
        [p[0] - nx - ex, p[1] - ny - ey],
        [q[0] - nx + ex, q[1] - ny + ey],
        [q[0] + nx + ex, q[1] + ny + ey],
        [p[0] + nx - ex, p[1] + ny - ey],
      ]);
    }
  }
  return out;
}

/**
 * Hero surfaces in one geometry with per vertex `color` (lens paint) and `aSurf` (index into
 * `surfaces` for picking and repaint). Non indexed triangles get a trivial index for the BVH.
 */
export function heroGeometry(surfaces: readonly HeroSurface[]): BufferGeometry {
  let n = 0;
  for (const s of surfaces) n += s.tris.length / 3;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const col = new Float32Array(n * 3).fill(1);
  const surf = new Float32Array(n);
  let v = 0;
  surfaces.forEach((s, si) => {
    for (let i = 0; i < s.tris.length; i += 3) {
      pos[v * 3] = s.tris[i]!;
      pos[v * 3 + 1] = s.tris[i + 1]!;
      pos[v * 3 + 2] = s.tris[i + 2]!;
      nor[v * 3] = s.normal[0];
      nor[v * 3 + 1] = s.normal[1];
      nor[v * 3 + 2] = s.normal[2];
      surf[v] = si;
      v++;
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nor, 3));
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.setAttribute('aSurf', new BufferAttribute(surf, 1));
  const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  g.setIndex(new BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/** Repaint per vertex colours from one colour per surface (linear RGB). */
export function paintHero(
  g: BufferGeometry,
  surfaces: readonly HeroSurface[],
  colourOf: (s: HeroSurface) => readonly [number, number, number],
): void {
  const col = g.getAttribute('color') as BufferAttribute;
  const surf = g.getAttribute('aSurf') as BufferAttribute;
  const arr = col.array as Float32Array;
  const cache = new Map<number, readonly [number, number, number]>();
  for (let v = 0; v < surf.count; v++) {
    const si = surf.getX(v);
    let c = cache.get(si);
    if (!c) {
      c = colourOf(surfaces[si]!);
      cache.set(si, c);
    }
    arr[v * 3] = c[0];
    arr[v * 3 + 1] = c[1];
    arr[v * 3 + 2] = c[2];
  }
  col.needsUpdate = true;
}

/** Edges of hero walls (ink outline): the boundary edges of each wall's triangles. */
export function heroOutline(surfaces: readonly HeroSurface[]): BufferGeometry {
  const pos: number[] = [];
  const key = (t: number[], i: number): string =>
    `${t[i]!.toFixed(3)},${t[i + 1]!.toFixed(3)},${t[i + 2]!.toFixed(3)}`;
  for (const s of surfaces) {
    if (s.kind !== 'wall') continue;
    const t = s.tris;
    const edges = new Map<string, { n: number; a: number; b: number }>();
    for (let i = 0; i < t.length; i += 9)
      for (const [a, b] of [
        [i, i + 3],
        [i + 3, i + 6],
        [i + 6, i],
      ] as const) {
        const ka = key(t, a);
        const kb = key(t, b);
        const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        const e = edges.get(k);
        if (e) e.n++;
        else edges.set(k, { n: 1, a, b });
      }
    for (const e of edges.values())
      if (e.n === 1) pos.push(t[e.a]!, t[e.a + 1]!, t[e.a + 2]!, t[e.b]!, t[e.b + 1]!, t[e.b + 2]!);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  return g;
}
