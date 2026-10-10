/**
 * Zod building blocks for wire-bound contracts. Owner: WP-00.
 * Each schema is annotated with its TS contract type, so a drift between the two fails
 * `tsc`; `test/schemas.test.ts` also checks the reverse direction.
 */
import { z } from 'zod';
import {
  GRADES,
  type Grade,
  type IsoDate,
  isIsoDate,
  isSemVer,
  REGION_CODES,
  type RegionCode,
  type SemVer,
} from '../common.ts';
import type { Choice, InputSource, NumField, Tri } from '../fields.ts';

export const IsoDateSchema = z.custom<IsoDate>((v) => typeof v === 'string' && isIsoDate(v), {
  message: 'expected a calendar date YYYY-MM-DD',
});
export const SemVerSchema = z.custom<SemVer>((v) => typeof v === 'string' && isSemVer(v), {
  message: 'expected MAJOR.MINOR.PATCH',
});
export const RegionCodeSchema = z.enum(REGION_CODES as [RegionCode, ...RegionCode[]]);
export const GradeSchema = z.enum(GRADES as [Grade, ...Grade[]]);
export const TriSchema: z.ZodType<Tri> = z.union([z.boolean(), z.literal('unknown')]);
/** Finite float (JSON has no NaN or infinity). */
export const Finite = z.number().refine(Number.isFinite, 'expected a finite number');
/** Fixed-point wire integer: decimal string, no leading zeros, no `-0` (ARCH 4.3). */
export const WireIntSchema = z.string().regex(/^(?:0|-?[1-9]\d*)$/, 'expected a decimal integer string');
/** Rational wire value `n/d` or `n`, normalised (`Q.fromWire` re-checks gcd). */
export const WireQSchema = z.string().regex(/^(?:0|-?[1-9]\d*)(?:\/[1-9]\d*)?$/, 'expected n/d');

export const IvalSchema = z
  .object({ lo: Finite, hi: Finite })
  .refine((v) => v.lo <= v.hi, 'lo must be <= hi');
const Range = z.tuple([Finite, Finite]).refine(([a, b]) => a <= b, 'range must be ordered');

export const InputSourceSchema: z.ZodType<InputSource> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stated') }),
  z.object({ kind: z.literal('measured'), how: z.enum(['bill', 'meter', 'survey']) }),
  z.object({
    kind: z.literal('document'),
    doc: z.enum(['epc', 'lease', 'survey']),
    ref: z.string().exactOptional(),
  }),
  z.object({ kind: z.literal('default'), pluginId: z.string() }),
  z.object({ kind: z.literal('derived'), from: z.array(z.string()) }),
  z.object({ kind: z.literal('calibrated'), posterior: IvalSchema }),
]);

export const NumFieldSchema: z.ZodType<NumField> = z.discriminatedUnion('state', [
  z.object({ state: z.literal('known'), value: Finite, source: InputSourceSchema }),
  z.object({ state: z.literal('estimated'), value: Finite, range: Range, source: InputSourceSchema }),
  z.object({ state: z.literal('unknown'), range: Range, material: z.boolean(), source: InputSourceSchema }),
]);

/** Schema for `Choice<E>` over a fixed list of values. */
export function choiceSchema<const E extends string>(values: readonly [E, ...E[]]): z.ZodType<Choice<E>> {
  const v = z.enum(values as unknown as [E, ...E[]]) as unknown as z.ZodType<E>;
  return z.discriminatedUnion('state', [
    z.object({ state: z.literal('known'), value: v, source: InputSourceSchema }),
    z.object({ state: z.literal('estimated'), value: v, options: z.array(v), source: InputSourceSchema }),
    z.object({
      state: z.literal('unknown'),
      options: z.array(v),
      material: z.boolean(),
      source: InputSourceSchema,
    }),
  ]) as unknown as z.ZodType<Choice<E>>;
}
