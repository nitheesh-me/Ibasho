/**
 * Paths, hashing and HTTP helpers for the asset pipeline. Owner: WP-11.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** `tools/assets/`. */
export const TOOL_DIR = resolve(HERE, '..');
/** Repository root. */
export const REPO_ROOT = resolve(TOOL_DIR, '..', '..');
/** Download cache (git ignored). Safe to delete; `pnpm assets:fetch` refills it. */
export const CACHE_DIR = join(TOOL_DIR, '.cache');
/** Pinned list of every downloaded source file with its sha256 (committed). */
export const LOCK_PATH = join(TOOL_DIR, 'sources.lock.json');
/** Served asset root. */
export const OUT_DIR = join(REPO_ROOT, 'apps', 'web', 'public', 'assets');
export const MANIFEST_PATH = join(OUT_DIR, 'manifest.json');
export const ATTRIBUTION_PATH = join(OUT_DIR, 'attribution.html');

export function sha256(buf: Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function md5(buf: Uint8Array): string {
  return createHash('md5').update(buf).digest('hex');
}

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export function writeFileEnsured(path: string, data: string | Uint8Array): void {
  ensureDir(dirname(path));
  writeFileSync(path, data);
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

const UA = 'ibasho-assets/0.0 (hobby project asset fetcher)';

/** GET with a timeout and a few retries. Throws on a non-2xx status. */
export async function httpGet(url: string, attempts = 3, timeoutMs = 120_000): Promise<Uint8Array> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

export async function httpText(url: string): Promise<string> {
  return new TextDecoder().decode(await httpGet(url));
}

export async function httpJson<T>(url: string): Promise<T> {
  return JSON.parse(await httpText(url)) as T;
}

/** Reads a cached file if present. */
export function readCached(rel: string): Uint8Array | undefined {
  const p = join(CACHE_DIR, rel);
  return existsSync(p) ? new Uint8Array(readFileSync(p)) : undefined;
}

/** Repo-relative POSIX path, for messages and the manifest. */
export function repoRel(abs: string): string {
  return abs
    .slice(REPO_ROOT.length + 1)
    .split('\\')
    .join('/');
}

/**
 * Serialises JSON exactly as the repo formatter (Biome) would write it, so generated files pass
 * `pnpm lint` and their sha256 is stable.
 */
export function formatJson(value: unknown, pathHint = 'x.json'): string {
  const raw = `${JSON.stringify(value, null, 2)}\n`;
  const bin = join(REPO_ROOT, 'node_modules', '.bin', 'biome');
  return execFileSync(bin, ['format', `--stdin-file-path=${pathHint}`], {
    cwd: REPO_ROOT,
    input: raw,
    encoding: 'utf8',
  });
}
