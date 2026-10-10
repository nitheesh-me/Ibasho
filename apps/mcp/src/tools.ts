/**
 * Every MCP tool in ARCH 14. Owner: WP-12.
 *
 * Inputs are zod schemas (validated by the SDK before a handler runs, and again here where the
 * contract lives in `@ibasho/core/schemas` or `@ibasho/agent-bridge`). Outputs are JSON text in
 * which every number is an evidence view (`assertGrounded`). Failures come back as tool errors
 * with a plain next step, never as protocol errors, so the agent can recover.
 */
import {
  CAMERA_PRESETS,
  checkSlotted,
  LIVE_METHODS,
  type LiveMethod,
  SECTION_KEYS,
} from '@ibasho/agent-bridge';
import { AppNotRunningError, type BridgeAgentClient, LinkCallError } from '@ibasho/agent-bridge/server';
import type { MemoryEventType, NewMemoryEvent } from '@ibasho/core';
import { ForgetSelectorSchema, MEMORY_EVENT_TYPES, MemoryEventSchema } from '@ibasho/core/schemas';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { EngineUnavailableError } from './engine.ts';
import { assertGrounded } from './evidence.ts';
import type { Headless } from './headless.ts';
import type { HomeCatalog } from './homes.ts';
import { homeSummary } from './homes.ts';
import { AGENT_MEMORY_TYPES, type MemoryLog } from './memory.ts';
import { opLabel } from './ops.ts';

export interface ToolDeps {
  headless: Headless;
  homes: HomeCatalog;
  memory: MemoryLog;
  live: BridgeAgentClient;
}

export const HEADLESS_TOOLS = [
  'ibasho_list_homes',
  'ibasho_get_home',
  'ibasho_simulate',
  'ibasho_what_if',
  'ibasho_search_futures',
  'ibasho_evidence',
  'ibasho_why_not',
  'ibasho_verify',
  'ibasho_memory_list',
  'ibasho_memory_remember',
  'ibasho_memory_forget',
  'ibasho_compare',
] as const;

export const LIVE_TOOLS = [
  'ibasho_live_sessions',
  'ibasho_live_state',
  'ibasho_live_apply',
  'ibasho_live_view',
  'ibasho_live_thread',
  'ibasho_live_screenshot',
  'ibasho_live_say',
] as const;

export function ok(payload: unknown): CallToolResult {
  assertGrounded(payload);
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

export function fail(e: unknown): CallToolResult {
  let kind = 'error';
  if (e instanceof EngineUnavailableError) kind = 'engine-unavailable';
  else if (e instanceof AppNotRunningError) kind = 'app-not-running';
  else if (e instanceof LinkCallError) kind = `live-${e.code}`;
  const message = e instanceof Error ? e.message : String(e);
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ error: kind, message }, null, 2) }],
  };
}

async function guard(fn: () => unknown): Promise<CallToolResult> {
  try {
    return ok(await fn());
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------------------------
// Shared input pieces

const HomeId = z
  .string()
  .min(1)
  .max(80)
  .describe('Home id from ibasho_list_homes, e.g. "fixture:gh1" (a bare "gh1" means the fixture)');
const RunModeSchema = z.enum(['rating', 'standard', 'your-home']);
const Modes = z
  .array(RunModeSchema)
  .min(1)
  .max(3)
  .optional()
  .describe('Run modes (SPEC R3). Default ["standard"]; "your-home" uses the household as described.');
const Quantities = z
  .array(z.string().regex(/^[a-z][a-z0-9_.]*$/))
  .max(20)
  .optional()
  .describe('Quantity id prefixes to return (SPEC 7), e.g. ["energy.delivered.", "money.bill"]');
const Hash = z.string().min(8).max(128);
const EvId = z.string().regex(/^ev_[0-9a-z]+$/, 'expected an evidence id like ev_1a2b');
const SessionId = z
  .string()
  .min(1)
  .max(64)
  .optional()
  .describe('Live session id; optional when one tab is paired');
/**
 * Ops are listed loosely here so the JSON Schema stays representable; each op is then parsed
 * strictly with `ScenarioOpSchema` (read `ibasho://schema/ops` for the full shape).
 */
const OpsInput = z
  .array(
    z.looseObject({
      op: z.enum([
        'addMeasure',
        'removeMeasure',
        'setParam',
        'setTariff',
        'setBudget',
        'setHorizon',
        'compare',
        'explain',
        'rejectMeasure',
      ]),
    }),
  )
  .min(1)
  .max(32)
  .describe(
    'Typed ScenarioOps (ibasho://schema/ops). Example: [{"op":"addMeasure","measureId":"loft","params":{"option":"loft-300"}}]',
  );

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

// ---------------------------------------------------------------------------------------------

export function registerTools(server: McpServer, d: ToolDeps): void {
  // ---------------------------------------------------------------- headless
  server.registerTool(
    'ibasho_list_homes',
    {
      title: 'List homes',
      description:
        'Homes the agent can explore: fixtures (e.g. GH1, a 1905 London mid-terrace), saved .ibasho files in ~/.config/ibasho/homes, and live sessions when the app is open with Agent link on.',
      inputSchema: {},
      annotations: readOnly,
    },
    () =>
      guard(async () => {
        let live: unknown = { available: false };
        try {
          const s = await d.live.sessions();
          live = {
            available: true,
            sessions: s.sessions.map((x) => ({ id: x.id, homeId: x.state?.homeId ?? null })),
          };
        } catch (e) {
          live = { available: false, reason: e instanceof Error ? e.message : String(e) };
        }
        return { homes: d.homes.list().map(({ id, kind, label }) => ({ id, kind, label })), live };
      }),
  );

  server.registerTool(
    'ibasho_get_home',
    {
      title: 'Get home',
      description:
        'Twin summary: form, elements, systems, designations, recorded checks, the measure catalogue (measure, group and option ids for ops), and every input field as known, estimated or unknown with its provenance. Numeric inputs are not shown; read numbers through ibasho_simulate evidence.',
      inputSchema: { homeId: HomeId },
      annotations: readOnly,
    },
    ({ homeId }) =>
      guard(async () => {
        const { entry, twin } = d.homes.get(homeId);
        return { ...homeSummary(entry, twin), catalogue: await d.headless.measures(twin) };
      }),
  );

  server.registerTool(
    'ibasho_simulate',
    {
      title: 'Simulate baseline',
      description:
        'Run the engine on the home as it is. Returns a result hash and evidence views {ev, quantity, value, unit, seal}. Quote numbers only with their ev ids.',
      inputSchema: { homeId: HomeId, modes: Modes, quantities: Quantities },
      annotations: readOnly,
    },
    ({ homeId, modes, quantities }) =>
      guard(() => d.headless.simulate(homeId, modes ?? ['standard'], quantities)),
  );

  server.registerTool(
    'ibasho_what_if',
    {
      title: 'What if',
      description:
        'Apply typed ops to a copy of the home and simulate before and after. Ops outside the ScenarioOp schema are rejected with the reason. Returns per-fuel saving evidence when the engine emits it. Never changes the saved home.',
      inputSchema: { homeId: HomeId, ops: OpsInput, modes: Modes, quantities: Quantities },
      annotations: readOnly,
    },
    ({ homeId, ops, modes, quantities }) =>
      guard(() => d.headless.whatIf(homeId, ops, modes ?? ['standard'], quantities)),
  );

  server.registerTool(
    'ibasho_search_futures',
    {
      title: 'Search futures',
      description:
        'Full retrofit search: the Pareto front, the three picks (least upfront, best return, lowest running carbon), packages that need a check, why-not rows with rule ids and dominance witnesses, and the certificate hash. Uses the memory log (ruled-out and done measures, budget).',
      inputSchema: {
        homeId: HomeId,
        target: z
          .enum(['default', 'save-money-year-1', 'cut-running-carbon'])
          .optional()
          .describe('Target set for the picks (SPEC R7). Default "default".'),
        budgetGBP: z.number().nonnegative().max(1_000_000).optional(),
        horizonYears: z.number().int().min(1).max(60).optional(),
      },
      annotations: readOnly,
    },
    ({ homeId, target, budgetGBP, horizonYears }) =>
      guard(() =>
        d.headless.searchFutures(homeId, {
          target:
            target === undefined || target === 'default'
              ? { kind: 'default' }
              : {
                  kind: 'custom',
                  saveMoneyYear1: target === 'save-money-year-1',
                  cutRunningCarbon: target === 'cut-running-carbon',
                },
          budgetGBP,
          horizonYears,
        }),
      ),
  );

  server.registerTool(
    'ibasho_evidence',
    {
      title: 'Open evidence',
      description:
        'One evidence node: value, formula (with its SPEC or brief id), input ev ids and roles, sources, grade and seal. Follow inputs to pull the red thread.',
      inputSchema: { evidenceId: EvId, resultHash: Hash.optional() },
      annotations: readOnly,
    },
    ({ evidenceId, resultHash }) => guard(() => d.headless.evidence(evidenceId, resultHash)),
  );

  server.registerTool(
    'ibasho_why_not',
    {
      title: 'Why not',
      description:
        'Why a measure (e.g. "wall-iwi") or option is absent from the futures: ruled out by you, blocked by a rule, needs a check (and which), misses the target, or dominated (and by which package).',
      inputSchema: {
        resultHash: Hash.describe('From ibasho_search_futures'),
        measure: z.string().min(1).max(80).describe('Measure id or option id'),
      },
      annotations: readOnly,
    },
    ({ resultHash, measure }) => guard(() => d.headless.whyNot(resultHash, measure)),
  );

  server.registerTool(
    'ibasho_verify',
    {
      title: 'Verify certificate',
      description:
        'Check a search certificate with the TypeScript mirror of the Lean checker (packages/verify). Reports each check; never claims Checked when no checker is available.',
      inputSchema: { resultHash: Hash },
      annotations: readOnly,
    },
    ({ resultHash }) => guard(() => d.headless.verify(resultHash)),
  );

  server.registerTool(
    'ibasho_memory_list',
    {
      title: 'Things you told us',
      description:
        'The memory log for a home (typed events), optionally one type, plus the folded preferences.',
      inputSchema: { homeId: HomeId, type: z.enum(MEMORY_EVENT_TYPES).optional() },
      annotations: readOnly,
    },
    ({ homeId, type }) =>
      guard(() => {
        const { entry } = d.homes.get(homeId);
        const events = d.memory.list(entry.id, type as MemoryEventType | undefined);
        const prefs = d.memory.preferences(entry.id);
        return {
          homeId: entry.id,
          events: events.map((e) => ({
            id: e.id,
            at: e.at,
            actor: e.actor,
            type: e.type,
            source: e.source ?? null,
          })),
          preferences: {
            tenure: prefs.tenure,
            hasBudget: prefs.budgetCapGBP !== undefined,
            ruledOut: Object.entries(prefs.rejected).map(([m, r]) => ({ measureId: m, scope: r.scope })),
            done: Object.keys(prefs.completed),
            priorities: prefs.priorities,
          },
          note: 'Payload values (such as a budget) are the person’s own statements; ask before repeating them.',
        };
      }),
  );

  server.registerTool(
    'ibasho_memory_remember',
    {
      title: 'Remember',
      description:
        'Record something the person told you, as one typed event. Only record what they said in their own words, and quote them. Allowed types: ' +
        AGENT_MEMORY_TYPES.join(', '),
      inputSchema: {
        homeId: HomeId,
        type: z.enum(AGENT_MEMORY_TYPES),
        payload: z.record(z.string(), z.unknown()).describe('Typed payload for the event type (AM 7.1)'),
        quote: z.string().min(1).max(120).describe('The person’s words, at most 120 characters'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    ({ homeId, type, payload, quote }) =>
      guard(() => {
        const { entry } = d.homes.get(homeId);
        const candidate = {
          homeId: entry.id,
          actor: 'owner',
          type,
          payload,
          source: { kind: 'chat', quote },
        };
        // Full validation against the core schema (with placeholder id and time).
        const parsed = MemoryEventSchema.safeParse({
          ...candidate,
          id: 'pending',
          at: new Date().toISOString(),
        });
        if (!parsed.success) {
          throw new Error(
            `payload does not match ${type}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
          );
        }
        const e = d.memory.append(candidate as NewMemoryEvent);
        return { recorded: { id: e.id, type: e.type, at: e.at } };
      }),
  );

  server.registerTool(
    'ibasho_memory_forget',
    {
      title: 'Forget',
      description:
        'Delete memory events for real: all, one event id, one type, or everything about one measure. Ask the person first.',
      inputSchema: {
        homeId: HomeId,
        selector: z
          .looseObject({ kind: z.enum(['all', 'event', 'type', 'measure']) })
          .describe('{"kind":"measure","measureId":"pv"} or {"kind":"event","eventId":"m_..."} etc.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    ({ homeId, selector }) =>
      guard(() => {
        const { entry } = d.homes.get(homeId);
        const sel = ForgetSelectorSchema.parse(selector);
        const { removed } = d.memory.forget(entry.id, sel);
        return { forgotten: removed.map((e) => ({ id: e.id, type: e.type })) };
      }),
  );

  server.registerTool(
    'ibasho_compare',
    {
      title: 'Compare',
      description:
        'Side by side evidence for two homes (simulated), or two packages from one search result. Never subtract values yourself; quote both with their ev ids.',
      inputSchema: {
        homes: z.tuple([HomeId, HomeId]).optional(),
        resultHash: Hash.optional(),
        packages: z.tuple([z.string().min(1), z.string().min(1)]).optional(),
        modes: Modes,
        quantities: Quantities,
      },
      annotations: readOnly,
    },
    ({ homes, resultHash, packages, modes, quantities }) =>
      guard(() => {
        if (homes) return d.headless.compareHomes(homes[0], homes[1], modes ?? ['standard'], quantities);
        if (resultHash && packages) return d.headless.comparePackages(resultHash, packages[0], packages[1]);
        throw new Error('pass either homes: [a, b], or resultHash with packages: [a, b]');
      }),
  );

  // ---------------------------------------------------------------- live
  const live = <M extends LiveMethod>(method: M, params: unknown, sessionId?: string) =>
    d.live.call(method, params, sessionId);
  const strip = <T extends { sessionId?: string | undefined }>(args: T) => {
    const { sessionId, ...rest } = args;
    return { sessionId, params: rest };
  };

  server.registerTool(
    'ibasho_live_sessions',
    {
      title: 'Live sessions',
      description:
        'Open app tabs with Agent link on, and the pairing code to tell the person when none is paired (they type it in Settings > Agent link).',
      inputSchema: {},
      annotations: readOnly,
    },
    () =>
      guard(async () => {
        const s = await d.live.sessions();
        return {
          sessions: s.sessions.map((x) => ({
            id: x.id,
            client: x.client,
            pairedAt: x.pairedAt,
            connected: x.connected,
            homeId: x.state?.homeId ?? null,
          })),
          pairing: s.sessions.some((x) => x.connected) ? null : s.pairing,
        };
      }),
  );

  server.registerTool(
    'ibasho_live_state',
    {
      title: 'Live state',
      description: 'What the open tab shows: home, route, chapter, layer, selection, current result hash.',
      inputSchema: { sessionId: SessionId },
      annotations: readOnly,
    },
    (args) =>
      guard(() => {
        const { sessionId, params } = strip(args);
        return live('state', params, sessionId);
      }),
  );

  server.registerTool(
    'ibasho_live_apply',
    {
      title: 'Apply in the app',
      description:
        'Apply typed ops in the open app. The change carries an "agent" mark, is undoable, and is listed in the outbound ledger. Tell the person what you changed.',
      inputSchema: {
        sessionId: SessionId,
        ops: OpsInput,
        label: z.string().min(1).max(80).optional().describe('Short undo label, no numbers'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    (args) =>
      guard(async () => {
        const { sessionId, params } = strip(args);
        const r = await live('apply', params, sessionId);
        return {
          accepted: r.accepted.map(opLabel),
          rejected: r.rejected.map((x) => ({ op: opLabel(x.op), code: x.code, detail: x.detail })),
          undoId: r.undoId,
          resultHash: r.resultHash,
        };
      }),
  );

  server.registerTool(
    'ibasho_live_view',
    {
      title: 'Change the view',
      description:
        'Set the layer, camera preset, time of day and month, chapter, or focus element in the open app.',
      inputSchema: {
        sessionId: SessionId,
        layer: z.string().max(40).optional().describe('Visual layer id, e.g. "heat", "air", "sun"'),
        camera: z.enum(CAMERA_PRESETS).optional(),
        time: z
          .object({ hour: z.number().int().min(0).max(23), month: z.number().int().min(1).max(12) })
          .optional(),
        chapter: z.string().max(40).optional(),
        focus: z.string().max(80).optional().describe('Element id from ibasho_get_home'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    (args) =>
      guard(() => {
        const { sessionId, params } = strip(args);
        return live('view', params, sessionId);
      }),
  );

  server.registerTool(
    'ibasho_live_thread',
    {
      title: 'Pull the red thread',
      description:
        'In the open app, draw the red thread from a number to its evidence inputs. Returns the path of ev ids.',
      inputSchema: { sessionId: SessionId, evidenceId: EvId },
      annotations: readOnly,
    },
    (args) =>
      guard(() => {
        const { sessionId, params } = strip(args);
        return live('thread', params, sessionId);
      }),
  );

  server.registerTool(
    'ibasho_live_screenshot',
    {
      title: 'Screenshot the stage',
      description:
        'PNG of the stage in the open app, for you to look at. Prefer ibasho_live_state for facts.',
      inputSchema: {
        sessionId: SessionId,
        width: z.number().int().min(160).max(2048).optional(),
        height: z.number().int().min(120).max(2048).optional(),
      },
      annotations: readOnly,
    },
    async (args) => {
      try {
        const { sessionId, params } = strip(args);
        const shot = await live('screenshot', params, sessionId);
        return { content: [{ type: 'image', data: shot.data, mimeType: shot.mime }] };
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'ibasho_live_say',
    {
      title: 'Say in the narrator strip',
      description:
        'Show slotted narration in the app. Write no digits or number words: use [[e:ev_id]] (or [[e:ev_id|approx]]) for numbers and [[m:measureId]] for measures. The app fills values from evidence and runs the narrator validator.',
      inputSchema: {
        sessionId: SessionId,
        section: z.enum(SECTION_KEYS),
        text: z.string().min(1).max(2000),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => {
      const check = checkSlotted(args.text);
      if (!check.ok) {
        return fail(
          new Error(
            `refused before sending: ${check.issues.map((i) => `${i.rule} ${i.detail}`).join('; ')}. Put every number in an [[e:ev_id]] slot.`,
          ),
        );
      }
      return guard(() => {
        const { sessionId, params } = strip(args);
        return live('say', params, sessionId);
      });
    },
  );
}

/** Every tool name (ARCH 14). */
export const ALL_TOOLS: readonly string[] = [...HEADLESS_TOOLS, ...LIVE_TOOLS];
/** Live methods the bridge serves, one per live tool except sessions. */
export const LIVE_METHOD_LIST: readonly LiveMethod[] = LIVE_METHODS;
