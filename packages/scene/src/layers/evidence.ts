/**
 * Picking to evidence (AC-V1: every highlighted element, junction or zone has its own node).
 * Owner: WP-07.
 */
import type { EvidenceGraph, EvidenceId, SceneHit, SearchResult } from '@ibasho/core';
import { type SceneTarget, targetOfHit } from '../select/store.ts';

/** Quantity ids, most specific first, that carry a target's own evidence. */
export function quantitiesFor(t: SceneTarget): string[] {
  switch (t.kind) {
    case 'element':
      return [`fabric.u.${t.id}`, `geom.area.${t.id}`];
    case 'junction':
      return [`fabric.psi.${t.id}`, `geom.len.${t.id}`];
    case 'zone':
      return [`thermal.zone.${t.id}`, `thermal.zone.${t.id}.hourly`];
  }
}

export function evidenceForTarget(
  graph: EvidenceGraph,
  t: SceneTarget,
  packageId = 'baseline',
): EvidenceId | undefined {
  for (const q of quantitiesFor(t)) {
    const n = graph.nodes.find((x) => x.quantity === q && (x.subject.packageId ?? 'baseline') === packageId);
    if (n) return n.id;
  }
  return undefined;
}

export function evidenceForHit(hit: SceneHit, res: SearchResult, packageId?: string): EvidenceId | undefined {
  const t = targetOfHit(hit);
  return t ? evidenceForTarget(res.graph, t, packageId) : undefined;
}
