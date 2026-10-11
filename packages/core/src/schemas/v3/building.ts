/**
 * Zod schemas for `ibasho.building/1` and its compiled form (ARCH 15.4). Owner: WP-00.
 * Documents enter from fixtures, imports (`.ibasho`, PDF trace, OSM, IFC) and the agent link.
 */
import { z } from 'zod';
import {
  BUILDING_TYPES,
  type BuildingDoc,
  type BuildingTypeId,
  type CompiledBuilding,
  FACADE_BINS,
  type FacadeBin,
  type Opening,
  type PlanCheck,
  type Quantities,
  type Room2D,
  type Segment,
  type SegmentBoundary,
  type ShadeRule,
  type Storey,
  type SurfaceSet,
  type TenureSplit,
  type WindowRule,
  type ZoneTwin,
} from '../../v3/building.ts';
import { METRIC_IDS, type MetricId } from '../../v3/metrics.ts';
import { IsoDateSchema, NumFieldSchema, TriSchema } from '../common.ts';
import { HomeTwinSchema, SystemRefSchema } from '../twin.ts';
import { BigNonNegSchema, MmSchema, PerMilleSchema, Point3MmSchema, PointMmSchema } from './wire.ts';

const opt = <T extends z.ZodType>(s: T) => s.exactOptional();
const Id = z.string().min(1).max(120);

export const BuildingTypeIdSchema = z.enum(BUILDING_TYPES as [BuildingTypeId, ...BuildingTypeId[]]);
export const FacadeBinSchema = z.enum(FACADE_BINS as [FacadeBin, ...FacadeBin[]]);
const MetricIdSchema = z.enum(METRIC_IDS as [MetricId, ...MetricId[]]);

const PolygonMmSchema = z.object({
  outer: z.array(PointMmSchema).min(3),
  holes: z.array(z.array(PointMmSchema).min(3)),
});

const PartySchema = z.enum(['owner', 'landlord', 'tenant', 'association', 'members', 'unknown']);
const CarrierShare = z.enum(['electricity', 'water', 'diesel', 'gas']);

export const TenureSplitSchema: z.ZodType<TenureSplit> = z.object({
  owner: z.enum(['owner-occupier', 'landlord', 'association', 'institution', 'unknown']),
  pays: z.object({
    electricity: PartySchema,
    water: PartySchema,
    diesel: opt(PartySchema),
    gas: opt(PartySchema),
  }),
  decides: z.object({
    envelope: PartySchema,
    systems: PartySchema,
    roof: PartySchema,
    interior: PartySchema,
  }),
  shares: opt(z.array(z.object({ party: PartySchema, carrier: CarrierShare, perMille: PerMilleSchema }))),
});

export const SegmentBoundarySchema: z.ZodType<SegmentBoundary> = z.union([
  z.object({ kind: z.enum(['outdoors', 'ground', 'adiabatic', 'air']) }),
  z.object({ kind: z.literal('adjacent'), roomId: Id, segId: Id }),
]);

export const OpeningSchema: z.ZodType<Opening> = z.object({
  id: Id,
  kind: z.enum(['window', 'door', 'glass-door', 'vent', 'skylight']),
  u: MmSchema,
  v: MmSchema,
  width: z.int().positive(),
  height: z.int().positive(),
  productId: opt(Id),
  operable: opt(z.boolean()),
  frame: opt(MmSchema),
});

export const WindowRuleSchema: z.ZodType<WindowRule> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({
    kind: z.literal('ratio'),
    wwrPm: z.int().min(0).max(950),
    sill: MmSchema,
    head: opt(MmSchema),
    productId: opt(Id),
  }),
  z.object({
    kind: z.literal('repeating'),
    wwrPm: z.int().min(0).max(950),
    width: MmSchema,
    spacing: MmSchema,
    sill: MmSchema,
    head: MmSchema,
    productId: opt(Id),
  }),
  z.object({
    kind: z.literal('single'),
    width: MmSchema,
    height: MmSchema,
    sill: MmSchema,
    offset: MmSchema,
    productId: opt(Id),
  }),
  z.object({ kind: z.literal('detailed'), openings: z.array(OpeningSchema) }),
]);

export const ShadeRuleSchema: z.ZodType<ShadeRule> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('overhang'), depth: MmSchema, aboveHead: MmSchema, extension: MmSchema }),
  z.object({
    kind: z.literal('fins'),
    depth: MmSchema,
    spacing: opt(MmSchema),
    sides: z.enum(['both', 'left', 'right']),
  }),
  z.object({
    kind: z.literal('louvres'),
    spacing: MmSchema,
    depth: MmSchema,
    angleMdeg: z.int(),
    axis: z.enum(['h', 'v']),
  }),
  z.object({ kind: z.literal('light-shelf'), inside: MmSchema, outside: MmSchema, height: MmSchema }),
  z.object({ kind: z.literal('balcony'), depth: MmSchema, parapet: MmSchema }),
  z.object({ kind: z.literal('screen'), porosityPm: PerMilleSchema, offset: MmSchema, presetId: opt(Id) }),
]);

export const SegmentSchema: z.ZodType<Segment> = z.object({
  id: Id,
  boundary: SegmentBoundarySchema,
  constructionId: opt(Id),
  thickness: opt(MmSchema),
  window: WindowRuleSchema,
  shading: z.array(ShadeRuleSchema),
});

export const Room2DSchema: z.ZodType<Room2D> = z
  .object({
    id: Id,
    name: opt(z.string()),
    aliases: opt(z.array(z.string())),
    floor: PolygonMmSchema,
    ceiling: MmSchema,
    spaceTypeId: opt(Id),
    zoneId: opt(Id),
    segments: z.array(SegmentSchema),
    floorBoundary: z.enum(['ground', 'adjacent', 'exposed']),
    ceilingBoundary: z.enum(['roof', 'adjacent', 'exposed']),
  })
  .refine((r) => r.segments.length === r.floor.outer.length, 'one segment per outer polygon edge');

const Room3DSchema = z.object({
  id: Id,
  name: opt(z.string()),
  spaceTypeId: opt(Id),
  zoneId: opt(Id),
  faces: z.array(
    z.object({
      id: Id,
      kind: z.enum(['wall', 'roof', 'floor']),
      vertices: z.array(Point3MmSchema).min(3),
      boundary: SegmentBoundarySchema,
      constructionId: opt(Id),
      openings: z.array(OpeningSchema),
    }),
  ),
});

export const StoreySchema: z.ZodType<Storey> = z.object({
  id: Id,
  name: z.string(),
  aliases: opt(z.array(z.string())),
  elevation: MmSchema,
  floorToFloor: z.int().positive(),
  multiplier: z.int().min(1),
  belowGrade: z.boolean(),
  rooms: z.array(Room2DSchema),
  rooms3d: z.array(Room3DSchema),
  cores: z.array(
    z.object({
      id: Id,
      kind: z.enum(['stair', 'lift', 'shaft', 'services']),
      outline: z.array(PointMmSchema).min(3),
      conditioned: z.boolean(),
      excludeFromArea: z.boolean(),
    }),
  ),
  underlay: opt(
    z.object({
      ref: z.string(),
      page: z.int().min(1),
      calibration: opt(z.object({ a: PointMmSchema, b: PointMmSchema, distance: z.int().positive() })),
      opacityPm: PerMilleSchema,
    }),
  ),
});

const RoofSpecSchema = z.object({
  id: Id,
  storeyId: Id,
  shape: z.enum(['flat', 'mono', 'gable', 'hip', 'dome', 'unknown']),
  pitchMdeg: opt(z.int()),
  constructionId: opt(Id),
  reflectancePm: opt(PerMilleSchema),
  emittancePm: opt(PerMilleSchema),
  pvZones: z.array(z.object({ id: Id, outline: z.array(PointMmSchema).min(3), coveragePm: PerMilleSchema })),
  skylights: z.array(OpeningSchema),
});

const FacadeShades = z.partialRecord(FacadeBinSchema, z.array(ShadeRuleSchema));

const MassingSpecSchema = z.object({
  footprint: z.array(PointMmSchema).min(3),
  storeys: z.int().min(1),
  floorToFloor: z.int().positive(),
  groundFloorToFloor: opt(z.int().positive()),
  setbacks: z.array(z.object({ storey: z.int().min(0), edge: z.int().min(0), inset: MmSchema })),
  core: z.union([
    z.object({ kind: z.literal('share'), perMille: PerMilleSchema }),
    z.object({ kind: z.literal('polygon'), outline: z.array(PointMmSchema).min(3) }),
  ]),
  perimeterDepth: z.int().positive(),
  wwrByFacade: z.partialRecord(FacadeBinSchema, z.int().min(0).max(950)),
  shadesByFacade: FacadeShades,
  programme: z.array(z.object({ spaceTypeId: Id, perMille: PerMilleSchema })),
});

export const BuildingDocSchema: z.ZodType<BuildingDoc> = z.object({
  schema: z.literal('ibasho.building/1'),
  id: Id,
  version: z.int().min(0),
  placeId: Id,
  name: z.string(),
  typeId: BuildingTypeIdSchema,
  tenure: opt(TenureSplitSchema),
  permitDate: opt(IsoDateSchema),
  origin: z.object({ x: MmSchema, y: MmSchema }),
  rotationMdeg: z.int(),
  storeys: z.array(StoreySchema),
  roofs: z.array(RoofSpecSchema),
  shades: z.array(
    z.object({
      id: Id,
      kind: z.enum(['canopy', 'screen', 'pergola', 'wall', 'tree']),
      vertices: z.array(Point3MmSchema).min(3),
      transmittancePm: PerMilleSchema,
      presetId: opt(Id),
    }),
  ),
  zones: z.array(
    z.object({
      id: Id,
      name: opt(z.string()),
      roomIds: z.array(Id),
      systemId: opt(Id),
      conditioned: z.boolean(),
      setpoints: opt(z.object({ coolC: opt(NumFieldSchema), heatC: opt(NumFieldSchema) })),
      scheduleSetId: opt(Id),
    }),
  ),
  systems: z.array(SystemRefSchema),
  massing: opt(MassingSpecSchema),
});

export const ZoneTwinSchema: z.ZodType<ZoneTwin> = z.object({
  schema: z.literal('ibasho.zonetwin/1'),
  buildingId: Id,
  typeId: BuildingTypeIdSchema,
  zones: z.array(
    z.object({
      id: Id,
      roomIds: z.array(Id),
      spaceTypeIds: z.array(Id),
      floorMm2: BigNonNegSchema,
      volumeMm3: BigNonNegSchema,
      conditioned: z.boolean(),
      systemId: opt(Id),
      storeyId: Id,
    }),
  ),
  surfaces: z.array(
    z.object({
      id: Id,
      zoneId: Id,
      kind: z.enum(['wall', 'roof', 'floor', 'window', 'door', 'skylight']),
      areaMm2: BigNonNegSchema,
      azimuthMdeg: z.int(),
      tiltMdeg: z.int(),
      boundary: z.union([z.enum(['outdoors', 'ground', 'adiabatic']), z.object({ zoneId: Id })]),
      constructionId: opt(Id),
      productId: opt(Id),
      hostId: opt(Id),
    }),
  ),
  systems: z.array(SystemRefSchema),
});

export const QuantitiesSchema: z.ZodType<Quantities> = z.object({
  gfaMm2: BigNonNegSchema,
  ncaMm2: BigNonNegSchema,
  storeys: z.array(
    z.object({
      storeyId: Id,
      gfaMm2: BigNonNegSchema,
      roomSumMm2: BigNonNegSchema,
      wallFootprintMm2: BigNonNegSchema,
      overlapMm2: BigNonNegSchema,
    }),
  ),
  facades: z.array(
    z.object({ bin: FacadeBinSchema, grossMm2: BigNonNegSchema, openingMm2: BigNonNegSchema }),
  ),
  roofMm2: BigNonNegSchema,
  skylightMm2: BigNonNegSchema,
  openings: z.array(
    z.object({
      id: Id,
      segId: Id,
      areaMm2: BigNonNegSchema,
      pf: opt(z.object({ n: BigNonNegSchema, d: BigNonNegSchema.refine((d) => d > 0n, 'd > 0') })),
    }),
  ),
});

export const PlanCheckSchema: z.ZodType<PlanCheck> = z.object({
  id: Id,
  kind: z.enum([
    'unclosed',
    'self-intersect',
    'overlap',
    'window-over-wall',
    'tiny-room',
    'untyped-room',
    'orphan-zone',
    'meter',
  ]),
  severity: z.enum(['error', 'warn', 'info']),
  targets: z.array(Id),
  message: z.string(),
  meter: opt(
    z.object({
      metric: MetricIdSchema,
      value: z.number(),
      limit: opt(z.number()),
      pass: TriSchema,
    }),
  ),
});

export const SurfaceSetSchema: z.ZodType<SurfaceSet> = z.object({
  surfaces: z.array(
    z
      .object({
        id: Id,
        kind: z.enum(['wall', 'roof', 'floor', 'window', 'door', 'skylight', 'shade', 'ground']),
        ownerId: Id,
        positions: z.array(z.int()),
        indices: z.array(z.int().min(0)),
        azimuthMdeg: z.int(),
        tiltMdeg: z.int(),
      })
      .refine((s) => s.positions.length % 3 === 0 && s.indices.length % 3 === 0, 'xyz triples and triangles')
      .refine((s) => s.indices.every((i) => i < s.positions.length / 3), 'index out of range'),
  ),
  rooms: opt(
    z.array(
      z.object({
        id: Id,
        zoneId: opt(Id),
        storeyId: Id,
        outer: z.array(PointMmSchema).min(3),
        holes: opt(z.array(z.array(PointMmSchema).min(3))),
        elevations: z.array(MmSchema).min(1),
        ceiling: MmSchema,
      }),
    ),
  ),
});

export const CompiledBuildingSchema: z.ZodType<CompiledBuilding> = z.object({
  docHash: z.string().min(1),
  twin: z.union([ZoneTwinSchema, HomeTwinSchema]),
  quantities: QuantitiesSchema,
  adjacency: z.array(
    z.object({
      a: z.object({ roomId: Id, segId: Id }),
      b: z.object({ roomId: Id, segId: Id }),
      overlap: z.int().min(0),
    }),
  ),
  checks: z.array(PlanCheckSchema),
  meshes: SurfaceSetSchema,
  placement: opt(z.object({ origin: z.object({ x: MmSchema, y: MmSchema }), rotationMdeg: z.int() })),
});
