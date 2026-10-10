/**
 * A1: every validation dataset is present, schema-valid and has a source and a date. Owner: WP-01.
 */
import { describe, expect, it } from 'vitest';
import epc from '../../../fixtures/src/validation/epc-open-data-sample.json' with { type: 'json' };
import hp from '../../../fixtures/src/validation/hp-field-spf.json' with { type: 'json' };
import india from '../../../fixtures/src/validation/india-ac-homes.json' with { type: 'json' };
import lbnl from '../../../fixtures/src/validation/lbnl-cool-roof.json' with { type: 'json' };
import need from '../../../fixtures/src/validation/need-2025.json' with { type: 'json' };
import pvgis from '../../../fixtures/src/validation/pvgis-pvcalc-6-cities.json' with { type: 'json' };
import { datasetProblems, REQUIRED_DATASETS, type ValidationDataset } from './datasets.ts';

const FILES: Record<string, unknown> = {
  'need-2025': need,
  'epc-open-data-sample': epc,
  'pvgis-pvcalc-6-cities': pvgis,
  'hp-field-spf': hp,
  'india-ac-homes': india,
  'lbnl-cool-roof': lbnl,
};

function load(): Map<string, ValidationDataset> {
  return new Map(Object.entries(FILES).map(([k, v]) => [k, v as ValidationDataset]));
}

describe('A1 validation datasets', () => {
  const sets = load();

  it('every required dataset is present (static imports fail the build if a file is missing)', () => {
    for (const id of REQUIRED_DATASETS) expect(sets.has(id), id).toBe(true);
  });

  it('every dataset is schema-valid with a source and a date', () => {
    for (const [file, d] of sets) expect(datasetProblems(d, file), file).toEqual([]);
  });

  it('only the EPC sample is pending (download needs an account key)', () => {
    const pending = [...sets.values()].filter((d) => d.status === 'pending').map((d) => d.id);
    expect(pending).toEqual(['epc-open-data-sample']);
  });

  it('records the headline values the AC-5 checks use', () => {
    const need = sets.get('need-2025')!.data as {
      medianGasKWh: { englandWales: number };
      medianElecKWh: { englandWales: number };
      measureSavingsMedianPct: { solidWallInsulation: number; cavityPlusLoft: number };
    };
    expect(need.medianGasKWh.englandWales).toBe(10100);
    expect(need.medianElecKWh.englandWales).toBe(2600);
    expect(need.measureSavingsMedianPct).toEqual({ solidWallInsulation: -16, cavityPlusLoft: -9 });
    const pv = sets.get('pvgis-pvcalc-6-cities')!.data as { rows: { city: string; eMKWh: number[] }[] };
    expect(pv.rows.map((r) => r.city)).toEqual(['london', 'manchester', 'edinburgh', 'hyderabad', 'mumbai', 'delhi']);
    for (const r of pv.rows) expect(r.eMKWh).toHaveLength(12);
  });

  it('rejects malformed datasets', () => {
    expect(datasetProblems(null)).not.toEqual([]);
    expect(datasetProblems({ schema: 'ibasho.validation/1', id: 'x', status: 'ready' })).not.toEqual([]);
    const pendingNoMarker = {
      schema: 'ibasho.validation/1',
      id: 'p',
      title: 'Pending set',
      grade: 'primary',
      retrieved: 'pending',
      status: 'pending',
      sources: [{ title: 't', url: 'https://example.org' }],
      data: {},
    };
    expect(datasetProblems(pendingNoMarker)).toContain('a pending dataset must say PLACEHOLDER in its notes');
  });
});
