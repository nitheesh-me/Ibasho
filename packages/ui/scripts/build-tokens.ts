/**
 * Writes `src/styles/tokens.css` from the token sources in `src/tokens/*.ts`.
 * Run: `pnpm --filter @ibasho/ui tokens`. `test/tokens.test.ts` fails if the file drifts.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderTokensCss } from '../src/tokens/css.ts';

const out = fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url));
writeFileSync(out, renderTokensCss());
console.log(`tokens: wrote ${out}`);
