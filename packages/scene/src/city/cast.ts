/**
 * Moment 7, "the shadow you cast" (PLAN-V3 6, QA M12): winter sun hours each neighbour's facades
 * lose when the hero gains floors. A preview ray test on facade sample points at 10 minute steps on
 * 21 December, against the city's casters with the hero at its height and then raised. Never a
 * certificate number (the shading ledger in the site stage is canonical). Owner: WP-07.
 */
import type { EN } from './frame.ts';
import type { HeroModel } from './hero.ts';
import { blockedBy, blockersOf } from './preview.ts';
import type { Caster } from './shadow.ts';
import { dayWindow, sunOf } from './sun.ts';

export interface CastLoss {
  id: string;
  name?: string;
  /** Mean direct sun hours a day lost on its facades (21 December). */
  lostHours: number;
  /** Facade points that lost any sun. */
  points: number;
}

export interface CastReceiver {
  id: string;
  name?: string;
  ring: EN[];
  height: number;
}

/** Losses, largest first, for receivers within `radius` m of the hero. */
export function castLosses(opts: {
  hero: HeroModel;
  /** Context casters only (the hero's prisms are added here). */
  context: readonly Caster[];
  receivers: readonly CastReceiver[];
  addedM: number;
  place: { lat: number; lon: number; tzHours?: number };
  date?: string;
  radius?: number;
}): CastLoss[] {
  const { hero, addedM, place } = opts;
  const date = opts.date ?? '2026-12-21';
  const radius = opts.radius ?? 260;
  const hc: EN = [(hero.box.minE + hero.box.maxE) / 2, (hero.box.minN + hero.box.maxN) / 2];
  const heroCasters = hero.prisms.map((p) => ({ id: p.id, ring: p.ring, z1: p.z1 }));
  const raised = hero.prisms.map((p) => ({ id: p.id, ring: p.ring, z1: p.z1 + addedM }));
  const base = blockersOf([...opts.context, ...heroCasters]);
  const plus = blockersOf([...opts.context, ...raised]);
  const w = dayWindow(date, place.lat, place.lon, place.tzHours);
  const suns: [number, number, number][] = [];
  for (let m = w.rise + 5; m < w.set; m += 10) {
    const s = sunOf({ date, minutes: m }, place.lat, place.lon, place.tzHours);
    if (s.altitudeDeg > 1) suns.push(s.dir);
  }
  const out: CastLoss[] = [];
  for (const r of opts.receivers) {
    const c = r.ring.reduce<EN>((a, p) => [a[0] + p[0] / r.ring.length, a[1] + p[1] / r.ring.length], [0, 0]);
    if (Math.hypot(c[0] - hc[0], c[1] - hc[1]) > radius) continue;
    let lost = 0;
    let n = 0;
    let hit = 0;
    for (let i = 0; i < r.ring.length; i++) {
      const a = r.ring[i]!;
      const b = r.ring[(i + 1) % r.ring.length]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 4) continue;
      const ne = (b[1] - a[1]) / len;
      const nn = -(b[0] - a[0]) / len;
      const o: [number, number, number] = [
        (a[0] + b[0]) / 2 + ne * 0.5,
        (a[1] + b[1]) / 2 + nn * 0.5,
        Math.min(r.height * 0.5, 6),
      ];
      let d = 0;
      for (const s of suns) {
        if (ne * s[0] + nn * -s[2] <= 0) continue;
        if (!blockedBy(o, s, base) && blockedBy(o, s, plus)) d++;
      }
      n++;
      if (d) hit++;
      lost += (d * 10) / 60;
    }
    if (n && lost > 0)
      out.push({ id: r.id, ...(r.name ? { name: r.name } : {}), lostHours: lost / n, points: hit });
  }
  return out.sort((x, y) => y.lostHours - x.lostHours);
}
