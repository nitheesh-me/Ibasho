/**
 * Sentence renderer for rules (RP 3: "the same rule can be evaluated in TypeScript, rendered as a
 * sentence, and exported to Lean as data"). Owner: WP-03.
 *
 * `renderExpr` turns a condition into plain British English; `renderRule` adds the effect, giving
 * "If the supply is looped, a DNO approval is needed first." Fact wording comes from `FACT_LABELS`
 * (packs may pass more); an unlabelled fact is read from its id. The narrator and the evidence
 * drawer use this text when a rule has no hand-written explanation; it never invents numbers: every
 * number in the sentence is a literal of the rule.
 */
import type { CheckKind, Effect, Expr, FactId, NamedFn, Obligation, Rule } from '@ibasho/core';

/** A boolean fact reads as a clause; any other fact as a noun phrase. */
export type FactLabel = { clause: string; negated: string } | { noun: string };

export const FACT_LABELS: Readonly<Record<FactId, FactLabel>> = {
  'h.supply.looped': {
    clause: 'the electricity supply is looped',
    negated: 'the electricity supply is not looped',
  },
  'h.supply.phases': { noun: 'the number of supply phases' },
  'h.designations.article23Land': {
    clause: 'the home is on Article 2(3) land',
    negated: 'the home is not on Article 2(3) land',
  },
  'h.designations.conservationArea': {
    clause: 'the home is in a conservation area',
    negated: 'the home is not in a conservation area',
  },
  'h.designations.listedGrade': { noun: 'the listed grade' },
  'h.designations.inCurtilageOfListed': {
    clause: 'the home is in the curtilage of a listed building',
    negated: 'the home is not in the curtilage of a listed building',
  },
  'h.designations.scheduledMonument': {
    clause: 'the site is a scheduled monument',
    negated: 'the site is not a scheduled monument',
  },
  'h.wall.u': { noun: 'the wall U-value' },
  'h.wall.solidMasonry': {
    clause: 'the walls are solid masonry',
    negated: 'the walls are not solid masonry',
  },
  'h.wall.traditional': {
    clause: 'the walls are of traditional construction',
    negated: 'the walls are not of traditional construction',
  },
  'h.dhw.class': { noun: 'the hot water system' },
  'h.flat': { clause: 'the home is a flat', negated: 'the home is not a flat' },
  'h.detached': { clause: 'the home is detached', negated: 'the home is not detached' },
  'h.vent.ap50': { noun: 'the measured air permeability (AP50)' },
  'h.tenure': { noun: 'the tenure' },
  'o.tenure': { noun: 'your tenure' },
  'o.budget': { noun: 'your budget' },
  'o.budget.set': { noun: 'whether a budget is set' },
  'p.capex': { noun: 'the package cost' },
  'p.export.W': { noun: 'the export capacity in watts' },
  'p.export.limitW': { noun: 'the G98 limit for your supply in watts' },
  'p.vent.provided': {
    clause: 'the package already provides continuous ventilation',
    negated: 'the package does not provide continuous ventilation',
  },
  'p.airtighter': {
    clause: 'the package makes the home more airtight',
    negated: 'the package does not make the home more airtight',
  },
  'p.funded.pas2035': {
    clause: 'a funded scheme that requires PAS 2035 applies',
    negated: 'no funded scheme that requires PAS 2035 applies',
  },
  'm.ewi.finish': { noun: 'the new wall finish' },
  'm.ewi.matches': {
    clause: 'the new finish matches the existing walls',
    negated: 'the new finish does not match the existing walls',
  },
  'm.wall.share': { noun: 'the share of the wall treated' },
  'm.pv.mount': { noun: 'where the panels are mounted' },
  'm.pv.frontsHighway': {
    clause: 'the panels front a highway',
    negated: 'the panels do not front a highway',
  },
  'm.ashp.volumeM3': { noun: 'the outdoor unit volume in cubic metres' },
  'm.ashp.units': { noun: 'the number of outdoor units' },
  'm.ashp.mount': { noun: 'where the outdoor unit is mounted' },
  'm.loft.accessible': { clause: 'the loft is accessible', negated: 'the loft is not accessible' },
};

const FN_TEXT: Readonly<Record<NamedFn, { yes: string; no: string }>> = {
  mcs020a_Lp_le: {
    yes: 'the heat pump noise is at most 37.0 dB(A) at every neighbouring window and door (MCS 020 a)',
    no: 'the heat pump noise is above 37.0 dB(A) at a neighbouring window or door (MCS 020 a)',
  },
  adf_category: {
    yes: 'the ventilation category from Approved Document F Diagram 3.1 is at least the one named',
    no: 'the ventilation category from Approved Document F Diagram 3.1 is below the one named',
  },
  ens_retv: {
    yes: 'the envelope transmittance (RETV) is within the Eco Niwas Samhita limit',
    no: 'the envelope transmittance (RETV) is above the Eco Niwas Samhita limit',
  },
  mees_cap: { yes: 'the spend is within the MEES cost cap', no: 'the spend is above the MEES cost cap' },
  dt_hosting: {
    yes: 'the local transformer can host the extra solar',
    no: 'the local transformer cannot host the extra solar',
  },
};

const ADF_ARG: Readonly<Record<string, string>> = { 'k.adf.A': 'A', 'k.adf.B': 'B', 'k.adf.C': 'C' };

const OP_TEXT = {
  '<': 'is less than',
  '<=': 'is at most',
  '=': 'is',
  '>=': 'is at least',
  '>': 'is more than',
  '!=': 'is not',
} as const;

function idWords(f: FactId): string {
  const parts = f.split('.');
  const head =
    parts[0] === 'h'
      ? 'the home'
      : parts[0] === 'm'
        ? 'the option'
        : parts[0] === 'p'
          ? 'the package'
          : 'you';
  const rest = parts
    .slice(1)
    .join(' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return `${head} ${rest}`;
}

function nounOf(f: FactId, labels: Readonly<Record<FactId, FactLabel>>): string {
  const l = labels[f];
  if (l === undefined) return idWords(f);
  return 'noun' in l ? l.noun : idWords(f);
}

function lit(v: string | number): string {
  return typeof v === 'number' ? String(v) : v;
}

function list(xs: readonly string[], conj: 'and' | 'or'): string {
  if (xs.length <= 1) return xs[0] ?? '';
  return `${xs.slice(0, -1).join(', ')} ${conj} ${xs[xs.length - 1]}`;
}

function boolCmp(e: Expr, labels: Readonly<Record<FactId, FactLabel>>, negate: boolean): string | undefined {
  if (!('cmp' in e) || typeof e.right !== 'number' || (e.right !== 0 && e.right !== 1)) return undefined;
  if (e.cmp !== '=' && e.cmp !== '!=') return undefined;
  const l = labels[e.left.fact];
  if (l === undefined || !('clause' in l)) return undefined;
  const truthy = (e.right === 1) === (e.cmp === '=');
  return truthy !== negate ? l.clause : l.negated;
}

function fnText(e: Expr, negate: boolean): string | undefined {
  if (!('fn' in e)) return undefined;
  const t = FN_TEXT[e.fn];
  let s = negate ? t.no : t.yes;
  if (e.fn === 'adf_category') {
    const cat = ADF_ARG[e.args[2]?.fact ?? ''];
    if (cat !== undefined) s = s.replace('the one named', cat);
  }
  return s;
}

/** A condition as an English clause. */
export function renderExpr(e: Expr, labels: Readonly<Record<FactId, FactLabel>> = FACT_LABELS): string {
  const go = (x: Expr, nested: boolean): string => {
    if ('const' in x) return x.const === true ? 'always' : x.const === false ? 'never' : 'it is not known';
    if ('and' in x)
      return x.and.length === 0
        ? 'always'
        : list(
            x.and.map((c) => go(c, true)),
            'and',
          );
    if ('or' in x) {
      if (x.or.length === 0) return 'never';
      const body = list(
        x.or.map((c) => go(c, true)),
        'or',
      );
      return nested && x.or.length > 1 ? `either ${body}` : body;
    }
    if ('not' in x)
      return (
        boolCmp(x.not, labels, true) ?? fnText(x.not, true) ?? `it is not the case that ${go(x.not, true)}`
      );
    const b = boolCmp(x, labels, false) ?? fnText(x, false);
    if (b !== undefined) return b;
    if ('cmp' in x) {
      const right = typeof x.right === 'object' ? nounOf(x.right.fact, labels) : lit(x.right);
      return `${nounOf(x.left.fact, labels)} ${OP_TEXT[x.cmp]} ${right}`;
    }
    if ('in' in x) return `${nounOf(x.in.fact, labels)} is ${list(x.set.map(lit), 'or')}`;
    return '';
  };
  return go(e, false);
}

const AUTHORITY_TEXT: Readonly<Record<string, string>> = {
  LPA: 'planning permission from the local planning authority',
  'LPA-prior-approval': 'prior approval from the local planning authority',
  LBC: 'listed building consent',
  'building-control': 'building control sign-off (or a competent person scheme)',
  freeholder: "the freeholder's consent",
  landlord: "the landlord's consent",
  RWA: "the residents' welfare association's resolution",
  DISCOM: "the distribution company's approval",
  DNO: "the network operator's (DNO) approval before installing",
  highway: "the highway authority's licence",
  neighbour: "the neighbour's agreement",
};

const CHECK_TEXT: Readonly<Record<CheckKind, string>> = {
  'moisture-assessment': 'a moisture risk assessment (BS 5250 or BS EN 15026)',
  'dno-approval': 'a DNO approval',
  structural: 'a structural check',
  'pas2035-assessment': 'a PAS 2035 retrofit assessment',
  asbestos: 'an asbestos survey',
};

function obligationText(o: Obligation): string {
  switch (o.kind) {
    case 'max-u':
      return `the whole ${o.element} must reach a U-value of ${o.maxU} where technically, functionally and economically feasible`;
    case 'ventilation':
      return `ventilation must be provided (${o.system}${o.category === undefined ? '' : `, category ${o.category}`})`;
    case 'emitter-flow':
      return `emitters must be sized for a flow temperature of ${o.maxFlowC} C or lower`;
    case 'hp-meets-design-load':
      return 'the heat pump must meet the full design heat loss';
    case 'assessment':
      return `${CHECK_TEXT[o.check]} must be carried out (it is costed)`;
    case 'add-option':
      return `the package must include ${o.optionId}`;
  }
}

/** The effect as the main clause of a sentence. */
export function renderEffect(e: Effect): string {
  switch (e.kind) {
    case 'block':
      return 'this is not possible';
    case 'consent':
      return `you need ${AUTHORITY_TEXT[e.authority] ?? e.authority}`;
    case 'oblige':
      return obligationText(e.spec);
    case 'check':
      return `${CHECK_TEXT[e.check]} is needed first`;
    case 'warn':
      return 'there is a risk to weigh';
    case 'info':
      return 'there is something to know';
  }
}

function capitalise(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

/** The whole rule as one sentence: "If <condition>, <effect>." */
export function renderRule(rule: Rule, labels: Readonly<Record<FactId, FactLabel>> = FACT_LABELS): string {
  const cond = renderExpr(rule.when, labels);
  const eff = renderEffect(rule.effect);
  if (cond === 'always') return `${capitalise(eff)}.`;
  return `If ${cond}, ${eff}.`;
}
