/**
 * Zod schema for parsed weather files `ibasho.epw/1` (ARCH 15.4, SPEC R28). Owner: WP-00.
 * Weather comes from packs and user uploads, so it is validated on load: 8760 hourly values per
 * series, physical ranges checked loosely (bad rows are a parse error, not a silent zero).
 */
import { z } from 'zod';
import type { Epw } from '../../v3/site.ts';
import { Finite, IsoDateSchema } from '../common.ts';

const HOURS = 8760;
const series = (lo: number, hi: number) =>
  z
    .array(Finite)
    .length(HOURS)
    .refine((xs) => xs.every((v) => v >= lo && v <= hi), `hourly values must lie in ${lo} to ${hi}`);

export const EpwSchema: z.ZodType<Epw> = z.object({
  schema: z.literal('ibasho.epw/1'),
  hash: z.string().regex(/^[0-9a-f]{64}$/, 'sha256 hex'),
  location: z.object({
    city: z.string(),
    country: z.string(),
    source: z.string(),
    stationId: z.string(),
    lat: Finite.refine((v) => v >= -90 && v <= 90, 'latitude in degrees'),
    lon: Finite.refine((v) => v >= -180 && v <= 180, 'longitude in degrees'),
    tzHours: Finite.refine((v) => v >= -12 && v <= 14, 'time zone hours'),
    elevationM: Finite,
  }),
  period: z.enum(['typical', 'actual', 'future']),
  dryBulbC: series(-90, 70),
  dewPointC: series(-90, 70),
  rhPct: series(0, 110),
  ghiWhm2: series(0, 1600),
  dniWhm2: series(0, 1600),
  dhiWhm2: series(0, 1000),
  windMs: series(0, 80),
  windDirDeg: series(0, 360),
  source: z.object({
    id: z.string().min(1),
    title: z.string(),
    url: z.string().exactOptional(),
    clause: z.string().exactOptional(),
    retrieved: IsoDateSchema,
  }),
});
