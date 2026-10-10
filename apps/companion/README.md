# @ibasho/companion

Optional local Node helper on 127.0.0.1:7357 (ARCH 11, ARCH 14). The app works without it; it probes `/health` and adds the Lean rung or the Ollama pass-through when present.

- **Owner:** WP-05 (AI and memory).
- **Layer:** L4. See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Routes

| Route | Does |
|---|---|
| `GET /health` | Open. Name, version, routes, `rungs.leanNative`, `ollamaPassThrough`, `agentLink` |
| `POST /verify` (`?batch=1`) | Pipes an `ibasho.cert/2` certificate (NDJSON with batch) into the prebuilt `proofs/.lake/build/bin/ibasho-check`. 200 for verdicts (exit 0 or 1), 422 malformed, 503 when the checker is not built, 413 over 32 MiB (Hono `bodyLimit`, chunked bodies too), 429 when 4 checks are already queued. One at a time, niced, 60 s timeout; a caller that hung up while queued starts no process. Never runs `lake build` |
| `GET /llm/ollama-cors/api/{tags,version}`, `POST .../api/{chat,show}` | Ollama pass-through for when `OLLAMA_ORIGINS` cannot be set. Allowlisted endpoints, loopback daemon only, browser Origin dropped |
| `/agent-link/*` | Mount point for the WP-12 bridge sub-app (`bridge` option). The bridge does its own auth |

**Guard.** Host must be loopback (DNS rebinding). A browser request needs an allowed origin (loopback, plus `IBASHO_APP_ORIGINS`) and gets CORS and Private Network Access preflight answers. A request without Origin needs `Authorization: Bearer <token>` (printed at start).

## Public API

`createApp(opts)` returns the Hono app (`token`, `origins`, `verify`, `ollama`, `bridge`, `port`); `lakeCheckRunner` (`maxQueue`), `CheckerBusyError`, `originCheck`, `forwardToOllama`. `src/main.ts` serves it.

## Stubs

- PLACEHOLDER: `main.ts` does not mount the agent bridge or write `server.json` yet; `@ibasho/agent-bridge` is not a dependency during the install freeze (INTERFACES request on the blackboard). `createApp({ bridge })` is ready and tested.
- `POST /llm/claude` is T2 (M-F).

Env: `IBASHO_COMPANION_PORT`, `IBASHO_APP_ORIGINS`, `IBASHO_PROOFS_DIR`, `OLLAMA_HOST`, `IBASHO_NO_OLLAMA=1`.

Commands: `pnpm --filter @ibasho/companion typecheck`, `pnpm --filter @ibasho/companion test`, `pnpm --filter @ibasho/companion start`.
