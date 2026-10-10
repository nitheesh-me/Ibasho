/**
 * no-dash: no em dash (U+2014) or en dash (U+2013) in copy, docs, comments or code.
 * Owner: WP-00 until G0, then WP-10. House style (CLAUDE.md, BUILD_PLAN 8).
 */
import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { Finding } from './files.ts';

const EN_DASH = String.fromCharCode(0x2013);
const EM_DASH = String.fromCharCode(0x2014);
const DASHES: Record<string, string> = { [EN_DASH]: 'en dash', [EM_DASH]: 'em dash' };
const BINARY = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.ico',
  '.avif',
  '.ktx2',
  '.hdr',
  '.exr',
  '.glb',
  '.gltf',
  '.bin',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.pdf',
  '.zip',
  '.gz',
  '.mp3',
  '.ogg',
  '.wav',
  '.mp4',
  '.webm',
  '.olean',
  '.ilean',
  '.wasm',
]);
/** Paths that legitimately hold dashes: the lint's own fixtures and generated lockfiles. */
const SKIP = [/^tools\/lint\/__fixtures__\//, /(^|\/)pnpm-lock\.yaml$/];

export function scanText(file: string, text: string): Finding[] {
  const out: Finding[] = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (let c = 0; c < line.length; c++) {
      const name = DASHES[line[c]!];
      if (name)
        out.push({
          rule: 'no-dash',
          file,
          line: i + 1,
          col: c + 1,
          message: `${name}; use a comma, colon, full stop or "to"`,
        });
    }
  });
  return out;
}

export function noDash(root: string, files: readonly string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (BINARY.has(extname(f).toLowerCase()) || SKIP.some((r) => r.test(f))) continue;
    const text = readFileSync(join(root, f), 'utf8');
    if (text.includes(EN_DASH) || text.includes(EM_DASH)) out.push(...scanText(f, text));
  }
  return out;
}
