/**
 * The agent link hub: pairing, sessions and call routing, independent of transport. Owner: WP-12.
 *
 * Trust model (ARCH 14, L4):
 * - The agent side proves itself with the per-launch token from `server.json` (checked by the
 *   Hono app, not here).
 * - A tab proves itself with a one-time pairing code the person types in Settings > Agent link.
 *   The code is short-lived, single use, and rotates after a few wrong guesses, so a random local
 *   page cannot join. A paired tab gets a random session token for its transport.
 */
import {
  AGENT_LINK_PROTOCOL,
  type ClientInfo,
  type DownFrame,
  type LedgerEntry,
  type LinkError,
  type LiveMethod,
  type LiveState,
  parseLiveParams,
  type SessionInfo,
  summariseCall,
  type UpFrame,
  UpFrameSchema,
} from '../protocol.ts';

/** Crockford base32 without I, L, O, U: easy to read aloud and type. */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export class LinkCallError extends Error {
  readonly code: LinkError['code'];
  constructor(code: LinkError['code'], message: string) {
    super(message);
    this.name = 'LinkCallError';
    this.code = code;
  }
}

export interface HubOptions {
  /** Milliseconds since epoch. */
  now?: () => number;
  /** Cryptographic random bytes. */
  randomBytes?: (n: number) => Uint8Array;
  callTimeoutMs?: number;
  pairingTtlMs?: number;
  /** Wrong codes allowed before the code rotates. */
  maxPairFailures?: number;
  onLedger?: (entry: LedgerEntry) => void;
}

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  method: LiveMethod;
}

interface Session {
  id: string;
  token: string;
  client: ClientInfo;
  pairedAt: string;
  state: LiveState | null;
  sink: ((f: DownFrame) => void) | null;
  pending: Map<string, Pending>;
}

/** A transport's handle on one connected tab. */
export interface Connection {
  sessionId: string;
  /** Feed one frame from the tab (already JSON-decoded). */
  receive(frame: unknown): void;
  close(reason?: string): void;
}

export function defaultRandomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/** Constant-time comparison for secrets of possibly different length. */
export function safeEqual(a: string, b: string): boolean {
  const n = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
  return diff === 0;
}

export function randomToken(bytes = 32, random: (n: number) => Uint8Array = defaultRandomBytes): string {
  return Array.from(random(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function normaliseCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
}

export class AgentHub {
  readonly #now: () => number;
  readonly #random: (n: number) => Uint8Array;
  readonly #timeout: number;
  readonly #ttl: number;
  readonly #maxFailures: number;
  readonly #onLedger: ((e: LedgerEntry) => void) | undefined;
  readonly #sessions = new Map<string, Session>();
  #code = '';
  #codeExpires = 0;
  #failures = 0;
  #seq = 0;

  constructor(opts: HubOptions = {}) {
    this.#now = opts.now ?? Date.now;
    this.#random = opts.randomBytes ?? defaultRandomBytes;
    this.#timeout = opts.callTimeoutMs ?? 15_000;
    this.#ttl = opts.pairingTtlMs ?? 10 * 60_000;
    this.#maxFailures = opts.maxPairFailures ?? 5;
    this.#onLedger = opts.onLedger;
    this.rotatePairingCode();
  }

  /** The current code, formatted `XXXX-XXXX`; rotates first if it expired. */
  pairingCode(): { code: string; expiresAt: string } {
    if (this.#now() >= this.#codeExpires) this.rotatePairingCode();
    return {
      code: `${this.#code.slice(0, 4)}-${this.#code.slice(4)}`,
      expiresAt: new Date(this.#codeExpires).toISOString(),
    };
  }

  rotatePairingCode(): void {
    const bytes = this.#random(8);
    this.#code = Array.from(bytes, (b) => CODE_ALPHABET[b & 31]).join('');
    this.#codeExpires = this.#now() + this.#ttl;
    this.#failures = 0;
  }

  /** Exchange a pairing code for a session. The code is single use. */
  pair(
    code: string,
    client: ClientInfo,
  ):
    | { ok: true; sessionId: string; sessionToken: string; protocol: typeof AGENT_LINK_PROTOCOL }
    | { ok: false; reason: 'bad-code' | 'expired' } {
    if (this.#now() >= this.#codeExpires) {
      this.rotatePairingCode();
      return { ok: false, reason: 'expired' };
    }
    if (!safeEqual(normaliseCode(code), this.#code)) {
      this.#failures += 1;
      if (this.#failures >= this.#maxFailures) this.rotatePairingCode();
      return { ok: false, reason: 'bad-code' };
    }
    this.rotatePairingCode();
    const id = `s_${randomToken(6, this.#random)}`;
    const token = randomToken(32, this.#random);
    this.#sessions.set(id, {
      id,
      token,
      client,
      pairedAt: new Date(this.#now()).toISOString(),
      state: null,
      sink: null,
      pending: new Map(),
    });
    return { ok: true, sessionId: id, sessionToken: token, protocol: AGENT_LINK_PROTOCOL };
  }

  /** Session id for a session token, or null. */
  authenticate(sessionToken: string): string | null {
    for (const s of this.#sessions.values()) if (safeEqual(s.token, sessionToken)) return s.id;
    return null;
  }

  /**
   * Attach a transport to a paired session. A newer connection replaces an older one (a reload),
   * and the older one's in-flight calls fail with `closed`.
   */
  connect(sessionToken: string, sink: (f: DownFrame) => void): Connection | null {
    const id = this.authenticate(sessionToken);
    const s = id ? this.#sessions.get(id) : undefined;
    if (!s) return null;
    if (s.sink) {
      s.sink({ t: 'bye', reason: 'replaced by a newer connection' });
      this.#detach(s, 'replaced by a newer connection');
    }
    s.sink = sink;
    sink({ t: 'welcome', sessionId: s.id, protocol: AGENT_LINK_PROTOCOL });
    let open = true;
    return {
      sessionId: s.id,
      receive: (raw) => {
        if (open && s.sink === sink) this.#receive(s, raw);
      },
      close: (reason = 'closed') => {
        if (!open) return;
        open = false;
        if (s.sink === sink) this.#detach(s, reason);
      },
    };
  }

  /** Forget a session entirely (the person turned Agent link off). */
  unpair(sessionId: string): void {
    const s = this.#sessions.get(sessionId);
    if (!s) return;
    if (s.sink) {
      s.sink({ t: 'bye', reason: 'unpaired' });
      this.#detach(s, 'unpaired');
    }
    this.#sessions.delete(sessionId);
  }

  sessions(): SessionInfo[] {
    return [...this.#sessions.values()].map((s) => ({
      id: s.id,
      client: s.client,
      pairedAt: s.pairedAt,
      connected: s.sink !== null,
      state: s.state,
    }));
  }

  /** Number of tabs connected right now. */
  connectedCount(): number {
    let n = 0;
    for (const s of this.#sessions.values()) if (s.sink) n += 1;
    return n;
  }

  /**
   * Relay one live call to a tab and wait for its answer. Params are validated here, before
   * anything reaches the tab.
   */
  async call(sessionId: string | undefined, method: LiveMethod, params: unknown): Promise<unknown> {
    let parsed: unknown;
    try {
      parsed = parseLiveParams(method, params);
    } catch (e) {
      throw new LinkCallError('bad-request', e instanceof Error ? e.message : String(e));
    }
    const s = this.#pick(sessionId);
    const sink = s.sink;
    if (!sink) throw new LinkCallError('closed', `session ${s.id} has no open tab`);
    this.#seq += 1;
    const id = `c${this.#seq}`;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        s.pending.delete(id);
        this.#ledger(s.id, method, parsed, false);
        reject(new LinkCallError('timeout', `the tab did not answer ${method} in time`));
      }, this.#timeout);
      s.pending.set(id, {
        method,
        timer,
        resolve: (v) => {
          this.#ledger(s.id, method, parsed, true);
          resolve(v);
        },
        reject: (e) => {
          this.#ledger(s.id, method, parsed, false);
          reject(e);
        },
      });
      sink({ t: 'call', id, method, params: parsed });
    });
  }

  #pick(sessionId: string | undefined): Session {
    if (sessionId) {
      const s = this.#sessions.get(sessionId);
      if (!s) throw new LinkCallError('no-session', `no session ${sessionId}`);
      return s;
    }
    const live = [...this.#sessions.values()].filter((s) => s.sink);
    if (live.length === 0)
      throw new LinkCallError('no-session', 'no tab is connected; turn on Settings > Agent link');
    if (live.length > 1)
      throw new LinkCallError('ambiguous-session', 'more than one tab is connected; pass sessionId');
    return live[0] as Session;
  }

  #receive(s: Session, raw: unknown): void {
    const r = UpFrameSchema.safeParse(raw);
    if (!r.success) return;
    const f: UpFrame = r.data;
    if (f.t === 'state') {
      s.state = f.state;
      return;
    }
    if (f.t !== 'result') return;
    const p = s.pending.get(f.id);
    if (!p) return;
    s.pending.delete(f.id);
    clearTimeout(p.timer);
    if (f.ok) p.resolve(f.result);
    else p.reject(new LinkCallError(f.error.code, f.error.message));
  }

  #detach(s: Session, reason: string): void {
    s.sink = null;
    for (const [id, p] of s.pending) {
      clearTimeout(p.timer);
      p.reject(new LinkCallError('closed', reason));
      s.pending.delete(id);
    }
  }

  #ledger(sessionId: string, method: LiveMethod, params: unknown, ok: boolean): void {
    this.#onLedger?.({
      at: new Date(this.#now()).toISOString(),
      sessionId,
      method,
      summary: summariseCall(method, params),
      ok,
    });
  }
}
