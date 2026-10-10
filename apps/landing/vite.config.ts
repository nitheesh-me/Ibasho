import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Owner: WP-09 (Content and landing). Skeleton created by WP-00 at G0.
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: { outDir: 'dist', target: 'es2024' },
  preview: { port: 4174, strictPort: true },
});
