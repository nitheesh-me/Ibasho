/**
 * Zod schemas for rule data (ARCH 5.4). Rule packs are data that travels inside certificates,
 * so they are validated on load. Owner: WP-00.
 */

import { NAMED_FNS, type NamedFn } from '@ibasho/spec-gen';
import { z } from 'zod';
import { MEASURE_KINDS, type MeasureKind } from '../measure-kinds.ts';
import type { Effect, Expr, Obligation, Rule } from '../rules.ts';
import { CHECK_KINDS, type CheckKind } from '../twin.ts';
import { METRIC_IDS, type MetricId } from '../v3/metrics.ts';
import { GradeSchema, IsoDateSchema, RegionCodeSchema, TriSchema } from './common.ts';

const CheckKindSchema = z.enum(CHECK_KINDS as unknown as [CheckKind, ...CheckKind[]]);
const FactRefSchema = z.object({ fact: z.string().min(1) });

export const ExprSchema: z.ZodType<Expr> = z.lazy(() =>
  z.union([
    z.strictObject({ and: z.array(ExprSchema) }),
    z.strictObject({ or: z.array(ExprSchema) }),
    z.strictObject({ not: ExprSchema }),
    z.strictObject({
      cmp: z.enum(['<', '<=', '=', '>=', '>', '!=']),
      left: FactRefSchema,
      right: z.union([FactRefSchema, z.number(), z.string()]),
    }),
    z.strictObject({ in: FactRefSchema, set: z.array(z.union([z.string(), z.number()])) }),
    z.strictObject({ fn: z.enum(NAMED_FNS as [NamedFn, ...NamedFn[]]), args: z.array(FactRefSchema) }),
    z.strictObject({ const: TriSchema }),
  ]),
);

export const ObligationSchema: z.ZodType<Obligation> = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('max-u'),
    element: z.enum(['wall', 'party-wall', 'roof', 'floor', 'window', 'door', 'rooflight']),
    maxU: z.number().positive(),
  }),
  z.object({
    kind: z.literal('ventilation'),
    system: z.enum(['natural', 'intermittent-extract', 'mev', 'piv', 'mvhr']),
    category: z.enum(['A', 'B', 'C']).exactOptional(),
  }),
  z.object({ kind: z.literal('emitter-flow'), maxFlowC: z.number() }),
  z.object({ kind: z.literal('hp-meets-design-load') }),
  z.object({ kind: z.literal('assessment'), check: CheckKindSchema }),
  z.object({ kind: z.literal('add-option'), optionId: z.string() }),
]);

export const EffectSchema: z.ZodType<Effect> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('block'), reason: z.string() }),
  z.object({
    kind: z.literal('consent'),
    authority: z.enum([
      'LPA',
      'LPA-prior-approval',
      'LBC',
      'building-control',
      'freeholder',
      'landlord',
      'RWA',
      'DISCOM',
      'DNO',
      'highway',
      'neighbour',
    ]),
    typicalWeeks: z.number().nonnegative().exactOptional(),
  }),
  z.object({ kind: z.literal('oblige'), spec: ObligationSchema }),
  z.object({ kind: z.literal('check'), check: CheckKindSchema }),
  z.object({ kind: z.literal('warn'), risk: z.string() }),
  z.object({ kind: z.literal('info'), note: z.string() }),
  z.object({
    kind: z.literal('comply'),
    metric: z.enum(METRIC_IDS as [MetricId, ...MetricId[]]),
    op: z.enum(['<', '<=', '=', '>=', '>', '!=']),
    limit: z.number().refine(Number.isFinite, 'expected a finite number'),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).exactOptional(),
  }),
]);

export const RuleSchema: z.ZodType<Rule> = z
  .object({
    id: z
      .string()
      .regex(
        /^[A-Z0-9]+(?:[.-][A-Z0-9]+)*(?:\.\*)?$/,
        'rule ids are dotted upper case, e.g. ENG.PD.ASHP.NOISE',
      ),
    jurisdiction: z.union([RegionCodeSchema, z.literal('CITY')]),
    measures: z.union([
      z.array(z.enum(MEASURE_KINDS as unknown as [MeasureKind, ...MeasureKind[]])),
      z.literal('*'),
    ]),
    scope: z.enum(['measure', 'package', 'building']),
    when: ExprSchema,
    effect: EffectSchema,
    effectiveFrom: IsoDateSchema,
    effectiveTo: IsoDateSchema.exactOptional(),
    source: z.object({ url: z.string().url(), clause: z.string(), grade: GradeSchema }),
    explain: z.string(),
    unverifiedRule: z.literal(true).exactOptional(),
  })
  .refine(
    (r) => r.effectiveTo === undefined || r.effectiveFrom <= r.effectiveTo,
    'effectiveFrom is after effectiveTo',
  );
