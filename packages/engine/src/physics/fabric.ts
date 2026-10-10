/**
 * Fabric stage (BP 3.2). Owner: WP-01.
 *
 * H_tr = sum A U_eff + H_bridge, with
 * - U_eff = 1 / (1/U + 0.04) for windows and rooflights (curtain allowance, SAP 10.2 3.2);
 * - H_bridge (SPEC R19 hybrid) = sum psi L over the explicit junctions (the ones the scene draws,
 *   SAP 10.2 Table K1 defaults unless stated) + y * A_rest, where A_rest is the exposed area of
 *   elements that no explicit junction touches and y is the RdSAP 10 Table 21 default (0.15 W/m2K
 *   for age bands A to I). With no junctions, A_rest is the whole exposed area (plain RdSAP y).
 * - HLP here is the fabric part only (H_tr / TFA); the heat-balance stage adds ventilation.
 * - TMP (RdSAP 10 Table 22): 250 kJ/m2K masonry; 100 for timber frame or internally insulated
 *   masonry, detected from wall construction ids containing `timber-frame` or `iwi`.
 */
import type { PhysicsStage } from '@ibasho/core';
import { floatDraft } from './common.ts';

export interface FabricDefaults {
  /** Thermal bridging y, W/m2K, used when the twin lists no explicit junctions. */
  bridgingYWm2K: number;
}

const OPENING_GLAZED = new Set(['window', 'rooflight']);

export function createFabricStage(d: FabricDefaults): PhysicsStage<'fabric'> {
  return {
    kind: 'physics-stage',
    id: 'stage-fabric-m0',
    version: '0.1.0',
    title: 'engine.stage.fabric',
    side: 'engine',
    stage: 'fabric',
    modes: ['rating', 'standard', 'your-home'],
    run(geo, ctx) {
      const byElementWK: Record<string, number> = {};
      const evidence = [];
      let sumAU = 0;
      for (const e of geo.elements) {
        const uEff = OPENING_GLAZED.has(e.kind) && e.u > 0 ? 1 / (1 / e.u + 0.04) : e.u;
        const h = e.areaM2 * uEff;
        byElementWK[e.id] = h;
        sumAU += h;
        evidence.push(
          floatDraft(
            ctx,
            `fabric.u.${e.id}`,
            uEff,
            'W/m2K',
            { id: 'BP-3.2', doc: OPENING_GLAZED.has(e.kind) ? 'U_eff = 1/(1/U + 0.04)' : 'element U' },
            { elementId: e.id, inputs: [{ key: `geom.area.${e.id}`, role: 'area' }] },
          ),
        );
      }
      const byJunctionWK: Record<string, number> = {};
      let sumPsiL = 0;
      for (const j of geo.junctions) {
        const h = j.psi * j.lengthM;
        byJunctionWK[j.id] = h;
        sumPsiL += h;
        evidence.push(
          floatDraft(
            ctx,
            `fabric.psi.${j.id}`,
            j.psi,
            'W/mK',
            { id: 'SAP-K1', doc: 'junction psi' },
            {
              junctionId: j.id,
              inputs: [{ key: `geom.len.${j.id}`, role: 'length' }],
            },
          ),
        );
      }
      const touched = new Set(geo.twin.junctions.flatMap((j) => j.elementIds));
      const aRest = geo.elements
        .filter((e) => e.kind !== 'party-wall' && !touched.has(e.id))
        .reduce((a, e) => a + e.areaM2, 0);
      const yRestWK = d.bridgingYWm2K * aRest;
      const htrWK = sumAU + sumPsiL + yRestWK;
      const hlpWm2K = htrWK / geo.tfaM2;
      const walls = geo.twin.elements.filter((e) => e.kind === 'wall');
      const lightweight = walls.some((e) => /timber-frame|iwi/.test(e.constructionId));
      const tmpKJm2K = lightweight ? 100 : 250;

      const htrInputs = [
        ...geo.elements.map((e) => ({ key: `fabric.u.${e.id}`, role: 'u' })),
        ...geo.junctions.map((j) => ({ key: `fabric.psi.${j.id}`, role: 'psi' })),
        { key: 'fabric.y_rest', role: 'y A_rest' },
      ];
      evidence.push(
        floatDraft(
          ctx,
          'fabric.y_rest',
          yRestWK,
          'W/K',
          { id: 'RdSAP-T21', doc: 'y A_rest over elements no explicit junction touches' },
          { provenance: 'default' },
        ),
        floatDraft(
          ctx,
          'fabric.htr',
          htrWK,
          'W/K',
          { id: 'BP-3.2', doc: 'H_tr = sum A U + sum psi L + y A_rest' },
          {
            inputs: htrInputs,
          },
        ),
        floatDraft(
          ctx,
          'fabric.hlp',
          hlpWm2K,
          'W/m2K',
          { id: 'BP-3.2', doc: 'HLP_fabric = H_tr / TFA' },
          {
            inputs: [
              { key: 'fabric.htr', role: 'htr' },
              { key: 'geom.tfa', role: 'tfa' },
            ],
          },
        ),
        floatDraft(
          ctx,
          'fabric.tmp',
          tmpKJm2K,
          'kJ/m2K',
          { id: 'RdSAP-T22', doc: 'thermal mass parameter' },
          {
            provenance: 'default',
          },
        ),
      );
      return {
        output: { htrWK, byElementWK, byJunctionWK, yRestWK, hlpWm2K, tmpKJm2K },
        evidence,
      };
    },
  };
}
