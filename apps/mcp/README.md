# @ibasho/mcp

stdio MCP server: headless engine tools in Node, and live tools forwarded to the bridge when the app is open (ARCH 14).

- **Owner:** WP-12 (Agent link).
- **Layer:** L4.

## Run

```bash
node apps/mcp/src/main.ts            # Node 26 runs the TypeScript directly; stdout is the protocol
pnpm --filter @ibasho/mcp start
claude mcp add ibasho -- node "$PWD/apps/mcp/src/main.ts"   # or: pnpm agent:install
```

No build step: ARCH 14 names `dist/index.js`; on Node 26 the source entry is the binary.

## Public API

- Tools (19): headless `ibasho_list_homes`, `ibasho_get_home`, `ibasho_simulate`, `ibasho_what_if`, `ibasho_search_futures`, `ibasho_evidence`, `ibasho_why_not`, `ibasho_verify`, `ibasho_memory_list`, `ibasho_memory_remember`, `ibasho_memory_forget`, `ibasho_compare`; live `ibasho_live_sessions`, `ibasho_live_state`, `ibasho_live_apply`, `ibasho_live_view`, `ibasho_live_thread`, `ibasho_live_screenshot`, `ibasho_live_say`.
- Resources: `ibasho://docs/{vision,spec}`, `ibasho://schema/twin`, `ibasho://schema/ops`, `ibasho://home/{id}`, `ibasho://cert/{hash}`. Prompts: `explore-my-home`, `compare-futures`, `audit-the-numbers`.
- Library: `createIbashoMcpServer(deps?)`, `engineFromModule`, `engineFrom`, `NO_ENGINE`, `fileCatalog`, `MemoryLog`, `applyOps`, `assertGrounded`, `groundingViolations`.

## How it keeps the agent honest

- Every number in a tool result is an evidence view `{ ev, quantity, value, unit, seal }`. `assertGrounded` runs on every result and fails the call if a number appears anywhere else. `ibasho_get_home` shows field states and provenance, not numeric inputs.
- Edits are `ScenarioOp`s parsed with `@ibasho/core/schemas` and resolved against the pack's frozen ids (`packs/<pack>/src/ids.ts`). There is no eval, `Function`, `vm` or `child_process` in `src` (tested).
- Memory events are validated with `MemoryEventSchema`, carry the person's quote, and forgetting deletes lines for real.

## Engine adapter

Headless numbers come from the engine through the `EngineApi` contract. The server loads `packages/engine/src/index.ts` at run time and takes the first of: `createEngineApi(opts?: { headless?: boolean })`, an `engineApi` instance, or WP-02's `createEngine`. With `createEngine` it boots like the worker: it loads the engine halves of `packs/{climate,home-uk,money-uk,rules-uk}` by path, fingerprints a shared registry and calls `init`; the search uses `M0_OPTION_IDS` (as the worker does) unless `IBASHO_ENGINE_OPTIONS=all`. If the engine cannot load, computing tools answer `engine-unavailable` with a plain message. `IBASHO_ENGINE_MODULE` overrides the module. The verify tool loads `packages/verify/src/index.ts` (`mirrorRung` or `createMirrorRung()`, WP-04) the same way, and never claims Checked without it.

Files: `~/.config/ibasho/homes/*.ibasho` (saved homes), `~/.config/ibasho/memory/<home>.jsonl` (headless memory log), `~/.config/ibasho/server.json` (read for live tools). `IBASHO_CONFIG_DIR` and `IBASHO_REPO` override the locations.

## Status

Real: every tool, resource and prompt; the engine, verify and catalogue adapters; memory log; live forwarding. Tests: 17. L2 (`test/l2-engine.test.ts`, real engine): the adapter boots `createEngine`, a GH1 search reproduces the worker fixture hash `packages/fixtures/src/results/gh1-m0.search.json`, `ibasho_search_futures` returns that same hash, and simulate, what-if, evidence, why-not and compare run grounded on real numbers. Plus (L1 tool, resource and prompt listing, zod input validation, grounding on every headless tool, L3 typed ops and the no-code-execution grep, memory round trip into the search, live tools against an in-process bridge and a fake tab including the L6 refusal, the real stdio binary). The L1 and L3 headless tests use a FAKE engine (`test/fake-engine.ts`) to pin wiring and grounding.

Waiting on others: `ibasho_verify` says Not checked until WP-04 exports `mirrorRung` from `packages/verify/src/index.ts`; numbers cover the M-0 option slice until WP-02 widens it.

Commands: `pnpm --filter @ibasho/mcp typecheck`, `pnpm --filter @ibasho/mcp test`.
