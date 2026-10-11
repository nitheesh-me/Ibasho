import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CORE, type CoreName, FUEL, NETSU, SEMANTIC } from '../src/tokens/color.ts';
import { renderTokensCss } from '../src/tokens/css.ts';
import {
  contrast,
  deltaEOk,
  hexToLinear,
  inGamut,
  oklchToHex,
  oklchToLinear,
  simulate,
} from '../src/tokens/oklch.ts';
import { hankoSpringEasing } from '../src/tokens/scale.ts';

const pkg = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string) => readFileSync(join(pkg, p), 'utf8');
const names = Object.keys(CORE) as CoreName[];
const THEMES = ['hiru', 'yoru'] as const;

describe('tokens.css', () => {
  it('is generated from the token sources (run `pnpm --filter @ibasho/ui tokens`)', () => {
    // The file is Biome formatted after generation; compare modulo whitespace and quote style.
    const norm = (css: string) => css.replace(/\s+/g, '').replaceAll('"', "'");
    expect(norm(read('src/styles/tokens.css'))).toBe(norm(renderTokensCss()));
  });

  it('declares every core, semantic and fuel token in both themes', () => {
    const css = renderTokensCss();
    const yoru = css.slice(css.indexOf('[data-theme="yoru"] {'));
    for (const n of [...names, ...Object.keys(SEMANTIC), ...Object.keys(FUEL)]) {
      expect(css).toContain(`--${n}: `);
      expect(yoru).toContain(`--${n}: `);
    }
  });

  it('follows the DESIGN_SYSTEM 2.5 theming shape', () => {
    const css = renderTokensCss();
    expect(css).toMatch(
      /@media \(prefers-color-scheme: dark\) \{\n {2}:root:not\(\[data-theme="hiru"\]\) \{/,
    );
    expect(css).toContain('[data-theme="yoru"] {');
    expect(css).toContain('color-scheme: light;');
    expect(css).toContain('color-scheme: dark;');
  });

  it('never ships a bitmap grain (procedural SVG only)', () => {
    const css = renderTokensCss();
    expect(css).not.toMatch(/data:image\/(png|jpe?g|webp)/);
    expect(css).toContain('feTurbulence');
  });
});

describe('colour tokens (DESIGN_SYSTEM 2)', () => {
  it('match the reference hex in DESIGN_SYSTEM 2.1 to within 4/255 per channel', () => {
    for (const n of names) {
      for (const t of THEMES) {
        const got = hexToLinear(oklchToHex(CORE[n][t]));
        const want = hexToLinear(CORE[n].ref[t]);
        const enc = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255;
        for (let i = 0; i < 3; i++) {
          expect(Math.abs(enc(got[i]!) - enc(want[i]!)), `${n} ${t}`).toBeLessThanOrEqual(4);
        }
      }
    }
  });

  it('are inside the sRGB gamut', () => {
    for (const n of names) for (const t of THEMES) expect(inGamut(CORE[n][t]), `${n} ${t}`).toBe(true);
    for (const s of NETSU) expect(inGamut(s.oklch)).toBe(true);
  });

  // F2: every text token in DS 2.1 reaches 4.5:1 on paper and raised paper, in both themes.
  it('F2: text tokens reach 4.5:1 on paper and paper-raised in Hiru and Yoru', () => {
    const text = names.filter((n) => CORE[n].use === 'text');
    expect(text).toEqual(
      expect.arrayContaining(['ink', 'ink-2', 'ink-3', 'cold', 'deep', 'warm', 'ember-ink', 'good', 'seal']),
    );
    for (const n of text) {
      for (const t of THEMES) {
        for (const ground of ['paper', 'paper-raised'] as const) {
          const c = contrast(CORE[n][t], CORE[ground][t]);
          expect(c, `${n} on ${ground} (${t}) = ${c.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('graphic tokens used for text on Yoru reach 4.5:1 (ember, glow, gold)', () => {
    for (const n of ['ember', 'glow', 'gold'] as const) {
      expect(contrast(CORE[n].yoru, CORE.paper.yoru)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('seal ink reaches 3:1 as a graphic on every paper (WCAG 1.4.11)', () => {
    for (const t of THEMES)
      for (const g of ['paper', 'paper-raised', 'paper-sunk'] as const)
        expect(contrast(CORE.seal[t], CORE[g][t])).toBeGreaterThanOrEqual(3);
  });
});

describe('F1 Netsu ramp (AC-14)', () => {
  it('has seven stops with OKLCH lightness strictly increasing', () => {
    expect(NETSU).toHaveLength(7);
    for (let i = 1; i < NETSU.length; i++) expect(NETSU[i]!.oklch[0]).toBeGreaterThan(NETSU[i - 1]!.oklch[0]);
  });

  it('is greyscale safe: relative luminance strictly increases', () => {
    const lum = NETSU.map((s) => {
      const [r, g, b] = oklchToLinear(s.oklch);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    });
    for (let i = 1; i < lum.length; i++) expect(lum[i]!).toBeGreaterThan(lum[i - 1]!);
  });

  for (const cvd of ['none', 'deuteranopia', 'protanopia'] as const) {
    it(`adjacent stops differ by at least 0.06 Delta E OK (${cvd})`, () => {
      for (let i = 1; i < NETSU.length; i++) {
        const d = deltaEOk(simulate(NETSU[i - 1]!.oklch, cvd), simulate(NETSU[i]!.oklch, cvd));
        expect(d, `stops ${i - 1} and ${i}`).toBeGreaterThanOrEqual(0.06);
      }
    });
  }
});

describe('F5 scarcity: --seal and --gold', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|css)$/.test(e)) files.push(relative(pkg, p));
    }
  };
  walk(join(pkg, 'src'));
  const isTokenSource = (f: string) => f.startsWith('src/tokens/') || f === 'src/styles/tokens.css';

  it('--seal is read only by src/seal/** and seal or claim rules in components.css', () => {
    for (const f of files) {
      if (isTokenSource(f)) continue;
      const src = read(f);
      if (!src.includes('var(--seal)')) continue;
      if (f.startsWith('src/seal/')) continue;
      expect(f, `${f} reads --seal`).toBe('src/styles/components.css');
      // Every CSS rule that reads --seal must target a seal or a claim.
      const css = src.replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of css.matchAll(/([^{}]+)\{[^{}]*var\(--seal\)[^{}]*\}/g)) {
        const selectors = m[1]!.trim().split(',');
        for (const s of selectors)
          expect(s.trim(), 'selector reading --seal').toMatch(/^\.ib-(seal|claim)\b/);
      }
    }
  });

  it('--gold and --gold-ink are read only by the one hero action (and later the mend)', () => {
    for (const f of files) {
      if (isTokenSource(f)) continue;
      const src = read(f);
      // Strip the hero action rules; nothing else may borrow gold.
      const rest = src.replace(/\.ib-btn--hero[^{]*\{[^}]*\}/g, '');
      expect(rest, f).not.toMatch(/var\(--gold(-ink)?\)/);
    }
  });
});

describe('motion', () => {
  it('samples the hanko spring (stiffness 600, damping 30) into a CSS linear() that settles at 1', () => {
    const s = hankoSpringEasing();
    expect(s.css.startsWith('linear(0, ')).toBe(true);
    expect(s.css.endsWith(', 1)')).toBe(true);
    expect(s.ms).toBeGreaterThan(200);
    expect(s.ms).toBeLessThan(800);
    // Underdamped: overshoots a little, as a pressed seal does.
    const vals = s.css.slice(7, -1).split(', ').map(Number);
    expect(Math.max(...vals)).toBeGreaterThan(1);
    expect(Math.max(...vals)).toBeLessThan(1.15);
  });
});
