/**
 * Obligations: normalise and turn into a twin patch (ARCH 5.4 step 4, Lean `Oblige`). Owner: WP-03.
 *
 * `normaliseObligations` merges what several rules oblige into one canonical, sorted list:
 * - `max-u` per element kind keeps the strictest (lowest) U;
 * - `emitter-flow` keeps the lowest flow temperature;
 * - `ventilation` keeps the strongest system (natural < intermittent-extract < piv < mev < mvhr)
 *   and the highest category;
 * - `hp-meets-design-load`, `assessment` and `add-option` are de-duplicated.
 * It is idempotent and order-free: `normalise(normalise(xs)) = normalise(xs)` and
 * `normalise(xs ++ xs) = normalise(xs)` (C4).
 *
 * `obligationPatch(twin, obligations)` is the `TwinPatch` the search applies before re-running
 * physics. It only ever tightens: a wall U already at or below the obligation is left alone, and a
 * stronger ventilation system is kept. So applying the patch twice equals applying it once.
 * Obligations with no twin field (`emitter-flow`, `hp-meets-design-load`, `assessment`,
 * `add-option`) are returned in `unpatched`; the search sizes emitters and adds costed options.
 */
import type { HomeTwin, NumField, Obligation, TwinPatch, VentSystem } from '@ibasho/core';
import { compareStrings } from '@ibasho/core';

const VENT_RANK: Readonly<Record<VentSystem, number>> = {
  natural: 0,
  'intermittent-extract': 1,
  piv: 2,
  mev: 3,
  mvhr: 4,
};
const CAT_RANK = { A: 0, B: 1, C: 2 } as const;

function keyOf(o: Obligation): string {
  switch (o.kind) {
    case 'max-u':
      return `max-u|${o.element}`;
    case 'ventilation':
      return 'ventilation';
    case 'emitter-flow':
      return 'emitter-flow';
    case 'hp-meets-design-load':
      return 'hp-meets-design-load';
    case 'assessment':
      return `assessment|${o.check}`;
    case 'add-option':
      return `add-option|${o.optionId}`;
  }
}

function merge(a: Obligation, b: Obligation): Obligation {
  if (a.kind === 'max-u' && b.kind === 'max-u') return a.maxU <= b.maxU ? a : b;
  if (a.kind === 'emitter-flow' && b.kind === 'emitter-flow') return a.maxFlowC <= b.maxFlowC ? a : b;
  if (a.kind === 'ventilation' && b.kind === 'ventilation') {
    const system = VENT_RANK[a.system] >= VENT_RANK[b.system] ? a.system : b.system;
    const ca = a.category === undefined ? -1 : CAT_RANK[a.category];
    const cb = b.category === undefined ? -1 : CAT_RANK[b.category];
    const category = ca >= cb ? a.category : b.category;
    return category === undefined
      ? { kind: 'ventilation', system }
      : { kind: 'ventilation', system, category };
  }
  return a;
}

/** Canonical, de-duplicated obligations, sorted by key. */
export function normaliseObligations(obligations: readonly Obligation[]): Obligation[] {
  const by = new Map<string, Obligation>();
  for (const o of obligations) {
    const k = keyOf(o);
    const prev = by.get(k);
    by.set(k, prev === undefined ? o : merge(prev, o));
  }
  return [...by.entries()].sort((x, y) => compareStrings(x[0], y[0])).map(([, o]) => o);
}

const knownU = (u: number): NumField => ({
  state: 'known',
  value: u,
  source: { kind: 'derived', from: ['rules.oblige'] },
});

/** The patch that makes `twin` meet the obligations it can express, and what is left over. */
export function obligationPatch(
  twin: HomeTwin,
  obligations: readonly Obligation[],
): { patch: TwinPatch; unpatched: Obligation[] } {
  const set: TwinPatch['set'] = [];
  const unpatched: Obligation[] = [];
  for (const o of normaliseObligations(obligations)) {
    if (o.kind === 'max-u') {
      twin.elements.forEach((e, i) => {
        if (e.kind !== o.element) return;
        if (e.u.state !== 'unknown' && e.u.value <= o.maxU) return;
        set.push({ path: `/elements/${i}/u`, value: knownU(o.maxU) });
      });
    } else if (o.kind === 'ventilation') {
      const cur = twin.ventilation.system;
      if (cur.state !== 'unknown' && VENT_RANK[cur.value] >= VENT_RANK[o.system]) continue;
      set.push({
        path: '/ventilation/system',
        value: { state: 'known', value: o.system, source: { kind: 'derived', from: ['rules.oblige'] } },
      });
    } else unpatched.push(o);
  }
  return { patch: { set }, unpatched };
}
