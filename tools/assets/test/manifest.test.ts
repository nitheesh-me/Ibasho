import { describe, expect, it } from 'vitest';
import { renderAttribution } from '../src/attribution.ts';
import {
  checkManifest,
  type DiskFile,
  type Manifest,
  type ManifestAsset,
  tierBytes,
} from '../src/manifest.ts';

const H = (c: string) => c.repeat(64);

function asset(over: Partial<ManifestAsset> = {}): ManifestAsset {
  return {
    id: 'tex-a',
    kind: 'texture',
    tier: 'hero',
    status: 'ok',
    title: 'A <brick> & "co"',
    use: 'test',
    licence: 'CC0-1.0',
    licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    source: {
      provider: 'polyhaven',
      providerName: 'Poly Haven',
      authors: ['Rob Tuytel'],
      page: 'https://polyhaven.com/a/a',
      licenceEvidence: 'x',
      files: [],
    },
    processing: [],
    files: [{ path: 'textures/a/diff.webp', role: 'diff', mime: 'image/webp', bytes: 100, sha256: H('a') }],
    ...over,
  };
}

function manifest(assets: ManifestAsset[]): Manifest {
  const m: Manifest = {
    schema: 1,
    generator: 'test',
    budgets: { hero: { limitBytes: 1000, bytes: 0 }, lazy: { limitBytes: null, bytes: 0 } },
    assets,
  };
  return {
    ...m,
    budgets: {
      hero: { limitBytes: 1000, bytes: tierBytes(m, 'hero') },
      lazy: { limitBytes: null, bytes: tierBytes(m, 'lazy') },
    },
  };
}

const disk = (entries: Array<[string, DiskFile]>) => new Map(entries);
const ok = disk([['textures/a/diff.webp', { bytes: 100, sha256: H('a') }]]);

describe('checkManifest (K1 to K3)', () => {
  it('passes a consistent manifest', () => {
    expect(checkManifest(manifest([asset()]), ok, 1000, 10)).toEqual([]);
  });

  it('K1: flags unlisted, missing and changed files', () => {
    const extra = new Map(ok).set('stray.png', { bytes: 1, sha256: H('b') });
    expect(checkManifest(manifest([asset()]), extra, 1000, 10)).toContain(
      'K1 stray.png: on disk but not in the manifest',
    );
    expect(checkManifest(manifest([asset()]), disk([]), 1000, 10)).toContain(
      'K1 textures/a/diff.webp: in the manifest but missing',
    );
    const changed = disk([['textures/a/diff.webp', { bytes: 101, sha256: H('c') }]]);
    const p = checkManifest(manifest([asset()]), changed, 1000, 10);
    expect(p).toContain('K1 textures/a/diff.webp: sha256 differs from the manifest');
    expect(p).toContain('K1 textures/a/diff.webp: size differs from the manifest');
  });

  it('K1: requires a licence and a licence URL', () => {
    const p = checkManifest(manifest([asset({ licence: '', licenceUrl: '' })]), ok, 1000, 10);
    expect(p).toContain('K1 tex-a: missing licence');
    expect(p).toContain('K1 tex-a: missing licence URL');
  });

  it('K2: enforces the hero budget including the manifest', () => {
    expect(checkManifest(manifest([asset()]), ok, 105, 10)[0]).toMatch(/^K2 hero tier is 110 bytes/);
  });

  it('K3: no pending-manual hero asset', () => {
    expect(checkManifest(manifest([asset({ status: 'pending-manual' })]), ok, 1000, 10)).toContain(
      'K3 tex-a: hero asset is pending-manual',
    );
    expect(
      checkManifest(manifest([asset({ status: 'pending-manual', tier: 'lazy' })]), ok, 1000, 10),
    ).toEqual([]);
  });

  it('rejects duplicate and non-kebab ids', () => {
    const b = asset({ files: [] });
    const p = checkManifest(manifest([asset(), b, asset({ id: 'Bad_Id', files: [] })]), ok, 1000, 10);
    expect(p).toContain('duplicate asset id tex-a');
    expect(p).toContain('Bad_Id: id is not kebab-case');
  });
});

describe('renderAttribution (K4)', () => {
  it('is deterministic, escapes text and credits every non-generated asset', () => {
    const m = manifest([
      asset(),
      asset({
        id: 'doc-x',
        kind: 'doc',
        source: { ...asset().source, provider: 'ibasho', providerName: 'Ibasho' },
        files: [],
      }),
    ]);
    const html = renderAttribution(m);
    expect(renderAttribution(m)).toBe(html);
    expect(html).toContain('A &lt;brick&gt; &amp; &quot;co&quot;');
    expect(html).toContain('<code>tex-a</code>');
    expect(html).not.toContain('<code>doc-x</code>');
    expect(html).toContain('Rob Tuytel');
    // No en or em dash (U+2013, U+2014) anywhere in the page.
    expect([...html].some((ch) => ch.charCodeAt(0) === 0x2013 || ch.charCodeAt(0) === 0x2014)).toBe(false);
  });
});
