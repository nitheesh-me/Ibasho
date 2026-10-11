/** Design before you build (SPEC 27): placement maths and the site check. */
import { describe, expect, it } from 'vitest';
import type { EN } from '../src/city/frame.ts';
import { heroFromDoc } from '../src/city/hero.ts';
import { cityModel } from '../src/city/model.ts';
import {
  applyPlacement,
  movePlacement,
  placementCheck,
  placementOf,
  ringsOverlap,
} from '../src/city/placement.ts';
import { ringCentre } from '../src/city/sceneParts.ts';
import { vindhyaStandIn } from '../src/city/vindhya.ts';

const sq = (e: number, n: number, s: number): EN[] => [
  [e, n],
  [e + s, n],
  [e + s, n + s],
  [e, n + s],
];

describe('placement', () => {
  it('a full turn and back is the identity, and a move translates the origin', () => {
    const p = { origin: { x: 10_000, y: 20_000 }, rotationMdeg: 40_000 };
    const pivot: EN = [50, 60];
    const turned = movePlacement(movePlacement(p, pivot, [0, 0], 90), pivot, [0, 0], -90);
    expect(Math.abs(turned.origin.x - p.origin.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(turned.origin.y - p.origin.y)).toBeLessThanOrEqual(1);
    expect(turned.rotationMdeg).toBe(40_000);
    const moved = movePlacement(p, pivot, [5, -3], 0);
    expect(moved.origin).toEqual({ x: 15_000, y: 17_000 });
  });

  it('turning about the building centre keeps the centre in place', () => {
    const doc = vindhyaStandIn();
    const c0 = ringCentre(heroFromDoc(doc).prisms.flatMap((x) => x.ring)).c;
    const next = movePlacement(placementOf(doc), c0, [0, 0], 33);
    const c1 = ringCentre(heroFromDoc(applyPlacement(doc, next)).prisms.flatMap((x) => x.ring)).c;
    expect(Math.hypot(c1[0] - c0[0], c1[1] - c0[1])).toBeLessThan(2);
    expect(next.rotationMdeg).toBe(doc.rotationMdeg + 33_000);
  });

  it('detects overlapping rings and ignores separate ones', () => {
    expect(ringsOverlap(sq(0, 0, 10), sq(5, 5, 10))).toBe(true);
    expect(ringsOverlap(sq(0, 0, 10), sq(20, 0, 10))).toBe(false);
    // Crossing without a vertex inside (a plus shape).
    expect(
      ringsOverlap(
        [
          [-1, 4],
          [11, 4],
          [11, 6],
          [-1, 6],
        ],
        [
          [4, -1],
          [6, -1],
          [6, 11],
          [4, 11],
        ],
      ),
    ).toBe(true);
  });

  it('flags a building dropped onto a neighbour, and finds who shades it', () => {
    const doc = vindhyaStandIn();
    const free = cityModel({ hero: doc });
    expect(placementCheck(free.hero!, free.masses, free.place).free).toBe(true);
    // Move the centre onto the first named neighbour.
    const target = free.masses.find((m) => m.name)!;
    const c0 = ringCentre(free.hero!.prisms.flatMap((x) => x.ring)).c;
    const tc = ringCentre(target.ring).c;
    const moved = cityModel({
      hero: applyPlacement(doc, movePlacement(placementOf(doc), c0, [tc[0] - c0[0], tc[1] - c0[1]], 0)),
    });
    const check = placementCheck(moved.hero!, moved.masses, moved.place);
    expect(check.free).toBe(false);
    expect(check.overlaps).toContain(target.id);
    for (const s of check.shading) expect(check.overlaps).not.toContain(s.id);
  });
});
