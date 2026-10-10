/**
 * Renewables stage (BP 3.11). Owner: WP-01.
 *
 * M-0 status: PV, battery and solar thermal are light measures outside the M-0 slice. A twin with
 * no PV yields zeros. A twin with PV is rejected with a clear error rather than modelled with the
 * SAP 10.2 Appendix M beta formula, whose transcription is pending a re-read (DEC SC-F2).
 * PLACEHOLDER: the real yield and self-use model lands at M-A with the PV validation test.
 */
import type { PhysicsStage, RenewOut } from '@ibasho/core';
import { PhysicsError, ZERO12 } from './common.ts';

export const renewablesStage: PhysicsStage<'renewables'> = {
  kind: 'physics-stage',
  id: 'stage-renewables-m0',
  version: '0.1.0',
  title: 'engine.stage.renewables',
  side: 'engine',
  stage: 'renewables',
  modes: ['rating', 'standard', 'your-home'],
  run(_input, ctx) {
    if ((ctx.twin.systems.pv?.length ?? 0) > 0) {
      throw new PhysicsError(
        'PV is not modelled before M-A (SAP 10.2 Appendix M beta pending re-read, DEC SC-F2)',
      );
    }
    const output: RenewOut = {
      pvYieldKWh: ZERO12,
      selfUseKWh: ZERO12,
      exportKWh: ZERO12,
      solarThermalKWh: ZERO12,
    };
    return { output, evidence: [] };
  },
};
