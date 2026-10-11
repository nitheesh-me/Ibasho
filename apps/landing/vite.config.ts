import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { presenceFromList } from '@ibasho/content';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin, runnerImport } from 'vite';
import { discoverPlugins } from './src/discover.ts';
import { readExample } from './src/example.ts';
import { type Poster, syncPosters } from './src/posters.ts';

// Owner: WP-09 (Content and landing).
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

type Prerender = typeof import('./src/prerender.tsx');

/**
 * Prerender the chapters into index.html, keeping only those whose plugins exist (SPEC 5.1, I4).
 * The renderer goes through Vite's module runner, so workspace TSX (`@ibasho/ui`) transforms.
 */
function prerender(): Plugin {
  let posters: Map<string, Poster> = new Map();
  return {
    name: 'ibasho-landing-prerender',
    // Copy the stills before Vite resolves `public/`, so this build already serves them.
    config() {
      posters = syncPosters(repoRoot, fileURLToPath(new URL('./public', import.meta.url)));
    },
    async transformIndexHtml(html) {
      const { source, plugins, skipped, stages } = await discoverPlugins(repoRoot);
      console.info(
        `landing: ${plugins.length} plugins from ${source}, ${Object.keys(stages).length} studio stages`,
      );
      for (const s of skipped) console.warn(`landing: skipped ${s.file}: ${s.reason}`);
      const { module } = await runnerImport<Prerender>(
        fileURLToPath(new URL('./src/prerender.tsx', import.meta.url)),
      );
      // IBASHO_LANDING_ALL=1 shows every chapter (marked Preview), for design work before they land.
      const all = process.env.IBASHO_LANDING_ALL === '1';
      const presence = all
        ? { has: () => true, hasKind: () => true, stage: () => 'preview' as const }
        : presenceFromList(plugins, stages);
      // Stills from the city scene, copied into public/ when rendered; the worked example's figures.
      const example = readExample(repoRoot);
      console.info(`landing: ${posters.size} stills, worked example ${example ? 'found' : 'absent'}`);
      return module.fillTemplate(html, presence, { posters, example });
    },
  };
}

/** Characters always kept beside the page's own: printable ASCII (the theme switch writes Day and Night). */
const ALWAYS: readonly [number, number][] = [[0x20, 0x7e]];

/** Parse a CSS unicode-range value into code point ranges. */
function rangesOf(value: string): [number, number][] {
  return value.split(',').flatMap((part): [number, number][] => {
    const m = /U\+([0-9A-F?]+)(?:-([0-9A-F]+))?/i.exec(part.trim());
    if (!m) return [];
    const a = m[1]!;
    if (a.includes('?')) return [[parseInt(a.replace(/\?/g, '0'), 16), parseInt(a.replace(/\?/g, 'F'), 16)]];
    const lo = parseInt(a, 16);
    return [[lo, m[2] ? parseInt(m[2], 16) : lo]];
  });
}

/**
 * Keep only the font slices this page can use (landing review p3). The shared stylesheet lists
 * every Japanese slice of three families; after the build this drops each `@font-face` whose
 * unicode-range holds no character of the prerendered page (or of printable ASCII),
 * and deletes the font files only those slices named.
 */
function subsetFonts(): Plugin {
  let outDir = '';
  return {
    name: 'ibasho-landing-font-subset',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir.startsWith('/') ? c.build.outDir : join(c.root, c.build.outDir);
    },
    writeBundle() {
      const assets = join(outDir, 'assets');
      const css = readdirSync(assets).find((f) => /^fonts-.*\.css$/.test(f));
      if (!css) return;
      const used = new Set<number>();
      for (const ch of readFileSync(join(outDir, 'index.html'), 'utf8')) used.add(ch.codePointAt(0)!);
      const wanted = (ranges: [number, number][]) =>
        ranges.some(
          ([lo, hi]) =>
            ALWAYS.some(([a, b]) => lo <= b && hi >= a) || [...used].some((c) => c >= lo && c <= hi),
        );
      const text = readFileSync(join(assets, css), 'utf8');
      const blocks = text.match(/@font-face\{[^}]*\}/g) ?? [];
      const keep: string[] = [];
      const dropped = new Set<string>();
      const kept = new Set<string>();
      for (const b of blocks) {
        const range = /unicode-range:([^;}]*)/.exec(b)?.[1];
        const files = [...b.matchAll(/url\(\/assets\/([^)]+)\)/g)].map((m) => m[1]!);
        if (!range || wanted(rangesOf(range))) {
          keep.push(b);
          for (const f of files) kept.add(f);
        } else for (const f of files) dropped.add(f);
      }
      writeFileSync(join(assets, css), keep.join(''));
      for (const f of dropped) if (!kept.has(f)) rmSync(join(assets, f), { force: true });
      console.info(`landing: fonts ${keep.length} of ${blocks.length} slices kept`);
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), prerender(), subsetFonts()],
  build: {
    outDir: 'dist',
    target: 'es2024',
    // Never inline font slices: they would bloat the render-blocking stylesheet.
    assetsInlineLimit: (file: string) => (/\.woff2?$/.test(file) ? false : undefined),
  },
  preview: { port: 4174, strictPort: true },
});
