/**
 * `pnpm assets`: turns the pinned sources in `tools/assets/.cache/` into the served files under
 * `apps/web/public/assets/`, then writes `manifest.json` and `attribution.html`. Owner: WP-11.
 *
 * The output directory is owned by this script: it is cleared and rebuilt on every run.
 * Flags:
 * - `--check`: no rebuild; verify K1 to K4 on the committed output (works without the cache).
 * - `--tier=hero|all`: which tiers to build (default hero; lazy sets arrive at M-D).
 */
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderAttribution } from './attribution.ts';
import { checkAssetsDir } from './check.ts';
import {
  ALL_SPECS,
  type AssetSpec,
  assetId,
  HERO_BUDGET_BYTES,
  kebab,
  PROVIDERS,
  type Tier,
} from './config.ts';
import { type LockAsset, loadLock, readLocked } from './lock.ts';
import {
  ATTRIBUTION_FILE,
  MANIFEST_FILE,
  type Manifest,
  type ManifestAsset,
  type ManifestFile,
  tierBytes,
} from './manifest.ts';
import { processHdri } from './steps/hdri.ts';
import { processModel } from './steps/model.ts';
import { processTexture } from './steps/texture.ts';
import type { OutFile, StepResult } from './steps/types.ts';
import { formatJson, OUT_DIR, sha256, writeFileEnsured } from './util.ts';

function outDir(spec: AssetSpec): string {
  switch (spec.kind) {
    case 'hdri':
      return `hdri/${kebab(spec.phId)}`;
    case 'texture':
      return `textures/${kebab(spec.phId)}`;
    case 'model':
      return spec.provider === 'kenney'
        ? `models/kenney/${kebab(spec.name)}.glb`
        : `models/quaternius/${spec.slug}.glb`;
  }
}

async function runStep(spec: AssetSpec, la: LockAsset): Promise<StepResult> {
  const file = (role: string) => {
    const e = la.files[role];
    if (!e) throw new Error(`${assetId(spec)}: lock has no ${role} file`);
    return readLocked(e);
  };
  switch (spec.kind) {
    case 'hdri':
      return processHdri(outDir(spec), file('hdr'));
    case 'texture':
      return processTexture(
        outDir(spec),
        { diff: file('diff'), nor: file('nor'), arm: file('arm') },
        spec.res === '2k' ? 2048 : 1024,
      );
    case 'model':
      return processModel(outDir(spec), file('glb'), spec.fit);
  }
}

function toManifestFile(f: OutFile): ManifestFile {
  return {
    path: f.rel,
    role: f.role,
    mime: f.mime,
    bytes: f.data.length,
    sha256: sha256(f.data),
    ...(f.width !== undefined ? { width: f.width } : {}),
    ...(f.height !== undefined ? { height: f.height } : {}),
  };
}

function toManifestAsset(spec: AssetSpec, la: LockAsset, r: StepResult): ManifestAsset {
  const p = PROVIDERS[la.provider];
  return {
    id: assetId(spec),
    kind: spec.kind,
    tier: spec.tier,
    status: 'ok',
    title: la.title,
    ...(spec.kind === 'model' ? { room: spec.room } : { use: spec.use }),
    licence: p.licence,
    licenceUrl: p.licenceUrl,
    source: {
      provider: la.provider,
      providerName: p.name,
      authors: la.authors,
      page: la.page,
      licenceEvidence: la.licenceEvidence,
      files: Object.entries(la.files).map(([role, e]) => ({
        role,
        url: e.url ?? 'see archive',
        ...(e.zip ? { member: e.zip.member } : {}),
        sha256: e.sha256,
      })),
    },
    processing: r.processing,
    files: r.files.map(toManifestFile),
    [spec.kind]: r.details,
  };
}

/** The lock stores archive members without a URL; resolve it from the lock's archive table. */
function withArchiveUrls(la: LockAsset, archives: Readonly<Record<string, { url: string }>>): LockAsset {
  const files = Object.fromEntries(
    Object.entries(la.files).map(([role, e]) => [
      role,
      e.zip && e.url === undefined ? { ...e, url: archives[e.zip.archive]?.url ?? 'unknown archive' } : e,
    ]),
  );
  return { ...la, files };
}

export async function build(tiers: readonly Tier[]): Promise<Manifest> {
  const lock = loadLock();
  if (!lock) throw new Error('tools/assets/sources.lock.json missing; run pnpm assets:fetch');
  // This script owns the output tree: clear it so stale files cannot linger (K1).
  if (existsSync(OUT_DIR)) for (const e of readdirSync(OUT_DIR)) rmSync(join(OUT_DIR, e), { recursive: true });

  const assets: ManifestAsset[] = [];
  for (const spec of ALL_SPECS) {
    if (!tiers.includes(spec.tier)) continue;
    const id = assetId(spec);
    const pinned = lock.assets[id];
    if (!pinned) throw new Error(`${id}: not in sources.lock.json; run pnpm assets:fetch`);
    const la = withArchiveUrls(pinned, lock.archives);
    const r = await runStep(spec, la);
    for (const f of r.files) writeFileEnsured(join(OUT_DIR, f.rel), f.data);
    assets.push(toManifestAsset(spec, la, r));
    console.log(`${id.padEnd(40)} ${r.files.reduce((s, f) => s + f.data.length, 0)} bytes`);
  }

  // The attribution page lists every credited asset; it is itself a hero file listed in the manifest.
  const draft: Manifest = {
    schema: 1,
    generator: 'tools/assets/src/process.ts',
    budgets: { hero: { limitBytes: HERO_BUDGET_BYTES, bytes: 0 }, lazy: { limitBytes: null, bytes: 0 } },
    assets,
  };
  const page = new TextEncoder().encode(renderAttribution(draft));
  writeFileEnsured(join(OUT_DIR, ATTRIBUTION_FILE), page);
  assets.push({
    id: 'doc-attribution',
    kind: 'doc',
    tier: 'hero',
    status: 'ok',
    title: 'Credits page',
    use: 'Attribution for every credited asset, generated from this manifest',
    // Our own generated page: same terms as the Ibasho repository, which has no public URL yet.
    licence: 'LicenseRef-Ibasho-project',
    licenceUrl: '',
    source: {
      provider: 'ibasho',
      providerName: 'Ibasho',
      authors: ['Ibasho contributors'],
      page: 'attribution.html',
      licenceEvidence: 'Generated by tools/assets/src/attribution.ts',
      files: [],
    },
    processing: ['Rendered by renderAttribution(manifest).'],
    files: [toManifestFile({ rel: ATTRIBUTION_FILE, role: 'page', mime: 'text/html', data: page })],
  });
  const withBytes = (m: Manifest): Manifest => ({
    ...m,
    budgets: {
      hero: { limitBytes: HERO_BUDGET_BYTES, bytes: tierBytes(m, 'hero') },
      lazy: { limitBytes: null, bytes: tierBytes(m, 'lazy') },
    },
  });
  const manifest = withBytes({ ...draft, assets });
  writeFileEnsured(join(OUT_DIR, MANIFEST_FILE), formatJson(manifest, `apps/web/public/assets/${MANIFEST_FILE}`));
  return manifest;
}

function report(): number {
  const r = checkAssetsDir();
  for (const p of r.problems) console.error(`assets: ${p}`);
  const n = r.manifest.assets.reduce((s, a) => s + a.files.length, 0);
  console.log(
    `assets: ${r.manifest.assets.length} assets, ${n} files; hero tier ${r.heroBytes} bytes of ${HERO_BUDGET_BYTES} (with manifest)`,
  );
  console.log(r.problems.length === 0 ? 'assets: K1 to K4 pass' : `assets: ${r.problems.length} problem(s)`);
  return r.problems.length === 0 ? 0 : 1;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (!args.includes('--check')) {
    const tierArg = args.find((a) => a.startsWith('--tier='))?.slice(7) ?? 'hero';
    await build(tierArg === 'all' ? ['hero', 'lazy'] : ['hero']);
  }
  process.exitCode = report();
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
