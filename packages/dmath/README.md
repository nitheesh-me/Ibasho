# @ibasho/dmath

Deterministic exp, log, log10, pow, sin, cos, atan2, acos and sqrt ported from fdlibm, with test vectors that run in Node, Chromium and Firefox (AC-D1).

- **Owner:** WP-01 (Physics). Skeleton created by WP-00 at G0.
- **Layer:** L0 (imports nothing in the repo). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

M-0 exports `exp`, `log`, `log10`, `pow` and `sqrt`. ARCH 4.3 also lists `sin`, `cos`, `atan2` and `acos`, which come at M-A.

- `exp`, `log`, `log10`: ports of fdlibm 5.3, error under 1 ulp, using only IEEE basic operations, so every engine gets the same bits.
- `sqrt`: correctly rounded, bit for bit equal to IEEE sqrt.
- `pow`: the special cases follow ECMAScript exactly. Integer exponents up to 64 use binary powering. Otherwise it computes `exp(y log x)`, about (2 + 2|y ln x|) ulp.

## Status

- **Done at M-0:** `exp`, `log`, `log10`, `sqrt`, `pow`. The tests pin bit patterns as cross-engine vectors and compare against the platform within 1 ulp.
- **PLACEHOLDER:** the general case of `pow` is not yet the full fdlibm `e_pow.c` port.
- **Not yet built (M-A):** `sin`, `cos`, `atan2`, `acos`; the Chromium and Firefox vector run (A5).

Commands: `pnpm --filter @ibasho/dmath typecheck`, `pnpm --filter @ibasho/dmath test`.
