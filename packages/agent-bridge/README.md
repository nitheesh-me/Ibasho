# @ibasho/agent-bridge

Agent link protocol (zod), the bridge as a Hono sub-app the companion mounts, the agent-side client, and the browser client `connectAgentLink()` used by `apps/web` (ARCH 14).

- **Owner:** WP-12 (Agent link).
- **Layer:** L2. `.` is browser-safe (imports L0 only); `./server` is the Node half (hono, node:fs).

## Public API

`@ibasho/agent-bridge` (browser):

- Protocol: `AGENT_LINK_PROTOCOL`, `BRIDGE_MOUNT` (`/agent-link`), `BRIDGE_HOST` (`127.0.0.1`), `ServerJsonSchema`, `LIVE_METHODS`, `LiveParamsSchemas`, `LiveResultSchemas`, `LiveHandlers`, `LiveState`, frames (`DownFrameSchema`, `UpFrameSchema`), pairing (`PairRequestSchema`, `PairResponseSchema`), `SessionsResponseSchema`, `LedgerEntry`, `summariseCall`.
- `checkSlotted(text)`, `parseSlots(text)`: boundary G2 pre-check for agent prose (no digits, `%` or number words outside `[[e:ev_..]]` slots).
- `connectAgentLink({ origin, pair: { code } | { session }, client, handlers, onStatus?, onLedger? })`: pairs with the code typed in Settings, streams calls (SSE over `fetch`, session token in a header), re-validates every call, answers through `POST /link/frame`, reports each call to `onLedger`, and reconnects with backoff.

`@ibasho/agent-bridge/server` (Node):

- `AgentHub`: pairing codes (8 characters, single use, 10 minute expiry, rotate after 5 wrong guesses), sessions, call routing with timeouts, ledger hook.
- `createBridgeApp({ hub, token, allowedOrigins?, upgradeWebSocket?, basePath? })`: routes in the file header. Bearer token on `/agent/*`, pairing on `/link/*`, loopback Host guard, CORS for loopback origins only.
- `bridgeWebSocketEvents(hub)`: the WebSocket transport (`hello` frame first) for `@hono/node-ws` when the companion adds it.
- Discovery: `ibashoConfigDir`, `serverJsonPath`, `writeServerJson` (0600, atomic), `readServerJson` (missing, invalid or stale pid), `removeServerJson`, `createServerToken`.
- `BridgeAgentClient`: `sessions()`, `call(method, params, sessionId?)`, re-reading `server.json` on every call; `AppNotRunningError`, `LinkCallError`.

## Mounting (WP-05, companion)

```ts
import { BRIDGE_HOST, BRIDGE_MOUNT } from '@ibasho/agent-bridge';
import { AgentHub, createBridgeApp, createServerToken, removeServerJson, writeServerJson } from '@ibasho/agent-bridge/server';

const token = createServerToken();
const hub = new AgentHub();
app.route(BRIDGE_MOUNT, createBridgeApp({ hub, token }));
serve({ fetch: app.fetch, hostname: BRIDGE_HOST, port }, () => {
  writeServerJson({ port, token, pid: process.pid, startedAt: new Date().toISOString(), bridge: BRIDGE_MOUNT });
  console.log(`Agent link pairing code: ${hub.pairingCode().code}`);
});
process.on('exit', () => removeServerJson());
```

## Status

Real: protocol, hub, Hono app (HTTP and SSE transports, WebSocket handler), discovery, agent client, browser client. Tests: 30 (L4 auth, pairing, loopback guards, typed-op rejection before the tab, L6 pre-check, timeouts, unpair, WebSocket hello, discovery file).

Not wired yet (other owners): the companion mount (WP-05) and the Settings > Agent link screen and handlers (WP-08). Requests are on the blackboard.

Commands: `pnpm --filter @ibasho/agent-bridge typecheck`, `pnpm --filter @ibasho/agent-bridge test`.
