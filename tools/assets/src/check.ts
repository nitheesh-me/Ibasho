/**
 * K1 to K4 over the real `apps/web/public/assets/` tree. Owner: WP-11.
 * Used by `process.ts` after a build, by `pnpm assets:check`, and by the tests.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { renderAttribution } from './attribution.ts';
import { HERO_BUDGET_BYTES } from './config.ts';
import { ATTRIBUTION_FILE, checkManifest, type DiskFile, MANIFEST_FILE, type Manifest } from './manifest.ts';
import { OUT_DIR, sha256 } from './util.ts';

/** Every file under `dir` except the manifest itself, keyed by POSIX path relative to `dir`. */
export function scanAssets(dir: string = OUT_DIR): Map<string, DiskFile> {
  const out = new Map<string, DiskFile>();
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) {
        const rel = relative(dir, p).split(sep).join('/');
        if (rel === MANIFEST_FILE) continue;
        const buf = readFileSync(p);
        out.set(rel, { bytes: buf.length, sha256: sha256(buf) });
      }
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

export interface CheckReport {
  readonly manifest: Manifest;
  readonly heroBytes: number;
  readonly problems: string[];
}

export function checkAssetsDir(dir: string = OUT_DIR): CheckReport {
  const mPath = join(dir, MANIFEST_FILE);
  if (!existsSync(mPath)) throw new Error(`${mPath} missing; run pnpm assets`);
  const raw = readFileSync(mPath);
  const manifest = JSON.parse(raw.toString('utf8')) as Manifest;
  const problems = checkManifest(manifest, scanAssets(dir), HERO_BUDGET_BYTES, raw.length);
  const aPath = join(dir, ATTRIBUTION_FILE);
  if (!existsSync(aPath)) problems.push(`K4 ${ATTRIBUTION_FILE} missing`);
  else if (readFileSync(aPath, 'utf8') !== renderAttribution(manifest))
    problems.push(`K4 ${ATTRIBUTION_FILE} is not the page generated from the manifest`);
  const heroBytes =
    manifest.assets
      .filter((a) => a.tier === 'hero')
      .reduce((s, a) => s + a.files.reduce((t, f) => t + f.bytes, 0), 0) + raw.length;
  return { manifest, heroBytes, problems };
}
