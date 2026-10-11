/**
 * Wire building blocks for v3 schemas. Owner: WP-00.
 *
 * JSON has no bigint, so fixtures and exports write integers as decimal strings (`toWireJson`).
 * Schemas accept either a bigint (in-memory values) or the wire string, and always output bigint,
 * so `parse(JSON.parse(toWireJson(x)))` deep-equals `x` (the round-trip tests rely on it).
 */
import { z } from 'zod';
import { Q } from '../../exact/q.ts';
import type { Mm } from '../../v3/building.ts';
import { Finite, WireIntSchema, WireQSchema } from '../common.ts';

/** bigint, or its decimal wire string. */
export const BigSchema = z.union([z.bigint(), WireIntSchema.transform((s) => BigInt(s))]);
/** Non-negative bigint (areas, litres, losses). */
export const BigNonNegSchema = BigSchema.refine((v) => v >= 0n, 'expected a non-negative integer');

/** Exact rational as `{ n, d }` (bigints or wire strings) or the `"n/d"` wire string. */
export const QSchema: z.ZodType<Q> = z.union([
  WireQSchema.transform((s) => Q.fromWire(s)),
  z.object({ n: BigSchema, d: BigSchema }).transform((v, ctx) => {
    if (v.d <= 0n) {
      ctx.addIssue({ code: 'custom', message: 'denominator must be positive' });
      return z.NEVER;
    }
    return Q.of(v.n, v.d);
  }),
]);

/** Safe integer millimetres. */
export const MmSchema: z.ZodType<Mm> = z.int();
export const PointMmSchema = z.tuple([z.int(), z.int()]);
export const Point3MmSchema = z.tuple([z.int(), z.int(), z.int()]);
/** Per mille, 0 to 1000. */
export const PerMilleSchema = z.int().min(0).max(1000);
/** Twelve monthly values. */
export const monthly = <T extends z.ZodType>(t: T) => z.array(t).length(12);

export const IvalSchemaV3 = z
  .object({ lo: Finite, hi: Finite })
  .refine((v) => v.lo <= v.hi, 'lo must be <= hi');

/** JSON with bigints written as decimal strings (Q values become `{ n, d }` string pairs). */
export function toWireJson(value: unknown, space?: number): string {
  return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), space);
}
