/**
 * Systems stage: delivered energy by fuel before renewables (BP 3.10), in kWh. Owner: WP-01.
 *
 * E_f,m = space Q_H / eff_space + (Q_W + cylinder loss) / eff_dhw + (Q_C + Q_lat) / SEER
 *         + lighting and appliances + cooking + fans.
 * - Boilers and other systems: seasonal efficiency from the system ref, else the `system` plugin.
 *   A missing efficiency is an error, never a silent default.
 * - Heat pumps (`system` category `heat-pump`): the BP 3.10 chain (`heat-pump.ts`) gives monthly
 *   space SPF from EN 14825 bins and hot water SPF at 55 degC; a weekly legionella cycle adds
 *   200 l x 4.18 x 10 K / 3600 = 2.32 kWh per week of direct electricity (ESTIMATE). A twin that
 *   states or measures its own efficiency overrides the chain.
 * - Cooking (BP 3.6, SAP L20 E_cook = 138 + 28 N as the electric reference): half the energy is
 *   the hob (ESTIMATE). Hob efficiencies (ESTIMATE, US DOE and ACEEE test ranges): electric
 *   reference 0.75, induction 0.85, gas 0.38. So a gas hob uses 0.5 E_cook x 0.75 / 0.38 of gas
 *   plus 0.5 E_cook of oven electricity; induction uses 0.5 E_cook x 0.75 / 0.85 + 0.5 E_cook. With
 *   induction and no other gas use, delivered gas is 0 and the gas supply can be capped (the
 *   `hob-induction-gas-disconnect` option; WP-02 drops the standing charge).
 * - MVHR fans (BP 6.1): SFP 0.8 W/(l/s) x (0.5 ach x V / 3.6 l/s) running all year.
 */
import {
  choiceValue,
  type ClimateMonth,
  FUELS,
  type Fuel,
  type FuelMonthly,
  type HourlyClimate,
  type InputSource,
  type Monthly,
  type NumField,
  numCentral,
  type PhysicsStage,
  type SystemPlugin,
  type SystemRef,
  type SystemsIn,
} from '@ibasho/core';
import { days, floatDraft, monthly, monthlyDrafts, PhysicsError } from './common.ts';
import { DEFAULT_FIELD_FACTOR, type HpChain, heatPumpChain } from './heat-pump.ts';
import { householdOf } from './household.ts';

export interface SystemsDefaults {
  /** System plugins by id, for efficiencies the twin does not state. */
  systems: ReadonlyMap<string, SystemPlugin>;
  /** Heat pump field factor (BP 3.10 step 7). */
  hpFieldFactor?: number;
}

/** Heat loss figures the runner passes to the systems stage (local adapter, see README). */
export interface HeatLossIn {
  /** Design heat loss of this run's twin, W. */
  designLossW: number;
  /** Design heat loss of the home before the package (emitter sizing basis), W. */
  designLossBaseW: number;
  thetaEdC: number;
  months: readonly ClimateMonth[];
  /** Hourly climate when the pack has one synchronously (TMY). */
  hourly?: HourlyClimate;
  volumeM3: number;
}
export type SystemsInExt = SystemsIn & { heat?: HeatLossIn };

const HOB_SHARE = 0.5;
const EFF_COOK_REF = 0.75;
const EFF_INDUCTION = 0.85;
const EFF_GAS_HOB = 0.38;
const LEGIONELLA_KWH_PER_WEEK = (200 * 4.18 * 10) / 3600;
const MVHR_SFP = 0.8;

function statedEfficiency(f: NumField | undefined): number | undefined {
  if (!f || f.state === 'unknown') return undefined;
  const src: InputSource = f.source;
  return src.kind === 'stated' || src.kind === 'measured' || src.kind === 'document' ? numCentral(f) : undefined;
}

export function efficiencyOf(
  ref: SystemRef,
  systems: ReadonlyMap<string, SystemPlugin>,
  what: string,
): number {
  const eff =
    ref.efficiency !== undefined ? numCentral(ref.efficiency) : systems.get(ref.systemId)?.efficiency;
  if (eff === undefined)
    throw new PhysicsError(`${what} system ${ref.systemId} has no efficiency (twin or plugin)`);
  if (!(eff > 0) || !Number.isFinite(eff))
    throw new PhysicsError(`${what} efficiency must be positive, got ${eff}`);
  return eff;
}

export function emptyFuelMonthly(): Record<Fuel, number[]> {
  const out = {} as Record<Fuel, number[]>;
  for (const f of FUELS) out[f] = new Array<number>(12).fill(0);
  return out;
}

export function freezeFuelMonthly<T>(acc: Record<Fuel, T[]>): FuelMonthly<T> {
  const out = {} as Record<Fuel, Monthly<T>>;
  for (const f of FUELS) out[f] = monthly((m) => acc[f][m]!);
  return out as FuelMonthly<T>;
}

export function isHeatPump(ref: SystemRef, systems: ReadonlyMap<string, SystemPlugin>): boolean {
  return systems.get(ref.systemId)?.category === 'heat-pump';
}

export function createSystemsStage(d: SystemsDefaults): PhysicsStage<'systems'> {
  return {
    kind: 'physics-stage',
    id: 'stage-systems',
    version: '0.2.0',
    title: 'engine.stage.systems',
    side: 'engine',
    stage: 'systems',
    modes: ['rating', 'standard', 'your-home'],
    run(input, ctx) {
      const hh = householdOf(input);
      const heat = (input as SystemsInExt).heat;
      const sys = input.systems;
      const acc = emptyFuelMonthly();
      const evidence = [];
      const add = (fuel: Fuel, m: number, kwh: number) => {
        acc[fuel][m] = acc[fuel][m]! + kwh;
      };
      const hpSpace = isHeatPump(sys.space, d.systems) && statedEfficiency(sys.space.efficiency) === undefined;
      const hpDhw = isHeatPump(sys.dhw, d.systems) && statedEfficiency(sys.dhw.efficiency) === undefined;
      let chain: HpChain | undefined;
      if (hpSpace || hpDhw) {
        if (!heat) throw new PhysicsError('heat pump needs the heat loss input (run it through the WP-01 runner)');
        const rads = sys.emitters.radiators;
        const k = numCentral(sys.emitters.kOversize);
        const emitterW50 =
          rads && rads.length > 0
            ? rads.reduce((a, r) => a + numCentral(r.outputW50), 0)
            : k * heat.designLossBaseW;
        chain = heatPumpChain({
          designLossW: heat.designLossW,
          emitterW50,
          thetaEd: heat.thetaEdC,
          months: heat.months,
          fieldFactor: d.hpFieldFactor ?? DEFAULT_FIELD_FACTOR,
          ...(heat.hourly ? { hourly: heat.hourly.thetaE } : {}),
        });
        const hpDoc = { id: 'BP-3.10', doc: 'heat pump chain (EN 14825 bins, Ruhnau 2019 COP)' };
        evidence.push(
          floatDraft(ctx, 'hp.design_load', chain.designLossW / 1000, 'kW', hpDoc, {
            inputs: [{ key: 'fabric.htr', role: 'htr' }],
          }),
          floatDraft(ctx, 'hp.size_kw', chain.sizeKw, 'kW', hpDoc, {
            inputs: [{ key: 'hp.design_load', role: 'design load' }],
          }),
          floatDraft(ctx, 'hp.flow_design', chain.flowDesignC, 'degC', hpDoc, {
            inputs: [{ key: 'hp.design_load', role: 'design load' }],
          }),
          floatDraft(ctx, 'hp.scop_bins', chain.scop, '1', hpDoc, {
            inputs: [{ key: 'hp.flow_design', role: 'design flow' }],
          }),
          ...monthlyDrafts(ctx, 'hp.spf', chain.spfSpace, '1', hpDoc, () => [
            { key: 'hp.flow_design', role: 'design flow' },
          ]),
        );
      }
      const effSpace = hpSpace ? 0 : efficiencyOf(sys.space, d.systems, 'space');
      const effDhw = hpDhw ? 0 : efficiencyOf(sys.dhw, d.systems, 'dhw');
      const cooler = sys.cooling?.[0];
      const effCool = cooler ? efficiencyOf(cooler, d.systems, 'cooling') : 1;
      const hob = choiceValue(sys.hob) ?? 'electric';
      const mvhr = choiceValue(ctx.twin.ventilation.system) === 'mvhr';
      const fanW = mvhr && heat ? (MVHR_SFP * 0.5 * heat.volumeM3) / 3.6 : 0;
      for (let m = 0; m < 12; m++) {
        const space = input.demand.qhKWh[m]!;
        add(sys.space.fuel, m, hpSpace ? space / chain!.spfSpace[m]! : space / effSpace);
        const water = input.dhw.qwKWh[m]! + input.dhw.cylinderLossKWh[m]!;
        if (hpDhw) {
          add(sys.dhw.fuel, m, water / chain!.spfDhw[m]!);
          add('electricity', m, (LEGIONELLA_KWH_PER_WEEK * days(m)) / 7);
        } else add(sys.dhw.fuel, m, water / effDhw);
        if (cooler) add(cooler.fuel, m, (input.cooling.qcKWh[m]! + input.cooling.qlatKWh[m]!) / effCool);
        add('electricity', m, hh.lightingKWh[m]! + hh.appliancesKWh[m]!);
        const cook = hh.cookingKWh[m]!;
        const oven = (1 - HOB_SHARE) * cook;
        const hobRef = HOB_SHARE * cook;
        if (hob === 'gas') {
          add('gas', m, (hobRef * EFF_COOK_REF) / EFF_GAS_HOB);
          add('electricity', m, oven);
        } else if (hob === 'induction') add('electricity', m, oven + (hobRef * EFF_COOK_REF) / EFF_INDUCTION);
        else add('electricity', m, cook);
        if (fanW > 0) add('electricity', m, (fanW * 24 * days(m)) / 1000);
      }
      return { output: freezeFuelMonthly(acc), evidence };
    },
  };
}
