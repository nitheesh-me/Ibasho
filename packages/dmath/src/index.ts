/**
 * @ibasho/dmath: deterministic maths for the engine (ARCH 4.3, SPEC R20, DEC TE-4). Owner: WP-01.
 * Layer L0: imports nothing in the repo.
 *
 * Every function uses only IEEE 754 basic operations (add, subtract, multiply, divide, which
 * ECMAScript defines exactly) and exact integer work, so results are bit-identical in Node,
 * Chromium and Firefox. `Math.exp`, `Math.pow`, `**` and friends are implementation-approximated
 * and are banned in the engine by `tools/lint/no-math`.
 *
 * M-0 status: `exp`, `log`, `log10` (fdlibm ports, error < 1 ulp), `sqrt` (correctly rounded),
 * `pow` (deterministic; exact for small integer powers, else about (2 + 2|y ln x|) ulp;
 * full fdlibm port at M-A).
 * M-A: `sin` and `cos` (FreeBSD msun ports, error < 1 ulp, |x| < 2^20 pi/2).
 * PLACEHOLDER: `atan2` and `acos` are not exported yet (ARCH 4.3 lists them;
 * nothing in the engine needs them yet; the Collares-Pereira-Rabl transposition will).
 */
export { exp } from './exp.ts';
export { log, log10 } from './log.ts';
export { pow } from './pow.ts';
export { sqrt } from './sqrt.ts';
export { cos, PI, sin } from './trig.ts';
