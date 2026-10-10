/**
 * stdio entry for the Ibasho MCP server. Owner: WP-12.
 * Run: `node apps/mcp/src/main.ts` (Node 26 strips types natively), or `apps/mcp/dist/index.js`
 * after `pnpm --filter @ibasho/mcp build`. Logs go to stderr; stdout is the protocol.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createIbashoMcpServer } from './server.ts';

const server = createIbashoMcpServer();
await server.connect(new StdioServerTransport());
process.stderr.write('ibasho mcp: ready on stdio\n');
