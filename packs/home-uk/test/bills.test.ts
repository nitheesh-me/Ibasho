/**
 * GH1 bill fixtures (M-0 step 1, inputs to calibration AC-C3 at M-B). Owner: WP-01.
 *
 * `packages/fixtures/src/bills/gh1-bills-{low,high}.json` are `MeterData`: twelve monthly gas and
 * electricity bill readings (kWh, October 2025 to September 2026, inclusive dates). They were
 * generated from the GH1 `your-home` model months: gas x 0.75 (low) and x 1.35 (high), electricity
 * x 1.0, rounded to whole kWh. A calibration fit must therefore pull demand down for `low` and up
 * for `high`. This test keeps the fixtures schema-valid and on the right side of the model as the
 * physics evolves (bands, not exact values).
 */
import { DAYS_IN_MONTH, type MeterData, type MeterSeries, sumBig } from '@ibasho/core';
import { MeterDataSchema, parseTwin } from '@ibasho/core/schemas';
import { describe, expect, it } from 'vitest';
import { simulate } from '../../../packages/engine/src/pipeline/index.ts';
import highJson from '../../../packages/fixtures/src/bills/gh1-bills-high.json' with { type: 'json' };
import lowJson from '../../../packages/fixtures/src/bills/gh1-bills-low.json' with { type: 'json' };
import gh1Json from '../../../packages/fixtures/src/homes/gh1.twin.json' with { type: 'json' };
import { londonClimate } from '../../../packs/climate/src/engine/index.ts';
import { M0_MEASURES, UK_SYSTEMS } from '../src/engine/index.ts';

const model = simulate(
  { twin: parseTwin(gh1Json), mode: 'your-home', asOf: '2026-10-11' },
  { climate: londonClimate, measures: M0_MEASURES, systems: UK_SYSTEMS },
).result;
const modelKWh = (fuel: 'gas' | 'electricity') => Number(sumBig(model.deliveredWh[fuel])) / 1000;

function series(d: MeterData, fuel: 'gas' | 'electricity'): MeterSeries {
  const s = d.series.find((x) => x.fuel === fuel);
  if (!s) throw new Error(`no ${fuel} series`);
  return s;
}
const total = (s: MeterSeries) => s.periods.reduce((a, p) => a + p.value, 0);

describe.each([
  ['low', lowJson, [0.65, 0.85]],
  ['high', highJson, [1.2, 1.5]],
] as const)('gh1-bills-%s', (_name, json, [lo, hi]) => {
  const bills = MeterDataSchema.parse(json);

  it('is schema-valid MeterData with 12 contiguous monthly kWh bills per fuel', () => {
    for (const fuel of ['gas', 'electricity'] as const) {
      const s = series(bills, fuel);
      expect(s.quality).toBe('kwh');
      expect(s.source).toEqual({ kind: 'measured', how: 'bill' });
      expect(s.periods).toHaveLength(12);
      s.periods.forEach((p, i) => {
        expect(p.unit).toBe('kWh');
        expect(Number.isInteger(p.value) && p.value > 0).toBe(true);
        const month = Number(p.from.slice(5, 7)) - 1;
        expect(p.from.slice(8)).toBe('01');
        expect(Number(p.to.slice(8))).toBe(DAYS_IN_MONTH[month]);
        if (i > 0) expect(p.from > s.periods[i - 1]!.to).toBe(true);
      });
    }
  });

  it('sits on the intended side of the M-0 model (gas ratio band, electricity near 1)', () => {
    const gasRatio = total(series(bills, 'gas')) / modelKWh('gas');
    expect(gasRatio).toBeGreaterThan(lo);
    expect(gasRatio).toBeLessThan(hi);
    const elecRatio = total(series(bills, 'electricity')) / modelKWh('electricity');
    expect(Math.abs(elecRatio - 1)).toBeLessThan(0.1);
  });
});
