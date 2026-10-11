// @vitest-environment happy-dom
/** The worked example (review M7), stills from the scene (B1) and the qualified promises (M3). */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkCustomerCopy, LANDING_PREVIEW_NOTE, type PluginPresence } from '@ibasho/content';
import { describe, expect, it } from 'vitest';
import { readExample } from '../src/example.ts';
import { syncPosters } from '../src/posters.ts';
import { renderLanding } from '../src/prerender.tsx';

// happy-dom replaces import.meta.url, so resolve from the package directory vitest runs in.
const repoRoot = resolve(process.cwd(), '../..');
const real: PluginPresence = { has: () => true, hasKind: () => true, stage: () => 'real' };
const previewAll: PluginPresence = { ...real, stage: () => 'preview' };
const parse = (html: string) => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');

describe('worked example', () => {
  const ex = readExample(repoRoot);

  it('reads Vindhya Bhavan from the studio results, not from constants', () => {
    expect(ex).toBeDefined();
    expect(ex!.eui).toMatch(/^\d+ to \d+ kWh\/m² a year$/);
    expect(ex!.bill).toMatch(/^About Rs [\d.]+ (crore|lakh) a year$/);
    expect(ex!.futures.map((f) => f.role)).toEqual(['least-upfront', 'best-return', 'lowest-running']);
    expect(ex!.lat).toBeGreaterThan(17);
  });

  it('renders three figures and three futures, marked Preview while they are', () => {
    const doc = parse(renderLanding(real, { example: ex }));
    const strip = doc.getElementById('example')!;
    expect(strip.querySelectorAll('.lp-fig')).toHaveLength(3);
    expect(strip.querySelectorAll('.lp-future')).toHaveLength(3);
    expect(strip.hasAttribute('data-preview')).toBe(ex!.preview);
    expect(checkCustomerCopy(strip.textContent ?? '').filter((f) => f.rule !== 'long-sentence')).toEqual([]);
  });

  it('is left out when the results are missing', () => {
    expect(readExample(join(tmpdir(), 'no-such-ibasho-root'))).toBeUndefined();
    expect(parse(renderLanding(real)).getElementById('example')).toBeNull();
  });
});

describe('promises', () => {
  it('say under the hero actions that some results are examples, only while any are', () => {
    expect(parse(renderLanding(previewAll)).querySelector('.lp-hero__note')?.textContent).toBe(
      LANDING_PREVIEW_NOTE,
    );
    expect(parse(renderLanding(real)).querySelector('.lp-hero__note')).toBeNull();
  });

  it('keep professional detail behind a disclosure', () => {
    expect(parse(renderLanding(real)).querySelectorAll('details.lp-more').length).toBeGreaterThan(4);
  });
});

describe('stills', () => {
  it('copy rendered stills, skip missing ones, and drop them into their chapter', () => {
    const root = mkdtempSync(join(tmpdir(), 'ibasho-posters-'));
    const src = join(root, 'packages', 'scene', 'dev', 'posters');
    mkdirSync(src, { recursive: true });
    writeFileSync(
      join(src, 'manifest.json'),
      JSON.stringify({
        posters: [
          {
            id: 'city-day',
            theme: 'hiru',
            alt: 'The campus as a paper model.',
            files: { large: 'a-1600.png', small: 'a-800.png' },
          },
          {
            id: 'sun-sweep',
            theme: 'hiru',
            alt: 'Sun hours.',
            files: { large: 'b-1600.png', small: 'b-800.png' },
          },
          { id: 'bad', alt: 'x', files: { large: '../escape.png', small: 'c.png' } },
        ],
      }),
    );
    writeFileSync(join(src, 'a-1600.png'), 'x');
    writeFileSync(join(src, 'a-800.png'), 'x');
    const pub = join(root, 'public');
    const posters = syncPosters(root, pub);
    expect([...posters.keys()]).toEqual(['city-day']);
    const doc = parse(renderLanding(real, { posters }));
    const img = doc.querySelector('#city .lp-ch__still img');
    expect(img?.getAttribute('src')).toBe('/posters/a-1600.png');
    expect(img?.getAttribute('alt')).toBe('The campus as a paper model.');
    expect(doc.querySelector('#sun .lp-panel')).not.toBeNull();
  });
});
