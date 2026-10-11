/**
 * What-if levers on a building (SPEC 18.4). Owner: WP-08.
 *
 * Document levers (window share, shading on the sunny facades, the cooling system) edit the
 * variant's document, so every stage sees them through `compile()`. Design levers (glazing, roof
 * finish, walls, lighting, daylight controls, set point, PV) become `EnergyParams` for the Preview
 * energy stage (`@ibasho/preview` `PARAM_PRESETS`, `pvKwpFor`): the whole result is recomputed, and
 * the energy inputs hash includes them, so energy, codes and optimise rerun.
 */
import type { BuildingDoc, CompiledBuilding, EnergyParams, FacadeBin } from '@ibasho/core';
import { edit, SHADE_PRESETS, setFacade } from '@ibasho/editor/core';
import { PARAM_PRESETS, pvKwpFor } from '@ibasho/preview';
import type { Levers } from './settings.ts';

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

/** Design levers as energy parameters (absent: the building as drawn). */
export function energyParams(levers: Levers, compiled: CompiledBuilding | undefined): EnergyParams {
  let p: EnergyParams = {};
  if (levers.glazing === 'low-e') p = { ...p, ...PARAM_PRESETS.glazing['low-e'] };
  if (levers.roof === 'cool') p = { ...p, ...PARAM_PRESETS.roof.cool };
  if (levers.wall === 'insulated') p = { ...p, ...PARAM_PRESETS.wall.insulated };
  if (levers.lighting === 'led') p = { ...p, ...PARAM_PRESETS.lighting.led };
  if (levers.daylight === 'on') p = { ...p, ...PARAM_PRESETS.daylight.on };
  if (levers.setpoint !== undefined && Number(levers.setpoint) !== 24)
    p = { ...p, setpointC: Number(levers.setpoint) };
  const pv = Number(levers.pv ?? 0);
  if (pv > 0 && compiled) p = { ...p, pvKwp: pvKwpFor(compiled, pv / 100) };
  return p;
}
