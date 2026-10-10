/**
 * `ens_retv`: Eco Niwas Samhita residential envelope transmittance value (RP 6.3, ENS 2018 3.4
 * Table 3, ENS 2024 5.2.1.4). Owner: WP-03.
 *
 *   RETV = (1 / A_env) * [a * sum(A_opq U_opq w) + b * sum(A_glz U_glz w) + c * sum(A_glz SHGC_eq w)]
 *
 * with (a, b, c) per climate. The three orientation-weighted sums come from the building physics
 * pack (the w factors are ENS table data); this function only combines them, exactly.
 */
import { Q, type Tri } from '@ibasho/core';
import { qOf } from './dt.ts';

export type EnsClimate = 'composite' | 'hot-dry' | 'warm-humid' | 'temperate';

/** ENS coefficients (a, b, c), in hundredths. Cold climate has no RETV (it uses U_envelope). */
export const ENS_COEFFS: Readonly<Record<EnsClimate, readonly [bigint, bigint, bigint]>> = {
  composite: [606n, 185n, 6899n],
  'hot-dry': [606n, 185n, 6899n],
  'warm-humid': [515n, 131n, 6521n],
  temperate: [338n, 37n, 6369n],
};

export interface RetvInput {
  climate: EnsClimate;
  /** Envelope area A_env, m2 (positive). */
  envelopeM2: number;
  /** sum(A_opq U_opq w), W/K. */
  opaque: number;
  /** sum(A_glz U_glz w), W/K. */
  glazingU: number;
  /** sum(A_glz SHGC_eq w), m2. */
  glazingSolar: number;
}

/** RETV in W/m2 as an exact rational. */
export function ensRetv(x: RetvInput): Q {
  const [a, b, c] = ENS_COEFFS[x.climate];
  const sum = Q.sum([
    Q.mul(Q.of(a, 100n), qOf(x.opaque)),
    Q.mul(Q.of(b, 100n), qOf(x.glazingU)),
    Q.mul(Q.of(c, 100n), qOf(x.glazingSolar)),
  ]);
  return Q.div(sum, qOf(x.envelopeM2));
}

function isClimate(s: string): s is EnsClimate {
  return Object.hasOwn(ENS_COEFFS, s);
}

/**
 * Named-function form: `ens_retv(climate, envelopeM2, opaque, glazingU, glazingSolar, limit)` is
 * true when RETV is at most `limit` (15 by ENS 2024, BEE target 12). Bad arguments are unknown.
 */
export function ensRetvFn(args: readonly (number | string)[]): Tri {
  if (args.length !== 6) return 'unknown';
  const [climate, ...rest] = args;
  if (typeof climate !== 'string' || !isClimate(climate)) return 'unknown';
  if (!rest.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0)) return 'unknown';
  const [env, opq, gu, gs, limit] = rest as number[];
  if (env! <= 0) return 'unknown';
  const retv = ensRetv({ climate, envelopeM2: env!, opaque: opq!, glazingU: gu!, glazingSolar: gs! });
  return Q.le(retv, qOf(limit!));
}
