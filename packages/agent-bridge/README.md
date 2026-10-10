# @ibasho/agent-bridge

Agent link protocol types (zod), a Hono sub-app (HTTP and WebSocket) the companion mounts, and the browser client `connectAgentLink()` used by apps/web (ARCH 14).

- **Owner:** WP-12 (Agent link). Skeleton created by WP-00 at G0.
- **Layer:** L2 (imports L0; Node and browser halves). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

`bridgeApp()`, `connectAgentLink()`, protocol schemas (ARCH 14).

## Status

Everything.

Commands: `pnpm --filter @ibasho/agent-bridge typecheck`, `pnpm --filter @ibasho/agent-bridge test`.
