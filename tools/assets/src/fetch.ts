/**
 * `pnpm assets:fetch`: downloads every source file of the configured sets into
 * `tools/assets/.cache/` and pins it in `tools/assets/sources.lock.json`. Owner: WP-11.
 *
 * Sources:
 * - Poly Haven public API (`api.polyhaven.com/info`, `/files`): HDRIs as 1k Radiance, textures
 *   as lossless PNG (Diffuse, nor_gl, arm). Size and upstream md5 are checked.
 * - Kenney Furniture Kit 2.0 zip (link read from the kit page); members extracted with `unzip -p`.
 * - Quaternius Ultimate House Interior via its Poly Pizza bundle (GLB per model). The author's
 *   own Google Drive folder only has OBJ and FBX and often answers "quota exceeded".
 *
 * Flags: `--refresh` re-resolves upstream pages and the API even when the lock already pins a
 * file (use it to pick up new upstream versions; review the lock diff after).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ALL_SPECS,
  type AssetSpec,
  assetId,
  type HdriSpec,
  KENNEY_FURNITURE_PAGE,
  type KenneyModelSpec,
  PROVIDERS,
  QUATERNIUS_BUNDLE_PAGE,
  type QuaterniusModelSpec,
  type TextureSpec,
} from './config.ts';
import {
  type Lock,
  type LockArchive,
  type LockAsset,
  type LockFileEntry,
  loadLock,
  sortKeys,
} from './lock.ts';
import {
  CACHE_DIR,
  formatJson,
  httpGet,
  httpJson,
  httpText,
  LOCK_PATH,
  md5,
  sha256,
  writeFileEnsured,
} from './util.ts';

const PH_API = 'https://api.polyhaven.com';

interface PhFile {
  url: string;
  size: number;
  md5: string;
}
type PhFiles = Record<string, Record<string, Record<string, PhFile>>>;
interface PhInfo {
  name: string;
  authors: Record<string, string>;
}

function cachePath(rel: string): string {
  return join(CACHE_DIR, rel);
}

function cachedMatches(entry: { cache: string; sha256: string }): boolean {
  const p = cachePath(entry.cache);
  return existsSync(p) && sha256(new Uint8Array(readFileSync(p))) === entry.sha256;
}

async function downloadPinned(
  url: string,
  cache: string,
  expect?: { sha256?: string; md5?: string; bytes?: number },
) {
  const buf = await httpGet(url);
  if (expect?.bytes !== undefined && buf.length !== expect.bytes)
    throw new Error(`${url}: got ${buf.length} bytes, expected ${expect.bytes}`);
  if (expect?.md5 !== undefined && md5(buf) !== expect.md5) throw new Error(`${url}: md5 mismatch`);
  if (expect?.sha256 !== undefined && sha256(buf) !== expect.sha256)
    throw new Error(`${url}: sha256 mismatch with lock`);
  writeFileEnsured(cachePath(cache), buf);
  return buf;
}

/** Makes sure every file of a pinned asset is cached, downloading from the pinned URL. */
async function ensurePinned(asset: LockAsset, archives: Record<string, LockArchive>): Promise<void> {
  for (const entry of Object.values(asset.files)) {
    if (cachedMatches(entry)) continue;
    if (entry.url !== undefined) {
      await downloadPinned(entry.url, entry.cache, { sha256: entry.sha256 });
    } else if (entry.zip !== undefined) {
      const arc = archives[entry.zip.archive];
      if (!arc) throw new Error(`lock: archive ${entry.zip.archive} missing`);
      await ensureArchive(entry.zip.archive, arc);
      extractMember(entry.zip.archive, entry.zip.member, entry.cache, entry.sha256);
    }
  }
}

async function ensureArchive(key: string, arc: LockArchive): Promise<void> {
  if (cachedMatches({ cache: key, sha256: arc.sha256 })) return;
  await downloadPinned(arc.url, key, { sha256: arc.sha256 });
}

/** Extracts one zip member with `unzip -p` (stdout only, so archive paths cannot escape the cache). */
function extractMember(archive: string, member: string, cache: string, expectSha?: string): Uint8Array {
  const buf = new Uint8Array(
    execFileSync('unzip', ['-p', cachePath(archive), member], { maxBuffer: 256 * 1024 * 1024 }),
  );
  if (buf.length === 0) throw new Error(`${archive}: member ${member} missing or empty`);
  if (expectSha !== undefined && sha256(buf) !== expectSha)
    throw new Error(`${archive}: member ${member} does not match lock`);
  writeFileEnsured(cachePath(cache), buf);
  return buf;
}

function authorsOf(info: PhInfo): string[] {
  return Object.entries(info.authors).map(([name, role]) => (role === 'All' ? name : `${name} (${role})`));
}

async function resolvePolyHaven(spec: HdriSpec | TextureSpec): Promise<LockAsset> {
  const info = await httpJson<PhInfo>(`${PH_API}/info/${spec.phId}`);
  const files = await httpJson<PhFiles>(`${PH_API}/files/${spec.phId}`);
  const pick: Array<[role: string, f: PhFile | undefined]> =
    spec.kind === 'hdri'
      ? [['hdr', files.hdri?.['1k']?.hdr]]
      : [
          ['diff', files.Diffuse?.[spec.res]?.png],
          ['nor', files.nor_gl?.[spec.res]?.png],
          ['arm', files.arm?.[spec.res]?.png],
        ];
  const out: Record<string, LockFileEntry> = {};
  for (const [role, f] of pick) {
    if (!f) throw new Error(`Poly Haven ${spec.phId}: no ${role} file at the requested resolution`);
    const name = f.url.split('/').pop()!;
    const cache = `polyhaven/${spec.phId}/${name}`;
    const buf =
      cachedMatchesMd5(cache, f.md5) ?? (await downloadPinned(f.url, cache, { md5: f.md5, bytes: f.size }));
    out[role] = { cache, url: f.url, bytes: buf.length, sha256: sha256(buf), md5: f.md5 };
  }
  return {
    provider: 'polyhaven',
    title: info.name,
    authors: authorsOf(info),
    page: `https://polyhaven.com/a/${spec.phId}`,
    licenceEvidence: 'polyhaven.com/license: "Our assets are all licensed as CC0"',
    files: out,
  };
}

function cachedMatchesMd5(cache: string, expectMd5: string): Uint8Array | undefined {
  const p = cachePath(cache);
  if (!existsSync(p)) return undefined;
  const buf = new Uint8Array(readFileSync(p));
  return md5(buf) === expectMd5 ? buf : undefined;
}

const KENNEY_ZIP = 'kenney/kenney_furniture-kit.zip';

async function resolveKenneyArchive(archives: Record<string, LockArchive>): Promise<LockArchive> {
  const html = await httpText(KENNEY_FURNITURE_PAGE);
  const m =
    /https:\/\/kenney\.nl\/media\/pages\/assets\/furniture-kit\/[^'"\s]+\/kenney_furniture-kit\.zip/.exec(
      html,
    );
  if (!m) throw new Error('Kenney: zip link not found on the kit page');
  const buf = await downloadPinned(m[0], KENNEY_ZIP);
  const arc = { url: m[0], bytes: buf.length, sha256: sha256(buf) };
  archives[KENNEY_ZIP] = arc;
  return arc;
}

function kenneyLicence(): string {
  const txt = new TextDecoder().decode(
    execFileSync('unzip', ['-p', cachePath(KENNEY_ZIP), 'License.txt'], { maxBuffer: 1024 * 1024 }),
  );
  const line = txt.split(/\r?\n/).find((l) => l.includes('License:'));
  if (!line?.includes('CC0')) throw new Error('Kenney: License.txt does not state CC0');
  return `Furniture Kit License.txt: "${line.trim()}"`;
}

function resolveKenneyModel(spec: KenneyModelSpec, licence: string): LockAsset {
  const member = `Models/GLTF format/${spec.name}.glb`;
  const cache = `kenney/furniture-kit/${spec.name}.glb`;
  const buf = extractMember(KENNEY_ZIP, member, cache);
  return {
    provider: 'kenney',
    title: `Furniture Kit: ${spec.name}`,
    authors: ['Kenney'],
    page: KENNEY_FURNITURE_PAGE,
    licenceEvidence: licence,
    files: { glb: { cache, zip: { archive: KENNEY_ZIP, member }, bytes: buf.length, sha256: sha256(buf) } },
  };
}

interface PizzaRecord {
  uuid: string;
  title: string;
  licence: string;
  url: string;
}

async function readPizzaBundle(): Promise<Map<string, PizzaRecord>> {
  const html = await httpText(QUATERNIUS_BUNDLE_PAGE);
  const re =
    /"title":"([^"]*)","alt":"[^"]*","creator":\{"username":"([^"]*)"[^}]*\},"url":"([^"]*)","previewUrl":"[^"]*?([0-9a-f-]{36})\.webp","publicID":"([^"]*)","licence":"([^"]*)"/g;
  const out = new Map<string, PizzaRecord>();
  for (const m of html.matchAll(re)) {
    if (m[2] !== 'Quaternius') continue;
    out.set(m[5]!, {
      title: m[1]!,
      url: `https://poly.pizza${m[3]!.replace(/\\u002F/g, '/')}`,
      uuid: m[4]!,
      licence: m[6]!,
    });
  }
  if (out.size === 0) throw new Error('Poly Pizza: no Quaternius records parsed from the bundle page');
  return out;
}

async function resolveQuaternius(
  spec: QuaterniusModelSpec,
  bundle: Map<string, PizzaRecord>,
): Promise<LockAsset> {
  const rec = bundle.get(spec.publicId);
  if (!rec) throw new Error(`Poly Pizza: ${spec.publicId} (${spec.title}) not in the bundle`);
  if (rec.licence !== 'CC0 1.0') throw new Error(`Poly Pizza: ${spec.publicId} licence is ${rec.licence}`);
  const url = `https://static.poly.pizza/${rec.uuid}.glb`;
  const cache = `quaternius/${spec.slug}.glb`;
  const buf = await downloadPinned(url, cache);
  if (new TextDecoder().decode(buf.subarray(0, 4)) !== 'glTF') throw new Error(`${url}: not a GLB`);
  return {
    provider: 'quaternius',
    title: `Ultimate House Interior: ${rec.title}`,
    authors: ['Quaternius'],
    page: rec.url,
    licenceEvidence: `Poly Pizza record ${spec.publicId}: "licence":"CC0 1.0"; quaternius.com pack page links CC0 1.0`,
    files: { glb: { cache, url, bytes: buf.length, sha256: sha256(buf) } },
  };
}

export async function fetchAll(specs: readonly AssetSpec[], refresh: boolean): Promise<Lock> {
  const prev = refresh ? undefined : loadLock();
  const archives: Record<string, LockArchive> = { ...(prev?.archives ?? {}) };
  const assets: Record<string, LockAsset> = {};
  let kenneyLicenceText: string | undefined;
  let bundle: Map<string, PizzaRecord> | undefined;

  for (const spec of specs) {
    const id = assetId(spec);
    const pinned = prev?.assets[id];
    if (pinned) {
      await ensurePinned(pinned, archives);
      assets[id] = pinned;
      console.log(`pinned   ${id}`);
      continue;
    }
    if (spec.kind === 'hdri' || spec.kind === 'texture') {
      assets[id] = await resolvePolyHaven(spec);
    } else if (spec.provider === 'kenney') {
      const arc = archives[KENNEY_ZIP];
      if (!arc) await resolveKenneyArchive(archives);
      else await ensureArchive(KENNEY_ZIP, arc);
      kenneyLicenceText ??= kenneyLicence();
      assets[id] = resolveKenneyModel(spec, kenneyLicenceText);
    } else {
      bundle ??= await readPizzaBundle();
      assets[id] = await resolveQuaternius(spec, bundle);
    }
    console.log(`fetched  ${id}`);
  }
  // Keep only archives still referenced.
  const used = new Set(
    Object.values(assets).flatMap((a) =>
      Object.values(a.files).flatMap((f) => (f.zip ? [f.zip.archive] : [])),
    ),
  );
  for (const k of Object.keys(archives)) if (!used.has(k)) delete archives[k];
  return { schema: 1, archives, assets };
}

async function main(): Promise<void> {
  const refresh = process.argv.includes('--refresh');
  const lock = await fetchAll(ALL_SPECS, refresh);
  writeFileEnsured(LOCK_PATH, formatJson(sortKeys(lock), 'tools/assets/sources.lock.json'));
  const n = Object.values(lock.assets).reduce((s, a) => s + Object.keys(a.files).length, 0);
  console.log(
    `assets:fetch: ${Object.keys(lock.assets).length} assets, ${n} source files pinned in sources.lock.json`,
  );
  console.log(
    `providers: ${Object.values(PROVIDERS)
      .map((p) => `${p.name} (${p.licence})`)
      .join(', ')}`,
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
