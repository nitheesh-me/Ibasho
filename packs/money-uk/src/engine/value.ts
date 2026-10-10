/**
 * Property value evidence (SF 4.2, SPEC R16). Owner: WP-02.
 *
 * `value-uk-oo-v1`: owner-occupier index relative to band D, percent, low / central / high
 * (SF 4.2 table). Uplift for a move from b0 to b1 is `(1 + P(b1)) / (1 + P(b0)) - 1` per column,
 * as an exact rational fraction of current value. Bands A and B share the A/B row. A move inside
 * one row returns null ("no measurable value effect expected", SF 4.3 rule 2). Never added to NPV
 * (SF D6). Graded `secondary`: the table is a synthesis of studies that disagree (SF 4.1).
 */
import { type Band, Q, type ValueEvidencePlugin } from '@ibasho/core';
import { provenance, SF_4_2 } from './sources.ts';

type Row = 'AB' | 'C' | 'D' | 'E' | 'F' | 'G';
/** Percent strings, SF 4.2. */
export const VALUE_TABLE_V1: Readonly<Record<Row, { low: string; central: string; high: string }>> = {
  AB: { low: '1.6', central: '3.5', high: '10.0' },
  C: { low: '0.0', central: '1.0', high: '3.5' },
  D: { low: '0', central: '0', high: '0' },
  E: { low: '0.0', central: '-1.0', high: '-4.0' },
  F: { low: '-1.4', central: '-3.0', high: '-12.0' },
  G: { low: '-1.4', central: '-5.0', high: '-15.0' },
};

const rowOf = (b: Band): Row => (b === 'A' || b === 'B' ? 'AB' : b);
const index = (pct: string): Q => Q.add(Q.ONE, Q.div(Q.fromDecimal(pct), Q.of(100)));

export const valueUkOwnerOccupierV1: ValueEvidencePlugin = {
  kind: 'value-evidence',
  id: 'value-uk-oo-v1',
  version: '0.1.0',
  title: 'money.value.uk-oo-v1',
  regions: ['GB-ENG', 'GB-WLS'],
  side: 'engine',
  provenance: provenance([SF_4_2], 'secondary'),
  uplift(from, to) {
    const a = rowOf(from);
    const b = rowOf(to);
    if (a === b) return null;
    const u = (k: 'low' | 'central' | 'high') =>
      Q.sub(Q.div(index(VALUE_TABLE_V1[b][k]), index(VALUE_TABLE_V1[a][k])), Q.ONE);
    return { low: u('low'), central: u('central'), high: u('high') };
  },
};
