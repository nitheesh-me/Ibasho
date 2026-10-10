/**
 * Geometry stage (BP 3.1). Owner: WP-01.
 *
 * Convention: an element's `areaM2` is its own net area. A wall's area excludes the windows and
 * doors whose `parentId` is that wall, so nothing is counted twice.
 * Tilt defaults: walls, party walls, windows and doors 90 deg; roofs (loft ceilings) and floors 0.
 * Orientation of an opening defaults to its parent wall, then to the front azimuth.
 */
import type { Element, GeometryElement, HomeTwin, PhysicsStage } from '@ibasho/core';
import { central, floatDraft, PhysicsError, provenanceOf } from './common.ts';

const VERTICAL: ReadonlySet<Element['kind']> = new Set(['wall', 'party-wall', 'window', 'door']);

function tiltOf(e: Element): number {
  if (e.tiltDeg !== undefined) return e.tiltDeg;
  return VERTICAL.has(e.kind) ? 90 : 0;
}

function orientationOf(e: Element, byId: Map<string, Element>, twin: HomeTwin): number | undefined {
  if (e.orientationDeg !== undefined) return e.orientationDeg;
  const parent = e.parentId !== undefined ? byId.get(e.parentId) : undefined;
  if (parent?.orientationDeg !== undefined) return parent.orientationDeg;
  if (VERTICAL.has(e.kind) && e.kind !== 'party-wall') return central(twin.form.frontAzimuthDeg, 'form.frontAzimuthDeg');
  return undefined;
}

export const geometryStage: PhysicsStage<'geometry'> = {
  kind: 'physics-stage',
  id: 'stage-geometry-m0',
  version: '0.1.0',
  title: 'engine.stage.geometry',
  side: 'engine',
  stage: 'geometry',
  modes: ['rating', 'standard', 'your-home'],
  run(twin, ctx) {
    const storeys = central(twin.form.storeys, 'form.storeys');
    const footprint = central(twin.form.footprintM2, 'form.footprintM2');
    const height = central(twin.form.storeyHeightM, 'form.storeyHeightM');
    const tfaM2 = footprint * storeys;
    if (!(tfaM2 > 0)) throw new PhysicsError(`TFA must be positive, got ${tfaM2}`);
    const volumeM3 = tfaM2 * height;
    const livingAreaM2 = tfaM2 * central(twin.zones.livingAreaFrac, 'zones.livingAreaFrac');

    const byId = new Map(twin.elements.map((e) => [e.id, e]));
    const elements: GeometryElement[] = twin.elements.map((e) => {
      const g: GeometryElement = {
        id: e.id,
        kind: e.kind,
        zone: e.zone,
        areaM2: central(e.areaM2, `elements.${e.id}.areaM2`),
        u: central(e.u, `elements.${e.id}.u`),
        tiltDeg: tiltOf(e),
      };
      if (g.areaM2 < 0 || g.u < 0) throw new PhysicsError(`element ${e.id} has a negative area or U`);
      if (e.g !== undefined) g.g = central(e.g, `elements.${e.id}.g`);
      const az = orientationOf(e, byId, twin);
      if (az !== undefined) g.orientationDeg = az;
      return g;
    });
    const exposedAreaM2 = elements.filter((e) => e.kind !== 'party-wall').reduce((s, e) => s + e.areaM2, 0);
    const junctions = twin.junctions.map((j) => ({
      id: j.id,
      kind: j.kind,
      lengthM: central(j.lengthM, `junctions.${j.id}.lengthM`),
      psi: central(j.psi, `junctions.${j.id}.psi`),
    }));

    const doc = { id: 'BP-3.1', doc: 'TFA = footprint x storeys; V = TFA x storey height' };
    const evidence = [
      floatDraft(ctx, 'geom.tfa', tfaM2, 'm2', doc),
      floatDraft(ctx, 'geom.volume', volumeM3, 'm3', doc, { inputs: [{ key: 'geom.tfa', role: 'tfa' }] }),
      ...twin.elements.map((e, i) =>
        floatDraft(ctx, `geom.area.${e.id}`, elements[i]!.areaM2, 'm2', { id: 'twin', doc: 'net element area' }, {
          elementId: e.id,
          provenance: provenanceOf(e.areaM2.source),
        }),
      ),
      ...twin.junctions.map((j, i) =>
        floatDraft(ctx, `geom.len.${j.id}`, junctions[i]!.lengthM, 'm', { id: 'twin', doc: 'junction length' }, {
          junctionId: j.id,
          provenance: provenanceOf(j.lengthM.source),
        }),
      ),
    ];
    return {
      output: { twin, tfaM2, volumeM3, livingAreaM2, exposedAreaM2, elements, junctions },
      evidence,
    };
  },
};
