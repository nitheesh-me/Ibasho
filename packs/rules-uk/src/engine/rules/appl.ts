/**
 * Applicability rules (`APPL.*`, ARCH 5.4: applicability is rules, not a measure method). Owner: WP-03.
 *
 * A measure that cannot apply to this home is a `block`. Unknown facts give `needs-check`, which
 * names the fact to find out (for example an airtightness test before MVHR). These read only home
 * facts, option facts and the derived package kinds, so the checker can recompute them.
 */
import type { Rule } from '@ibasho/core';
import { all, cmp, no, not, SRC } from './helpers.ts';

const SPEC9 = 'https://www.legislation.gov.uk/uksi/2010/2214/contents';

export const APPL_CYLINDER_JACKET_COMBI: Rule = {
  id: 'APPL.CYLINDER-JACKET.COMBI',
  jurisdiction: 'GB',
  measures: ['cylinder-jacket'],
  scope: 'measure',
  when: cmp('h.dhw.class', '=', 'combi'),
  effect: { kind: 'block', reason: 'rules.appl.cylinder-jacket.combi.reason' },
  effectiveFrom: '2000-01-01',
  source: {
    url: SRC.adL2021,
    clause: 'SPEC 9: a cylinder jacket needs a hot water cylinder; a combi has none',
    grade: 'primary',
  },
  explain: 'rules.appl.cylinder-jacket.combi.explain',
};

export const APPL_SOLAR_THERMAL_COMBI: Rule = {
  id: 'APPL.SOLAR-THERMAL.COMBI',
  jurisdiction: 'GB',
  measures: ['solar-thermal'],
  scope: 'package',
  when: all(
    cmp('h.dhw.class', '=', 'combi'),
    cmp('p.kind.ashp', '=', 0),
    cmp('p.kind.gshp', '=', 0),
    cmp('p.kind.cylinder', '=', 0),
  ),
  effect: { kind: 'block', reason: 'rules.appl.solar-thermal.combi.reason' },
  effectiveFrom: '2000-01-01',
  source: {
    url: SRC.adL2021,
    clause: 'SPEC 9: solar thermal needs a cylinder; not applicable to a combi unless the package adds one',
    grade: 'primary',
  },
  explain: 'rules.appl.solar-thermal.combi.explain',
};

export const APPL_MVHR_AP50: Rule = {
  id: 'APPL.MVHR.AP50',
  jurisdiction: 'GB',
  measures: ['mvhr'],
  scope: 'measure',
  when: not(cmp('h.vent.ap50', '<=', 5)),
  effect: { kind: 'block', reason: 'rules.appl.mvhr.ap50.reason' },
  effectiveFrom: '2000-01-01',
  source: {
    url: SRC.adF2021,
    clause: 'SPEC 9: MVHR only if AP50 is at most 5 m3/(h m2) (measured)',
    grade: 'primary',
  },
  explain: 'rules.appl.mvhr.ap50.explain',
};

export const APPL_LOFT_ACCESS: Rule = {
  id: 'APPL.LOFT.ACCESS',
  jurisdiction: 'GB',
  measures: ['loft'],
  scope: 'measure',
  when: no('m.loft.accessible'),
  effect: { kind: 'block', reason: 'rules.appl.loft.access.reason' },
  effectiveFrom: '2000-01-01',
  source: {
    url: SPEC9,
    clause: 'SPEC 9 loft group: joist-level insulation needs an accessible loft',
    grade: 'primary',
  },
  explain: 'rules.appl.loft.access.explain',
};

export const APPL_FLOOR_SUSPENDED: Rule = {
  id: 'APPL.FLOOR.SUSPENDED',
  jurisdiction: 'GB',
  measures: ['floor'],
  scope: 'measure',
  when: cmp('h.floor.type', '=', 'solid'),
  effect: { kind: 'block', reason: 'rules.appl.floor.suspended.reason' },
  effectiveFrom: '2000-01-01',
  source: {
    url: SPEC9,
    clause: 'SPEC 9 floor group: suspended timber floor insulation needs a suspended floor',
    grade: 'primary',
  },
  explain: 'rules.appl.floor.suspended.explain',
};

export const APPL_RULES: readonly Rule[] = [
  APPL_CYLINDER_JACKET_COMBI,
  APPL_SOLAR_THERMAL_COMBI,
  APPL_MVHR_AP50,
  APPL_LOFT_ACCESS,
  APPL_FLOOR_SUSPENDED,
];
