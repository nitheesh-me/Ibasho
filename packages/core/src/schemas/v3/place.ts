/**
 * Zod schemas for places and city tiles (ARCH 15.4, 15.7). Owner: WP-00.
 * City tiles come from packs built offline and cached in IndexedDB, so they are validated on load.
 */
import { z } from 'zod';
import type { CityTile, ContextBuilding, ContextTree, Place } from '../../v3/place.ts';
import { Finite, IsoDateSchema } from '../common.ts';
import { PointMmSchema } from './wire.ts';

const opt = <T extends z.ZodType>(s: T) => s.exactOptional();
const Id = z.string().min(1).max(120);

export const PlaceSchema: z.ZodType<Place> = z.object({
  id: Id,
  name: z.string(),
  lat: Finite.refine((v) => v >= -90 && v <= 90, 'latitude in degrees'),
  lon: Finite.refine((v) => v >= -180 && v <= 180, 'longitude in degrees'),
  elevationM: Finite,
  trueNorthMdeg: z.int(),
  climatePackId: Id,
  codePackIds: z.array(Id),
  moneyPackIds: z.array(Id),
  cityPackId: opt(Id),
  buildingIds: z.array(Id),
  lineage: opt(z.object({ from: Id, at: IsoDateSchema })),
  sample: opt(z.literal(true)),
});

const HeightRange = z
  .object({ lo: z.int().min(0), likely: z.int().min(0), hi: z.int().min(0) })
  .refine((h) => h.lo <= h.likely && h.likely <= h.hi, 'lo <= likely <= hi');

export const ContextBuildingSchema: z.ZodType<ContextBuilding> = z.object({
  id: Id,
  footprint: z.array(PointMmSchema).min(3),
  holes: opt(z.array(z.array(PointMmSchema).min(3))),
  height: z
    .object({
      lo: z.int().min(0),
      likely: z.int().min(0),
      hi: z.int().min(0),
      source: z.enum(['user', 'osm-height', 'osm-levels', 'open-buildings', 'overture', 'unknown']),
    })
    .refine((h) => h.lo <= h.likely && h.likely <= h.hi, 'lo <= likely <= hi'),
  levels: opt(z.int().min(0)),
  roof: opt(z.string()),
  sources: opt(z.array(z.string())),
  name: opt(z.string()),
  aliases: opt(z.array(z.string())),
  addr: opt(z.string()),
});

export const ContextTreeSchema: z.ZodType<ContextTree> = z.object({
  id: Id,
  at: PointMmSchema,
  crownRadius: z.int().positive(),
  height: HeightRange,
  leafOn: z.array(z.int().min(0).max(11)),
  source: z.enum(['osm', 'canopy-raster', 'user', 'unknown']),
});

export const CityTileSchema: z.ZodType<CityTile> = z.object({
  schema: z.literal('ibasho.city/1'),
  packId: Id,
  tx: z.int(),
  ty: z.int(),
  buildings: z.array(ContextBuildingSchema),
  trees: z.array(ContextTreeSchema),
  terrain: opt(
    z
      .object({
        cell: z.int().positive(),
        cols: z.int().min(1),
        rows: z.int().min(1),
        heights: z.array(z.int()),
      })
      .refine((t) => t.heights.length === t.cols * t.rows, 'heights is cols x rows'),
  ),
});
