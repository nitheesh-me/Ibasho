/**
 * Standalone dev harness for `@ibasho/scene` (WP-07). Not shipped.
 * Run: `pnpm --filter @ibasho/scene dev` (http://127.0.0.1:5177/).
 * Serves WP-11 hero assets from `apps/web/public/assets` at `/assets/` when present.
 */
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

export default {
  root: here,
  publicDir: fileURLToPath(new URL('../../../apps/web/public', import.meta.url)),
  oxc: { jsx: { runtime: 'automatic' } },
  server: {
    host: '127.0.0.1',
    port: 5177,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL('../../..', import.meta.url))] },
  },
  preview: { host: '127.0.0.1', port: 5177, strictPort: true },
};
