/**
 * Fact environments for rules (RP 4). Owner: WP-03.
 *
 * Home facts are `h.*`, owner facts `o.*`, package facts `p.*`, constants `k.*`. Option facts
 * (`m.*`) come from `MeasureModel.facts`. A field that is unknown in the twin is the fact value
 * `'unknown'`, never a default. Booleans are written as `true`/`false` (they compare as 1 and 0).
 *
 * Derived home facts and their reading of the twin:
 * - `h.wall.u`: area-weighted U of the external `wall` elements; unknown if any area or U is unknown.
 * - `h.wall.solidMasonry`: every external wall has a `solid-*` construction (true), none has
 *   (false), else unknown. `h.wall.traditional` is the same fact: AD L 0.11 treats solid masonry
 *   with permeable materials as traditional construction.
 * - `h.art4.<code>`: whether an Article 4 direction removes GPDO class `<code>` here. Codes are
 *   `P<part>.<class>` (`P14.A` roof PV, `P14.G` air source heat pump, `P1.A` alterations such as
 *   cladding). Every code in `ART4_CODES` is known (the list in the twin is the full record), and
 *   any extra code the twin names is true.
 * - `h.glazing.swToFloor`: window area facing south to west (azimuth 135 to 315 degrees) over
 *   total floor area (Part O simplified method); unknown when an area or orientation is unknown.
 * - `h.envelope.areaM2`: exposed element area (walls, roof, floor, openings; party walls excluded).
 * - `h.past.adf.major`, `h.past.adf.minor`: AD F counts of past measures (`twin.done`), RP 6.2.
 */
import type { Choice, HomeTwin, MicroPence, NumField, OwnerCtx, Tri } from '@ibasho/core';
import { adfClassOfMeasureId } from './derive.ts';
import type { FactEnv, FactValue } from './expr.ts';
import { RuleError } from './expr.ts';

function num(f: NumField | undefined): FactValue {
  return f === undefined || f.state === 'unknown' ? 'unknown' : f.value;
}
/** Only a known choice is a fact; an estimated choice stays unknown for rules (unknown is not a guess). */
function choice<E extends string>(c: Choice<E> | undefined): FactValue {
  return c !== undefined && c.state === 'known' ? c.value : 'unknown';
}
function tri(t: Tri | undefined): FactValue {
  return t ?? 'unknown';
}

/** GPDO classes an Article 4 direction can remove that the T1 rules read. */
export const ART4_CODES = [
  'P1.A',
  'P1.C',
  'P1.D',
  'P1.E',
  'P14.A',
  'P14.B',
  'P14.G',
  'P14.H',
  'P14.I',
] as const;

const FLATS = new Set(['flat', 'maisonette']);

function wallFacts(twin: HomeTwin): { u: FactValue; solid: FactValue } {
  const walls = twin.elements.filter((e) => e.kind === 'wall');
  if (walls.length === 0) return { u: 'unknown', solid: 'unknown' };
  let area = 0;
  let ua = 0;
  let uKnown = true;
  for (const w of walls) {
    if (w.areaM2.state === 'unknown' || w.u.state === 'unknown') uKnown = false;
    else {
      area += w.areaM2.value;
      ua += w.areaM2.value * w.u.value;
    }
  }
  const solid = walls.map((w) => w.constructionId.startsWith('solid-'));
  const cavityOrFrame = walls.map((w) => /^(cavity|timber|steel|system)-/.test(w.constructionId));
  return {
    u: uKnown && area > 0 ? ua / area : 'unknown',
    solid: solid.every((x) => x) ? true : cavityOrFrame.every((x) => x) ? false : 'unknown',
  };
}

const EXPOSED = new Set(['wall', 'roof', 'floor', 'window', 'door', 'rooflight']);

/** Heat-loss envelope area (party walls excluded); unknown if any exposed area is unknown. */
function envelopeArea(twin: HomeTwin): FactValue {
  let a = 0;
  for (const e of twin.elements) {
    if (!EXPOSED.has(e.kind)) continue;
    if (e.areaM2.state === 'unknown') return 'unknown';
    a += e.areaM2.value;
  }
  return a;
}

function glazingSwToFloor(twin: HomeTwin): FactValue {
  const storeys = twin.form.storeys;
  const foot = twin.form.footprintM2;
  if (storeys.state === 'unknown' || foot.state === 'unknown') return 'unknown';
  const floor = storeys.value * foot.value;
  if (floor <= 0) return 'unknown';
  let sw = 0;
  for (const e of twin.elements) {
    if (e.kind !== 'window' && e.kind !== 'rooflight') continue;
    if (e.areaM2.state === 'unknown' || e.orientationDeg === undefined) return 'unknown';
    if (e.orientationDeg >= 135 && e.orientationDeg <= 315) sw += e.areaM2.value;
  }
  return sw / floor;
}

function topFloorFlat(twin: HomeTwin): FactValue {
  if (!FLATS.has(twin.form.builtForm)) return false;
  const level = twin.form.floorLevel;
  const storeys = twin.form.storeys;
  if (level === undefined || storeys.state === 'unknown') return 'unknown';
  return level >= storeys.value - 1;
}

function pastAdf(twin: HomeTwin): { major: number; minor: number } {
  let major = 0;
  let minor = 0;
  for (const d of twin.done) {
    const c = adfClassOfMeasureId(d.measureId);
    if (c === 'major') major++;
    else if (c === 'minor') minor++;
  }
  return { major, minor };
}

/** `h.*` facts from the twin. */
export function homeFacts(twin: HomeTwin): FactEnv {
  const d = twin.legal.designations;
  const wall = wallFacts(twin);
  const past = pastAdf(twin);
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
    'h.builtForm': twin.form.builtForm,
    'h.flat': FLATS.has(twin.form.builtForm),
    'h.detached': twin.form.builtForm === 'detached',
    'h.storeys': num(twin.form.storeys),
    'h.topFloorFlat': topFloorFlat(twin),
    'h.roof': choice(twin.form.roof),
    'h.dhw.class': twin.systems.dhw.class,
    'h.space.fuel': twin.systems.space.fuel,
    'h.pv.count': twin.systems.pv?.length ?? 0,
    'h.vent.system': choice(twin.ventilation.system),
    'h.vent.ap50': num(twin.ventilation.ap50),
    'h.floor.type': choice(twin.ventilation.floorType),
    'h.chimneys.open': num(twin.ventilation.chimneysOpen),
    'h.wall.u': wall.u,
    'h.wall.solidMasonry': wall.solid,
    'h.wall.traditional': wall.solid,
    'h.glazing.swToFloor': glazingSwToFloor(twin),
    'h.envelope.areaM2': envelopeArea(twin),
    'h.neighbours.known': twin.site.neighbours !== undefined,
    'h.past.adf.major': past.major,
    'h.past.adf.minor': past.minor,
    'h.roofIsCommonArea': tri(twin.legal.roofIsCommonArea),
    'h.lease.covenant': choice(twin.legal.leaseCovenant),
    'h.value.gbp': num(twin.legal.valueGBP),
    'h.sanctionedLoadKW': num(twin.legal.sanctionedLoadKW),
    'h.epc.band': twin.legal.epc?.band ?? 'unknown',
    'h.epc.sap': twin.legal.epc?.sap ?? 'unknown',
  };
  if (twin.legal.supply.fuseA !== undefined) out['h.supply.fuseA'] = num(twin.legal.supply.fuseA);
  for (const c of ART4_CODES) out[`h.art4.${c}`] = false;
  for (const c of d.article4RemovedClasses) out[`h.art4.${c}`] = true;
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
