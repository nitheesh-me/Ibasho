/**
 * Optional Ollama CORS pass-through (ARCH 11, AM 4.1). When the owner cannot set `OLLAMA_ORIGINS`,
 * the app talks to `/llm/ollama-cors/api/*` here instead and the companion forwards to the local
 * daemon without the browser `Origin` header (which Ollama would refuse). Only the endpoints the
 * Ollama provider uses are forwarded, and only to a loopback daemon: this is not an open proxy.
 */

export const OLLAMA_PASS_PREFIX = '/llm/ollama-cors';

/** Method and path pairs the provider needs (`packages/ai/src/providers/ollama.ts`). */
export const OLLAMA_ALLOWED: readonly (readonly [string, string])[] = [
  ['GET', '/api/version'],
  ['GET', '/api/tags'],
  ['POST', '/api/show'],
  ['POST', '/api/chat'],
];

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface OllamaPassOptions {
  /** Daemon base URL. Default `http://127.0.0.1:11434` (`OLLAMA_HOST` in `main.ts`). */
  host?: string;
  fetch?: Fetch;
  /** Max request body. Chat prompts are small; default 2 MiB. */
  maxBody?: number;
}

export const OLLAMA_DEFAULT = 'http://127.0.0.1:11434';

export function isLoopbackUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === '127.0.0.1' || h === 'localhost' || h === '[::1]';
  } catch {
    return false;
  }
}

/** Forward one request. Returns undefined when the method and path are not allowed. */
export async function forwardToOllama(
  req: Request,
  subpath: string,
  opts: OllamaPassOptions = {},
): Promise<Response | undefined> {
  if (!OLLAMA_ALLOWED.some(([m, p]) => m === req.method && p === subpath)) return undefined;
  const host = (opts.host ?? OLLAMA_DEFAULT).replace(/\/$/, '');
  if (!isLoopbackUrl(host))
    return new Response(JSON.stringify({ error: 'ollama host must be loopback' }), { status: 500 });
  const f = opts.fetch ?? fetch;
  const init: RequestInit = { method: req.method, headers: { accept: 'application/json' } };
  if (req.method === 'POST') {
    const body = await req.arrayBuffer();
    if (body.byteLength > (opts.maxBody ?? 2 * 1024 * 1024))
      return new Response(JSON.stringify({ error: 'body too large' }), { status: 413 });
    init.body = body;
    init.headers = { accept: 'application/json', 'content-type': 'application/json' };
  }
  if (req.signal) init.signal = req.signal;
  let upstream: Response;
  try {
    upstream = await f(`${host}${subpath}`, init);
  } catch (e) {
    return new Response(JSON.stringify({ error: `ollama unreachable at ${host}: ${(e as Error).message}` }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
  // Stream the body back (chat may stream NDJSON); keep only the content type.
  const headers = new Headers();
  const ct = upstream.headers.get('content-type');
  if (ct) headers.set('content-type', ct);
  return new Response(upstream.body, { status: upstream.status, headers });
}
