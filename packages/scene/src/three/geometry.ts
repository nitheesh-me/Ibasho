/**
 * three.js geometry from the house model. Owner: WP-07.
 * Each surface is its planar polygon (with holes) extruded by its thickness along the outward
 * normal, regrouped into outer face, inner face and edges so walls get brick outside and
 * plaster inside from one mesh.
 */
import type { Vec3 } from '@ibasho/core';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  ExtrudeGeometry,
  Matrix4,
  Path,
  Shape,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PlaneFrame } from '../twin/frame.ts';
import type { Opening, Stairs, Surface } from '../twin/house.ts';
import { surfaceRing2 } from '../twin/house.ts';

/** Group indices after `regroupByNormal`. */
export const G_OUTER = 0;
export const G_INNER = 1;
export const G_EDGE = 2;

export function frameMatrix(f: PlaneFrame, offset = 0): Matrix4 {
  const m = new Matrix4();
  m.makeBasis(new Vector3(...f.u), new Vector3(...f.v), new Vector3(...f.n));
  m.setPosition(f.origin[0] + f.n[0] * offset, f.origin[1] + f.n[1] * offset, f.origin[2] + f.n[2] * offset);
  return m;
}

/**
 * Sort a non-indexed geometry's triangles into three groups by local normal z: outer (+z),
 * inner (-z), edges (the rest).
 */
export function regroupByNormal(g: BufferGeometry): BufferGeometry {
  const src = g.index ? g.toNonIndexed() : g;
  const pos = src.getAttribute('position');
  const uv = src.getAttribute('uv');
  const tris = pos.count / 3;
  const buckets: number[][] = [[], [], []];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let t = 0; t < tris; t++) {
    a.fromBufferAttribute(pos, t * 3);
    b.fromBufferAttribute(pos, t * 3 + 1);
    c.fromBufferAttribute(pos, t * 3 + 2);
    const n = b.sub(a).cross(c.sub(a)).normalize();
    buckets[n.z > 0.5 ? G_OUTER : n.z < -0.5 ? G_INNER : G_EDGE]!.push(t);
  }
  const outPos = new Float32Array(pos.count * 3);
  const outUv = uv ? new Float32Array(uv.count * 2) : undefined;
  const out = new BufferGeometry();
  let cursor = 0;
  buckets.forEach((list, gi) => {
    const start = cursor;
    for (const t of list) {
      for (let k = 0; k < 3; k++) {
        const v = t * 3 + k;
        outPos[cursor * 3] = pos.getX(v);
        outPos[cursor * 3 + 1] = pos.getY(v);
        outPos[cursor * 3 + 2] = pos.getZ(v);
        if (outUv && uv) {
          outUv[cursor * 2] = uv.getX(v);
          outUv[cursor * 2 + 1] = uv.getY(v);
        }
        cursor++;
      }
    }
    out.addGroup(start, cursor - start, gi);
  });
  out.setAttribute('position', new BufferAttribute(outPos, 3));
  if (outUv) out.setAttribute('uv', new BufferAttribute(outUv, 2));
  out.computeVertexNormals();
  return out;
}

function shapeOf(outer: [number, number][], holes: [number, number][][]): Shape {
  const s = new Shape(outer.map(([x, y]) => new Vector2(x, y)));
  for (const h of holes) s.holes.push(new Path(h.map(([x, y]) => new Vector2(x, y))));
  return s;
}

/** Extruded, regrouped, world-space geometry for one surface. */
export function surfaceGeometry(s: Surface): BufferGeometry {
  const { outer, holes } = surfaceRing2(s);
  const shape = shapeOf(outer, holes);
  const depth = Math.max(0.005, s.thickness);
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1, curveSegments: 1 });
  const z0 = s.extrude === 'in' ? -depth : s.extrude === 'out' ? 0 : -depth / 2;
  g.translate(0, 0, z0);
  const r = regroupByNormal(g);
  g.dispose();
  r.applyMatrix4(frameMatrix(s.frame));
  r.computeVertexNormals();
  r.computeBoundingSphere();
  return r;
}

/** A flat cap of a surface (for lens and tint overlays), nudged along the normal. */
export function surfaceCap(s: Surface, nudge: number, side: 'outer' | 'inner' = 'inner'): BufferGeometry {
  const { outer, holes } = surfaceRing2(s);
  const shape = shapeOf(outer, holes);
  const g = new ExtrudeGeometry(shape, { depth: 0.0001, bevelEnabled: false, steps: 1, curveSegments: 1 });
  const r = regroupByNormal(g);
  g.dispose();
  const grp = r.groups[side === 'outer' ? G_OUTER : G_INNER]!;
  const pos = r.getAttribute('position');
  const cap = new BufferGeometry();
  const arr = new Float32Array(grp.count * 3);
  for (let i = 0; i < grp.count; i++) {
    arr[i * 3] = pos.getX(grp.start + i);
    arr[i * 3 + 1] = pos.getY(grp.start + i);
    arr[i * 3 + 2] = pos.getZ(grp.start + i);
  }
  cap.setAttribute('position', new BufferAttribute(arr, 3));
  const t = s.thickness;
  const faceZ =
    side === 'outer'
      ? s.extrude === 'out'
        ? t
        : s.extrude === 'centre'
          ? t / 2
          : 0
      : s.extrude === 'in'
        ? -t
        : s.extrude === 'centre'
          ? -t / 2
          : 0;
  cap.translate(0, 0, faceZ + (side === 'outer' ? nudge : -nudge));
  cap.applyMatrix4(frameMatrix(s.frame));
  cap.computeVertexNormals();
  r.dispose();
  return cap;
}

/** Window or door parts, in world space. */
export interface OpeningParts {
  frame: BufferGeometry;
  glass?: BufferGeometry;
  sill?: BufferGeometry;
  lintel: BufferGeometry;
  leaf?: BufferGeometry;
}

function boxAt(w: number, h: number, d: number, cx: number, cy: number, cz: number): BufferGeometry {
  const b = new BoxGeometry(w, h, d);
  b.translate(cx, cy, cz);
  return b.toNonIndexed();
}

export function openingParts(o: Opening): OpeningParts {
  const m = frameMatrix(o.frame);
  const W = o.width;
  const H = o.height;
  const recess = Math.min(0.11, o.reveal * 0.45);
  const fz = -recess;
  const bar = 0.055;
  const fd = 0.07;
  const frames: BufferGeometry[] = [
    boxAt(W, bar, fd, W / 2, H - bar / 2, fz),
    boxAt(bar, H, fd, bar / 2, H / 2, fz),
    boxAt(bar, H, fd, W - bar / 2, H / 2, fz),
  ];
  if (o.kind === 'window') {
    frames.push(boxAt(W, bar, fd, W / 2, bar / 2, fz));
    // Sash meeting rail and glazing bars (two over two for single glazing, plain for double).
    frames.push(boxAt(W, bar * 0.8, fd * 0.9, W / 2, H * 0.52, fz + 0.01));
    if (o.glazing === 'single') {
      frames.push(boxAt(bar * 0.45, H, fd * 0.6, W / 2, H / 2, fz + 0.012));
    }
  }
  const frame = mergeGeometries(frames)!;
  frame.applyMatrix4(m);
  const parts: OpeningParts = { frame, lintel: lintelOf(o, m) };
  if (o.kind === 'window') {
    const glass = boxAt(W - bar * 2, H - bar * 2, 0.01, W / 2, H / 2, fz - 0.005);
    glass.applyMatrix4(m);
    parts.glass = glass;
    const sill = boxAt(W + 0.12, 0.06, recess + 0.07, W / 2, -0.03, -recess / 2 + 0.035);
    sill.applyMatrix4(m);
    parts.sill = sill;
  } else {
    const leaf = mergeGeometries([
      boxAt(W - bar * 2, H * 0.78 - bar, 0.05, W / 2, (H * 0.78 - bar) / 2, fz - 0.01),
      // Fanlight frame bar above the leaf.
      boxAt(W - bar * 2, bar, 0.05, W / 2, H * 0.78, fz - 0.01),
    ])!;
    leaf.applyMatrix4(m);
    parts.leaf = leaf;
    const glass = boxAt(W - bar * 2, H * 0.22 - bar * 1.5, 0.01, W / 2, H * 0.89, fz - 0.012);
    glass.applyMatrix4(m);
    parts.glass = glass;
  }
  return parts;
}

function lintelOf(o: Opening, m: Matrix4): BufferGeometry {
  // Gauged brick or stone lintel, a touch proud of the face.
  const g = boxAt(o.width + 0.22, 0.16, 0.04, o.width / 2, o.height + 0.08, 0.012);
  g.applyMatrix4(m);
  return g;
}

export function stairsGeometry(s: Stairs): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const side: Vec3 = s.across;
  for (let i = 0; i < s.risers - 1; i++) {
    const h = s.rise * (i + 1);
    const along = s.going * i + s.going / 2;
    const cx = s.start[0] + s.dir[0] * along + side[0] * (s.width / 2);
    const cz = s.start[2] + s.dir[2] * along + side[2] * (s.width / 2);
    const sx = Math.abs(s.dir[0]) > 0.5 ? s.going : s.width;
    const sz = Math.abs(s.dir[0]) > 0.5 ? s.width : s.going;
    parts.push(boxAt(sx, h, sz, cx, h / 2, cz));
  }
  const g = mergeGeometries(parts)!;
  g.computeVertexNormals();
  return g;
}
