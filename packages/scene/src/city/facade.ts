/**
 * Facade detail from the building document (round 6): every glazed outdoor segment gets its
 * openings by the window rule (punched windows, or ribbon glazing with mullions when the glazing
 * ratio is high), a head, a projecting sill and jambs as thin card, and the segment's shading rules
 * (overhangs or chajjas, fins, louvres, balconies, light shelves) as paper planes that cast real
 * shadows. Output is instance matrices per storey: three instanced draws per storey at most.
 * Nothing is invented: a segment without shading rules gets no chajja. Owner: WP-07.
 */
import type { BuildingDoc, ShadeRule } from '@ibasho/core';
import { Matrix4, Vector3 } from 'three';
import { planToEN } from './frame.ts';
import { windowRects } from './hero.ts';

export interface FacadeStorey {
  storeyId: string;
  /** Unit plane facing +z, scaled to each pane. */
  glass: Matrix4[];
  /** Unit boxes: heads, sills, jambs, mullions. */
  frame: Matrix4[];
  /** Unit boxes: overhangs, fins, louvres, balconies, shelves. */
  shade: Matrix4[];
  /** Bottom of each frame or shade piece above the storey floor (m), for the cutaway. */
  frameTop: number[];
  shadeTop: number[];
  glassTop: number[];
}

/** Ribbon glazing above this window to wall ratio (per mille); punched windows below it. */
export const RIBBON_WWR_PM = 450;

const tmpU = new Vector3();
const tmpUp = new Vector3(0, 1, 0);
const tmpN = new Vector3();

/** A unit piece placed on a wall: `u` along the wall, `v` up from the floor, `d` out from the face. */
function piece(
  origin: Vector3,
  u: number,
  v: number,
  d: number,
  sx: number,
  sy: number,
  sz: number,
): Matrix4 {
  const m = new Matrix4().makeBasis(tmpU, tmpUp, tmpN);
  m.scale(new Vector3(Math.max(0.005, sx), Math.max(0.005, sy), Math.max(0.005, sz)));
  const p = origin.clone().addScaledVector(tmpU, u).addScaledVector(tmpUp, v).addScaledVector(tmpN, d);
  m.setPosition(p);
  return m;
}

function shadePieces(
  out: FacadeStorey,
  o: Vector3,
  s: ShadeRule,
  r: [number, number, number, number],
  f2f: number,
): void {
  const [u0, u1, v0, v1] = r;
  const w = u1 - u0;
  const uc = (u0 + u1) / 2;
  const h = v1 - v0;
  const push = (m: Matrix4, top: number): void => {
    out.shade.push(m);
    out.shadeTop.push(top);
  };
  switch (s.kind) {
    case 'overhang': {
      const depth = s.depth / 1000;
      const y = Math.min(f2f - 0.05, v1 + s.aboveHead / 1000 + 0.05);
      push(piece(o, uc, y, depth / 2, w + (2 * s.extension) / 1000, 0.08, depth), y);
      break;
    }
    case 'fins': {
      const depth = s.depth / 1000;
      const us: number[] = [];
      if (s.spacing) for (let u = u0; u <= u1 + 1e-6; u += Math.max(0.3, s.spacing / 1000)) us.push(u);
      else {
        if (s.sides !== 'right') us.push(u0 - 0.04);
        if (s.sides !== 'left') us.push(u1 + 0.04);
      }
      for (const u of us) push(piece(o, u, v0 + h / 2, depth / 2, 0.06, h + 0.3, depth), v0);
      break;
    }
    case 'louvres': {
      const depth = s.depth / 1000;
      const step = Math.max(0.1, s.spacing / 1000);
      if (s.axis === 'h')
        for (let v = v0 + step / 2; v < v1; v += step) push(piece(o, uc, v, depth / 2, w, 0.03, depth), v);
      else
        for (let u = u0 + step / 2; u < u1; u += step)
          push(piece(o, u, v0 + h / 2, depth / 2, 0.03, h, depth), v0);
      break;
    }
    case 'light-shelf': {
      const out_ = s.outside / 1000;
      if (out_ > 0) push(piece(o, uc, s.height / 1000, out_ / 2, w, 0.05, out_), s.height / 1000);
      break;
    }
    case 'balcony': {
      const depth = s.depth / 1000;
      push(piece(o, uc, 0.07, depth / 2, w + 1, 0.14, depth), 0);
      if (s.parapet > 0) push(piece(o, uc, s.parapet / 2000, depth, w + 1, s.parapet / 1000, 0.08), 0);
      break;
    }
    case 'screen':
      // Jaali: drawn by the scene as a screen plane later; its porosity is in the model.
      break;
  }
}

/** Facade detail per above grade storey of a document. */
export function facadeOf(doc: BuildingDoc): FacadeStorey[] {
  const out: FacadeStorey[] = [];
  const sorted = [...doc.storeys].sort((a, b) => a.elevation - b.elevation);
  for (const st of sorted) {
    if (st.belowGrade) continue;
    for (let mlt = 0; mlt < Math.max(1, st.multiplier); mlt++) {
      const z0 = (st.elevation + mlt * st.floorToFloor) / 1000;
      const f2f = st.floorToFloor / 1000;
      const fs: FacadeStorey = {
        storeyId: mlt === 0 ? st.id : `${st.id}#${mlt}`,
        glass: [],
        frame: [],
        shade: [],
        frameTop: [],
        shadeTop: [],
        glassTop: [],
      };
      for (const room of st.rooms) {
        const ring = room.floor.outer.map((p) => planToEN(doc, p));
        room.segments.forEach((seg, i) => {
          if (seg.boundary.kind !== 'outdoors') return;
          const p = ring[i]!;
          const q = ring[(i + 1) % ring.length]!;
          const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
          if (len < 0.5) return;
          const ue = (q[0] - p[0]) / len;
          const un = (q[1] - p[1]) / len;
          // World: x east, y up, z south. Along the wall and outward normal (dy, -dx) in EN.
          tmpU.set(ue, 0, -un);
          tmpN.set(un, 0, ue);
          const o = new Vector3(p[0], z0, -p[1]);
          const rule = seg.window;
          const ribbon = rule.kind === 'ratio' && rule.wwrPm >= RIBBON_WWR_PM;
          let rects = windowRects(rule, len, f2f);
          if (ribbon && rects.length) {
            const v0 = rects[0]![2];
            const v1 = rects[0]![3];
            rects = [[0.25, len - 0.25, v0, v1]];
          }
          for (const r of rects) {
            const [u0, u1, v0, v1] = r;
            const w = u1 - u0;
            const h = v1 - v0;
            if (w < 0.1 || h < 0.1) continue;
            const uc = (u0 + u1) / 2;
            const vc = (v0 + v1) / 2;
            fs.glass.push(piece(o, uc, vc, 0.012, w, h, 1));
            fs.glassTop.push(v0);
            const frame = (m: Matrix4, bottom: number): void => {
              fs.frame.push(m);
              fs.frameTop.push(bottom);
            };
            frame(piece(o, uc, v1 + 0.04, 0.05, w + 0.12, 0.08, 0.1), v1);
            frame(piece(o, uc, v0 - 0.03, 0.08, w + 0.24, 0.06, 0.16), v0 - 0.06);
            if (ribbon) {
              const n = Math.max(1, Math.round(w / 1.5));
              for (let k = 0; k <= n; k++) frame(piece(o, u0 + (k * w) / n, vc, 0.03, 0.05, h, 0.06), v0);
            } else {
              frame(piece(o, u0 - 0.03, vc, 0.05, 0.06, h, 0.1), v0);
              frame(piece(o, u1 + 0.03, vc, 0.05, 0.06, h, 0.1), v0);
            }
            for (const s of seg.shading) shadePieces(fs, o, s, r, f2f);
          }
        });
      }
      out.push(fs);
    }
  }
  return out;
}

/** Count of instances in a facade (tests and budgets). */
export function facadeCounts(f: readonly FacadeStorey[]): { glass: number; frame: number; shade: number } {
  return f.reduce(
    (a, s) => ({
      glass: a.glass + s.glass.length,
      frame: a.frame + s.frame.length,
      shade: a.shade + s.shade.length,
    }),
    { glass: 0, frame: 0, shade: 0 },
  );
}
