/**
 * Fact environments for rules (RP 4). Owner: WP-03.
 *
 * Home facts are `h.*`, owner facts `o.*`, package facts `p.*`. Option facts (`m.*`) come from
 * `MeasureModel.facts`. A field that is unknown in the twin is the fact value `'unknown'`, never a
 * default. M-0 covers the facts the GH1 rules read; the full RP 4 table arrives at M-B.
 */
import type { Choice, HomeTwin, MicroPence, NumField, OwnerCtx, Tri } from '@ibasho/core';
import type { FactEnv, FactValue } from './expr.ts';
import { RuleError } from './expr.ts';

function num(f: NumField): FactValue {
  return f.state === 'unknown' ? 'unknown' : f.value;
}
/** Only a known choice is a fact; an estimated choice stays unknown for rules (unknown is not a guess). */
function choice<E extends string>(c: Choice<E>): FactValue {
  return c.state === 'known' ? c.value : 'unknown';
}
function tri(t: Tri | undefined): FactValue {
  return t ?? 'unknown';
}

/** `h.*` facts from the twin. */
export function homeFacts(twin: HomeTwin): FactEnv {
  const d = twin.legal.designations;
  const out: Record<string, FactValue> = {
    'h.region': twin.region,
    'h.tenure': choice(twin.legal.tenure),
    'h.designations.conservationArea': d.conservationArea,
    'h.designations.article23Land': d.article23Land,
    'h.designations.listedGrade': choice(d.listedGrade),
    'h.designations.inCurtilageOfListed': tri(d.inCurtilageOfListed),
    'h.designations.scheduledMonument': tri(d.scheduledMonument),
    'h.supply.phases': num(twin.legal.supply.phases),
    'h.supply.looped': twin.legal.supply.looped,
  };
  if (twin.legal.supply.fuseA !== undefined) out['h.supply.fuseA'] = num(twin.legal.supply.fuseA);
  return out;
}

/** A micro-pence amount as an exact number fact. Throws beyond 2^53 (about 90 million pounds). */
export function moneyFact(mp: MicroPence): number {
  const n = Number(mp);
  if (!Number.isSafeInteger(n)) throw new RuleError(`money fact ${mp} is not a safe integer`);
  return n;
}

/**
 * `o.*` facts. `o.budget.set` is always known (1 or 0) so the budget built-in is false, not
 * unknown, when no budget is set (SPEC R24: no budget at Reveal).
 */
export function ownerFacts(owner: OwnerCtx): FactEnv {
  const out: Record<string, FactValue> = {
    'o.tenure': owner.tenure === 'unknown' ? 'unknown' : owner.tenure,
    'o.budget.set': owner.budget === undefined ? 0 : 1,
  };
  if (owner.budget !== undefined) out['o.budget'] = moneyFact(owner.budget);
  if (owner.rights !== undefined) {
    out['o.rights.roof'] = owner.rights.roof;
    out['o.rights.externalWalls'] = owner.rights.externalWalls;
    out['o.rights.windows'] = owner.rights.windows;
  }
  return out;
}
