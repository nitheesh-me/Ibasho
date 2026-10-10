/**
 * `tools/assets/sources.lock.json`: every downloaded source file, pinned by sha256. Owner: WP-11.
 *
 * `fetch.ts` writes it; `process.ts` refuses to run on a cache that does not match it. With the
 * lock present, fetch downloads straight from the pinned URLs and never re-resolves the
 * upstream pages unless asked to (`--refresh`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProviderId } from './config.ts';
import { CACHE_DIR, LOCK_PATH, readJson, sha256 } from './util.ts';

export interface LockArchive {
  readonly url: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface LockFileEntry {
  /** Path under `tools/assets/.cache/`. */
  readonly cache: string;
  /** Direct download URL, when the file is fetched on its own. */
  readonly url?: string;
  /** Archive member, when the file is extracted from a zip listed in `archives`. */
  readonly zip?: { readonly archive: string; readonly member: string };
  readonly bytes: number;
  readonly sha256: string;
  /** Upstream checksum, when the provider publishes one (Poly Haven md5), verified at fetch. */
  readonly md5?: string;
}

export interface LockAsset {
  readonly provider: ProviderId;
  readonly title: string;
  readonly authors: readonly string[];
  /** Human page for the asset. */
  readonly page: string;
  /** Where the licence was read, quoted. */
  readonly licenceEvidence: string;
  /** Role (hdr, diff, nor, arm, glb) to source file. */
  readonly files: Readonly<Record<string, LockFileEntry>>;
}

export interface Lock {
  readonly schema: 1;
  readonly archives: Readonly<Record<string, LockArchive>>;
  readonly assets: Readonly<Record<string, LockAsset>>;
}

export function loadLock(): Lock | undefined {
  return existsSync(LOCK_PATH) ? readJson<Lock>(LOCK_PATH) : undefined;
}

/** Returns the cached bytes of a lock entry, or throws when missing or not matching the lock. */
export function readLocked(entry: LockFileEntry): Uint8Array {
  const p = join(CACHE_DIR, entry.cache);
  if (!existsSync(p)) throw new Error(`missing cached source ${entry.cache}; run pnpm assets:fetch`);
  const buf = new Uint8Array(readFileSync(p));
  const got = sha256(buf);
  if (got !== entry.sha256)
    throw new Error(`cached source ${entry.cache} has sha256 ${got}, lock says ${entry.sha256}`);
  return buf;
}

/** Sorts object keys recursively so the lock diff stays stable. */
export function sortKeys<T>(v: T): T {
  if (Array.isArray(v)) return v.map(sortKeys) as T;
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) o[k] = sortKeys((v as Record<string, unknown>)[k]);
    return o as T;
  }
  return v;
}
