import type { EvidenceNode, EvidenceValue, SealLevel, Unit } from '@ibasho/core';

/** A minimal, valid evidence node for tests and stories. */
export function node(
  id: string,
  value: EvidenceValue,
  unit: Unit,
  rounding: EvidenceNode['rounding'],
  seal: SealLevel = 'checked',
  extra: Partial<EvidenceNode> = {},
): EvidenceNode {
  return {
    id: `ev_${id}`,
    quantity: id,
    subject: { homeId: 'gh1', mode: 'standard' },
    value,
    unit,
    formula: { id: 'TEST', doc: 'test' },
    inputs: [],
    provenance: { kind: 'computed' },
    seal,
    rounding,
    ...(seal === 'checked' ? { check: { id: 'acct.saving', rung: 'mirror', coverage: 'all' } } : {}),
    ...extra,
  } as EvidenceNode;
}
