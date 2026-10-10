/**
 * Delivered stage: the quantisation boundary (SPEC R20, ARCH 4 principle 4). Owner: WP-01.
 *
 * Delivered electricity is the systems electricity minus PV self-use; every fuel is then quantised
 * once to integer Wh by `quantiseWh` (round half to even on kWh * 1000). After this point all
 * bookkeeping is integer.
 */
import { type EvidenceDraft, FUELS, type Fuel, type PhysicsStage, toWire } from '@ibasho/core';
import { subjectOf } from './common.ts';
import { freezeFuelMonthly } from './systems.ts';

export class QuantiseError extends Error {
  override name = 'QuantiseError';
}

/**
 * kWh (float) to integer Wh, rounding half to even. Exact and deterministic: kWh * 1000 is one
 * IEEE multiplication, and the rounding uses only floor and comparisons.
 */
export function quantiseWh(kWh: number): bigint {
  const x = kWh * 1000;
  if (!Number.isFinite(x)) throw new QuantiseError(`cannot quantise non-finite energy ${kWh} kWh`);
  if (Math.abs(x) > Number.MAX_SAFE_INTEGER) throw new QuantiseError(`energy ${kWh} kWh is out of range`);
  const f = Math.floor(x);
  const r = x - f; // exact for |x| < 2^53
  let q = f;
  if (r > 0.5 || (r === 0.5 && f % 2 !== 0)) q = f + 1;
  return BigInt(q);
}

/** Evidence inputs for each fuel's delivered energy: the demand terms that feed it. */
function inputsFor(m: number): { key: string; role: string }[] {
  return [
    { key: `heat.qh.${m}`, role: 'space heating' },
    { key: `dhw.qw.${m}`, role: 'hot water' },
    { key: `dhw.cyl_loss.${m}`, role: 'cylinder loss' },
    { key: `cool.qc.${m}`, role: 'cooling' },
    { key: 'occ.n', role: 'occupancy' },
  ];
}

export const deliveredStage: PhysicsStage<'delivered'> = {
  kind: 'physics-stage',
  id: 'stage-delivered-m0',
  version: '0.1.0',
  title: 'engine.stage.delivered',
  side: 'engine',
  stage: 'delivered',
  modes: ['rating', 'standard', 'your-home'],
  run({ systems, renew }, ctx) {
    const acc = {} as Record<Fuel, bigint[]>;
    const evidence: EvidenceDraft[] = [];
    for (const f of FUELS) {
      acc[f] = [];
      for (let m = 0; m < 12; m++) {
        const kWh = f === 'electricity' ? systems[f][m]! - renew.selfUseKWh[m]! : systems[f][m]!;
        acc[f].push(quantiseWh(kWh));
      }
      if (acc[f].every((v) => v === 0n)) continue;
      acc[f].forEach((wh, m) => {
        const quantity = `energy.delivered.${f}.${m}`;
        evidence.push({
          key: quantity,
          quantity,
          subject: subjectOf(ctx, { month: m }),
          value: { fixed: toWire(wh), unit: 'Wh' },
          unit: 'Wh',
          formula: { id: 'BP-3.10', doc: 'E_f = sum Q / efficiency, quantised to Wh (R20)' },
          inputs: inputsFor(m),
          provenance: { kind: 'computed' },
          rounding: { mode: 'sig', value: 3 },
        });
      });
    }
    return { output: freezeFuelMonthly(acc), evidence };
  },
};
