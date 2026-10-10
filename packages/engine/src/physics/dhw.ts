/**
 * Domestic hot water stage (BP 3.9, SAP Appendix J simplified). Owner: WP-01.
 *
 * Daily hot water at 52 degC, with mixed-water uses converted by f_hot = (41 - T_c) / (52 - T_c):
 * - showers 0.45 N + 0.65 per day, 6 min at 10 l/min (60 l mixed);
 * - baths 0.13 N + 0.19 per day at 73 l mixed;
 * - other uses 9.8 N + 14 l/day of hot water.
 * The total is scaled by the SAP monthly factors (1.10 in January to 0.90 in June and July).
 * Energy content Q_W = 4.18 V n (52 - T_c) / 3600 kWh, plus 15% distribution loss (BP 3.9);
 * `qwKWh` reports both. Mains temperature T_c: SAP Table J1 in the UK, theta_e in India
 * (rooftop tanks).
 * Cylinder standing loss (class `cylinder`): a new factory-insulated cylinder that comes with a
 * heat pump (SPEC 9 sub-measure `cylinder`) loses `newCylinderLossKWhPerDay`; any other cylinder
 * loses `cylinderLossKWhPerDay` (BP 3.9 range 0.5 to 1.5 kWh/day). Combi keep-hot and primary
 * circuit losses sit inside the seasonal efficiencies (SAP Appendix D values the pack uses).
 * PLACEHOLDER: the twin has no cylinder description yet (volume, insulation, jacket); the
 * cylinder jacket and solar thermal measures need it (INTERFACES request on the blackboard).
 */
import type { DhwMonthly, HomeTwin, Monthly, PhysicsStage, StageCtx } from '@ibasho/core';
import { days, monthly, monthlyDrafts } from './common.ts';

/** SAP 10.2 Table J1 cold water temperature, UK, degC. */
const T_COLD_UK = [8.0, 8.2, 9.3, 12.7, 14.6, 16.7, 18.4, 17.6, 16.6, 14.3, 11.1, 8.5];
/** SAP monthly hot water use factors. */
const MONTH_FACTOR = [1.1, 1.06, 1.02, 0.98, 0.94, 0.9, 0.9, 0.94, 0.98, 1.02, 1.06, 1.1];
const DISTRIBUTION_LOSS = 0.15;

export interface DhwDefaults {
  /** Standing loss of an existing hot water cylinder, kWh/day (BP 3.9: 0.5 to 1.5 by insulation). */
  cylinderLossKWhPerDay: number;
  /** Standing loss of a new factory-insulated heat pump cylinder, kWh/day. */
  newCylinderLossKWhPerDay: number;
  /** System ids that are heat pumps. */
  heatPumpIds: ReadonlySet<string>;
}

export interface DhwModel {
  /** Energy content of the hot water drawn, kWh. */
  contentKWh: Monthly<number>;
  /** Distribution loss, kWh. */
  distKWh: Monthly<number>;
  /** Storage (cylinder) loss, kWh. */
  storeKWh: Monthly<number>;
}

/** Shared DHW model (the gains stage reads it for water heating gains). */
export function dhwModel(twin: HomeTwin, n: number, ctx: StageCtx, d: DhwDefaults): DhwModel {
  const india = twin.region.startsWith('IN');
  const cold = (m: number) => (india ? ctx.climate.months[m]!.thetaE : T_COLD_UK[m]!);
  const contentKWh = monthly((m) => {
    const tc = Math.min(cold(m), 40);
    const fHot = (41 - tc) / (52 - tc);
    const litres =
      ((0.45 * n + 0.65) * 60 * fHot + (0.13 * n + 0.19) * 73 * fHot + (9.8 * n + 14)) * MONTH_FACTOR[m]!;
    return (4.18 * litres * days(m) * (52 - tc)) / 3600;
  });
  const distKWh = monthly((m) => contentKWh[m]! * DISTRIBUTION_LOSS);
  const cylinder = twin.systems.dhw.class === 'cylinder';
  const perDay = d.heatPumpIds.has(twin.systems.dhw.systemId)
    ? d.newCylinderLossKWhPerDay
    : d.cylinderLossKWhPerDay;
  const storeKWh = monthly((m) => (cylinder ? perDay * days(m) : 0));
  return { contentKWh, distKWh, storeKWh };
}

export function createDhwStage(d: DhwDefaults): PhysicsStage<'dhw'> {
  return {
    kind: 'physics-stage',
    id: 'stage-dhw',
    version: '0.2.0',
    title: 'engine.stage.dhw',
    side: 'engine',
    stage: 'dhw',
    modes: ['rating', 'standard', 'your-home'],
    run({ geometry, occupancyN: n }, ctx) {
      const model = dhwModel(geometry.twin, n, ctx, d);
      const qwKWh = monthly((m) => model.contentKWh[m]! + model.distKWh[m]!);
      const output: DhwMonthly = { qwKWh, cylinderLossKWh: model.storeKWh };
      const evidence = [
        ...monthlyDrafts(
          ctx,
          'dhw.qw',
          qwKWh,
          'kWh',
          { id: 'BP-3.9', doc: 'Q_W = 4.18 V n (52 - T_c) / 3600, + 15% distribution' },
          () => [{ key: 'occ.n', role: 'occupancy' }],
        ),
        ...monthlyDrafts(ctx, 'dhw.cyl_loss', model.storeKWh, 'kWh', {
          id: 'BP-3.9',
          doc: 'cylinder standing loss',
        }),
      ];
      return { output, evidence };
    },
  };
}
