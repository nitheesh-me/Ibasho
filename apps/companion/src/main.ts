/**
 * `pnpm --filter @ibasho/companion start`. Binds 127.0.0.1 only.
 *
 * Env: `IBASHO_COMPANION_PORT` (default 7357), `IBASHO_APP_ORIGINS` (extra browser origins, comma
 * separated), `IBASHO_PROOFS_DIR` (default `<repo>/proofs`), `OLLAMA_HOST` (loopback only),
 * `IBASHO_NO_OLLAMA=1` to leave the pass-through off.
 *
 * PLACEHOLDER (agent link): the bridge sub-app and `server.json` discovery come from
 * `@ibasho/agent-bridge/server`, which the companion cannot depend on during the install freeze
 * (INTERFACES request on the blackboard). Once it is a dependency, add here:
 *   const hub = new AgentHub({}); const bridge = createBridgeApp({ hub, token });
 *   createApp({ ..., bridge }); writeServerJson({ port, token, pid, startedAt, bridge: BRIDGE_MOUNT });
 *   removeServerJson() on exit; print hub.pairingCode().code.
 */
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { COMPANION_HOST, COMPANION_PORT, createApp, lakeCheckRunner, originCheck } from './index.ts';
import { isLoopbackUrl, OLLAMA_DEFAULT } from './ollama.ts';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env['IBASHO_COMPANION_PORT'] ?? COMPANION_PORT);
const proofsDir = process.env['IBASHO_PROOFS_DIR'] ?? resolve(here, '../../../proofs');
const rawOllama = process.env['OLLAMA_HOST'] ?? OLLAMA_DEFAULT;
const ollamaHost = /^https?:\/\//.test(rawOllama) ? rawOllama : `http://${rawOllama}`;
const token = randomBytes(24).toString('base64url');

const app = createApp({
  token,
  port,
  origins: originCheck((process.env['IBASHO_APP_ORIGINS'] ?? '').split(',')),
  verify: lakeCheckRunner({ proofsDir }),
  ...(process.env['IBASHO_NO_OLLAMA'] === '1' || !isLoopbackUrl(ollamaHost)
    ? {}
    : { ollama: { host: ollamaHost } }),
});

const server = serve({ fetch: app.fetch, hostname: COMPANION_HOST, port }, (info) => {
  console.log(`ibasho companion on http://${info.address}:${info.port}`);
  console.log(`token (scripts and agents send Authorization: Bearer <token>): ${token}`);
});

const stop = () => {
  server.close(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
