/**
 * `createIbashoMcpServer`: wires catalogue, memory, engine adapter and live client into an
 * `McpServer` (ARCH 14). Owner: WP-12. `main.ts` connects it to stdio; tests use the SDK
 * in-memory transport.
 */

import { join } from 'node:path';
import { BridgeAgentClient, ibashoConfigDir } from '@ibasho/agent-bridge/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type EngineSource, engineFromModule } from './engine.ts';
import { Headless, type HeadlessDeps } from './headless.ts';
import { fileCatalog, type HomeCatalog } from './homes.ts';
import { MemoryLog } from './memory.ts';
import { repoPath } from './paths.ts';
import { registerPrompts, registerResources } from './resources.ts';
import { registerTools } from './tools.ts';

export const SERVER_NAME = 'ibasho';
export const SERVER_VERSION = '0.1.0';

export const INSTRUCTIONS = `Ibasho is a local-first digital twin of a home. Explore it like the owner would.
Rules: every number you state comes from an evidence view {ev, quantity, value, unit, seal}; cite the ev id and never compute new numbers from values. Change a home only with typed ScenarioOps (ibasho://schema/ops). Record memory only from the person's own words. Live tools need the app open with Settings > Agent link on; ibasho_live_sessions gives the pairing code to tell the person. In ibasho_live_say write no digits: use [[e:ev_id]] and [[m:measureId]] slots.`;

export interface McpDeps {
  env?: Record<string, string | undefined>;
  engine?: EngineSource;
  homes?: HomeCatalog;
  memory?: MemoryLog;
  live?: BridgeAgentClient;
  now?: () => Date;
  loadMirror?: HeadlessDeps['loadMirror'];
}

export function createIbashoMcpServer(deps: McpDeps = {}): McpServer {
  const env = deps.env ?? process.env;
  const config = ibashoConfigDir(env);
  const homes =
    deps.homes ??
    fileCatalog({
      fixturesDir: repoPath('packages/fixtures/src/homes', env),
      homesDir: join(config, 'homes'),
    });
  const memory = deps.memory ?? new MemoryLog(join(config, 'memory'), deps.now);
  const live = deps.live ?? new BridgeAgentClient({ env });
  const hd: HeadlessDeps = { engine: deps.engine ?? engineFromModule(), homes, memory };
  if (deps.now) hd.now = deps.now;
  if (deps.loadMirror) hd.loadMirror = deps.loadMirror;
  const headless = new Headless(hd);

  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: INSTRUCTIONS, capabilities: { tools: {}, resources: {}, prompts: {} } },
  );
  registerTools(server, { headless, homes, memory, live });
  registerResources(server, { homes, headless });
  registerPrompts(server);
  return server;
}
