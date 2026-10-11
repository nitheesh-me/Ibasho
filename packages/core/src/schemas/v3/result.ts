/**
 * Zod schemas for stage outputs: stamps, site results, building results, codes and optimisation
 * (ARCH 15.4, 15.5). Owner: WP-00. Preview fixtures (WP-13) and stored results are validated with
 * these on load, so Preview and real outputs share one shape (AC-PG4, P1).
 */
import { z } from 'zod';
import type { EvidenceGraph, EvidenceId } from '../../evidence/types.ts';
import type { Unit } from '../../units.ts';
import { OBJECTIVE_IDS, type ObjectiveId } from '../../v3/goals.ts';
import { METRIC_IDS, type MetricId } from '../../v3/metrics.ts';
import type { OptimiseResult } from '../../v3/optimise.ts';
import type { ResultStamp } from '../../v3/provenance.ts';
import { STUDIO_STAGES, type StageId, TIERS, type Tier } from '../../v3/provenance.ts';
import {
  APPLICABILITY,
  type Applicability,
  type BuildingResult,
  END_USES,
  type EndUse,
} from '../../v3/result.ts';
import type { SiteResult } from '../../v3/site.ts';
import { DAYLIGHT_TIERS, type DaylightTier, RESOLUTION_LEVELS } from '../../v3/site.ts';
import type { CodesOut } from '../../v3/stage.ts';
import { Finite, GradeSchema, IsoDateSchema, SemVerSchema, TriSchema } from '../common.ts';
import { BigNonNegSchema, BigSchema, IvalSchemaV3, monthly, QSchema } from './wire.ts';

const opt = <T extends z.ZodType>(s: T) => s.exactOptional();
const Id = z.string().min(1).max(200);
const enumOf = <E extends string>(xs: readonly E[]) => z.enum(xs as unknown as [E, ...E[]]);

export const StageIdSchema = enumOf<StageId>(STUDIO_STAGES);
export const TierSchema = enumOf<Tier>(TIERS);
const Impl = z.enum(['preview', 'real']);
const UnitSchema = z.string().min(1) as unknown as z.ZodType<Unit>;
const EvIdSchema = z
  .string()
  .regex(/^ev_/, 'evidence ids start with ev_') as unknown as z.ZodType<EvidenceId>;
const MetricSchema = enumOf<MetricId>(METRIC_IDS);
const ApplicabilitySchema = enumOf<Applicability>(APPLICABILITY);

export const ResultStampSchema: z.ZodType<ResultStamp> = z.object({
  impl: Impl,
  providers: z.array(z.object({ stage: StageIdSchema, id: Id, version: z.string(), impl: Impl })),
  tier: TierSchema,
  computedAt: IsoDateSchema,
});

const SourceRefSchema = z.object({
  id: Id,
  title: z.string(),
  url: opt(z.string()),
  clause: opt(z.string()),
  retrieved: IsoDateSchema,
});

const EvidenceValueSchema = z.union([
  z.object({ fixed: z.string(), unit: UnitSchema }),
  z.object({ exact: QSchema }),
  z.object({ float: Finite }),
  z.object({ interval: IvalSchemaV3 }),
  z.object({ cat: z.string() }),
]);

/** Evidence graph (ARCH 7): plain data, nodes sorted by id. */
export const EvidenceGraphSchema = z.object({
  schema: z.literal('ibasho.evidence/1'),
  nodes: z.array(
    z.object({
      id: EvIdSchema,
      quantity: z.string().min(1),
      subject: z.looseObject({ homeId: z.string(), mode: z.enum(['rating', 'standard', 'your-home']) }),
      value: EvidenceValueSchema,
      unit: UnitSchema,
      formula: z.object({ id: z.string(), doc: z.string(), expr: opt(z.string()) }),
      inputs: z.array(z.object({ id: EvIdSchema, role: z.string() })),
      provenance: z.object({
        kind: z.enum([
          'computed',
          'stated',
          'measured',
          'document',
          'default',
          'catalogue',
          'tariff',
          'owner-claim',
          'calibrated',
          'preview',
        ]),
        plugin: opt(z.object({ id: Id, version: SemVerSchema })),
        sources: opt(z.array(SourceRefSchema)),
        grade: opt(GradeSchema),
      }),
      uncertainty: opt(z.object({ p10: Finite, p50: Finite, p90: Finite })),
      seal: z.enum(['checked', 'modelled', 'unverified', 'cracked', 'preview']),
      check: opt(
        z.object({
          id: z.string(),
          rung: z.enum(['lean-native', 'lean-wasm', 'mirror']),
          coverage: z.enum(['all', 'sample']),
        }),
      ),
      derived: opt(
        z.object({
          kind: z.enum(['rank', 'ratio', 'percent', 'compare', 'sign', 'attribution', 'bisect']),
          of: z.array(EvIdSchema),
        }),
      ),
      rounding: z.object({ mode: z.enum(['sig', 'step']), value: Finite }),
    }),
  ),
  external: z.array(EvIdSchema),
}) as unknown as z.ZodType<EvidenceGraph>;

const ResolutionSchema = z.object({
  level: z.enum(RESOLUTION_LEVELS as unknown as ['sketch', 'standard', 'fine']),
  grid: z.int().positive(),
  stepMin: z.union([z.literal(6), z.literal(15), z.literal(60)]),
  skyPatches: z.union([z.literal(145), z.literal(577)]),
  contextRadiusM: Finite,
});
const DaylightTierSchema = enumOf<DaylightTier>(DAYLIGHT_TIERS);

export const SiteResultSchema: z.ZodType<SiteResult> = z.object({
  inputsHash: z.string(),
  weatherHash: z.string(),
  sceneHash: z.string(),
  method: DaylightTierSchema,
  kernel: z.enum(['cpu', 'gpu-preview']),
  resolution: ResolutionSchema,
  stamp: ResultStampSchema,
  surfaces: z.array(
    z.object({
      id: Id,
      irrWhm2: z.union([monthly(BigNonNegSchema), z.literal('unknown')]),
      sunHours: opt(
        z.object({ dailyMean: IvalSchemaV3, annual: Finite, monthly: opt(z.array(Finite).length(12)) }),
      ),
      svf: opt(QSchema),
      areaM2: opt(Finite),
      receivedWh: opt(BigNonNegSchema),
      unobstructedWh: opt(BigNonNegSchema),
    }),
  ),
  windows: z.array(z.object({ id: Id, shadingFactor: monthly(QSchema) })),
  rooms: z.array(
    z.object({
      id: Id,
      sda: opt(IvalSchemaV3),
      ase: opt(IvalSchemaV3),
      ecbcShare: opt(IvalSchemaV3),
      views: opt(IvalSchemaV3),
      tier: DaylightTierSchema,
    }),
  ),
  ledger: z.array(z.object({ receiver: Id, blocker: Id, lostWh: BigNonNegSchema })),
  unknownHeightIds: opt(z.array(Id)),
  overlappedIds: opt(z.array(Id)),
  ground: opt(
    z
      .object({
        x0: Finite,
        y0: Finite,
        cellM: Finite.refine((v) => v > 0, 'cell size must be positive'),
        cols: z.int().min(1),
        rows: z.int().min(1),
        hours: z.array(Finite),
        date: IsoDateSchema,
      })
      .refine((g) => g.hours.length === g.cols * g.rows, 'hours must be cols x rows'),
  ),
});

const MonthSchema = z.int().min(0).max(11);
const TariffBillSchema = z.object({
  carrier: z.enum(['electricity', 'water', 'diesel', 'gas', 'lpg']),
  tariffId: Id,
  currency: z.enum(['INR', 'GBP']),
  byMonth: monthly(BigSchema),
  total: BigSchema,
  cliffMonths: z.array(MonthSchema),
  demandKva: opt(Finite),
});
const PartySchema = z.enum(['owner', 'landlord', 'tenant', 'association', 'members', 'unknown']);

export const CodeRowSchema = z.object({
  ruleId: Id,
  edition: z.string(),
  status: TriSchema,
  margin: opt(z.object({ value: Finite, unit: UnitSchema })),
  applicability: ApplicabilitySchema,
  grade: GradeSchema,
  metric: opt(MetricSchema),
  tier: opt(z.union([z.literal(1), z.literal(2), z.literal(3)])),
  clause: opt(z.string()),
  unknownFacts: opt(z.array(z.string())),
});
export const RatingRowSchema = z.object({
  scheme: z.string(),
  edition: z.string(),
  metric: MetricSchema,
  value: z.union([IvalSchemaV3, z.literal('unknown')]),
  points: z.object({ likely: z.union([Finite, z.literal('unknown')]), possible: opt(Finite) }),
  level: z.object({ likely: z.string(), possible: opt(z.string()) }),
  applicability: ApplicabilitySchema,
  grade: GradeSchema,
});
export const BaselineRowSchema = z.object({
  code: z.string(),
  builderId: Id,
  eui: IvalSchemaV3,
  ratio: IvalSchemaV3,
});

const endUsesShape = Object.fromEntries(
  END_USES.map((u) => [u, monthly(z.union([BigSchema, z.literal('unknown')]))]),
) as unknown as Record<EndUse, z.ZodType<readonly (bigint | 'unknown')[]>>;

export const BuildingResultSchema: z.ZodType<BuildingResult> = z.object({
  inputsHash: z.string(),
  stamp: ResultStampSchema,
  endUses: z.object(endUsesShape),
  eui: z.object({
    site: IvalSchemaV3,
    source: IvalSchemaV3,
    partial: z.boolean(),
    missing: opt(z.array(enumOf<EndUse>(END_USES))),
    target: opt(z.object({ value: IvalSchemaV3, source: z.string() })),
  }),
  conditionedM2: Finite,
  bills: z.array(TariffBillSchema),
  water: opt(
    z.object({
      litresByMonth: monthly(BigNonNegSchema),
      bill: opt(TariffBillSchema),
      savedByMonth: opt(monthly(BigSchema)),
    }),
  ),
  carbon: z.object({ op: BigSchema, factorIds: z.array(z.string()), saved: opt(BigSchema) }),
  comfort: z.array(
    z.object({
      roomId: Id,
      model: z.enum(['IMAC-MM', 'IMAC-NV', 'ASHRAE55-adaptive', 'EN16798', 'fixed-band']),
      fanAirSpeedMs: opt(Finite),
      fanHours: IvalSchemaV3,
      acHours: z.array(z.object({ setpointC: Finite, hours: IvalSchemaV3 })),
      occupiedHours: Finite,
    }),
  ),
  codes: z.array(CodeRowSchema),
  ratings: z.array(RatingRowSchema),
  baselines: opt(z.array(BaselineRowSchema)),
  split: opt(
    z.array(z.object({ party: PartySchema, carrier: TariffBillSchema.shape.carrier, amount: BigSchema })),
  ),
  evidence: EvidenceGraphSchema,
  asOf: IsoDateSchema,
}) as unknown as z.ZodType<BuildingResult>;

export const CodesOutSchema: z.ZodType<CodesOut> = z.object({
  codes: z.array(CodeRowSchema),
  ratings: z.array(RatingRowSchema),
  baselines: z.array(BaselineRowSchema),
  result: BuildingResultSchema,
  gaps: opt(
    z.array(
      z.object({
        presetId: opt(z.string()),
        goal: z.looseObject({ kind: z.string() }),
        status: z.enum(['met', 'not-met', 'unknown']),
        value: opt(IvalSchemaV3),
        target: opt(Finite),
        unit: opt(z.string()),
        ruleIds: opt(z.array(z.string())),
        reason: z.string(),
        sources: z.array(SourceRefSchema),
        grade: GradeSchema,
      }),
    ),
  ),
}) as unknown as z.ZodType<CodesOut>;

const RecRoleSchema = z.string().min(1);
export const OptimiseResultSchema: z.ZodType<OptimiseResult> = z.object({
  inputsHash: z.string(),
  stamp: ResultStampSchema,
  objectives: z.array(z.object({ id: enumOf<ObjectiveId>(OBJECTIVE_IDS), dir: z.enum(['min', 'max']) })),
  method: z.enum(['exhaustive', 'nsga2', 'screen-only']),
  seed: opt(z.string()),
  screening: opt(z.array(z.object({ axis: z.string(), muStar: Finite, sigma: Finite }))),
  tried: z.int().min(0),
  candidates: z.array(
    z.object({
      id: Id,
      ops: z.array(z.looseObject({ op: z.string() })),
      axes: z.array(BigSchema),
      feasible: z.boolean(),
      blockedBy: opt(z.array(z.string())),
      needsCheck: opt(z.boolean()),
      evidence: z.array(EvIdSchema),
    }),
  ),
  front: z.array(Id),
  witnesses: z.array(z.object({ dominated: Id, by: Id })),
  picks: z.array(
    z.object({
      role: RecRoleSchema,
      id: z.union([Id, z.literal('none')]),
      label: z.string(),
      euiBeforeGeneration: opt(Finite),
    }),
  ),
  sweeps: z.array(
    z.object({
      target: z.string(),
      param: z.string(),
      grid: z.string(),
      points: z.array(z.object({ index: z.int(), axes: z.array(BigSchema), evidence: z.array(EvIdSchema) })),
    }),
  ),
  evidence: opt(EvidenceGraphSchema),
}) as unknown as z.ZodType<OptimiseResult>;
