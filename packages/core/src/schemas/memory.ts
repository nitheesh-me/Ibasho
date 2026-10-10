/**
 * Zod schema for `MemoryEvent` (AM 7.1): the append-only log is exported, imported and fed by
 * the agent link, so every event is validated at the boundary. Owner: WP-00.
 */
import { z } from 'zod';
import type { ForgetSelector, MemoryEvent, MemoryEventType } from '../ai/memory.ts';
import { ScenarioOpSchema } from './ops.ts';

export const MEMORY_EVENT_TYPES = [
  'measureRejected',
  'measureRestored',
  'measureCompleted',
  'budgetSet',
  'tenureSet',
  'priorityRanked',
  'seedProposed',
  'seedAccepted',
  'seedDismissed',
  'opApplied',
  'packageViewed',
  'questionAsked',
  'memoryEdited',
  'memoryForgotten',
] as const satisfies readonly MemoryEventType[];

const TypeSchema = z.enum(MEMORY_EVENT_TYPES);
const Priority = z.enum(['warmth', 'quiet', 'air-quality', 'cool-summers', 'low-disruption']);

export const ForgetSelectorSchema: z.ZodType<ForgetSelector> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({ kind: z.literal('event'), eventId: z.string() }),
  z.object({ kind: z.literal('type'), type: TypeSchema }),
  z.object({ kind: z.literal('measure'), measureId: z.string() }),
]);

const base = {
  id: z.string().min(1),
  homeId: z.string().min(1),
  at: z.iso.datetime({ offset: true }),
  actor: z.enum(['owner', 'engine', 'llm-proposal']),
  source: z
    .object({
      kind: z.enum(['ui', 'chat', 'note']),
      ref: z.string().exactOptional(),
      quote: z.string().max(120).exactOptional(),
    })
    .exactOptional(),
};
const ev = <T extends MemoryEventType, P extends z.ZodType>(type: T, payload: P) =>
  z.object({ ...base, type: z.literal(type), payload });

export const MemoryEventSchema: z.ZodType<MemoryEvent> = z.discriminatedUnion('type', [
  ev(
    'measureRejected',
    z.object({
      measureId: z.string(),
      scope: z.enum(['never', 'snooze']),
      until: z.string().exactOptional(),
      reason: z.string().exactOptional(),
    }),
  ),
  ev('measureRestored', z.object({ measureId: z.string() })),
  ev('measureCompleted', z.object({ measureId: z.string(), optionId: z.string().exactOptional() })),
  ev('budgetSet', z.object({ capGBP: z.number().nonnegative().nullable() })),
  ev('tenureSet', z.object({ tenure: z.enum(['owner', 'tenant', 'landlord', 'unknown']) })),
  ev('priorityRanked', z.object({ priorities: z.array(Priority) })),
  ev(
    'seedProposed',
    z.object({
      seedId: z.string(),
      text: z.string(),
      proposes: z.object({ type: TypeSchema, payload: z.unknown() }).nullable(),
    }),
  ),
  ev('seedAccepted', z.object({ seedId: z.string() })),
  ev('seedDismissed', z.object({ seedId: z.string() })),
  ev('opApplied', z.object({ op: ScenarioOpSchema })),
  ev('packageViewed', z.object({ packageId: z.string(), resultHash: z.string().exactOptional() })),
  ev('questionAsked', z.object({ question: z.string() })),
  ev('memoryEdited', z.object({ eventId: z.string(), payload: z.unknown() })),
  ev('memoryForgotten', z.object({ selector: ForgetSelectorSchema })),
]);
