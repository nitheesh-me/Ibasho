/**
 * England permitted development rules (RP 5.1, SPEC 9, DEC SC-3). Owner: WP-03.
 *
 * GPDO 2015 Schedule 2 Part 14 Class G (air source heat pumps, as amended by SI 2025/560 from
 * 2025-05-29), Part 14 Class A (solar PV), Part 1 Class A (cladding) and Article 4 directions. A
 * failed limb means a planning application (consent from the LPA), never a block: the owner can
 * still apply (SPEC 9: "the front is consent, not block").
 */
import type { MeasureKind, Rule } from '@ibasho/core';
import { all, always, any, cmp, isIn, no, not, SRC, yes } from './helpers.ts';

const ENG = 'GB-ENG' as const;
const LPA = { kind: 'consent', authority: 'LPA', typicalWeeks: 8 } as const;
const ASHP: MeasureKind[] = ['ashp'];
/** SI 2025/560 commencement as RP 5.1 dates it (the boundary rule's last day is 2025-05-28). */
const SI_2025_560 = '2025-05-29';
const CLASS_G = '2011-12-01';
const PD_2015 = '2015-04-15';

const listed = any(
  cmp('h.designations.listedGrade', '!=', 'none'),
  yes('h.designations.inCurtilageOfListed'),
);

export const ENG_PD_ASHP_NOISE: Rule = {
  id: 'ENG.PD.ASHP.NOISE',
  jurisdiction: ENG,
  measures: ASHP,
  scope: 'measure',
  when: not({ fn: 'mcs020a_Lp_le', args: [{ fact: 'm.ashp.noise' }] }),
  effect: LPA,
  effectiveFrom: SI_2025_560,
  source: {
    url: SRC.mcs020a,
    clause: 'MCS 020 a) Issue 1.1: Lp,total at most 37.0 dB(A), rational enclosure (RP 6.1)',
    grade: 'primary',
  },
  explain: 'rules.eng.pd.ashp.noise.explain',
};

export const ENG_PD_ASHP_VOLUME: Rule = {
  id: 'ENG.PD.ASHP.VOLUME',
  jurisdiction: ENG,
  measures: ASHP,
  scope: 'measure',
  when: any(
    all(no('h.flat'), cmp('m.ashp.volumeM3', '>', 1.5)),
    all(yes('h.flat'), cmp('m.ashp.volumeM3', '>', 0.6)),
  ),
  effect: LPA,
  effectiveFrom: SI_2025_560,
  source: {
    url: SRC.oxfordHp,
    clause: 'GPDO Pt14 Class G as amended: unit volume over 1.5 m3 (0.6 m3 on a block of flats)',
    grade: 'secondary',
  },
  explain: 'rules.eng.pd.ashp.volume.explain',
};

export const ENG_PD_ASHP_COUNT: Rule = {
  id: 'ENG.PD.ASHP.COUNT',
  jurisdiction: ENG,
  measures: ASHP,
  scope: 'measure',
  when: any(
    all(yes('h.detached'), cmp('m.ashp.units', '>', 2)),
    all(no('h.detached'), cmp('m.ashp.units', '>', 1)),
  ),
  effect: LPA,
  effectiveFrom: SI_2025_560,
  source: {
    url: SRC.si2025_560,
    clause: 'SI 2025/560: two units on a detached house, otherwise one',
    grade: 'primary',
  },
  explain: 'rules.eng.pd.ashp.count.explain',
};

export const ENG_PD_ASHP_HWY23: Rule = {
  id: 'ENG.PD.ASHP.HWY23',
  jurisdiction: ENG,
  measures: ASHP,
  scope: 'measure',
  when: all(
    yes('h.designations.article23Land'),
    any(yes('m.ashp.frontsHighway'), yes('m.ashp.nearerHighway')),
  ),
  effect: LPA,
  effectiveFrom: CLASS_G,
  source: {
    url: SRC.oxfordHp,
    clause:
      'GPDO Pt14 Class G: on Article 2(3) land, not on a wall or roof fronting a highway, nor nearer the highway than the house',
    grade: 'secondary',
  },
  explain: 'rules.eng.pd.ashp.hwy23.explain',
};

export const ENG_PD_ASHP_LISTED: Rule = {
  id: 'ENG.PD.ASHP.LISTED',
  jurisdiction: ENG,
  measures: ASHP,
  scope: 'measure',
  when: listed,
  effect: LPA,
  effectiveFrom: CLASS_G,
  source: {
    url: SRC.gpdoPt14,
    clause: 'GPDO Pt14 Class G: not within the curtilage of a listed building',
    grade: 'secondary',
  },
  explain: 'rules.eng.pd.ashp.listed.explain',
};

export const ENG_PD_ASHP_SCHEDMON: Rule = {
  id: 'ENG.PD.ASHP.SCHEDMON',
  jurisdiction: ENG,
  measures: ASHP,
  scope: 'measure',
  when: yes('h.designations.scheduledMonument'),
  effect: LPA,
  effectiveFrom: CLASS_G,
  source: {
    url: SRC.gpdoPt14,
    clause: 'GPDO Pt14 Class G: not on a site designated as a scheduled monument',
    grade: 'secondary',
  },
  explain: 'rules.eng.pd.ashp.schedmon.explain',
};

export const ENG_PD_ASHP_FLATROOF: Rule = {
  id: 'ENG.PD.ASHP.FLATROOF',
  jurisdiction: ENG,
  measures: ASHP,
  scope: 'measure',
  when: all(cmp('m.ashp.mount', '=', 'flat-roof'), cmp('m.ashp.edgeDistM', '<', 1)),
  effect: LPA,
  effectiveFrom: SI_2025_560,
  source: {
    url: SRC.oxfordHp,
    clause: 'GPDO Pt14 Class G as amended: on a flat roof, at least 1 m from the roof edge',
    grade: 'secondary',
  },
  explain: 'rules.eng.pd.ashp.flatroof.explain',
};

export const ENG_PD_ASHP_PITCHED: Rule = {
  id: 'ENG.PD.ASHP.PITCHED',
  jurisdiction: ENG,
  measures: ASHP,
  scope: 'measure',
  when: cmp('m.ashp.mount', '=', 'pitched-roof'),
  effect: LPA,
  effectiveFrom: CLASS_G,
  source: { url: SRC.oxfordHp, clause: 'GPDO Pt14 Class G: not on a pitched roof', grade: 'secondary' },
  explain: 'rules.eng.pd.ashp.pitched.explain',
};

export const ENG_PD_ASHP_COOLONLY: Rule = {
  id: 'ENG.PD.ASHP.COOLONLY',
  jurisdiction: ENG,
  measures: ASHP,
  scope: 'measure',
  when: yes('m.ashp.coolingOnly'),
  effect: LPA,
  effectiveFrom: CLASS_G,
  source: {
    url: SRC.oxfordHp,
    clause: 'GPDO Pt14 Class G: used solely for heating (or heating and cooling), not cooling only',
    grade: 'secondary',
  },
  explain: 'rules.eng.pd.ashp.coolonly.explain',
};

/** Retired by SI 2025/560: the 1 m boundary limb applies up to and including 2025-05-28 (C5). */
export const ENG_PD_ASHP_BOUNDARY1M: Rule = {
  id: 'ENG.PD.ASHP.BOUNDARY1M',
  jurisdiction: ENG,
  measures: ASHP,
  scope: 'measure',
  when: cmp('m.ashp.boundaryDistM', '<', 1),
  effect: LPA,
  effectiveFrom: CLASS_G,
  effectiveTo: '2025-05-28',
  source: {
    url: SRC.si2025_560,
    clause: 'GPDO Pt14 Class G before SI 2025/560: at least 1 m from the property boundary (retired)',
    grade: 'primary',
  },
  explain: 'rules.eng.pd.ashp.boundary1m.explain',
};

export const ENG_PD_ASHP_SITING: Rule = {
  id: 'ENG.PD.ASHP.SITING',
  jurisdiction: ENG,
  measures: ASHP,
  scope: 'measure',
  when: always,
  effect: { kind: 'info', note: 'rules.eng.pd.ashp.siting.note' },
  effectiveFrom: CLASS_G,
  source: {
    url: SRC.oxfordHp,
    clause:
      'GPDO Pt14 Class G conditions: site to minimise visual and amenity impact; remove when no longer needed',
    grade: 'secondary',
  },
  explain: 'rules.eng.pd.ashp.siting.explain',
};

/** Article 4 directions: PD rights for a class are removed only where a direction is recorded. */
const art4 = (id: string, measures: MeasureKind[], code: string, what: string): Rule => ({
  id,
  jurisdiction: ENG,
  measures,
  scope: 'measure',
  when: yes(`h.art4.${code}`),
  effect: LPA,
  effectiveFrom: PD_2015,
  source: {
    url: SRC.gpdoArt4,
    clause: `GPDO 2015 article 4: a direction removing ${what}`,
    grade: 'primary',
  },
  explain: `rules.${id.toLowerCase()}.explain`,
});
export const ENG_PD_ART4_PV = art4(
  'ENG.PD.ART4.PV',
  ['pv', 'solar-thermal'],
  'P14.A',
  'Part 14 Class A (roof and wall solar)',
);
export const ENG_PD_ART4_ASHP = art4(
  'ENG.PD.ART4.ASHP',
  ['ashp'],
  'P14.G',
  'Part 14 Class G (air source heat pumps)',
);
export const ENG_PD_ART4_EWI = art4(
  'ENG.PD.ART4.EWI',
  ['ewi'],
  'P1.A',
  'Part 1 Class A (alterations, including cladding)',
);

export const ENG_PD_PV_WALL23: Rule = {
  id: 'ENG.PD.PV.WALL23',
  jurisdiction: ENG,
  measures: ['pv'],
  scope: 'measure',
  when: all(cmp('m.pv.mount', '=', 'wall'), yes('h.designations.article23Land'), yes('m.pv.frontsHighway')),
  effect: LPA,
  effectiveFrom: PD_2015,
  source: {
    url: SRC.wyrePv,
    clause: 'GPDO Pt14 Class A: wall-mounted panels fronting a highway on Article 2(3) land',
    grade: 'secondary',
  },
  explain: 'rules.eng.pd.pv.wall23.explain',
};

export const ENG_PD_PV_FLAT23: Rule = {
  id: 'ENG.PD.PV.FLAT23',
  jurisdiction: ENG,
  measures: ['pv'],
  scope: 'measure',
  when: all(cmp('m.pv.mount', '=', 'flat'), yes('h.designations.article23Land')),
  effect: { kind: 'consent', authority: 'LPA-prior-approval', typicalWeeks: 8 },
  effectiveFrom: '2023-12-21',
  source: {
    url: SRC.cornwallPv,
    clause:
      'GPDO Pt14 Class A as amended by SI 2023/1279: flat roof on Article 2(3) land, prior approval on visual impact',
    grade: 'secondary',
  },
  explain: 'rules.eng.pd.pv.flat23.explain',
};

export const ENG_PD_PV_PROJ: Rule = {
  id: 'ENG.PD.PV.PROJ',
  jurisdiction: ENG,
  measures: ['pv'],
  scope: 'measure',
  when: all(isIn('m.pv.mount', ['roof', 'wall']), cmp('m.pv.projectionM', '>', 0.2)),
  effect: LPA,
  effectiveFrom: PD_2015,
  source: {
    url: SRC.wyrePv,
    clause: 'GPDO Pt14 Class A: panels project more than 0.2 m from the roof slope or wall',
    grade: 'secondary',
  },
  explain: 'rules.eng.pd.pv.proj.explain',
};

export const ENG_PD_PV_LISTED: Rule = {
  id: 'ENG.PD.PV.LISTED',
  jurisdiction: ENG,
  measures: ['pv', 'solar-thermal'],
  scope: 'measure',
  when: any(listed, yes('h.designations.scheduledMonument')),
  effect: LPA,
  effectiveFrom: PD_2015,
  source: {
    url: SRC.wyrePv,
    clause: 'GPDO Pt14 Class A: listed building, its curtilage or a scheduled monument',
    grade: 'secondary',
  },
  explain: 'rules.eng.pd.pv.listed.explain',
};

/** Finishes that need consent on Article 2(3) land under Part 1 Class A, A.2(a) (DEC SC-3). */
export const CLADDING_FINISHES = ['render', 'stone', 'pebbledash', 'timber', 'plastic', 'tiles'];

export const ENG_PD_EWI_ART23: Rule = {
  id: 'ENG.PD.EWI.ART23',
  jurisdiction: ENG,
  measures: ['ewi'],
  scope: 'measure',
  when: all(yes('h.designations.article23Land'), isIn('m.ewi.finish', CLADDING_FINISHES)),
  effect: LPA,
  effectiveFrom: PD_2015,
  source: {
    url: SRC.gpdoPt1,
    clause: 'GPDO Pt1 Class A, A.2(a): cladding of any elevation on Article 2(3) land (DEC SC-3)',
    grade: 'secondary',
  },
  explain: 'rules.eng.pd.ewi.art23.explain',
};

export const ENG_PD_EWI_LOOK: Rule = {
  id: 'ENG.PD.EWI.LOOK',
  jurisdiction: ENG,
  measures: ['ewi'],
  scope: 'measure',
  when: no('m.ewi.matches'),
  effect: LPA,
  effectiveFrom: PD_2015,
  source: {
    url: SRC.croydonWalls,
    clause:
      'GPDO Pt1 Class A, A.3(a): materials of similar appearance; a non-matching front is consent, not block (DEC SC-3)',
    grade: 'secondary',
  },
  explain: 'rules.eng.pd.ewi.look.explain',
};

export const ENG_PD_EWI_FLAT: Rule = {
  id: 'ENG.PD.EWI.FLAT',
  jurisdiction: ENG,
  measures: ['ewi'],
  scope: 'measure',
  when: yes('h.flat'),
  effect: LPA,
  effectiveFrom: PD_2015,
  source: {
    url: SRC.croydonWalls,
    clause: 'GPDO Pt1 is for dwellinghouses only: flats and maisonettes need permission',
    grade: 'secondary',
  },
  explain: 'rules.eng.pd.ewi.flat.explain',
};

/** Listed building consent for works that affect character, inside or out (P(LBCA)A 1990 s7). */
export const ENG_LB_ANY: Rule = {
  id: 'ENG.LB.ANY',
  jurisdiction: ENG,
  measures: [
    'ewi',
    'iwi',
    'glazing-double',
    'glazing-secondary',
    'floor',
    'ashp',
    'pv',
    'solar-thermal',
    'mvhr',
    'roof-insulation',
  ],
  scope: 'measure',
  when: listed,
  effect: { kind: 'consent', authority: 'LBC', typicalWeeks: 8 },
  effectiveFrom: '1990-05-24',
  source: {
    url: SRC.lbca1990,
    clause: 'Planning (Listed Buildings and Conservation Areas) Act 1990 s7',
    grade: 'primary',
  },
  explain: 'rules.eng.lb.any.explain',
};

export const PD_RULES: readonly Rule[] = [
  ENG_PD_ASHP_NOISE,
  ENG_PD_ASHP_VOLUME,
  ENG_PD_ASHP_COUNT,
  ENG_PD_ASHP_HWY23,
  ENG_PD_ASHP_LISTED,
  ENG_PD_ASHP_SCHEDMON,
  ENG_PD_ASHP_FLATROOF,
  ENG_PD_ASHP_PITCHED,
  ENG_PD_ASHP_COOLONLY,
  ENG_PD_ASHP_BOUNDARY1M,
  ENG_PD_ASHP_SITING,
  ENG_PD_ART4_PV,
  ENG_PD_ART4_ASHP,
  ENG_PD_ART4_EWI,
  ENG_PD_PV_WALL23,
  ENG_PD_PV_FLAT23,
  ENG_PD_PV_PROJ,
  ENG_PD_PV_LISTED,
  ENG_PD_EWI_ART23,
  ENG_PD_EWI_LOOK,
  ENG_PD_EWI_FLAT,
  ENG_LB_ANY,
];
