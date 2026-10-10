/**
 * `noise()` fast path from the twin's site geometry (WP-03 M-B, C6).
 */
import type { AshpUnit, HomeTwin } from '@ibasho/core';
import { parseTwin } from '@ibasho/core/schemas';
import { describe, expect, it } from 'vitest';
import gh1Json from '../../../fixtures/src/homes/gh1.twin.json' with { type: 'json' };
import { decodeNoiseSites } from './fns/noise.ts';
import { barrierBetween, noise, noiseFact, reflectingSurfaces } from './fns/noise-site.ts';

const gh1 = parseTwin(gh1Json);
/** The host clock (Node and browsers); the engine tsconfig has no DOM or Node types. */
const perf = (globalThis as unknown as { performance: { now(): number } }).performance;

/** GH1 with a rear garden: a brick wall 1.8 m high at z = 14, neighbours behind it and to the side. */
function withSite(): HomeTwin {
  const neighbours = [0, 1, 2, 3, 4, 5].map((i) => ({
    id: `nb-${i}`,
    position: [-4 + 2 * i, 1.5 + (i % 2) * 2.5, 22] as [number, number, number],
    kind: 'window' as const,
    habitable: true as const,
  }));
  return {
    ...gh1,
    site: {
      ...gh1.site,
      neighbours,
      boundaries: [
        {
          id: 'b-rear',
          path: [
            [-6, 14],
            [6, 14],
          ],
          kind: 'wall',
          heightM: 1.8,
        },
      ],
    },
  };
}
const units: AshpUnit[] = [
  { id: 'u1', lwa: 58, position: [1, 0.45, 12], mount: 'ground' },
  { id: 'u2', lwa: 58, position: [-1, 0.45, 12], mount: 'ground' },
];

describe('noise() from geometry', () => {
  it('unknown neighbours give unknown, never a pass', () => {
    expect(noise({ twin: gh1, units }).ok).toBe('unknown');
    expect(noiseFact(gh1, units)).toBe('unknown');
  });
  it('a 1.8 m brick wall between unit and window is a type 1 barrier', () => {
    const t = withSite();
    expect(barrierBetween(t, units[0]!, [1, 1.5, 22])).toEqual({ type: 1, view: 'hidden' });
    expect(reflectingSurfaces(t, units[0]!)).toBe(1);
  });
  it('decides every position and encodes the fact', () => {
    const t = withSite();
    const r = noise({ twin: t, units });
    expect(r.positions).toHaveLength(6);
    expect(r.ok).toBe(true);
    const sites = decodeNoiseSites(noiseFact(t, units) as string);
    expect(sites).toHaveLength(6);
    expect(sites![0]).toHaveLength(2);
  });
  it('C6: p95 under 5 ms for 2 units x 6 positions', () => {
    const t = withSite();
    for (let i = 0; i < 20; i++) noise({ twin: t, units });
    const times: number[] = [];
    for (let i = 0; i < 200; i++) {
      const t0 = perf.now();
      noise({ twin: t, units });
      times.push(perf.now() - t0);
    }
    times.sort((a, b) => a - b);
    expect(times[Math.floor(times.length * 0.95)]!).toBeLessThan(5);
  });
});
