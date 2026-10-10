/**
 * The real binary over stdio: Node 26 runs `src/main.ts` directly (type stripping), the server
 * lists every tool, and computing tools answer with a result or a clear "engine not yet
 * available" error, depending on whether the engine (WP-02) loads in this checkout.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { describe, expect, it } from 'vitest';
import { ALL_TOOLS } from '../src/index.ts';
import { repoPath } from '../src/paths.ts';

describe('stdio binary', () => {
  it('starts, lists tools and answers a headless call', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ibasho-stdio-'));
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [repoPath('apps/mcp/src/main.ts')],
      env: { PATH: process.env.PATH ?? '', HOME: dir, IBASHO_CONFIG_DIR: join(dir, 'cfg') },
      stderr: 'pipe',
    });
    const client = new Client({ name: 'stdio-test', version: '0' });
    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual([...ALL_TOOLS].sort());
      const home = (await client.callTool({ name: 'ibasho_get_home', arguments: { homeId: 'gh1' } })) as {
        isError?: boolean;
      };
      expect(home.isError).toBeFalsy();
      const sim = (await client.callTool({ name: 'ibasho_simulate', arguments: { homeId: 'gh1' } })) as {
        isError?: boolean;
        content: { text: string }[];
      };
      const body = JSON.parse(sim.content[0]?.text ?? '{}') as { error?: string; evidence?: unknown[] };
      if (sim.isError) expect(body.error).toBe('engine-unavailable');
      else expect(body.evidence?.length).toBeGreaterThan(0);
    } finally {
      await client.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
