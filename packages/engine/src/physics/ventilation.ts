/**
 * Infiltration and ventilation stage (SAP 10.2 section 2 via BP 3.3). Owner: WP-01.
 *
 * 1. n_flue = (80 open chimneys + 20 blocked chimneys + 10 extract fans) / V
 *    (open flues, passive vents and flueless fires are not in the twin yet; they count 0).
 * 2. With an AP50 test: n_inf = AP50 / 20 + n_flue. Without: n_inf = n_flue + 0.1 (storeys - 1)
 *    + {0.35 masonry | 0.25 timber frame} + {0.2 unsealed suspended | 0.1 sealed | 0 solid floor}
 *    + 0.05 (no draught lobby assumed) + (0.25 - 0.2 f_dp).
 * 3. Shelter: n_sh = n_inf (1 - 0.075 s).  4. Wind: n_m = n_sh v_m / 4.
 * 5. Effective rate: natural and intermittent extract: n_m >= 1 ? n_m : 0.5 + 0.5 n_m^2;
 *    MVHR: n_m + 0.5 (1 - 0.85 * 0.8); MEV and PIV: max(0.5, n_m + 0.25).
 * 6. H_ve = 0.33 n_eff V.
 */
import { choiceValue, type PhysicsStage } from '@ibasho/core';
import { central, floatDraft, monthly, monthlyDrafts } from './common.ts';

export const ventilationStage: PhysicsStage<'ventilation'> = {
  kind: 'physics-stage',
  id: 'stage-ventilation-m0',
  version: '0.1.0',
  title: 'engine.stage.ventilation',
  side: 'engine',
  stage: 'ventilation',
  modes: ['rating', 'standard', 'your-home'],
  run(geo, ctx) {
    const v = geo.twin.ventilation;
    const V = geo.volumeM3;
    const open = central(v.chimneysOpen, 'ventilation.chimneysOpen');
    const blocked = central(v.chimneysBlocked, 'ventilation.chimneysBlocked');
    const fans = central(v.extractFans, 'ventilation.extractFans');
    const nFlue = (80 * open + 20 * blocked + 10 * fans) / V;

    let ninfAch: number;
    if (v.ap50 !== undefined) {
      ninfAch = central(v.ap50, 'ventilation.ap50') / 20 + nFlue;
    } else {
      const storeys = central(geo.twin.form.storeys, 'form.storeys');
      const frame = geo.twin.elements.some((e) => e.kind === 'wall' && /timber-frame/.test(e.constructionId));
      // An unknown floor type takes the leakiest option (conservative for demand).
      const floor = choiceValue(v.floorType) ?? 'suspended-unsealed';
      const floorTerm = floor === 'suspended-unsealed' ? 0.2 : floor === 'suspended-sealed' ? 0.1 : 0;
      const fdp = Math.min(1, Math.max(0, central(v.draughtProofedFrac, 'ventilation.draughtProofedFrac')));
      ninfAch = nFlue + 0.1 * (storeys - 1) + (frame ? 0.25 : 0.35) + floorTerm + 0.05 + (0.25 - 0.2 * fdp);
    }
    const sheltered = Math.min(4, Math.max(0, central(v.shelteredSides, 'ventilation.shelteredSides')));
    const nSh = ninfAch * (1 - 0.075 * sheltered);
    const system = choiceValue(v.system) ?? 'natural';
    const nEffAch = monthly((m) => {
      const nm = (nSh * ctx.climate.months[m]!.windMs) / 4;
      switch (system) {
        case 'mvhr':
          return nm + 0.5 * (1 - 0.85 * 0.8);
        case 'mev':
        case 'piv':
          return Math.max(0.5, nm + 0.25);
        default:
          return nm >= 1 ? nm : 0.5 + 0.5 * nm * nm;
      }
    });
    const hveWK = monthly((m) => 0.33 * nEffAch[m]! * V);

    const doc = { id: 'BP-3.3', doc: 'SAP 10.2 infiltration and ventilation' };
    const evidence = [
      floatDraft(ctx, 'vent.ninf', ninfAch, 'ach', doc, { inputs: [{ key: 'geom.volume', role: 'volume' }] }),
      ...monthlyDrafts(ctx, 'vent.neff', nEffAch, 'ach', doc, () => [{ key: 'vent.ninf', role: 'ninf' }]),
      ...monthlyDrafts(ctx, 'vent.hve', hveWK, 'W/K', { id: 'BP-3.3', doc: 'H_ve = 0.33 n_eff V' }, (m) => [
        { key: `vent.neff.${m}`, role: 'neff' },
        { key: 'geom.volume', role: 'volume' },
      ]),
    ];
    return { output: { ninfAch, nEffAch, hveWK }, evidence };
  },
};
