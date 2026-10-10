/**
 * Sliced execution for cancellation (ARCH 5.5, DEC TE-6). Owner: WP-02.
 *
 * The search calls `tick()` between units of work. Once a slice has run for `sliceMs` (about 20 ms)
 * it yields a macrotask, so a `cancel` message can be delivered to the worker, and then checks the
 * cancel flag. Timing only decides where the search pauses, never what it computes, so results stay
 * deterministic.
 */

export class SearchCancelled extends Error {
  override name = 'SearchCancelled';
  readonly jobId: string;
  constructor(jobId: string) {
    super(`search ${jobId} was cancelled`);
    this.jobId = jobId;
  }
}

interface HostTimers {
  setTimeout?: (cb: () => void, ms: number) => unknown;
  performance?: { now(): number };
}
const host = globalThis as unknown as HostTimers;

function now(): number {
  return host.performance ? host.performance.now() : Date.now();
}

/** Resolve on the next macrotask (setTimeout 0), or a microtask where no timer exists. */
export function yieldMacrotask(): Promise<void> {
  return new Promise((resolve) => {
    if (host.setTimeout) host.setTimeout(resolve, 0);
    else Promise.resolve().then(resolve);
  });
}

export class Slicer {
  private start = now();
  readonly jobId: string;
  readonly sliceMs: number;
  private readonly isCancelled: () => boolean;
  constructor(jobId: string, isCancelled: () => boolean, sliceMs = 20) {
    this.jobId = jobId;
    this.isCancelled = isCancelled;
    this.sliceMs = sliceMs;
  }

  /** Yield if the slice is used up, then throw `SearchCancelled` if a cancel arrived. */
  async tick(): Promise<void> {
    if (now() - this.start >= this.sliceMs) {
      await yieldMacrotask();
      this.start = now();
    }
    if (this.isCancelled()) throw new SearchCancelled(this.jobId);
  }
}
