/**
 * Stills from the city scene for the landing page (SPEC 5.1 posters, landing review B1). Owner: WP-09.
 *
 * The scene renders stills into `packages/scene/dev/posters/` with a `manifest.json` (id, chapter,
 * theme, alt, preview flag, and a large and small file with their pixel sizes). At build time this
 * copies every still whose files exist into `apps/landing/public/posters/`, so the landing serves
 * its own copies, and lists them by id. A still that is not rendered yet is simply absent: its
 * chapter keeps the drawn panel in the same slot, and drops the still in on the next build.
 *
 * Runs in Node only (from `vite.config.ts` and tests). Never throws.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface StillFile {
  /** Published path under the landing's base. */
  src: string;
  width: number;
  height: number;
}

export interface Poster {
  id: string;
  /** Landing chapter it belongs to (`city`, `hero`, `invitation`, ...). */
  chapter: string;
  theme: 'hiru' | 'yoru';
  alt: string;
  /** The still shows example results: it carries the Preview hatch. */
  preview: boolean;
  large: StillFile;
  small?: StillFile | undefined;
}

type FileRef = string | { file?: string; width?: number; height?: number };

interface ManifestEntry {
  id?: string;
  chapter?: string;
  theme?: string;
  alt?: string;
  preview?: boolean;
  files?: { large?: FileRef; small?: FileRef };
}

export function postersSource(repoRoot: string): string {
  return join(repoRoot, 'packages', 'scene', 'dev', 'posters');
}

const SAFE = /^[a-z0-9][a-z0-9._-]*\.(png|webp|jpg|jpeg|avif)$/i;

function copyIfNewer(from: string, to: string): void {
  if (existsSync(to) && statSync(to).mtimeMs >= statSync(from).mtimeMs) return;
  copyFileSync(from, to);
}

/** A file reference from the manifest, checked: a safe name, a file that exists, a size. */
function fileOf(
  ref: FileRef | undefined,
  src: string,
): { name: string; width: number; height: number } | undefined {
  if (!ref) return undefined;
  const r = typeof ref === 'string' ? { file: ref, width: 1600, height: 1000 } : ref;
  const name = r.file;
  if (!name || !SAFE.test(name) || !existsSync(join(src, name))) return undefined;
  const width = Number(r.width) > 0 ? Number(r.width) : 1600;
  const height = Number(r.height) > 0 ? Number(r.height) : 1000;
  return { name, width, height };
}

/** Copy the rendered stills into `publicDir/posters` and list them by id. */
export function syncPosters(repoRoot: string, publicDir: string): Map<string, Poster> {
  const out = new Map<string, Poster>();
  try {
    const src = postersSource(repoRoot);
    const file = join(src, 'manifest.json');
    if (!existsSync(file)) return out;
    const manifest = JSON.parse(readFileSync(file, 'utf8')) as { posters?: ManifestEntry[] };
    const dest = join(publicDir, 'posters');
    const published = new Set<string>();
    for (const p of manifest.posters ?? []) {
      const large = fileOf(p.files?.large, src);
      if (!p.id || !p.alt || !large) continue;
      const small = fileOf(p.files?.small, src);
      mkdirSync(dest, { recursive: true });
      const publish = (f: { name: string; width: number; height: number }): StillFile => {
        copyIfNewer(join(src, f.name), join(dest, f.name));
        published.add(f.name);
        return { src: `/posters/${f.name}`, width: f.width, height: f.height };
      };
      out.set(p.id, {
        id: p.id,
        chapter: p.chapter ?? p.id,
        theme: p.theme === 'yoru' ? 'yoru' : 'hiru',
        alt: p.alt,
        preview: p.preview === true,
        large: publish(large),
        small: small ? publish(small) : undefined,
      });
    }
    // Drop copies of stills the scene no longer lists, so nothing stale ships.
    if (existsSync(dest))
      for (const f of readdirSync(dest)) if (SAFE.test(f) && !published.has(f)) rmSync(join(dest, f));
  } catch {
    // A broken manifest only means no stills on this build.
  }
  return out;
}

/** The day and night stills of one chapter, when they exist. */
export function stillsFor(
  posters: ReadonlyMap<string, Poster>,
  chapter: string,
): { day?: Poster | undefined; night?: Poster | undefined } {
  let day: Poster | undefined;
  let night: Poster | undefined;
  for (const p of posters.values()) {
    if (p.chapter !== chapter) continue;
    if (p.theme === 'hiru') day ??= p;
    else night ??= p;
  }
  return { day, night };
}

/** `srcset` for a still: small and large by width. */
export function srcSetOf(p: Poster): string {
  return p.small
    ? `${p.small.src} ${p.small.width}w, ${p.large.src} ${p.large.width}w`
    : `${p.large.src} ${p.large.width}w`;
}
