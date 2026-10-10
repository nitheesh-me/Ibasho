/**
 * `apps/web/public/assets/manifest.json`: shape and checks. Owner: WP-11.
 *
 * Consumers (WP-07 scene, WP-08 shell) read it at runtime with `fetch('/app/assets/manifest.json')`
 * or import the types from `@ibasho/tools-assets`. Every path is relative to the assets root.
 */
import type { ProviderId, Room, Tier } from './config.ts';

export type AssetKind = 'hdri' | 'texture' | 'model' | 'doc';
/** `pending-manual` marks an asset whose source must be fetched by hand (K3: never in the hero tier). */
export type AssetStatus = 'ok' | 'pending-manual';

export interface ManifestFile {
  readonly path: string;
  readonly role: string;
  readonly mime: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly width?: number;
  readonly height?: number;
}

export interface ManifestSourceFile {
  readonly role: string;
  readonly url: string;
  /** Zip member, when extracted from an archive at `url`. */
  readonly member?: string;
  readonly sha256: string;
}

export interface ManifestAsset {
  readonly id: string;
  readonly kind: AssetKind;
  readonly tier: Tier;
  readonly status: AssetStatus;
  readonly title: string;
  readonly use?: string;
  readonly room?: Room;
  /** SPDX id (`LicenseRef-Ibasho-project` for files we generate). */
  readonly licence: string;
  /** Licence text URL; empty only for files we generate. */
  readonly licenceUrl: string;
  readonly source: {
    readonly provider: ProviderId | 'ibasho';
    readonly providerName: string;
    readonly authors: readonly string[];
    readonly page: string;
    readonly licenceEvidence: string;
    readonly files: readonly ManifestSourceFile[];
  };
  readonly processing: readonly string[];
  readonly files: readonly ManifestFile[];
  readonly hdri?: Readonly<Record<string, unknown>>;
  readonly texture?: Readonly<Record<string, unknown>>;
  readonly model?: Readonly<Record<string, unknown>>;
}

export interface Manifest {
  readonly schema: 1;
  readonly generator: string;
  readonly budgets: Readonly<Record<Tier, { readonly limitBytes: number | null; readonly bytes: number }>>;
  readonly assets: readonly ManifestAsset[];
}

export const MANIFEST_FILE = 'manifest.json';
export const ATTRIBUTION_FILE = 'attribution.html';

/** Total bytes of a tier's files. */
export function tierBytes(m: Manifest, tier: Tier): number {
  return m.assets.filter((a) => a.tier === tier).reduce((s, a) => s + a.files.reduce((t, f) => t + f.bytes, 0), 0);
}

export interface DiskFile {
  readonly bytes: number;
  readonly sha256: string;
}

/**
 * Checks K1 to K3 (BUILD_PLAN WP-11) against the files on disk. K4 (attribution generated from
 * the manifest) is checked by the caller, which can render the page. Returns problems; empty
 * means pass. `disk` maps assets-root paths to size and hash, excluding `manifest.json`.
 */
export function checkManifest(
  m: Manifest,
  disk: ReadonlyMap<string, DiskFile>,
  heroLimitBytes: number,
  manifestBytes: number,
): string[] {
  const problems: string[] = [];
  const listed = new Map<string, { asset: ManifestAsset; file: ManifestFile }>();
  const ids = new Set<string>();
  for (const a of m.assets) {
    if (ids.has(a.id)) problems.push(`duplicate asset id ${a.id}`);
    ids.add(a.id);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.id)) problems.push(`${a.id}: id is not kebab-case`);
    if (a.licence.trim() === '') problems.push(`K1 ${a.id}: missing licence`);
    if (a.source.provider !== 'ibasho' && a.licenceUrl.trim() === '') problems.push(`K1 ${a.id}: missing licence URL`);
    if (a.files.length === 0) problems.push(`${a.id}: no files`);
    if (a.tier === 'hero' && a.status === 'pending-manual') problems.push(`K3 ${a.id}: hero asset is pending-manual`);
    for (const f of a.files) {
      if (listed.has(f.path)) problems.push(`K1 ${f.path}: listed twice`);
      listed.set(f.path, { asset: a, file: f });
      if (!/^[0-9a-f]{64}$/.test(f.sha256)) problems.push(`K1 ${f.path}: sha256 malformed`);
    }
  }
  for (const [path, d] of disk) {
    const hit = listed.get(path);
    if (!hit) {
      problems.push(`K1 ${path}: on disk but not in the manifest`);
      continue;
    }
    if (hit.file.sha256 !== d.sha256) problems.push(`K1 ${path}: sha256 differs from the manifest`);
    if (hit.file.bytes !== d.bytes) problems.push(`K1 ${path}: size differs from the manifest`);
  }
  for (const path of listed.keys()) if (!disk.has(path)) problems.push(`K1 ${path}: in the manifest but missing`);

  for (const tier of ['hero', 'lazy'] as const) {
    const b = m.budgets[tier];
    if (b && b.bytes !== tierBytes(m, tier)) problems.push(`budget ${tier}: recorded bytes do not match files`);
  }
  const hero = tierBytes(m, 'hero') + manifestBytes;
  if (hero > heroLimitBytes) problems.push(`K2 hero tier is ${hero} bytes (with manifest), limit ${heroLimitBytes}`);
  return problems;
}
