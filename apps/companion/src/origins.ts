/**
 * Who may call the companion from a browser (ARCH 11: CORS restricted to the app origin).
 * Default: loopback http origins, which cover the Vite dev server and an app served from this
 * machine. Extra origins (a hosted app) come from `IBASHO_APP_ORIGINS`, comma separated.
 * Same rule as `isLoopbackOrigin` in `@ibasho/agent-bridge/server` (WP-12); kept local until the
 * companion may depend on the bridge (install freeze).
 */
export type OriginCheck = (origin: string) => boolean;

export function isLoopbackOrigin(origin: string): boolean {
  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';
}

/** Loopback plus an explicit list (exact match on scheme, host and port). */
export function originCheck(extra: readonly string[] = []): OriginCheck {
  const allowed = new Set(extra.map((o) => o.trim().replace(/\/$/, '')).filter((o) => o.length > 0));
  return (origin) => isLoopbackOrigin(origin) || allowed.has(origin);
}
