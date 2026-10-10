/**
 * Heat-flow motes (SV 3.2, DESIGN_SYSTEM 10 honesty rule: one mote is 10 W). Owner: WP-07.
 * Pure: turns scene quantities and the house model into mote seeds. The shader animates them;
 * the count never changes with animation, so the legend stays true in every frame.
 */
import type { Vec2, Vec3 } from '@ibasho/core';
import { xoshiro128ss } from '@ibasho/core';
import { type SceneQuantities, WATTS_PER_MOTE } from '../quantities/types.ts';
import { bounds2, fromPlane, newellNormal, planeFrame, pointInRing, toPlane } from '../twin/frame.ts';
import type { HouseModel, Surface } from '../twin/house.ts';

export interface MoteSource {
  /** Element, junction or leak the motes belong to (evidence and highlight). */
  key: string;
  elementId?: string;
  junctionId?: string;
  kind: 'fabric' | 'junction' | 'leak';
  watts: number;
  count: number;
  /** Loss density for colour, W/m2 (fabric) or W/m (junction). */
  density: number;
}

export interface MoteField {
  sources: MoteSource[];
  /** xyz per mote. */
  origins: Float32Array;
  /** Unit drift direction per mote. */
  dirs: Float32Array;
  /** Phase in [0, 1), speed factor, colour t, source index. */
  params: Float32Array;
  count: number;
}

export function moteCount(watts: number): number {
  return watts > 0 ? Math.round(watts / WATTS_PER_MOTE) : 0;
}

/** Loss density to a Netsu t in [0.3, 1]: warmer motes where more heat leaves per m2. */
export function densityToT(density: number, kind: MoteSource['kind']): number {
  const ref = kind === 'junction' ? 8 : 60;
  return 0.3 + 0.7 * Math.min(1, Math.max(0, density / ref));
}

function sampler(poly: Vec3[], holes: Vec3[][]) {
  const f = planeFrame(poly);
  const outer = poly.map((p) => toPlane(f, p));
  const hs = holes.map((h) => h.map((p) => toPlane(f, p)));
  const b = bounds2(outer);
  return (r: () => number): Vec3 => {
    for (let k = 0; k < 64; k++) {
      const q: Vec2 = [b.min[0] + (b.max[0] - b.min[0]) * r(), b.min[1] + (b.max[1] - b.min[1]) * r()];
      if (pointInRing(q, outer) && !hs.some((h) => pointInRing(q, h))) return fromPlane(f, q, 0.02);
    }
    return fromPlane(f, [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2], 0.02);
  };
}

export function buildMotes(house: HouseModel, q: SceneQuantities, seed = house.twinId): MoteField {
  const sources: MoteSource[] = [];
  const origins: number[] = [];
  const dirs: number[] = [];
  const params: number[] = [];
  const surfaceOf = new Map<string, Surface>();
  for (const s of house.surfaces) {
    if (s.elementId && !surfaceOf.has(s.elementId) && s.role !== 'gable' && s.role !== 'roof-slope') {
      surfaceOf.set(s.elementId, s);
    }
  }
  const openingOf = new Map(house.openings.map((o) => [o.elementId, o]));

  const emit = (src: MoteSource, place: (r: () => number) => { p: Vec3; d: Vec3 }): void => {
    const idx = sources.length;
    sources.push(src);
    const r = xoshiro128ss(`${seed}:${src.key}`);
    const rf = (): number => r.nextFloat();
    const t = densityToT(src.density, src.kind);
    for (let i = 0; i < src.count; i++) {
      const { p, d } = place(rf);
      origins.push(p[0], p[1], p[2]);
      dirs.push(d[0], d[1], d[2]);
      params.push(rf(), 0.75 + 0.5 * rf(), t, idx);
    }
  };

  for (const e of q.elements) {
    const count = moteCount(e.watts);
    if (count === 0) continue;
    const s = surfaceOf.get(e.elementId);
    const o = openingOf.get(e.elementId);
    const poly = o ? o.polygon : s?.polygon;
    if (!poly) continue;
    const n = newellNormal(poly);
    const sample = sampler(poly, o ? [] : (s?.holes ?? []));
    emit(
      {
        key: `el:${e.elementId}`,
        elementId: e.elementId,
        kind: 'fabric',
        watts: e.watts,
        count,
        density: e.areaM2 > 0 ? e.watts / e.areaM2 : 0,
      },
      (r) => ({ p: sample(r), d: n }),
    );
  }

  const lineOf = new Map(house.junctions.map((j) => [j.junctionId, j]));
  for (const j of q.junctions) {
    const count = moteCount(j.watts);
    const line = lineOf.get(j.junctionId);
    if (count === 0 || !line || line.path.length < 2) continue;
    const host = line.elementIds.map((id) => surfaceOf.get(id)).find((s) => s && s.role === 'wall');
    const n: Vec3 = host ? host.frame.n : [0, 0, -1];
    emit(
      {
        key: `jn:${j.junctionId}`,
        junctionId: j.junctionId,
        kind: 'junction',
        watts: j.watts,
        count,
        density: j.wPerM,
      },
      (r) => {
        const a = line.path[0]!;
        const b = line.path[line.path.length - 1]!;
        const k = r();
        return {
          p: [
            a[0] + (b[0] - a[0]) * k + n[0] * 0.03,
            a[1] + (b[1] - a[1]) * k,
            a[2] + (b[2] - a[2]) * k + n[2] * 0.03,
          ],
          d: n,
        };
      },
    );
  }

  q.leaks.forEach((l, i) => {
    const count = moteCount(l.watts);
    if (count === 0) return;
    if (l.kind === 'chimney') {
      const c = house.chimneys[0];
      if (!c) return;
      const top: Vec3 = [c.base[0], c.base[1] + c.size[1] + 0.1, c.base[2]];
      emit(
        {
          key: `leak:${i}`,
          kind: 'leak',
          watts: l.watts,
          count,
          density: 60,
          ...(c.elementId ? { elementId: c.elementId } : {}),
        },
        (r) => ({
          p: [top[0] + (r() - 0.5) * 0.3, top[1], top[2] + (r() - 0.5) * 0.3],
          d: [0, 1, 0],
        }),
      );
      return;
    }
    const o = l.elementId ? openingOf.get(l.elementId) : undefined;
    if (!o) return;
    const n = o.frame.n;
    emit(
      { key: `leak:${i}`, kind: 'leak', watts: l.watts, count, density: 40, elementId: o.elementId },
      (r) => {
        // On the frame edge: pick a side, then a point along it.
        const side = Math.floor(r() * 4);
        const k = r();
        const u = side === 0 ? k * o.width : side === 1 ? o.width : side === 2 ? (1 - k) * o.width : 0;
        const v = side === 0 ? 0 : side === 1 ? k * o.height : side === 2 ? o.height : (1 - k) * o.height;
        const p = fromPlane(o.frame, [u, v], 0.03);
        return { p, d: n };
      },
    );
  });

  return {
    sources,
    origins: new Float32Array(origins),
    dirs: new Float32Array(dirs),
    params: new Float32Array(params),
    count: origins.length / 3,
  };
}
