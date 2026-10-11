/**
 * Evidence for Preview outputs (ARCH 7, R26). Every node has `provenance.kind = 'preview'` and
 * seal `preview`, so `verify` never seals it and the UI shows the Preview stamp (AC-PG3, P3).
 * Ids are deterministic: `ev_pv_<building>_<stage>_<n>`.
 */
import type {
  EvidenceGraph,
  EvidenceId,
  EvidenceNode,
  EvidenceSubject,
  EvidenceValue,
  Q,
  StageId,
  Unit,
} from '@ibasho/core';

export const PREVIEW_VERSION = '0.1.0' as const;

export class EvidenceBuilder {
  private readonly nodes: EvidenceNode[] = [];
  private n = 0;
  private readonly buildingId: string;
  private readonly stage: StageId;
  constructor(buildingId: string, stage: StageId) {
    this.buildingId = buildingId;
    this.stage = stage;
  }

  add(
    quantity: string,
    value: EvidenceValue,
    unit: Unit,
    formula: string,
    opts: { inputs?: EvidenceId[]; subject?: Partial<EvidenceSubject>; doc?: string } = {},
  ): EvidenceId {
    const id =
      `ev_pv_${this.buildingId}_${this.stage}_${(this.n++).toString(36).padStart(3, '0')}` as EvidenceId;
    this.nodes.push({
      id,
      quantity,
      subject: { homeId: this.buildingId, buildingId: this.buildingId, mode: 'standard', ...opts.subject },
      value,
      unit,
      formula: { id: formula, doc: opts.doc ?? 'packages/preview/README.md' },
      inputs: (opts.inputs ?? []).map((i) => ({ id: i, role: 'input' })),
      provenance: {
        kind: 'preview',
        plugin: { id: `preview.${this.stage}`, version: PREVIEW_VERSION },
        grade: 'estimate',
      },
      seal: 'preview',
      rounding: { mode: 'sig', value: 3 },
    });
    return id;
  }

  /** Fixed-point integer value (Wh, micro-paise, g). */
  fixed(
    quantity: string,
    v: bigint,
    unit: Unit,
    formula: string,
    opts?: Parameters<EvidenceBuilder['add']>[4],
  ): EvidenceId {
    return this.add(quantity, { fixed: v.toString(), unit }, unit, formula, opts);
  }
  float(
    quantity: string,
    v: number,
    unit: Unit,
    formula: string,
    opts?: Parameters<EvidenceBuilder['add']>[4],
  ): EvidenceId {
    return this.add(quantity, { float: v }, unit, formula, opts);
  }
  interval(
    quantity: string,
    lo: number,
    hi: number,
    unit: Unit,
    formula: string,
    opts?: Parameters<EvidenceBuilder['add']>[4],
  ): EvidenceId {
    return this.add(quantity, { interval: { lo, hi } }, unit, formula, opts);
  }
  exact(
    quantity: string,
    q: Q,
    unit: Unit,
    formula: string,
    opts?: Parameters<EvidenceBuilder['add']>[4],
  ): EvidenceId {
    return this.add(quantity, { exact: q }, unit, formula, opts);
  }
  cat(
    quantity: string,
    v: string,
    formula: string,
    opts?: Parameters<EvidenceBuilder['add']>[4],
  ): EvidenceId {
    return this.add(quantity, { cat: v }, '1', formula, opts);
  }

  graph(): EvidenceGraph {
    return {
      schema: 'ibasho.evidence/1',
      nodes: [...this.nodes].sort((a, b) => (a.id < b.id ? -1 : 1)),
      external: [],
    };
  }
}
