/** Build-time plugin discovery (I4): the landing sees the packs that exist. */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { presenceFromList } from '@ibasho/content';
import { describe, expect, it } from 'vitest';
import { discoverPlugins, moduleFiles, packModuleFiles } from '../src/discover.ts';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

describe('discoverPlugins', () => {
  it('finds pack modules in a stable order', () => {
    const files = packModuleFiles(repoRoot);
    expect(files.length).toBeGreaterThan(0);
    expect(files).toEqual([...files].sort());
  });

  it('lists the plugins the app packs load', async () => {
    const { plugins } = await discoverPlugins(repoRoot);
    const p = presenceFromList(plugins);
    expect(p.has('rules-uk')).toBe(true);
    expect(p.has('loft')).toBe(true);
    expect(p.hasKind('climate')).toBe(true);
  });

  it('skips a broken module instead of failing the build', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ibasho-landing-'));
    mkdirSync(join(root, 'packs', 'broken', 'src', 'engine'), { recursive: true });
    writeFileSync(join(root, 'packs', 'broken', 'src', 'engine', 'module.ts'), 'export const nope = 1;\n');
    const { plugins, skipped } = await discoverPlugins(root);
    expect(plugins).toEqual([]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]!.reason).toMatch(/IbashoModule/);
  });

  it('returns nothing for a root with no packs', async () => {
    expect(await discoverPlugins(join(tmpdir(), 'no-such-ibasho-root'))).toEqual({
      source: 'none',
      plugins: [],
      skipped: [],
      stages: {},
    });
  });

  const moduleSrc = (id: string, kind: string, pid: string) =>
    `export default { id: '${id}', load: () => [{ kind: '${kind}', id: '${pid}' }] };\n`;

  it('scans packages too, where search strategies and checker rungs live (ARCH 2)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ibasho-landing-'));
    mkdirSync(join(root, 'packages', 'verify', 'src', 'engine'), { recursive: true });
    writeFileSync(
      join(root, 'packages', 'verify', 'src', 'engine', 'module.ts'),
      moduleSrc('verify/engine', 'checker-rung', 'mirror'),
    );
    expect(moduleFiles(root)).toHaveLength(1);
    const d = await discoverPlugins(root);
    expect(d.source).toBe('files');
    expect(presenceFromList(d.plugins).hasKind('checker-rung')).toBe(true);
  });

  it('prefers the app manifest once it lists modules, so the page matches the app', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ibasho-landing-'));
    mkdirSync(join(root, 'packs', 'extra', 'src', 'engine'), { recursive: true });
    writeFileSync(
      join(root, 'packs', 'extra', 'src', 'engine', 'module.ts'),
      moduleSrc('extra/engine', 'climate', 'not-in-app'),
    );
    mkdirSync(join(root, 'apps', 'web', 'src'), { recursive: true });
    writeFileSync(
      join(root, 'apps', 'web', 'src', 'manifest.ts'),
      [
        'const mod = { id: "app/engine", load: () => [{ kind: "search-strategy", id: "exhaustive" }] };',
        'export const manifest = { engine: [{ id: "app/engine", load: async () => ({ default: mod }) }], ui: [] };',
        '',
      ].join('\n'),
    );
    const d = await discoverPlugins(root);
    expect(d.source).toBe('manifest');
    const p = presenceFromList(d.plugins);
    expect(p.hasKind('search-strategy')).toBe(true);
    expect(p.has('not-in-app')).toBe(false);
  });

  it('reads the studio stage providers from the real manifest', async () => {
    const d = await discoverPlugins(repoRoot);
    const p = presenceFromList(d.plugins, d.stages);
    expect(Object.keys(d.stages).length).toBeGreaterThan(0);
    expect(p.stage?.('sun')).toMatch(/^(preview|real)$/);
  });

  it('reads stage providers even when the manifest lists no modules', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ibasho-landing-'));
    mkdirSync(join(root, 'apps', 'web', 'src'), { recursive: true });
    writeFileSync(
      join(root, 'apps', 'web', 'src', 'manifest.ts'),
      'export const manifest = { engine: [], ui: [] };\nexport const STAGE_PROVIDERS = { sun: "preview.sun", energy: 42 };\n',
    );
    const d = await discoverPlugins(root);
    expect(d.stages).toEqual({ sun: 'preview.sun' });
  });

  it('falls back to module files while the manifest is empty', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ibasho-landing-'));
    mkdirSync(join(root, 'packs', 'extra', 'src', 'engine'), { recursive: true });
    writeFileSync(
      join(root, 'packs', 'extra', 'src', 'engine', 'module.ts'),
      moduleSrc('extra/engine', 'climate', 'climate-test'),
    );
    mkdirSync(join(root, 'apps', 'web', 'src'), { recursive: true });
    writeFileSync(
      join(root, 'apps', 'web', 'src', 'manifest.ts'),
      'export const manifest = { engine: [], ui: [] };\n',
    );
    const d = await discoverPlugins(root);
    expect(d.source).toBe('files');
    expect(presenceFromList(d.plugins).has('climate-test')).toBe(true);
  });
});
