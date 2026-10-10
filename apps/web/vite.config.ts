import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Owner: WP-08 (everything except `public/assets/**`, which is WP-11). Skeleton created by WP-00 at G0.
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  build: { outDir: 'dist', target: 'es2024' },
  preview: { port: 4173, strictPort: true },
});
