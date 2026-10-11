/**
 * Stills from the city scene for the landing page (SPEC 5.1 posters, landing review B1). Owner: WP-09.
 *
 * The scene renders stills into `packages/scene/dev/posters/` with a `manifest.json`. At build
 * time this copies every still whose files exist into `apps/landing/public/posters/`, so the
 * landing serves its own copies, and returns them by id. A still that is not rendered yet is
 * simply absent: its chapter keeps the drawn panel in the same slot, and drops the still in on
 * the next build once it exists.
 *
 * Runs in Node only (from `vite.config.ts` and tests). Never throws.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface Poster {
  id: string;
  theme: 'hiru' | 'yoru';
  alt: string;
  /** Published paths under the landing's base. */
  large: string;
  small: string;
}

interface ManifestEntry {
  id: string;
  theme?: string;
  alt?: string;
  files?: { large?: string; small?: string };
}

export function postersSource(repoRoot: string): string {
  return join(repoRoot, 'packages', 'scene', 'dev', 'posters');
}

const SAFE = /^[a-z0-9][a-z0-9._-]*\.(png|webp|jpg|jpeg|avif)$/i;

function copyIfNewer(from: string, to: string): void {
  if (existsSync(to) && statSync(to).mtimeMs >= statSync(from).mtimeMs) return;
  copyFileSync(from, to);
}

/** Copy the rendered stills into `publicDir/posters` and list them by id. */
export function syncPosters(repoRoot: string, publicDir: string): Map<string, Poster> {
  const out = new Map<string, Poster>();
  try {
    const src = postersSource(repoRoot);
    const file = join(src, 'manifest.json');
    if (!existsSync(file)) return out;
    const manifest = JSON.parse(readFileSync(file, 'utf8')) as { posters?: ManifestEntry[] };
    for (const p of manifest.posters ?? []) {
      const large = p.files?.large;
      const small = p.files?.small;
      if (!p.id || !p.alt || !large || !small || !SAFE.test(large) || !SAFE.test(small)) continue;
      if (!existsSync(join(src, large)) || !existsSync(join(src, small))) continue;
      const dest = join(publicDir, 'posters');
      mkdirSync(dest, { recursive: true });
      copyIfNewer(join(src, large), join(dest, large));
      copyIfNewer(join(src, small), join(dest, small));
      out.set(p.id, {
        id: p.id,
        theme: p.theme === 'yoru' ? 'yoru' : 'hiru',
        alt: p.alt,
        large: `/posters/${large}`,
        small: `/posters/${small}`,
      });
    }
  } catch {
    // A broken manifest only means no stills on this build.
  }
  return out;
}
