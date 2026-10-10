import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Owner: WP-08 (everything except `public/assets/**`, which is WP-11).
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  // Vite's own bundles go to `dist/build/`, so they never share a folder with WP-11's
  // `public/assets/` (served at `/app/assets/`).
  build: { outDir: 'dist', target: 'es2024', assetsDir: 'build' },
  worker: { format: 'es' },
  preview: { port: 4173, strictPort: true },
});
