/**
 * FIXTURE: K1-style junctions derived from twin geometry, for twins that carry none yet.
 * Owner: WP-07. Not physics: the scene uses this only until the twin carries explicit
 * junctions (SPEC R19, owned by WP-01 and the archetype plugins). Values are approximate
 * SAP 10.2 Table K1 defaults (lintel E2, sill E3, jamb E4, ground floor E5, intermediate floor
 * E6, eaves E10, party wall E18), tagged `default` so they never pass for a measurement.
 */
import type { Element, HomeTwin, Junction, JunctionKind, NumField, Vec3 } from '@ibasho/core';
import { numCentral } from '@ibasho/core';
import { bounds3, centroid, newellNormal, polylineLength } from '../twin/frame.ts';

export const K1_FIXTURE_PSI: Record<JunctionKind, number> = {
  lintel: 0.3,
  sill: 0.04,
  jamb: 0.05,
  'ground-floor': 0.16,
  'intermediate-floor': 0.07,
  eaves: 0.06,
  'party-wall': 0.06,
  corner: 0.09,
  'joist-end': 0.07,
};

const field = (value: number, pluginId: string): NumField => ({
  state: 'estimated',
  value,
  range: [value * 0.5, value * 1.5],
  source: { kind: 'default', pluginId },
});

function junction(id: string, kind: JunctionKind, elementIds: string[], path: Vec3[]): Junction {
  const l = Math.round(polylineLength(path) * 1000) / 1000;
  return {
    id,
    kind,
    elementIds,
    lengthM: field(l, 'scene-fixture-geometry'),
    psi: field(K1_FIXTURE_PSI[kind], 'scene-fixture-k1'),
    path,
  };
}

/** Returns the twin unchanged when it already has junctions. */
export function withFixtureJunctions(twin: HomeTwin): HomeTwin {
  if (twin.junctions.length > 0) return twin;
  const out: Junction[] = [];
  const storeys = Math.max(1, Math.round(numCentral(twin.form.storeys)));
  const h = numCentral(twin.form.storeyHeightM);
  const walls = twin.elements.filter((e) => e.kind === 'wall');
  const party = twin.elements.filter((e) => e.kind === 'party-wall');
  const floor = twin.elements.find((e) => e.kind === 'floor');
  const roof = twin.elements.find((e) => e.kind === 'roof');

  for (const o of twin.elements) {
    if (o.kind !== 'window' && o.kind !== 'door') continue;
    const b = bounds3(o.geometry.polygon);
    const host = o.parentId;
    const ids = host ? [o.id, host] : [o.id];
    const n = newellNormal(o.geometry.polygon);
    const alongX = Math.abs(n[2]) >= Math.abs(n[0]);
    const z = alongX ? b.min[2] : 0;
    const x = alongX ? 0 : b.min[0];
    const pt = (u: number, y: number): Vec3 => (alongX ? [u, y, z] : [x, y, u]);
    const u0 = alongX ? b.min[0] : b.min[2];
    const u1 = alongX ? b.max[0] : b.max[2];
    out.push(junction(`jn-lintel-${o.id}`, 'lintel', ids, [pt(u0, b.max[1]), pt(u1, b.max[1])]));
    if (o.kind === 'window') {
      out.push(junction(`jn-sill-${o.id}`, 'sill', ids, [pt(u0, b.min[1]), pt(u1, b.min[1])]));
    }
    out.push(junction(`jn-jamb-${o.id}-a`, 'jamb', ids, [pt(u0, b.min[1]), pt(u0, b.max[1])]));
    out.push(junction(`jn-jamb-${o.id}-b`, 'jamb', ids, [pt(u1, b.min[1]), pt(u1, b.max[1])]));
  }

  for (const w of walls) {
    const b = bounds3(w.geometry.polygon);
    const c = centroid(w.geometry.polygon);
    const n = newellNormal(w.geometry.polygon);
    const alongX = Math.abs(n[2]) >= Math.abs(n[0]);
    const pt = (u: number, y: number): Vec3 => (alongX ? [u, y, c[2]] : [c[0], y, u]);
    const u0 = alongX ? b.min[0] : b.min[2];
    const u1 = alongX ? b.max[0] : b.max[2];
    const tag = w.id.replace(/^wall-/, '');
    if (floor) {
      out.push(
        junction(`jn-ground-${tag}`, 'ground-floor', [w.id, floor.id], [pt(u0, b.min[1]), pt(u1, b.min[1])]),
      );
    }
    for (let s = 1; s < storeys; s++) {
      out.push(junction(`jn-floor${s}-${tag}`, 'intermediate-floor', [w.id], [pt(u0, s * h), pt(u1, s * h)]));
    }
    if (roof) {
      out.push(junction(`jn-eaves-${tag}`, 'eaves', [w.id, roof.id], [pt(u0, b.max[1]), pt(u1, b.max[1])]));
    }
    for (const p of party) {
      const pb = bounds3(p.geometry.polygon);
      const meets = alongX
        ? Math.abs(pb.min[0] - b.min[0]) < 0.05 || Math.abs(pb.max[0] - b.max[0]) < 0.05
        : Math.abs(pb.min[2] - b.min[2]) < 0.05 || Math.abs(pb.max[2] - b.max[2]) < 0.05;
      if (!meets) continue;
      const pc = centroid(p.geometry.polygon);
      const u = alongX ? pc[0] : pc[2];
      out.push(
        junction(
          `jn-party-${tag}-${p.id.replace(/^party-/, '')}`,
          'party-wall',
          [w.id, p.id],
          [pt(u, b.min[1]), pt(u, b.max[1])],
        ),
      );
    }
  }
  return { ...twin, junctions: out };
}

/** Elements a junction touches, for the outline (stable order). */
export function junctionHosts(twin: HomeTwin, j: Junction): Element[] {
  return j.elementIds.map((id) => twin.elements.find((e) => e.id === id)).filter((e): e is Element => !!e);
}
