/**
 * Scene quantities from the engine's evidence graph (ARCH 7). Owner: WP-07.
 *
 * Reads `fabric.u.<element>`, `geom.area.<element>`, `fabric.psi.<junction>`,
 * `geom.len.<junction>`, `vent.hve.<m>` and `thermal.zone.<z>` (or `heat.theta_i.<m>`) for one
 * package and mode, and keeps each node's id so the scene can open it. Display numbers only:
 * nothing here feeds the bookkeeping.
 */
import type { EvidenceGraph, EvidenceNode, HomeTwin, RunMode } from '@ibasho/core';
import { fromTwin, JANUARY_NIGHT, surfaceTemp } from './from-twin.ts';
import type { ElementFlow, JunctionFlow, SceneCondition, SceneQuantities, ZoneTemp } from './types.ts';

/** Numeric value of a node for display (fixed strings, rationals, floats, interval midpoints). */
export function nodeNumber(n: EvidenceNode): number | undefined {
  const v = n.value;
  if ('float' in v) return v.float;
  if ('fixed' in v) return Number(v.fixed);
  if ('exact' in v) return Number(v.exact.n) / Number(v.exact.d);
  if ('interval' in v) return (v.interval.lo + v.interval.hi) / 2;
  return undefined;
}

export interface GraphSelect {
  packageId?: string;
  mode?: RunMode;
  /** Month index for monthly quantities (January is 0). */
  month?: number;
}

export function fromGraph(
  twin: HomeTwin,
  graph: EvidenceGraph,
  condition: SceneCondition = JANUARY_NIGHT,
  sel: GraphSelect = {},
): SceneQuantities {
  const pkg = sel.packageId ?? 'baseline';
  const mode = sel.mode ?? 'standard';
  const month = sel.month ?? 0;
  const nodes = graph.nodes.filter(
    (n) => (n.subject.packageId ?? 'baseline') === pkg && n.subject.mode === mode,
  );
  const byQ = new Map<string, EvidenceNode>();
  for (const n of nodes) if (!byQ.has(n.quantity)) byQ.set(n.quantity, n);
  const fallback = fromTwin(twin, condition);
  const dT = condition.thetaInC - condition.thetaOutC;

  const elements: ElementFlow[] = twin.elements.map((e) => {
    const un = byQ.get(`fabric.u.${e.id}`);
    const an = byQ.get(`geom.area.${e.id}`);
    const fb = fallback.elements.find((x) => x.elementId === e.id)!;
    const u = un ? (nodeNumber(un) ?? fb.u) : fb.u;
    const areaM2 = an ? (nodeNumber(an) ?? fb.areaM2) : fb.areaM2;
    const ua = u * areaM2;
    return {
      elementId: e.id,
      watts: ua * dT,
      ua,
      u,
      areaM2,
      surfaceC: surfaceTemp(u, e.kind, condition),
      ...(un ? { evidenceId: un.id } : {}),
    };
  });
  const junctions: JunctionFlow[] = twin.junctions.map((j) => {
    const pn = byQ.get(`fabric.psi.${j.id}`);
    const ln = byQ.get(`geom.len.${j.id}`);
    const fb = fallback.junctions.find((x) => x.junctionId === j.id)!;
    const psi = pn ? (nodeNumber(pn) ?? fb.psi) : fb.psi;
    const lengthM = ln ? (nodeNumber(ln) ?? fb.lengthM) : fb.lengthM;
    return {
      junctionId: j.id,
      psi,
      lengthM,
      wPerM: psi * dT,
      watts: psi * lengthM * dT,
      ...(pn ? { evidenceId: pn.id } : {}),
    };
  });
  const hveNode = byQ.get(`vent.hve.${month}`);
  const hve = hveNode ? nodeNumber(hveNode) : undefined;
  const ventilationW = hve !== undefined ? hve * dT : fallback.ventilationW;
  const k = fallback.ventilationW > 0 ? ventilationW / fallback.ventilationW : 0;

  const zones: ZoneTemp[] = (['living', 'rest'] as const).map((z) => {
    const zn = byQ.get(`thermal.zone.${z}`) ?? byQ.get(`thermal.zone.${z}.${month}`);
    const zv = zn ? nodeNumber(zn) : undefined;
    if (zn && zv !== undefined) return { zone: z, tempC: zv, evidenceId: zn.id };
    return fallback.zones.find((x) => x.zone === z)!;
  });
  const engineBacked = elements.some((e) => e.evidenceId !== undefined);
  return {
    source: engineBacked ? 'engine' : 'twin-fixture',
    condition,
    elements,
    junctions,
    zones,
    ventilationW,
    ...(hveNode ? { ventilationEvidenceId: hveNode.id } : {}),
    leaks: fallback.leaks.map((l) => ({ ...l, watts: l.watts * k })),
  };
}
