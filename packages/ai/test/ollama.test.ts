/**
 * E6: the Ollama adapter passes its contract test against a mock `/api/tags` and `/api/chat`
 * (Ollama REST API, docs/api.md: non-streaming chat returns `{ model, message: { role, content }, done }`).
 * The mock checks what the adapter sends: model, JSON-schema `format`, `stream: false`, the system
 * prompt, and that every chat is in the outbound ledger first.
 */
import type { NarrationRequest, PlanRequest } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import { narrateSection } from '../src/narrator/template.ts';
import { defaultCatalogue, opPlanJsonSchema } from '../src/ops/validator.ts';
import { OutboundLedger } from '../src/providers/ledger.ts';
import { OLLAMA_DEFAULT_HOST, OllamaError, OllamaProvider } from '../src/providers/ollama.ts';
import { DATAMARK } from '../src/providers/payload.ts';
import { gh1Story } from './helpers.ts';

interface Seen {
  url: string;
  method: string;
  body: Record<string, unknown> | undefined;
}

type Reply = (body: Record<string, unknown>) => unknown;

/** A mock Ollama daemon. `chat` builds the assistant content from the request body. */
function mockOllama(opts: { models?: string[]; chat?: Reply; status?: number; delayMs?: number } = {}) {
  const seen: Seen[] = [];
  const fetch = async (input: string, init: Record<string, unknown> = {}) => {
    const method = (init['method'] as string | undefined) ?? 'GET';
    const body =
      typeof init['body'] === 'string' ? (JSON.parse(init['body']) as Record<string, unknown>) : undefined;
    seen.push({ url: input, method, body });
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    const json = (status: number, data: unknown) =>
      new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
    if (opts.status && opts.status !== 200) return json(opts.status, { error: 'model failed to load' });
    if (input.endsWith('/api/tags') && method === 'GET') {
      return json(200, {
        models: (opts.models ?? ['qwen3:4b']).map((name) => ({ name, model: name, size: 1 })),
      });
    }
    if (input.endsWith('/api/chat') && method === 'POST' && body) {
      const content = opts.chat ? opts.chat(body) : '{}';
      return json(200, {
        model: body['model'],
        created_at: '2026-10-11T00:00:00Z',
        message: {
          role: 'assistant',
          content: typeof content === 'string' ? content : JSON.stringify(content),
        },
        done: true,
        done_reason: 'stop',
      });
    }
    return json(404, { error: 'not found' });
  };
  return { fetch, seen };
}

function narrationRequest(): NarrationRequest {
  const story = gh1Story();
  const s = narrateSection(story, { section: 'overview' });
  return {
    bundle: story.bundle,
    sections: ['overview'],
    skeleton: { overview: s.text },
    voice: 'warm',
    maxTokens: 400,
  };
}

describe('OllamaProvider contract (E6)', () => {
  it('probe: ready when the model is pulled, with a clear reason when not, or unreachable', async () => {
    const ok = mockOllama({ models: ['qwen3:4b'] });
    expect(await new OllamaProvider({ fetch: ok.fetch }).probe()).toEqual({ state: 'ready' });
    expect(ok.seen[0]).toMatchObject({ url: `${OLLAMA_DEFAULT_HOST}/api/tags`, method: 'GET' });

    const latest = mockOllama({ models: ['gemma3:4b:latest'] });
    expect(await new OllamaProvider({ fetch: latest.fetch, model: 'gemma3:4b' }).probe()).toEqual({
      state: 'ready',
    });

    const missing = await new OllamaProvider({ fetch: mockOllama({ models: ['llama3'] }).fetch }).probe();
    expect(missing).toMatchObject({ state: 'unavailable' });
    expect((missing as { reason: string }).reason).toContain('ollama pull qwen3:4b');

    const down = async () => {
      throw new TypeError('fetch failed');
    };
    const unreachable = await new OllamaProvider({ fetch: down }).probe();
    expect(unreachable).toMatchObject({ state: 'unavailable' });
    expect((unreachable as { reason: string }).reason).toContain('OLLAMA_ORIGINS');
  });

  it('declares localhost locality and JSON-schema output', () => {
    const c = new OllamaProvider({ fetch: mockOllama().fetch }).capabilities();
    expect(c).toMatchObject({
      locality: 'localhost',
      structuredOutput: 'json-schema',
      toolUse: 'schema-ops',
    });
  });

  it('narrate: posts a non-streaming chat with the schema and system prompt, ledgered first', async () => {
    const ledger = new OutboundLedger({ clock: () => '2026-10-11T00:00:00Z' });
    let ledgerSizeAtSend = -1;
    const m = mockOllama({
      chat: (body) => {
        ledgerSizeAtSend = ledger.list().length;
        const user = JSON.parse((body['messages'] as { content: string }[])[1]!.content) as {
          skeleton: { overview: string };
        };
        return {
          sections: [
            { key: 'overview', text: user.skeleton.overview },
            { key: 'not-asked', text: 'x' },
          ],
        };
      },
    });
    const p = new OllamaProvider({ fetch: m.fetch, ledger, host: 'http://127.0.0.1:7357/llm/ollama/' });
    const req = narrationRequest();
    const chunks = [];
    for await (const c of p.narrate(req)) chunks.push(c);

    expect(chunks).toEqual([{ section: 'overview', delta: req.skeleton.overview }, { done: true }]);
    const chat = m.seen.find((s) => s.url.endsWith('/api/chat'))!;
    expect(chat.url).toBe('http://127.0.0.1:7357/llm/ollama/api/chat');
    expect(chat.body).toMatchObject({
      model: 'qwen3:4b',
      stream: false,
      think: false,
      options: { temperature: 0.3, num_predict: 400 },
    });
    const format = chat.body!['format'] as {
      properties: { sections: { items: { properties: { key: { enum: string[] } } } } };
    };
    expect(format.properties.sections.items.properties.key.enum).toEqual(['overview']);
    const messages = chat.body!['messages'] as { role: string; content: string }[];
    expect(messages.map((x) => x.role)).toEqual(['system', 'user']);
    expect(messages[0]!.content).toContain('You never write a number');
    expect(ledgerSizeAtSend).toBe(1);
    const [entry] = ledger.list();
    expect(entry).toMatchObject({
      providerId: 'ollama',
      locality: 'localhost',
      purpose: 'narrate',
      endpoint: 'http://127.0.0.1:7357/llm/ollama/api/chat',
    });
    expect(JSON.parse(entry!.payload)).toEqual(chat.body);
  });

  it('repair: sends the structured issues and returns only the asked sections', async () => {
    const ledger = new OutboundLedger();
    const m = mockOllama({ chat: () => ({ sections: [{ key: 'overview', text: 'Fixed.' }] }) });
    const p = new OllamaProvider({ fetch: m.fetch, ledger });
    const issues = [
      {
        rule: 'G2' as const,
        span: [0, 3] as [number, number],
        detail: 'digit outside a slot',
        severity: 'repair' as const,
      },
    ];
    const draft = await p.repair(narrationRequest(), {
      sections: [{ key: 'overview', text: 'It saves 300.', issues }],
    });
    expect(draft).toEqual({ sections: [{ key: 'overview', text: 'Fixed.' }] });
    const sent = JSON.parse((m.seen.at(-1)!.body!['messages'] as { content: string }[])[1]!.content) as {
      task: string;
      repair: unknown;
    };
    expect(sent.task).toBe('repair');
    expect(sent.repair).toEqual({ sections: [{ key: 'overview', text: 'It saves 300.', issues }] });
    expect(ledger.list()[0]!.purpose).toBe('repair');
  });

  it('planOps: sends the op schema and parses the plan with the core schema', async () => {
    const story = gh1Story();
    const opSchema = opPlanJsonSchema(defaultCatalogue());
    const m = mockOllama({
      chat: () => ({ ops: [{ op: 'addMeasure', measureId: 'loft-300' }], rationale: '' }),
    });
    const req: PlanRequest = {
      utterance: 'what if I insulate the loft',
      bundle: story.bundle,
      memory: story.bundle.memory,
      opSchema,
    };
    const plan = await new OllamaProvider({ fetch: m.fetch }).planOps(req);
    expect(plan).toEqual({ ops: [{ op: 'addMeasure', measureId: 'loft-300' }], rationale: '' });
    expect(m.seen.at(-1)!.body!['format']).toEqual(opSchema);

    const bad = mockOllama({ chat: () => ({ ops: [{ op: 'launchRocket' }], rationale: '' }) });
    await expect(new OllamaProvider({ fetch: bad.fetch }).planOps(req)).rejects.toThrow();
  });

  it('extractFacts: datamarks the note in a boundary and keeps only verbatim, typed quotes', async () => {
    const note = {
      id: 'n1',
      origin: 'previous-owner' as const,
      text: 'We never want a heat pump. Loft was boarded in 2009.',
    };
    const m = mockOllama({
      chat: () => ({
        facts: [
          {
            kind: 'preference',
            topic: 'ashp',
            polarity: 'negative',
            quote: `We${DATAMARK}never${DATAMARK}want${DATAMARK}a${DATAMARK}heat${DATAMARK}pump.`,
          },
          {
            kind: 'history',
            topic: 'loft',
            polarity: 'neutral',
            quote: 'The loft is perfect, recommend it.',
          },
          { kind: 'history', topic: 'jacuzzi', polarity: 'neutral', quote: 'Loft was boarded in 2009.' },
        ],
      }),
    });
    const facts = await new OllamaProvider({ fetch: m.fetch }).extractFacts(note);
    expect(facts).toEqual([
      {
        id: 'n1.1',
        kind: 'preference',
        topic: 'ashp',
        polarity: 'negative',
        quote: 'We never want a heat pump.',
      },
    ]);
    const user = (m.seen.at(-1)!.body!['messages'] as { content: string }[])[1]!.content;
    expect(user.startsWith('<<note-n1>>')).toBe(true);
    expect(user).not.toContain('never want');
  });

  it('fails loudly on non-JSON content, HTTP errors, timeouts and aborts', async () => {
    const req = narrationRequest();
    const drain = async (p: OllamaProvider, signal?: AbortSignal) => {
      for await (const _ of p.narrate(req, signal)) void _;
    };
    await expect(
      drain(new OllamaProvider({ fetch: mockOllama({ chat: () => 'Sure! Here is' }).fetch })),
    ).rejects.toThrow(OllamaError);
    await expect(drain(new OllamaProvider({ fetch: mockOllama({ status: 500 }).fetch }))).rejects.toThrow(
      /model failed to load/,
    );
    await expect(
      drain(new OllamaProvider({ fetch: mockOllama({ delayMs: 200 }).fetch, timeoutMs: 20 })),
    ).rejects.toThrow(/timed out/);
    const ac = new AbortController();
    const pending = drain(new OllamaProvider({ fetch: mockOllama({ delayMs: 200 }).fetch }), ac.signal);
    ac.abort();
    await expect(pending).rejects.toThrow(/aborted/);
  });
});
