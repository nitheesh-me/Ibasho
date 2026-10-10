import { describe, expect, it } from 'vitest';
import { MEASURE_MON, MONS, type MonDef } from '../src/mon/set.ts';

/** Every end point of a path, walking M, L, H, V, A and Z (absolute only). */
function points(d: string): { cmds: string[]; pts: [number, number][] } {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const cmds: string[] = [];
  const pts: [number, number][] = [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const t = tokens[i] as string;
    if (/[A-Za-z]/.test(t)) {
      cmd = t;
      cmds.push(cmd);
      i++;
      if (cmd === 'Z' || cmd === 'z') continue;
    }
    switch (cmd) {
      case 'M':
      case 'L':
        x = num();
        y = num();
        break;
      case 'H':
        x = num();
        break;
      case 'V':
        y = num();
        break;
      case 'A':
        i += 5;
        x = num();
        y = num();
        break;
      default:
        throw new Error(`unexpected command ${cmd}`);
    }
    pts.push([x, y]);
  }
  return { cmds, pts };
}

describe('Mon set (DESIGN_SYSTEM 7)', () => {
  const entries = Object.entries(MONS) as [string, MonDef][];

  it('uses only M, L, H, V, A and Z, with no Beziers', () => {
    for (const [id, def] of entries) {
      for (const p of def.paths) {
        for (const c of points(p.d).cmds) expect('MLHVAZ', `${id} uses ${c}`).toContain(c);
      }
    }
  });

  it('keeps every motif inside the outer circle', () => {
    for (const [id, def] of entries) {
      for (const p of def.paths) {
        for (const [x, y] of points(p.d).pts) {
          expect(Math.hypot(x - 12, y - 12), `${id} at ${x},${y}`).toBeLessThanOrEqual(11);
        }
      }
      for (const c of def.circles ?? []) {
        expect(Math.hypot(c.cx - 12, c.cy - 12) + c.r, `${id} circle`).toBeLessThanOrEqual(11);
      }
    }
  });

  it('names every crest and maps every measure to a real crest', () => {
    for (const [, def] of entries) expect(def.title.length).toBeGreaterThan(0);
    for (const mon of Object.values(MEASURE_MON)) expect(Object.hasOwn(MONS, mon)).toBe(true);
  });
});
