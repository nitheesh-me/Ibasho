import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderTokensCss } from '../src/tokens/css.ts';
import { FAMILIES } from '../src/tokens/scale.ts';

const pkg = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(join(pkg, 'package.json'));
const fontsCss = readFileSync(join(pkg, 'src/styles/fonts.css'), 'utf8');
const imports = [...fontsCss.matchAll(/@import ['"]([^'"]+)['"];/g)].map((m) => m[1]!);

interface Face {
  family: string;
  weight: string;
  range: string | undefined;
  src: string[];
  file: string;
}
const faces: Face[] = imports.flatMap((spec) => {
  const file = require.resolve(spec);
  const css = readFileSync(file, 'utf8');
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => {
    const body = m[1]!;
    return {
      family: /font-family:\s*'([^']+)'/.exec(body)![1]!,
      weight: /font-weight:\s*([^;]+);/.exec(body)![1]!.trim(),
      range: /unicode-range:\s*([^;]+);/.exec(body)?.[1],
      src: [...body.matchAll(/url\(([^)]+)\)/g)].map((u) => u[1]!),
      file,
    };
  });
});

describe('fonts (DESIGN_SYSTEM 3, DEC TE-8)', () => {
  it('loads exactly the three Andon families (F8 at the source)', () => {
    const families = new Set(faces.map((f) => f.family));
    expect([...families].sort()).toEqual(
      Object.values(FAMILIES)
        .map((f) => f.family)
        .sort(),
    );
  });

  it('loads exactly the weights the type spec names', () => {
    for (const fam of Object.values(FAMILIES)) {
      const weights = new Set(faces.filter((f) => f.family === fam.family).map((f) => f.weight));
      if (fam.family.endsWith('Variable')) {
        // One variable face whose axis covers every named weight.
        expect([...weights]).toHaveLength(1);
        const [lo, hi] = [...weights][0]!.split(/\s+/).map(Number);
        for (const w of fam.weights) expect(w >= lo! && w <= hi!).toBe(true);
      } else {
        expect([...weights].map(Number).sort((a, b) => a - b)).toEqual([...fam.weights]);
      }
    }
  });

  it('slices every face by unicode-range so only used glyph blocks download', () => {
    expect(faces.length).toBeGreaterThan(100);
    for (const f of faces) expect(f.range, `${f.family} ${f.weight}`).toBeTruthy();
  });

  it('points every face at a woff2 file that is installed', () => {
    for (const f of faces) {
      const woff2 = f.src.find((s) => s.endsWith('.woff2'));
      expect(woff2).toBeTruthy();
      expect(existsSync(join(dirname(f.file), woff2!))).toBe(true);
    }
  });

  it('font tokens lead with the loaded family names', () => {
    const css = renderTokensCss();
    for (const [k, fam] of Object.entries(FAMILIES)) {
      expect(css).toContain(`--font-${k}: '${fam.family}'`);
    }
  });
});
