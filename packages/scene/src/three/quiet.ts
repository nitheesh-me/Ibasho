/**
 * React Three Fiber 9 still creates a `THREE.Clock` in every canvas store, and three r183+ warns
 * that Clock is deprecated on each mount. We do not use the store clock (frames are driven by
 * `performance.now()`), so drop that one message and pass every other three.js message through.
 * Owner: WP-07.
 */
import { getConsoleFunction, setConsoleFunction } from 'three';

const CLOCK = 'THREE.Clock: This module has been deprecated';
let installed = false;

export function quietClockWarning(): void {
  if (installed) return;
  installed = true;
  const prev = getConsoleFunction();
  setConsoleFunction((type: 'log' | 'warn' | 'error', message: string, ...params: unknown[]) => {
    if (type === 'warn' && typeof message === 'string' && message.startsWith(CLOCK)) return;
    if (prev) {
      prev(type, message, ...params);
      return;
    }
    const out = type === 'error' ? console.error : type === 'warn' ? console.warn : console.log;
    out(message, ...params);
  });
}
