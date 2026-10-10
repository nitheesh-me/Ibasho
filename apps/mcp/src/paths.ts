/**
 * Repository paths for the MCP server. Owner: WP-12.
 * The server runs from a checkout (`node apps/mcp/src/main.ts`), so the repo root is fixed
 * relative to this file. `IBASHO_REPO` overrides it.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export function repoRoot(env: Record<string, string | undefined> = process.env): string {
  return env.IBASHO_REPO ? resolve(env.IBASHO_REPO) : resolve(HERE, '..', '..', '..');
}

export function repoPath(rel: string, env: Record<string, string | undefined> = process.env): string {
  return join(repoRoot(env), rel);
}
