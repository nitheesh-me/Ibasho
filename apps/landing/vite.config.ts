import { fileURLToPath } from 'node:url';
import { presenceFromList } from '@ibasho/content';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin, runnerImport } from 'vite';
import { discoverPlugins } from './src/discover.ts';

// Owner: WP-09 (Content and landing).
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

type Prerender = typeof import('./src/prerender.tsx');

/**
 * Prerender the chapters into index.html, keeping only those whose plugins exist (SPEC 5.1, I4).
 * The renderer goes through Vite's module runner, so workspace TSX (`@ibasho/ui`) transforms.
 */
function prerender(): Plugin {
  return {
    name: 'ibasho-landing-prerender',
    async transformIndexHtml(html) {
      const { source, plugins, skipped, stages } = await discoverPlugins(repoRoot);
      console.info(`landing: ${plugins.length} plugins from ${source}, ${Object.keys(stages).length} studio stages`);
      for (const s of skipped) console.warn(`landing: skipped ${s.file}: ${s.reason}`);
      const { module } = await runnerImport<Prerender>(
        fileURLToPath(new URL('./src/prerender.tsx', import.meta.url)),
      );
      // IBASHO_LANDING_ALL=1 shows every chapter (marked Preview), for design work before they land.
      const all = process.env.IBASHO_LANDING_ALL === '1';
      const presence = all
        ? { has: () => true, hasKind: () => true, stage: () => 'preview' as const }
        : presenceFromList(plugins, stages);
      return module.fillTemplate(html, presence);
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), prerender()],
  build: {
    outDir: 'dist',
    target: 'es2024',
    // Never inline font slices: they would bloat the render-blocking stylesheet.
    assetsInlineLimit: (file: string) => (/\.woff2?$/.test(file) ? false : undefined),
  },
  preview: { port: 4174, strictPort: true },
});
