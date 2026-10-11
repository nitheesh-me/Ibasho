/**
 * What-if levers on a building (SPEC 18.4). Owner: WP-08.
 *
 * Geometry levers (window share, shading) and the cooling system edit the variant's document, so
 * every stage sees them through `compile()`. The other levers (glazing, roof finish, lighting,
 * daylight controls, set point, PV, walls) are design parameters the Preview energy stage does not
 * read yet: `adjustEnergy` applies them to the energy result with the same factors the Preview
 * optimiser uses. PLACEHOLDER until `@ibasho/preview` reads design parameters from the energy
 * input (requested from agent A on the blackboard); then this file keeps only `variantDoc`.
 */
import type { BuildingDoc, BuildingResult, CompiledBuilding, EndUse, FacadeBin } from '@ibasho/core';
import { edit, SHADE_PRESETS, setFacade } from '@ibasho/editor';
import { BASE_LEVERS, type Levers } from './settings.ts';

const SUNNY: FacadeBin[] = ['E', 'SE', 'S', 'SW', 'W'];
const HVAC: Record<string, string> = { split: 'split-ac', vrf: 'vrf', chiller: 'chiller-water-cooled' };

/** The variant's document: the building as it is plus the variant's document levers. */
export function variantDoc(base: BuildingDoc, changes: Levers): BuildingDoc {
  let doc = base;
  if (changes.wwr !== undefined)
    doc = edit(doc, 'wwr', setFacade('all', 'all', { wwrPm: Number(changes.wwr) * 10 })).doc;
  if (changes.shading !== undefined) {
    const preset = changes.shading === 'deep' ? 'box' : String(changes.shading);
    const rules = SHADE_PRESETS.find((p) => p.id === preset)?.rules ?? [];
    for (const bin of SUNNY) doc = edit(doc, 'shading', setFacade('all', bin, { shading: rules })).doc;
  }
  const hv = changes.hvac !== undefined ? HVAC[String(changes.hvac)] : undefined;
  if (hv) {
    doc = edit(doc, 'hvac', (d) => {
      const keep = d.systems.filter((s) => /precision|data/.test(s.systemId));
      d.systems = [{ systemId: hv, fuel: 'electricity' }, ...keep];
    }).doc;
  }
  return doc;
}

const MONTH_PV = [0.085, 0.09, 0.1, 0.1, 0.1, 0.075, 0.065, 0.07, 0.075, 0.08, 0.08, 0.08];

/** True when a lever needs the energy adjustment (not carried by the document). */
export const hasParamLevers = (l: Levers): boolean =>
  ['glazing', 'roof', 'lighting', 'daylight', 'setpoint', 'pv', 'wall'].some(
    (k) => k in l && l[k] !== BASE_LEVERS[k],
  );

const scaleBig = (v: bigint, k: number) => BigInt(Math.round(Number(v) * k));

/** Apply design-parameter levers to an energy result (whole recompute of totals, never summed percentages). */
export function adjustEnergy(
  res: BuildingResult,
  compiled: CompiledBuilding,
  levers: Levers,
): BuildingResult {
  if (!hasParamLevers(levers)) return res;
  const sp = Number(levers.setpoint ?? 24);
  const cool =
    (levers.glazing === 'low-e' ? 0.86 : 1) *
    (levers.roof === 'cool' ? 0.95 : 1) *
    (levers.wall === 'insulated' ? 0.96 : 1) *
    Math.max(0.5, 1 - 0.07 * (sp - 24));
  const light = (levers.lighting === 'led' ? 0.65 : 1) * (levers.daylight === 'on' ? 0.78 : 1);
  const roofM2 = Number(compiled.quantities.roofMm2) / 1e6;
  const pvKwh = (Number(levers.pv ?? 0) / 100) * (roofM2 / 6.5) * 1450;
  const endUses = { ...res.endUses } as Record<EndUse, readonly (bigint | 'unknown')[]>;
  const mul = (u: EndUse, k: number) => {
    endUses[u] = res.endUses[u].map((v) => (v === 'unknown' ? v : scaleBig(v, k)));
  };
  mul('cooling', cool);
  mul('lighting', light);
  if (pvKwh > 0)
    endUses.pv = res.endUses.pv.map((v, m) =>
      v === 'unknown' ? v : v - BigInt(Math.round(pvKwh * (MONTH_PV[m] ?? 0) * 1000)),
    );
  const total = (e: Record<EndUse, readonly (bigint | 'unknown')[]>) =>
    Object.values(e).reduce(
      (s, xs) => s + xs.reduce<number>((a, v) => a + (v === 'unknown' ? 0 : Number(v)), 0),
      0,
    );
  const before = total(res.endUses as Record<EndUse, readonly (bigint | 'unknown')[]>);
  const after = total(endUses);
  const k = before > 0 ? Math.max(0, after / before) : 1;
  return {
    ...res,
    inputsHash: `${res.inputsHash}:levers:${JSON.stringify(levers)}`,
    endUses,
    eui: {
      ...res.eui,
      site: { lo: res.eui.site.lo * k, hi: res.eui.site.hi * k },
      source: { lo: res.eui.source.lo * k, hi: res.eui.source.hi * k },
    },
    bills: res.bills.map((b) =>
      b.carrier === 'electricity'
        ? { ...b, total: scaleBig(b.total, k), byMonth: b.byMonth.map((v) => scaleBig(v, k)) }
        : b,
    ),
    carbon: { ...res.carbon, op: scaleBig(res.carbon.op, k) },
  };
}
