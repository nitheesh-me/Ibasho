/**
 * Outbound ledger (AM 4.2 rule 3, SPEC 5.14, SPEC 13). Every payload that leaves the device is
 * recorded here, byte for byte, before it is sent. Cloud sends need the owner's consent per provider,
 * given after seeing the first payload; localhost sends are recorded but need no consent.
 */
import { canonicalJson, type ProviderCapabilities, utf8 } from '@ibasho/core';

export type Locality = ProviderCapabilities['locality'];

export interface LedgerEntry {
  seq: number;
  at: string;
  providerId: string;
  locality: Locality;
  /** What the request is for (`narrate`, `repair`, `plan`, `extract`, `agent`). */
  purpose: string;
  endpoint: string;
  /** Canonical JSON of exactly what was sent. */
  payload: string;
  bytes: number;
}

export class ConsentRequiredError extends Error {
  override name = 'ConsentRequiredError';
  readonly providerId: string;
  /** The payload the owner should see before agreeing. */
  readonly preview: string;
  constructor(providerId: string, preview: string) {
    super(`cloud provider ${providerId} needs consent before the first send`);
    this.providerId = providerId;
    this.preview = preview;
  }
}

export interface LedgerOptions {
  clock?: () => string;
  /** Cap on kept entries (oldest dropped). */
  limit?: number;
}

export class OutboundLedger {
  private readonly entries: LedgerEntry[] = [];
  private readonly consented = new Set<string>();
  private readonly listeners = new Set<(e: LedgerEntry) => void>();
  private seq = 0;
  private readonly clock: () => string;
  private readonly limit: number;

  constructor(opts: LedgerOptions = {}) {
    this.clock = opts.clock ?? (() => new Date().toISOString());
    this.limit = opts.limit ?? 500;
  }

  grantConsent(providerId: string): void {
    this.consented.add(providerId);
  }

  revokeConsent(providerId: string): void {
    this.consented.delete(providerId);
  }

  hasConsent(providerId: string): boolean {
    return this.consented.has(providerId);
  }

  /**
   * Record a send. Throws `ConsentRequiredError` for a cloud provider without consent, so the caller
   * shows the preview and sends nothing.
   */
  record(e: {
    providerId: string;
    locality: Locality;
    purpose: string;
    endpoint: string;
    payload: unknown;
  }): LedgerEntry {
    const payload = canonicalJson(e.payload);
    if (e.locality === 'cloud' && !this.consented.has(e.providerId)) {
      throw new ConsentRequiredError(e.providerId, payload);
    }
    const entry: LedgerEntry = {
      seq: ++this.seq,
      at: this.clock(),
      providerId: e.providerId,
      locality: e.locality,
      purpose: e.purpose,
      endpoint: e.endpoint,
      payload,
      bytes: utf8(payload).length,
    };
    this.entries.push(entry);
    if (this.entries.length > this.limit) this.entries.splice(0, this.entries.length - this.limit);
    for (const l of this.listeners) l(entry);
    return entry;
  }

  list(): readonly LedgerEntry[] {
    return [...this.entries];
  }

  subscribe(cb: (e: LedgerEntry) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
}

/** Badge text per locality (SPEC 5.14, UX 14). */
export const LOCALITY_BADGE: Record<Locality, string> = {
  device: 'On this device',
  localhost: 'On your computer',
  cloud: 'In the cloud',
};
