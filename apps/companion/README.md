# @ibasho/companion

Optional local Node helper on 127.0.0.1:7357: `GET /health`, `POST /verify`, optional Ollama CORS pass-through (ARCH 11).

- **Owner:** WP-05 (AI and memory). Skeleton created by WP-00 at G0.
- **Layer:** L4. See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

`createApp()` returns the Hono app; `src/main.ts` serves it.

## Status

Only `GET /health` is real. `/verify` and `/llm/*` are not mounted yet.

Commands: `pnpm --filter @ibasho/companion typecheck`, `pnpm --filter @ibasho/companion test`.
