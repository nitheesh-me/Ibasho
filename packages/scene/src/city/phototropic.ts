/**
 * Moment 6, "the building bends to the sun" (RB 7.2, 7.3): a heliotropic PV canopy over the open
 * courts and skiaphilic fins on the facades that face the low east and west sun. Pure geometry
 * from the hero model and `t`; the numbers beside it come from the optimise stage. Owner: WP-07.
 */
import type { BuildingDoc } from '@ibasho/core';
import { type EN, planToEN, pointInRing } from './frame.ts';
import type { HeroModel, HeroSurface } from './hero.ts';
import type { PhototropicSpec } from './types.ts';

export interface PhototropicGeometry {
  /** Triangles, world metres. */
  canopy: number[];
  fins: number[];
  /** Area of PV canopy, m². */
  canopyM2: number;
  finCount: number;
}

const ease = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));

/** How strongly a facade bearing faces the low morning or afternoon sun (0 north or south, 1 east or west). */
export function lowSunExposure(bearingDeg: number): number {
  return Math.abs(Math.sin((bearingDeg * Math.PI) / 180));
}

/**
 * Canopy panels on a 3 m plan grid over the open cells inside the building's plan box (the
 * courts), tilted by `canopyTiltDeg * t` towards plan +y. Fins every 1.5 m on walls whose low
 * sun exposure is above 0.3, deeper on the east and west.
 */
export function phototropicGeometry(
  doc: BuildingDoc,
  hero: HeroModel,
  spec: PhototropicSpec,
): PhototropicGeometry {
  const t = ease(spec.t);
  const tilt = ((spec.canopyTiltDeg ?? 17) * t * Math.PI) / 180;
  const finDepth = (spec.finDepthM ?? 0.9) * t;
  const canopy: number[] = [];
  const fins: number[] = [];
  let canopyM2 = 0;
  let finCount = 0;
  if (t <= 0.001) return { canopy, fins, canopyM2, finCount };

  // Plan box of the top storey and its rooms (plan mm).
  const top = [...doc.storeys].filter((s) => !s.belowGrade).sort((a, b) => b.elevation - a.elevation)[0];
  if (top?.rooms.length) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const r of top.rooms)
      for (const [x, y] of r.floor.outer) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    const rings = top.rooms.map((r) => r.floor.outer.map(([x, y]) => [x, y] as EN));
    const open = (x: number, y: number): boolean => !rings.some((ring) => pointInRing(x, y, ring));
    const yC = hero.height + 1.6 * t;
    const sl = Math.sin(tilt);
    const cl = Math.cos(tilt);
    // Panels follow the plan grid and tilt towards plan +y (bearing 220 for Vindhya: the
    // afternoon sun), so rows read as one canopy rather than a saw.
    const half = 1400;
    for (let x = x0 + 1500; x < x1 - 1000; x += 3000)
      for (let y = y0 + 1500; y < y1 - 1000; y += 3000) {
        if (!open(x, y)) continue;
        // Keep panels clear of the walls by a metre.
        if (!open(x + 1200, y) || !open(x - 1200, y) || !open(x, y + 1200) || !open(x, y - 1200)) continue;
        const corner = (su: number, sv: number): number[] => {
          // sv = +1 is the low (sun side) edge; the slope rises towards -y.
          const [e, n] = planToEN(doc, [x + su * half, y + sv * half * cl]);
          return [e, yC - sv * (half / 1000) * sl, -n];
        };
        const a = corner(-1, 1);
        const b = corner(1, 1);
        const c = corner(1, -1);
        const d = corner(-1, -1);
        canopy.push(...a, ...b, ...c, ...a, ...c, ...d);
        canopyM2 += (2 * half * 2 * half) / 1e6;
      }
  }

  for (const s of hero.surfaces) {
    if (s.kind !== 'wall') continue;
    const k = lowSunExposure(s.bearingDeg);
    if (k < 0.3) continue;
    finCount += addFins(fins, s, finDepth * (0.5 + 0.5 * k));
  }
  return { canopy, fins, canopyM2, finCount };
}

function addFins(out: number[], s: HeroSurface, depth: number): number {
  const t = s.tris;
  const a = [t[0]!, t[1]!, t[2]!];
  const b = [t[3]!, t[4]!, t[5]!];
  const top = t[7]!;
  const dx = b[0]! - a[0]!;
  const dz = b[2]! - a[2]!;
  const len = Math.hypot(dx, dz);
  const n = Math.max(1, Math.floor(len / 1.5));
  let count = 0;
  for (let i = 1; i < n; i++) {
    const f = i / n;
    const x = a[0]! + dx * f;
    const z = a[2]! + dz * f;
    const ox = x + s.normal[0] * depth;
    const oz = z + s.normal[2] * depth;
    const y0 = a[1]!;
    const y1 = top;
    // Two sided: both windings.
    out.push(x, y0, z, ox, y0, oz, ox, y1, oz, x, y0, z, ox, y1, oz, x, y1, z);
    out.push(x, y0, z, ox, y1, oz, ox, y0, oz, x, y0, z, x, y1, z, ox, y1, oz);
    count++;
  }
  return count;
}
