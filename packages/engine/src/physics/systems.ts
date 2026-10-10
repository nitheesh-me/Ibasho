/**
 * Systems stage: delivered energy by fuel before renewables (BP 3.10), in kWh. Owner: WP-01.
 *
 * E_f,m = space Q_H / eff_space + (Q_W + cylinder loss) / eff_dhw + Q_C / eff_cooling
 *         + lighting and appliances (electricity) + cooking (hob fuel).
 * Efficiencies are seasonal efficiencies or fixed COPs (M-0): the system ref's own `efficiency`
 * field, else the `system` plugin with that id (its `efficiency`). A missing efficiency is an
 * error, never a silent default. Gas hobs use the same cooking energy as electric (estimate).
 * M-0 status: EN 14825 bin SCOP and the flow temperature chain (BP 3.10 steps 1 to 8), pumps and
 * fans arrive at M-A.
 */
import {
  choiceValue,
  type Fuel,
  type FuelMonthly,
  FUELS,
  type Monthly,
  numCentral,
  type PhysicsStage,
  type SystemPlugin,
  type SystemRef,
} from '@ibasho/core';
import { monthly, PhysicsError } from './common.ts';
import { householdOf } from './household.ts';

export interface SystemsDefaults {
  /** System plugins by id, for efficiencies the twin does not state. */
  systems: ReadonlyMap<string, SystemPlugin>;
}

export function efficiencyOf(ref: SystemRef, systems: ReadonlyMap<string, SystemPlugin>, what: string): number {
  const eff = ref.efficiency !== undefined ? numCentral(ref.efficiency) : systems.get(ref.systemId)?.efficiency;
  if (eff === undefined) throw new PhysicsError(`${what} system ${ref.systemId} has no efficiency (twin or plugin)`);
  if (!(eff > 0) || !Number.isFinite(eff)) throw new PhysicsError(`${what} efficiency must be positive, got ${eff}`);
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

export function createSystemsStage(d: SystemsDefaults): PhysicsStage<'systems'> {
  return {
    kind: 'physics-stage',
    id: 'stage-systems-m0',
    version: '0.1.0',
    title: 'engine.stage.systems',
    side: 'engine',
    stage: 'systems',
    modes: ['rating', 'standard', 'your-home'],
    run(input) {
      const hh = householdOf(input);
      const sys = input.systems;
      const acc = emptyFuelMonthly();
      const add = (fuel: Fuel, m: number, kwh: number) => {
        acc[fuel][m] = acc[fuel][m]! + kwh;
      };
      const effSpace = efficiencyOf(sys.space, d.systems, 'space');
      const effDhw = efficiencyOf(sys.dhw, d.systems, 'dhw');
      const cooler = sys.cooling?.[0];
      const effCool = cooler ? efficiencyOf(cooler, d.systems, 'cooling') : 1;
      const hob = choiceValue(sys.hob) ?? 'electric';
      const cookFuel: Fuel = hob === 'gas' ? 'gas' : 'electricity';
      for (let m = 0; m < 12; m++) {
        add(sys.space.fuel, m, input.demand.qhKWh[m]! / effSpace);
        add(sys.dhw.fuel, m, (input.dhw.qwKWh[m]! + input.dhw.cylinderLossKWh[m]!) / effDhw);
        if (cooler) add(cooler.fuel, m, input.cooling.qcKWh[m]! / effCool);
        add('electricity', m, hh.lightingKWh[m]! + hh.appliancesKWh[m]!);
        add(cookFuel, m, hh.cookingKWh[m]!);
      }
      return { output: freezeFuelMonthly(acc), evidence: [] };
    },
  };
}
