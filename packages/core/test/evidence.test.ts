import { describe, expect, it } from 'vitest';
import {
  createEvidenceGraphBuilder,
  EvidenceGraphError,
  evidenceId,
  graphHash,
  indexGraph,
  mergeGraphs,
} from '../src/evidence/graph.ts';
import type { EvidenceDraft, EvidenceId, EvidenceNode } from '../src/evidence/types.ts';

const subject = { homeId: 'gh1', mode: 'standard' as const };
const draft = (
  quantity: string,
  key: string | undefined,
  inputs: EvidenceDraft['inputs'] = [],
): EvidenceDraft => ({
  ...(key !== undefined ? { key } : {}),
  quantity,
  subject,
  value: { float: 1 },
  unit: 'W/K',
  formula: { id: 'BP-3.2', doc: 'fabric loss' },
  inputs,
  provenance: { kind: 'computed' },
  rounding: { mode: 'sig', value: 3 },
});

describe('evidenceId', () => {
  it('is deterministic and content addressed', () => {
    const a = evidenceId('fabric.htr', subject);
    expect(a).toMatch(/^ev_[0-9a-f]{20}$/);
    expect(evidenceId('fabric.htr', { mode: 'standard', homeId: 'gh1' })).toBe(a);
    expect(evidenceId('fabric.htr', { ...subject, mode: 'rating' })).not.toBe(a);
  });
});

describe('EvidenceGraphBuilder', () => {
  it('assigns ids, resolves keys in any order, and seals as unverified by default', () => {
    const b = createEvidenceGraphBuilder();
    const ids = b.addDrafts([
      draft('fabric.htr', 'htr', [
        { key: 'u', role: 'U' },
        { key: 'a', role: 'area' },
      ]),
      draft('fabric.u.wall', 'u'),
      draft('geom.area.wall', 'a'),
    ]);
    expect(ids).toHaveLength(3);
    expect(b.idOfKey('htr')).toBe(ids[0]);
    const g = b.build();
    expect(g.schema).toBe('ibasho.evidence/1');
    expect(g.nodes.map((n) => n.id)).toEqual([...ids].sort());
    expect(g.nodes.every((n) => n.seal === 'unverified')).toBe(true);
    const htr = g.nodes.find((n) => n.quantity === 'fabric.htr')!;
    expect(htr.inputs.map((i) => i.role)).toEqual(['U', 'area']);
    expect('key' in htr).toBe(false);
    expect(b.size).toBe(3);
    expect(b.has(ids[1]!)).toBe(true);
    expect(b.get(ids[1]!)?.quantity).toBe('fabric.u.wall');
  });

  it('resolves keys across batches, custom ids and seals', () => {
    const b = createEvidenceGraphBuilder({ defaultSeal: 'modelled' });
    b.addDrafts([draft('geom.tfa', 'tfa')]);
    const [id] = b.addDrafts([draft('fabric.hlp', undefined, [{ key: 'tfa', role: 'tfa' }])], {
      idFor: () => 'ev_custom' as EvidenceId,
      seal: 'checked',
    });
    expect(id).toBe('ev_custom');
    const g = b.build();
    expect(g.nodes.find((n) => n.id === 'ev_custom')?.seal).toBe('checked');
    expect(g.nodes.find((n) => n.quantity === 'geom.tfa')?.seal).toBe('modelled');
  });

  it('accepts explicit input ids and external (lazy) nodes', () => {
    const b = createEvidenceGraphBuilder();
    const ext = 'ev_external0000000000' as EvidenceId;
    b.markExternal(ext);
    b.markExternal('ev_unused' as EvidenceId);
    b.addDrafts([draft('fin.npv', undefined, [{ id: ext, role: 'b_t' }])]);
    expect(b.build().external).toEqual([ext]);
  });

  it('rejects dangling inputs, unresolved keys, reused keys and bad ids', () => {
    const b = createEvidenceGraphBuilder();
    b.addDrafts([draft('x', undefined, [{ id: 'ev_missing' as EvidenceId, role: 'r' }])]);
    expect(() => b.build()).toThrow(/dangling input/);
    expect(() =>
      createEvidenceGraphBuilder().addDrafts([draft('y', undefined, [{ key: 'nope', role: 'r' }])]),
    ).toThrow(EvidenceGraphError);
    expect(() => createEvidenceGraphBuilder().addDrafts([draft('y', undefined, [{ role: 'r' }])])).toThrow(
      EvidenceGraphError,
    );
    const c = createEvidenceGraphBuilder();
    c.addDrafts([draft('a', 'k')]);
    expect(() => c.addDrafts([draft('b', 'k')])).toThrow(/reused/);
    const node: EvidenceNode = {
      ...(draft('z', undefined) as Omit<EvidenceNode, 'id' | 'seal'>),
      id: 'bad' as EvidenceId,
      seal: 'modelled',
      inputs: [],
    };
    expect(() => c.add(node)).toThrow(/must start with ev_/);
  });

  it('re-adding an identical node is a no-op; a different one throws', () => {
    const b = createEvidenceGraphBuilder();
    const [id] = b.addDrafts([draft('a', undefined)]);
    expect(b.addDrafts([draft('a', undefined)])).toEqual([id]);
    expect(() => b.addDrafts([{ ...draft('a', undefined), value: { float: 2 } }])).toThrow(/conflicting/);
  });

  it('detects cycles', () => {
    const b = createEvidenceGraphBuilder();
    const ids = ['ev_a', 'ev_b', 'ev_c'] as EvidenceId[];
    let i = 0;
    b.addDrafts(
      [
        draft('a', 'a', [{ key: 'b', role: 'r' }]),
        draft('b', 'b', [{ key: 'c', role: 'r' }]),
        draft('c', 'c', [{ key: 'a', role: 'r' }]),
      ],
      { idFor: () => ids[i++]! },
    );
    expect(() => b.build()).toThrow(/cycle/);
  });
});

describe('index, merge and hash', () => {
  const b = createEvidenceGraphBuilder();
  const [npv, bt, price, ext] = ['ev_npv', 'ev_bt', 'ev_price', 'ev_ext'] as EvidenceId[];
  b.markExternal(ext!);
  b.addDrafts([draft('fin.npv', undefined, [{ id: bt!, role: 'b' }])], { idFor: () => npv! });
  b.addDrafts(
    [
      draft('fin.b.1', undefined, [
        { id: price!, role: 'p' },
        { id: ext!, role: 'x' },
      ]),
    ],
    { idFor: () => bt! },
  );
  b.addDrafts([draft('money.price', undefined)], { idFor: () => price! });
  const g = b.build();

  it('walks inputs, dependents and closures', () => {
    const ix = indexGraph(g);
    expect(ix.get(npv!)?.quantity).toBe('fin.npv');
    expect(ix.inputsOf(bt!).map((n) => n.id)).toEqual([price]);
    expect(ix.dependentsOf(price!).map((n) => n.id)).toEqual([bt]);
    expect(ix.dependentsOf(npv!)).toEqual([]);
    expect(ix.closure(npv!)).toEqual([price, bt]);
    expect(ix.byQuantity('fin.npv').map((n) => n.id)).toEqual([npv]);
    expect(ix.byQuantity('nope')).toEqual([]);
    expect(ix.inputsOf('ev_nope' as EvidenceId)).toEqual([]);
  });

  it('merges lazily fetched nodes and hashes deterministically', () => {
    const extra = createEvidenceGraphBuilder();
    extra.addDrafts([draft('lazy.thing', undefined)], { idFor: () => ext! });
    const merged = mergeGraphs(g, extra.build());
    expect(merged.nodes.map((n) => n.id)).toContain(ext);
    expect(merged.external).toEqual([]);
    expect(graphHash(g)).toBe(
      graphHash(mergeGraphs(g, { schema: 'ibasho.evidence/1', nodes: [], external: [] })),
    );
    expect(graphHash(merged)).not.toBe(graphHash(g));
  });
});
