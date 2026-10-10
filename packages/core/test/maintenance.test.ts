import { describe, expect, it } from 'vitest';
import { Q } from '../src/exact/q.ts';
import type { MaintenancePlugin } from '../src/maintenance.ts';
import { checkMaintenance, checkPlugin, createRegistry, RegistryError } from '../src/plugin/registry.ts';
import { NUMERIC_PLUGIN_KINDS } from '../src/plugin/types.ts';

const boiler = (extra: Partial<MaintenancePlugin> = {}): MaintenancePlugin => ({
  kind: 'maintenance',
  id: 'decay-boiler-unserviced',
  version: '0.1.0',
  title: 'maintenance.boiler.title',
  side: 'engine',
  ages: { kind: 'system', category: 'boiler' },
  neglect: 'maintenance.boiler.neglect',
  effects: [
    {
      param: '/systems/space/efficiency',
      unit: '1',
      rate: { form: 'relative', ppbPerYear: { lo: -15_000_000n, mid: -10_000_000n, hi: -5_000_000n } },
      clamp: { min: Q.of(60, 100) },
      quantity: 'sys.efficiency.space',
      explain: 'maintenance.boiler.efficiency',
    },
  ],
  endOfLife: { ageYears: { lo: 12, mid: 15, hi: 20 }, explain: 'maintenance.boiler.eol' },
  provenance: {
    sources: [{ id: 'test-source', title: 'Test source', retrieved: '2026-10-01' }],
    lastChecked: '2026-10-01',
    grade: 'estimate',
  },
  ...extra,
});

describe('maintenance plugin kind (SPEC 14)', () => {
  it('is numeric, so provenance is required', () => {
    expect(NUMERIC_PLUGIN_KINDS.has('maintenance')).toBe(true);
    const { provenance: _drop, ...rest } = boiler();
    const issues = checkPlugin(rest as unknown as MaintenancePlugin);
    expect(issues.map((i) => i.check)).toContain('provenance');
  });

  it('accepts a well formed decay model and registers it', () => {
    expect(checkMaintenance(boiler())).toEqual([]);
    const r = createRegistry();
    r.registerAll([boiler()]);
    expect(r.all('maintenance').map((p) => p.id)).toEqual(['decay-boiler-unserviced']);
  });

  it('rejects unordered ranges, bad pointers and empty models', () => {
    const bad = boiler({
      ages: { kind: 'measure', measureId: '' },
      effects: [
        {
          param: 'systems/space/efficiency',
          unit: '1',
          rate: { form: 'absolute', perYear: { lo: Q.of(1, 10), mid: Q.ZERO, hi: Q.ONE } },
          onsetYears: -1,
          clamp: { min: Q.ONE, max: Q.ZERO },
          quantity: 'q',
          explain: 'x',
        },
      ],
      endOfLife: { ageYears: { lo: 0, mid: 15, hi: 10 }, explain: 'x' },
    });
    expect(checkMaintenance(bad)).toHaveLength(6);
    expect(() => createRegistry().registerAll([bad])).toThrow(RegistryError);
    expect(checkMaintenance(boiler({ effects: [], endOfLife: undefined as never }))).toEqual([
      'no effects and no end of life',
    ]);
  });
});
