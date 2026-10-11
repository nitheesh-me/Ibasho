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
  const still = (id: string, chapter: string, theme: string, file: string, preview = true) => ({
    id,
    chapter,
    theme,
    alt: `${id} alt.`,
    preview,
    files: {
      large: { file: `${file}-1600.webp`, width: 1600, height: 1000 },
      small: { file: `${file}-800.webp`, width: 800, height: 500 },
    },
  });

  function fixture(entries: object[], files: string[]) {
    const root = mkdtempSync(join(tmpdir(), 'ibasho-posters-'));
    const src = join(root, 'packages', 'scene', 'dev', 'posters');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'manifest.json'), JSON.stringify({ posters: entries }));
    for (const f of files) writeFileSync(join(src, f), 'x');
    return syncPosters(root, join(root, 'public'));
  }

  it('copy rendered stills, skip missing or unsafe ones, and drop them into their chapter', () => {
    const posters = fixture(
      [
        still('city-day', 'city', 'hiru', 'a'),
        still('sun-day', 'sun', 'hiru', 'b'),
        { id: 'bad', alt: 'x', files: { large: { file: '../escape.png' } } },
      ],
      ['a-1600.webp', 'a-800.webp'],
    );
    expect([...posters.keys()]).toEqual(['city-day']);
    const doc = parse(renderLanding(real, { posters }));
    const img = doc.querySelector('#city .lp-ch__still img');
    expect(img?.getAttribute('src')).toBe('/posters/a-1600.webp');
    expect(img?.getAttribute('srcset')).toBe('/posters/a-800.webp 800w, /posters/a-1600.webp 1600w');
    expect(img?.getAttribute('width')).toBe('1600');
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(doc.querySelector('#city .lp-preview--corner')).not.toBeNull();
    expect(doc.querySelector('#sun .lp-panel')).not.toBeNull();
  });

  it('show the day or the night still by theme, and the night hero as a picture', () => {
    const posters = fixture(
      [
        still('city-day', 'city', 'hiru', 'a'),
        still('city-night', 'city', 'yoru', 'n'),
        still('hero-wide', 'hero', 'yoru', 'w'),
        {
          ...still('hero-phone', 'hero', 'yoru', 'p'),
          files: { large: { file: 'p-720.webp', width: 720, height: 900 } },
        },
        still('invitation-dusk', 'invitation', 'hiru', 'd', false),
      ],
      [
        'a-1600.webp',
        'a-800.webp',
        'n-1600.webp',
        'n-800.webp',
        'w-1600.webp',
        'w-800.webp',
        'p-720.webp',
        'd-1600.webp',
        'd-800.webp',
      ],
    );
    const doc = parse(renderLanding(real, { posters }));
    expect(doc.querySelector('#city img.lp-still--hiru')).not.toBeNull();
    expect(doc.querySelector('#city img.lp-still--yoru')).not.toBeNull();
    const pic = doc.querySelector('#hero picture.lp-still--yoru');
    expect(pic?.querySelector('source')?.getAttribute('media')).toBe('(min-width: 48rem)');
    expect(pic?.querySelector('img')?.getAttribute('src')).toBe('/posters/p-720.webp');
    expect(doc.querySelector('#hero img.lp-still--hiru')).not.toBeNull();
    expect(doc.querySelector('#invitation .lp-invite__still')?.getAttribute('src')).toBe(
      '/posters/d-1600.webp',
    );
  });

  it('carry result plates with the worked example figures on energy, codes, compare and trust', () => {
    const ids = ['energy', 'codes', 'compare', 'trust'];
    const posters = fixture(
      ids.map((c) => still(`${c}-day`, c, 'hiru', c)),
      ids.flatMap((c) => [`${c}-1600.webp`, `${c}-800.webp`]),
    );
    const ex = readExample(repoRoot);
    const doc = parse(renderLanding(real, { posters, example: ex }));
    for (const c of ids) expect(doc.querySelector(`#${c} .lp-plate`), c).not.toBeNull();
    expect(doc.querySelectorAll('#energy .lp-enduse > span').length).toBeGreaterThan(2);
    expect(doc.querySelectorAll('#compare .lp-plate__cards li')).toHaveLength(3);
    expect(doc.querySelector('#trust .lp-plate__value')?.textContent).toMatch(/^\d+ to \d+ kWh/);
    expect(doc.querySelector('#city .lp-plate')).toBeNull();
  });
});
