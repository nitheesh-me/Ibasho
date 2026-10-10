/**
 * Agent link wire protocol (ARCH 14). Owner: WP-12.
 *
 * Three parties speak it:
 * - the MCP server (or any local agent holding the per-launch token) calls `/agent/*`;
 * - the bridge (a Hono sub-app the companion mounts) relays each call to one paired tab;
 * - the browser tab (`connectAgentLink`) runs the call against the app and answers.
 *
 * Every frame is parsed with these schemas on both sides: the bridge does not trust the agent,
 * and the tab does not trust the bridge. Edits travel only as typed `ScenarioOp`s from
 * `@ibasho/core/schemas`; there is no frame that carries code.
 */
import { ScenarioOpSchema } from '@ibasho/core/schemas';
import { z } from 'zod';
import { checkSlotted } from './slots.ts';

export const AGENT_LINK_PROTOCOL = 'ibasho.agent-link/1';

/** Where the companion mounts the bridge sub-app. */
export const BRIDGE_MOUNT = '/agent-link';

/** The bridge must only ever listen on loopback (L4). */
export const BRIDGE_HOST = '127.0.0.1';

// ---------------------------------------------------------------------------------------------
// Discovery file: `~/.config/ibasho/server.json`

export const ServerJsonSchema = z.object({
  port: z.number().int().min(1).max(65_535),
  token: z.string().min(32).max(256),
  pid: z.number().int().nonnegative(),
  startedAt: z.iso.datetime({ offset: true }),
  /** Path the bridge is mounted at; absent means `BRIDGE_MOUNT`. */
  bridge: z
    .string()
    .regex(/^\/[\w/-]*$/)
    .exactOptional(),
  /** Live session count at the last write (informational; ask the bridge for the truth). */
  sessions: z.number().int().nonnegative().exactOptional(),
});
export type ServerJson = z.infer<typeof ServerJsonSchema>;

// ---------------------------------------------------------------------------------------------
// Live calls

export const LIVE_METHODS = ['state', 'apply', 'view', 'thread', 'screenshot', 'say'] as const;
export type LiveMethod = (typeof LIVE_METHODS)[number];

const EvidenceIdSchema = z.string().regex(/^ev_[0-9a-z]+$/, 'expected an evidence id like ev_1a2b');

export const SECTION_KEYS = [
  'overview',
  'package',
  'tradeoff',
  'answer',
  'chapter',
  'welcome-back',
  'why-not',
] as const;

export const CAMERA_PRESETS = ['street', 'cutaway', 'plan', 'loft', 'garden', 'section'] as const;

export const LiveStateParamsSchema = z.strictObject({});

export const LiveApplyParamsSchema = z.strictObject({
  ops: z.array(ScenarioOpSchema).min(1).max(32),
  /** Short label for the undo entry and the outbound ledger. Prose, no numbers. */
  label: z.string().min(1).max(80).exactOptional(),
});

export const LiveViewParamsSchema = z
  .strictObject({
    layer: z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/)
      .max(40)
      .exactOptional(),
    camera: z.enum(CAMERA_PRESETS).exactOptional(),
    time: z
      .strictObject({
        hour: z.number().int().min(0).max(23),
        month: z.number().int().min(1).max(12),
      })
      .exactOptional(),
    chapter: z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/)
      .max(40)
      .exactOptional(),
    /** Element id from the twin (`ibasho_get_home`). */
    focus: z.string().min(1).max(80).exactOptional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'set at least one of layer, camera, time, chapter, focus');

export const LiveThreadParamsSchema = z.strictObject({ evidenceId: EvidenceIdSchema });

export const LiveScreenshotParamsSchema = z.strictObject({
  width: z.number().int().min(160).max(2048).exactOptional(),
  height: z.number().int().min(120).max(2048).exactOptional(),
});

export const LiveSayParamsSchema = z
  .strictObject({
    section: z.enum(SECTION_KEYS),
    /** Prose with `[[e:ev_..]]`, `[[m:..]]` slots. Digits and number words outside slots are refused. */
    text: z.string().min(1).max(2000),
  })
  .superRefine((v, ctx) => {
    for (const issue of checkSlotted(v.text).issues) {
      ctx.addIssue({ code: 'custom', path: ['text'], message: `${issue.rule}: ${issue.detail}` });
    }
  });

export const LiveParamsSchemas = {
  state: LiveStateParamsSchema,
  apply: LiveApplyParamsSchema,
  view: LiveViewParamsSchema,
  thread: LiveThreadParamsSchema,
  screenshot: LiveScreenshotParamsSchema,
  say: LiveSayParamsSchema,
} as const satisfies Record<LiveMethod, z.ZodType>;

export type LiveParams = { [M in LiveMethod]: z.infer<(typeof LiveParamsSchemas)[M]> };

/** A call as the agent sends it. `sessionId` may be omitted when exactly one tab is paired. */
export const AgentCallSchema = z.strictObject({
  sessionId: z.string().min(1).max(64).exactOptional(),
  method: z.enum(LIVE_METHODS),
  params: z.unknown(),
});
export type AgentCall = z.infer<typeof AgentCallSchema>;

/** Parse the params of one method; throws a `ZodError` on anything outside the schema. */
export function parseLiveParams<M extends LiveMethod>(method: M, params: unknown): LiveParams[M] {
  return LiveParamsSchemas[method].parse(params ?? {}) as LiveParams[M];
}

// ---------------------------------------------------------------------------------------------
// Results the tab returns

/** Bounded: tab state is relayed into agent context (SubagentStart hook), so it stays short. */
export const LiveStateSchema = z.object({
  homeId: z.string().max(120).nullable(),
  route: z.string().max(240),
  chapter: z.string().max(80).nullable(),
  layer: z.string().max(80).nullable(),
  selection: z.array(z.string().max(120)).max(64),
  resultHash: z.string().max(128).nullable(),
  /** True while an agent edit is on top of the undo stack. */
  agentEditPending: z.boolean(),
});
export type LiveState = z.infer<typeof LiveStateSchema>;

export const LiveResultSchemas = {
  state: LiveStateSchema,
  apply: z.object({
    accepted: z.array(ScenarioOpSchema),
    rejected: z.array(z.object({ op: z.unknown(), code: z.string(), detail: z.string() })),
    undoId: z.string().nullable(),
    resultHash: z.string().nullable(),
  }),
  view: z.object({ state: LiveStateSchema }),
  thread: z.object({ path: z.array(EvidenceIdSchema) }),
  screenshot: z.object({
    mime: z.literal('image/png'),
    /** Base64 PNG. */
    data: z.string().min(1),
  }),
  say: z.object({
    rendered: z.boolean(),
    issues: z.array(z.object({ rule: z.string(), detail: z.string(), severity: z.string() })),
  }),
} as const satisfies Record<LiveMethod, z.ZodType>;

export type LiveResults = { [M in LiveMethod]: z.infer<(typeof LiveResultSchemas)[M]> };

/** What a tab must implement to take live calls. */
export type LiveHandlers = {
  [M in LiveMethod]: (params: LiveParams[M]) => Promise<LiveResults[M]>;
};

// ---------------------------------------------------------------------------------------------
// Frames between bridge and tab (SSE data lines or WebSocket messages)

export const ErrorCodeSchema = z.enum([
  'unauthorized',
  'bad-request',
  'no-session',
  'ambiguous-session',
  'timeout',
  'closed',
  'handler-error',
  'refused',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const LinkErrorSchema = z.object({ code: ErrorCodeSchema, message: z.string().max(500) });
export type LinkError = z.infer<typeof LinkErrorSchema>;

/** Bridge to tab. */
export const DownFrameSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('welcome'), sessionId: z.string(), protocol: z.literal(AGENT_LINK_PROTOCOL) }),
  z.object({ t: z.literal('call'), id: z.string(), method: z.enum(LIVE_METHODS), params: z.unknown() }),
  z.object({ t: z.literal('ping') }),
  z.object({ t: z.literal('bye'), reason: z.string() }),
]);
export type DownFrame = z.infer<typeof DownFrameSchema>;

/** Tab to bridge. `hello` is only used on the WebSocket transport (the HTTP one sends a header). */
export type UpFrame =
  | { t: 'hello'; sessionToken: string }
  | { t: 'result'; id: string; ok: true; result: unknown }
  | { t: 'result'; id: string; ok: false; error: LinkError }
  | { t: 'state'; state: LiveState };

const ResultFrameSchema = z.union([
  z.object({ t: z.literal('result'), id: z.string(), ok: z.literal(true), result: z.unknown() }),
  z.object({ t: z.literal('result'), id: z.string(), ok: z.literal(false), error: LinkErrorSchema }),
]);
export const UpFrameSchema: z.ZodType<UpFrame> = z.union([
  z.object({ t: z.literal('hello'), sessionToken: z.string().min(16).max(256) }),
  ResultFrameSchema,
  z.object({ t: z.literal('state'), state: LiveStateSchema }),
]) as z.ZodType<UpFrame>;

// ---------------------------------------------------------------------------------------------
// Pairing

export const ClientInfoSchema = z.object({
  app: z.literal('ibasho-web'),
  version: z.string().max(40),
  /** Human label shown to the agent, e.g. "Firefox on this laptop". */
  label: z.string().max(80).exactOptional(),
});
export type ClientInfo = z.infer<typeof ClientInfoSchema>;

export const PairRequestSchema = z.strictObject({
  code: z.string().min(4).max(16),
  client: ClientInfoSchema,
});
export const PairResponseSchema = z.object({
  sessionId: z.string(),
  sessionToken: z.string(),
  protocol: z.literal(AGENT_LINK_PROTOCOL),
});
export type PairResponse = z.infer<typeof PairResponseSchema>;

export const SessionInfoSchema = z.object({
  id: z.string(),
  client: ClientInfoSchema,
  pairedAt: z.string(),
  connected: z.boolean(),
  state: LiveStateSchema.nullable(),
});
export type SessionInfo = z.infer<typeof SessionInfoSchema>;

export const SessionsResponseSchema = z.object({
  sessions: z.array(SessionInfoSchema),
  /** Present so the agent can tell the person which code to type in Settings > Agent link. */
  pairing: z.object({ code: z.string(), expiresAt: z.string() }),
});
export type SessionsResponse = z.infer<typeof SessionsResponseSchema>;

/** One outbound ledger line (SPEC 5.14): every live call the tab served. */
export interface LedgerEntry {
  at: string;
  sessionId: string;
  method: LiveMethod;
  /** Short, number-free description, e.g. "apply: addMeasure loft". */
  summary: string;
  ok: boolean;
}

/** Number-free summary of a call for the ledger. */
export function summariseCall(method: LiveMethod, params: unknown): string {
  if (method === 'apply') {
    const ops = (params as LiveParams['apply'] | undefined)?.ops ?? [];
    const parts = ops.map((o) => {
      if ('measureId' in o) return `${o.op} ${o.measureId}`;
      if (o.op === 'setParam') return `setParam ${o.path}`;
      return o.op;
    });
    return `apply: ${parts.join(', ')}`.slice(0, 160);
  }
  if (method === 'say') return `say: ${(params as LiveParams['say'] | undefined)?.section ?? ''}`;
  if (method === 'thread') return `thread: ${(params as LiveParams['thread'] | undefined)?.evidenceId ?? ''}`;
  return method;
}
