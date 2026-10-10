/**
 * Hero assets from WP-11's manifest (`/app/assets/manifest.json`). Owner: WP-07.
 * The scene works without them (procedural materials); with them it uses the Poly Haven
 * textures and HDRIs and the Kenney and Quaternius props. Types are structural so the scene
 * does not depend on `tools/assets`.
 */

export interface AssetFileLike {
  path: string;
  role: string;
}
export interface AssetLike {
  id: string;
  kind: string;
  status?: string;
  files: AssetFileLike[];
}
export interface AssetManifestLike {
  assets: AssetLike[];
}

export interface SceneAssets {
  /** URL prefix the manifest paths are relative to, ending with `/` (e.g. `/app/assets/`). */
  base: string;
  manifest: AssetManifestLike;
}

export function assetFile(a: SceneAssets | null | undefined, id: string, role: string): string | undefined {
  if (!a) return undefined;
  const asset = a.manifest.assets.find((x) => x.id === id && (x.status ?? 'ok') === 'ok');
  const f = asset?.files.find((x) => x.role === role);
  return f ? `${a.base}${f.path}` : undefined;
}

/** Gain-map HDRI triple for drei `<Environment files>` (sdr, gain, meta). */
export function hdriFiles(a: SceneAssets | null | undefined, id: string): [string, string, string] | undefined {
  if (!a) return undefined;
  const asset = a.manifest.assets.find((x) => x.id === id && x.kind === 'hdri');
  if (!asset) return undefined;
  const by = (suffix: string): string | undefined => {
    const f = asset.files.find((x) => x.path.endsWith(suffix));
    return f ? `${a.base}${f.path}` : undefined;
  };
  const sdr = by('/sdr.webp');
  const gain = by('/gain.webp');
  const meta = by('/meta.json');
  return sdr && gain && meta ? [sdr, gain, meta] : undefined;
}

export interface TextureSetUrls {
  diff: string;
  nor?: string;
  arm?: string;
}
export function textureSet(a: SceneAssets | null | undefined, id: string): TextureSetUrls | undefined {
  if (!a) return undefined;
  const asset = a.manifest.assets.find((x) => x.id === id && x.kind === 'texture');
  if (!asset) return undefined;
  const by = (name: string): string | undefined => {
    const f = asset.files.find((x) => x.path.endsWith(`/${name}.webp`));
    return f ? `${a.base}${f.path}` : undefined;
  };
  const diff = by('diff');
  if (!diff) return undefined;
  const nor = by('nor');
  const arm = by('arm');
  return { diff, ...(nor ? { nor } : {}), ...(arm ? { arm } : {}) };
}

export function modelUrl(a: SceneAssets | null | undefined, id: string): string | undefined {
  if (!a) return undefined;
  const asset = a.manifest.assets.find((x) => x.id === id && x.kind === 'model' && (x.status ?? 'ok') === 'ok');
  const f = asset?.files.find((x) => x.path.endsWith('.glb'));
  return f ? `${a.base}${f.path}` : undefined;
}

/** Fetch and minimally validate a manifest. Returns null on any failure (procedural fallback). */
export async function loadAssets(base: string, fetcher: typeof fetch = fetch): Promise<SceneAssets | null> {
  try {
    const res = await fetcher(`${base}manifest.json`);
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    if (!json || typeof json !== 'object' || !Array.isArray((json as { assets?: unknown }).assets)) return null;
    return { base, manifest: json as AssetManifestLike };
  } catch {
    return null;
  }
}
