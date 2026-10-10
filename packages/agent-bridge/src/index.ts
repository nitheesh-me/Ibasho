/**
 * `@ibasho/agent-bridge`: protocol schemas, the slot pre-check and the browser client
 * (ARCH 14). Owner: WP-12. Browser-safe: no Node imports. The Node half (hub, Hono sub-app,
 * discovery, agent client) is `@ibasho/agent-bridge/server`.
 */
export {
  type AgentLink,
  AgentLinkError,
  type AgentLinkOptions,
  type AgentLinkStatus,
  connectAgentLink,
  sseData,
} from './client.ts';
export * from './protocol.ts';
export { checkSlotted, parseSlots, type Slot, type SlotIssue } from './slots.ts';
