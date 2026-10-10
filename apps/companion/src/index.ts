/**
 * Companion app (ARCH 11). Owner: WP-05. Skeleton created by WP-00 at G0.
 * Real: `GET /health`. Not mounted yet: `POST /verify` (WP-04 handler), `POST /llm/ollama-cors`,
 * `POST /llm/claude` (T2). CORS restricted to the app origin is added with the first POST route.
 */
import { Hono } from 'hono';

export const COMPANION_HOST = '127.0.0.1';
export const COMPANION_PORT = 7357;

export interface Health {
  ok: true;
  name: 'ibasho-companion';
  routes: string[];
}

export function createApp(): Hono {
  const app = new Hono();
  app.get('/health', (c) => c.json<Health>({ ok: true, name: 'ibasho-companion', routes: ['GET /health'] }));
  return app;
}
