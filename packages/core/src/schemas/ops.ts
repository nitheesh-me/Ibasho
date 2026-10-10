/**
 * Zod schema for `ScenarioOp` (AM 6.1). Owner: WP-00.
 * Shape only. Parameter ranges come from `MeasureModel.options[].params` (ARCH 5.6) and are
 * checked by the `OpValidator` in @ibasho/ai, never in the JSON schema sent to a model.
 */
import { z } from 'zod';
import type { OpPlan, ScenarioOp } from '../ai/ops.ts';
import { FUELS, type Fuel } from '../units.ts';
import { IsoDateSchema } from './common.ts';

const Id = z.string().min(1).max(80);

export const ScenarioOpSchema: z.ZodType<ScenarioOp> = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('addMeasure'),
    measureId: Id,
    params: z.record(z.string(), z.union([z.number(), z.string()])).exactOptional(),
  }),
  z.strictObject({ op: z.literal('removeMeasure'), measureId: Id }),
  z.strictObject({
    op: z.literal('setParam'),
    path: z.string().regex(/^[a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*)*$/),
    value: z.union([z.number(), z.string()]),
  }),
  z.strictObject({ op: z.literal('setTariff'), fuel: z.enum(FUELS as [Fuel, ...Fuel[]]), tariffId: Id }),
  z.strictObject({ op: z.literal('setBudget'), capGBP: z.number().nonnegative() }),
  z.strictObject({ op: z.literal('setHorizon'), years: z.number().int().min(1).max(60) }),
  z.strictObject({ op: z.literal('compare'), scenarioIds: z.array(Id).min(2) }),
  z.strictObject({ op: z.literal('explain'), evidenceId: z.string().regex(/^ev_[0-9a-z]+$/) }),
  z.strictObject({
    op: z.literal('rejectMeasure'),
    measureId: Id,
    scope: z.enum(['never', 'snooze']),
    until: IsoDateSchema.exactOptional(),
    reason: z.string().max(280).exactOptional(),
  }),
]);

export const OpPlanSchema: z.ZodType<OpPlan> = z.object({
  ops: z.array(ScenarioOpSchema),
  rationale: z.string(),
});
