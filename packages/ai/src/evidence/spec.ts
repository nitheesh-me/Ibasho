/**
 * Story spec: a JSON description of the evidence a narration needs, turned into a `Story` through
 * real `EvidenceNode`s and the bundle builder. Used for the synthetic fixtures under
 * `packages/fixtures/src/narration` until the engine lands, and by headless callers (agent link)
 * that hold values but no graph. Untrusted, so it is parsed with zod.
 */
import {
  evidenceId,
  type EvidenceNode,
  type EvidenceSubject,
  type MemoryDigest,
  type Unit,
} from '@ibasho/core';
import { MemoryEventSchema } from '@ibasho/core/schemas';
import { z } from 'zod';
import { buildBundle } from './bundle.ts';
import type { Story, StoryContext } from '../narrator/template.ts';

const KIND = z.enum([
  'energy',
  'energyDelta',
  'cost',
  'costDelta',
  'carbon',
  'carbonDelta',
  'payback',
  'score',
  'valueRange',
  'rank',
  'ratio',
  'percent',
  'count',
  'param',
]);
const DISPLAY_UNIT = z.enum(['kWh/yr', 'GBP', 'GBP/yr', 'kgCO2e/yr', 'yr', 'pts', '%', 'rank', '']);
const SUBJECT = z.strictObject({
  packageId: z.string().exactOptional(),
  measureId: z.string().exactOptional(),
  scenarioId: z.string().exactOptional(),
});
const FUEL = z.enum(['gas', 'electricity', 'oil', 'lpg', 'biomass']);
const ROUNDING = z.strictObject({ mode: z.enum(['sig', 'step']), value: z.number().positive() });
const VALUE = z.union([
  z.strictObject({ fixed: z.string().regex(/^-?(0|[1-9]\d*)$/) }),
  z.strictObject({ float: z.number() }),
  z.strictObject({ interval: z.strictObject({ lo: z.number(), hi: z.number() }) }),
]);

const NodeSpec = z.strictObject({
  role: z.string().min(1),
  kind: KIND,
  label: z.string().min(1),
  quantity: z.string().min(1),
  unit: z.string().min(1),
  value: VALUE,
  subject: SUBJECT.exactOptional(),
  fuel: FUEL.exactOptional(),
  sign: z.enum(['saving', 'increase', 'neutral']).exactOptional(),
  display: DISPLAY_UNIT.exactOptional(),
  rounding: ROUNDING.exactOptional(),
});

const DerivedSpec = z.strictObject({
  role: z.string().min(1),
  kind: z.enum(['rank', 'count', 'ratio', 'percent', 'param']),
  label: z.string().min(1),
  value: z.union([z.number(), z.strictObject({ lo: z.number(), hi: z.number() })]),
  of: z.array(z.string()),
  subject: SUBJECT.exactOptional(),
  unit: DISPLAY_UNIT.exactOptional(),
  rounding: ROUNDING.exactOptional(),
});

const RIGHT = z.enum(['yes', 'no', 'ask', 'unknown']);
const PreferencesSpec = z.strictObject({
  budgetCapGBP: z.number().nonnegative().exactOptional(),
  horizonYears: z.number().int().positive().exactOptional(),
  tenure: z.enum(['owner', 'tenant', 'landlord', 'unknown']),
  rights: z.strictObject({ roof: RIGHT, externalWalls: RIGHT, windows: RIGHT }),
  rejected: z.record(
    z.string(),
    z.strictObject({
      scope: z.enum(['never', 'snooze']),
      until: z.string().exactOptional(),
      reason: z.string().exactOptional(),
      at: z.string(),
    }),
  ),
  completed: z.record(z.string(), z.strictObject({ at: z.string() })),
  priorities: z.array(z.enum(['warmth', 'quiet', 'air-quality', 'cool-summers', 'low-disruption'])),
});

const PICK = z.enum(['leastUpfront', 'bestReturn', 'lowestRunningCarbon']);
const ContextSpec = z.strictObject({
  topLossName: z.string().exactOptional(),
  leverMeasure: z.string().exactOptional(),
  picks: z.partialRecord(PICK, z.strictObject({ packageId: z.string(), measures: z.array(z.string()) })).exactOptional(),
  chosen: PICK.exactOptional(),
  nextStep: z.string().exactOptional(),
  packages: z.record(z.string(), z.strictObject({ measures: z.array(z.string()) })).exactOptional(),
  diffReason: z.string().exactOptional(),
  billsGiven: z.boolean().exactOptional(),
  whyNot: z
    .array(
      z.strictObject({
        measureId: z.string(),
        reason: z.discriminatedUnion('kind', [
          z.strictObject({
            kind: z.literal('rule'),
            status: z.enum(['needs-check', 'blocked']),
            ruleId: z.string(),
            ruleTitle: z.string(),
          }),
          z.strictObject({ kind: z.literal('memory') }),
          z.strictObject({ kind: z.literal('tenure') }),
          z.strictObject({ kind: z.literal('dominated') }),
          z.strictObject({ kind: z.literal('budget'), overByRole: z.string().exactOptional() }),
          z.strictObject({ kind: z.literal('not-applicable') }),
        ]),
      }),
    )
    .exactOptional(),
});

export const StorySpecSchema = z.strictObject({
  schema: z.literal('ibasho.story/1'),
  homeId: z.string().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  locale: z.string().min(2),
  modelVersion: z.string().min(1),
  mode: z.enum(['rating', 'standard', 'your-home']),
  preferences: PreferencesSpec,
  recent: z.array(MemoryEventSchema).exactOptional(),
  hiddenByRejection: z.number().int().nonnegative(),
  facts: z
    .array(
      z.strictObject({
        id: z.string(),
        kind: z.enum(['constraint', 'condition', 'preference', 'history']),
        topic: z.string(),
        polarity: z.enum(['positive', 'negative', 'neutral']),
        quote: z.string().max(120),
      }),
    )
    .exactOptional(),
  nodes: z.array(NodeSpec),
  derived: z.array(DerivedSpec).exactOptional(),
  context: ContextSpec,
});
export type StorySpec = z.infer<typeof StorySpecSchema>;

/** Parse and build. Throws a `ZodError` on malformed input and a `BundleError` on bad roles. */
export function buildStory(input: unknown): Story {
  const spec = StorySpecSchema.parse(input);
  const nodes = spec.nodes.map((n) => {
    const subject: EvidenceSubject = { homeId: spec.homeId, mode: spec.mode };
    if (n.subject?.packageId !== undefined) subject.packageId = n.subject.packageId;
    if (n.subject?.measureId !== undefined) subject.measureId = n.subject.measureId;
    const unit = n.unit as Unit;
    const value: EvidenceNode['value'] =
      'fixed' in n.value
        ? { fixed: n.value.fixed, unit }
        : 'float' in n.value
          ? { float: n.value.float }
          : { interval: n.value.interval };
    const node: EvidenceNode = {
      id: evidenceId(n.quantity, subject),
      quantity: n.quantity,
      subject,
      value,
      unit,
      formula: { id: 'SYNTH', doc: 'synthetic story fixture' },
      inputs: [],
      provenance: { kind: 'computed' },
      seal: 'modelled',
      rounding: { mode: 'sig', value: 3 },
    };
    return {
      role: n.role,
      node,
      kind: n.kind,
      label: n.label,
      ...(n.display !== undefined ? { unit: n.display } : {}),
      ...(n.fuel !== undefined ? { fuel: n.fuel } : {}),
      ...(n.sign !== undefined ? { sign: n.sign } : {}),
      ...(n.rounding !== undefined ? { rounding: n.rounding } : {}),
      ...(n.subject !== undefined ? { subject: n.subject } : {}),
    };
  });
  const memory: MemoryDigest = {
    preferences: spec.preferences,
    recent: spec.recent ?? [],
    hiddenByRejection: spec.hiddenByRejection,
  };
  const { bundle, roles } = buildBundle({
    homeId: spec.homeId,
    createdAt: spec.createdAt,
    locale: spec.locale,
    modelVersion: spec.modelVersion,
    nodes,
    derived: (spec.derived ?? []).map((d) => ({
      role: d.role,
      kind: d.kind,
      label: d.label,
      value: d.value,
      of: d.of,
      ...(d.subject !== undefined ? { subject: d.subject } : {}),
      ...(d.unit !== undefined ? { unit: d.unit } : {}),
      ...(d.rounding !== undefined ? { rounding: d.rounding } : {}),
    })),
    facts: spec.facts ?? [],
    memory,
  });
  return { bundle, roles, context: spec.context as StoryContext };
}
