/**
 * Evidence nodes for Preview results (SPEC R26, AC-PG3). Owner: WP-08.
 *
 * Every Preview number reaches the screen as an evidence node with `seal: 'preview'` and
 * `provenance.kind: 'preview'`, so `Num` draws the dashed underline and no seal, and `verify` never
 * seals it. Ids are `ev_<building>~<variant>.<quantity>` so two variants can share one provider.
 */
import type { EvidenceId, EvidenceNode, EvidenceValue, Unit } from '@ibasho/core';

export const PREVIEW_PLUGIN = { id: 'preview.local-adapter', version: '0.1.0' } as const;

export class EvBag {
  readonly nodes: EvidenceNode[] = [];
  readonly key: string;
  readonly subject: { buildingId: string; placeId: string; variantId: string };
  constructor(key: string, subject: { buildingId: string; placeId: string; variantId: string }) {
    this.key = key;
    this.subject = subject;
  }

  id(quantity: string): EvidenceId {
    return `ev_${this.key}.${quantity}`;
  }

  private push(
    quantity: string,
    value: EvidenceValue,
    unit: Unit,
    rounding: EvidenceNode['rounding'],
    doc: string,
  ): EvidenceId {
    const id = this.id(quantity);
    this.nodes.push({
      id,
      quantity,
      subject: { homeId: this.subject.buildingId, mode: 'standard', ...this.subject },
      value,
      unit,
      formula: { id: 'PREVIEW', doc },
      inputs: [],
      provenance: { kind: 'preview', plugin: PREVIEW_PLUGIN, grade: 'estimate' },
      seal: 'preview',
      rounding,
    });
    return id;
  }

  /** A point value. */
  num(q: string, v: number, unit: Unit, sig = 3, doc = 'Preview fixture'): EvidenceId {
    return this.push(q, { float: v }, unit, { mode: 'sig', value: sig }, doc);
  }
  /** A range (unknown is a range, not zero). */
  range(q: string, lo: number, hi: number, unit: Unit, sig = 2, doc = 'Preview fixture'): EvidenceId {
    return this.push(
      q,
      { interval: { lo: Math.min(lo, hi), hi: Math.max(lo, hi) } },
      unit,
      { mode: 'sig', value: sig },
      doc,
    );
  }
  /** Exact fixed point (money in micro-paise, energy in Wh). */
  fixed(q: string, v: bigint, unit: Unit, step: number, doc = 'Preview fixture'): EvidenceId {
    return this.push(q, { fixed: v.toString(), unit }, unit, { mode: 'step', value: step }, doc);
  }
  cat(q: string, v: string, doc = 'Preview fixture'): EvidenceId {
    return this.push(q, { cat: v }, 'band', { mode: 'sig', value: 1 }, doc);
  }
}
