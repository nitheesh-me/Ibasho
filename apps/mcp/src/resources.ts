/**
 * MCP resources and prompts (ARCH 14). Owner: WP-12.
 *
 * Resources: `ibasho://docs/{vision,spec}`, `ibasho://schema/twin`, `ibasho://schema/ops`,
 * `ibasho://home/{id}`, `ibasho://cert/{hash}`.
 * Prompts: `explore-my-home`, `compare-futures`, `audit-the-numbers`.
 */

import { readFileSync } from 'node:fs';
import { HomeTwinSchema, ScenarioOpSchema } from '@ibasho/core/schemas';
import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Headless } from './headless.ts';
import type { HomeCatalog } from './homes.ts';
import { repoPath } from './paths.ts';

/** JSON Schema of a contract schema; `z.custom` dates become `format: date` strings. */
export function jsonSchemaOf(schema: z.ZodType): unknown {
  return z.toJSONSchema(schema, {
    unrepresentable: 'any',
    override: (ctx) => {
      const def = (ctx.zodSchema as { _zod?: { def?: { type?: string } } })._zod?.def;
      if (def?.type === 'custom') {
        ctx.jsonSchema.type = 'string';
        ctx.jsonSchema.format = 'date';
      }
    },
  });
}

const json = (uri: URL, value: unknown) => ({
  contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value, null, 2) }],
});

export const RESOURCE_URIS = [
  'ibasho://docs/vision',
  'ibasho://docs/spec',
  'ibasho://schema/twin',
  'ibasho://schema/ops',
] as const;
export const RESOURCE_TEMPLATES = ['ibasho://home/{id}', 'ibasho://cert/{hash}'] as const;
export const PROMPTS = ['explore-my-home', 'compare-futures', 'audit-the-numbers'] as const;

export function registerResources(server: McpServer, d: { homes: HomeCatalog; headless: Headless }): void {
  for (const [name, file] of [
    ['vision', 'docs/VISION.md'],
    ['spec', 'docs/SPEC.md'],
  ] as const) {
    server.registerResource(
      `docs-${name}`,
      `ibasho://docs/${name}`,
      { title: `Ibasho ${name}`, description: `${file} from the repository`, mimeType: 'text/markdown' },
      (uri) => {
        let text: string;
        try {
          text = readFileSync(repoPath(file), 'utf8');
        } catch {
          text = `${file} is not present in this checkout.`;
        }
        return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text }] };
      },
    );
  }

  server.registerResource(
    'schema-twin',
    'ibasho://schema/twin',
    { title: 'HomeTwin JSON Schema', description: 'ibasho.twin/2 (ARCH 5.2)', mimeType: 'application/json' },
    (uri) => json(uri, jsonSchemaOf(HomeTwinSchema)),
  );

  server.registerResource(
    'schema-ops',
    'ibasho://schema/ops',
    {
      title: 'ScenarioOp JSON Schema',
      description: 'The only way to change a home (AM 6.1). Used by ibasho_what_if and ibasho_live_apply.',
      mimeType: 'application/json',
    },
    (uri) => json(uri, jsonSchemaOf(ScenarioOpSchema)),
  );

  server.registerResource(
    'home',
    new ResourceTemplate('ibasho://home/{id}', {
      list: () => ({
        resources: d.homes
          .list()
          .map((h) => ({ uri: `ibasho://home/${encodeURIComponent(h.id)}`, name: h.label })),
      }),
    }),
    {
      title: 'Home twin',
      description:
        'The input twin as stored (inputs with provenance, not results). Quote computed numbers only from evidence.',
      mimeType: 'application/json',
    },
    (uri, vars) => {
      const id = decodeURIComponent(String(vars.id));
      return json(uri, d.homes.get(id).twin);
    },
  );

  server.registerResource(
    'cert',
    new ResourceTemplate('ibasho://cert/{hash}', { list: undefined }),
    {
      title: 'Certificate',
      description: 'ibasho.cert/2 for a search in this session',
      mimeType: 'application/json',
    },
    (uri, vars) => {
      const cert = d.headless.certificate(String(vars.hash));
      if (!cert) throw new Error(`no certificate ${vars.hash} in this session; run ibasho_search_futures`);
      return json(uri, cert);
    },
  );
}

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'explore-my-home',
    {
      title: 'Explore my home',
      description: 'A guided first look: what the house is, where heat leaks, and what is unknown.',
      argsSchema: { homeId: z.string().optional() },
    },
    ({ homeId }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Explore ${homeId ? `the home "${homeId}"` : 'my home (call ibasho_list_homes first and pick it with me)'} with me.`,
              'Use ibasho_get_home for what is known and unknown, then ibasho_simulate in standard mode.',
              'Tell me in plain words where the heat goes and which unknowns matter most.',
              'Every number you say must come from an evidence view; cite its ev id. Do not do arithmetic on values.',
            ].join(' '),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'compare-futures',
    {
      title: 'Compare futures',
      description: 'Run the search and walk through the three picks and what was left out.',
      argsSchema: { homeId: z.string() },
    },
    ({ homeId }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Search futures for "${homeId}" with ibasho_search_futures (check ibasho_memory_list first so my ruled-out measures are respected).`,
              'Explain least upfront, best return and lowest running carbon side by side with ibasho_compare.',
              'For one measure that is missing, use ibasho_why_not and tell me what check would unlock it.',
              'Cite every number with its ev id.',
            ].join(' '),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'audit-the-numbers',
    {
      title: 'Audit the numbers',
      description:
        'Pull the red thread on a result: formulas, inputs, sources and seals, then verify the certificate.',
      argsSchema: { resultHash: z.string().optional() },
    },
    ({ resultHash }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              resultHash
                ? `Audit result ${resultHash}.`
                : 'Run ibasho_search_futures on my home, then audit the result.',
              'Pick the headline numbers, open each with ibasho_evidence, and follow inputs at least two levels down.',
              'Say which values are Checked, Modelled or Unverified, and which sources are estimates.',
              'Then run ibasho_verify and report every failed check plainly.',
            ].join(' '),
          },
        },
      ],
    }),
  );
}
