/**
 * Compile the token sources into `tokens.css` (DESIGN_SYSTEM 2.5). Owner: WP-06.
 * Pure and deterministic: `scripts/build-tokens.ts` writes the result and a test fails on drift.
 */
import { xoshiro128ss } from '@ibasho/core';
import { CORE, type CoreName, FUEL, NETSU, type Oklch, oklchCss, SEMANTIC } from './color.ts';
import {
  DEPTH,
  FAMILIES,
  hankoSpringEasing,
  JO,
  LH_BODY_MINCHO,
  MA,
  MOTION,
  RADII,
  TYPE_SCALE,
} from './scale.ts';

type Theme = 'hiru' | 'yoru';

const decl = (name: string, value: string) => `  --${name}: ${value};`;

/**
 * Washi grain tile (DESIGN_SYSTEM 4.5): feTurbulence (baseFrequency 0.8, 2 octaves) plus 40 long
 * thin fibres, seeded so the tile is identical on every build. Procedural SVG, never a bitmap.
 */
export function washiTileSvg(theme: Theme, size = 280, fibres = 40): string {
  const rng = xoshiro128ss(`andon-washi-${size}-${fibres}`);
  const r = () => rng.nextFloat();
  const f1 = (x: number) => Number(x.toFixed(1)).toString();
  // Hiru: sumi fibres multiplied into the paper. Yoru: warm lamplight fibres screened on sumi.
  const tint = theme === 'hiru' ? [0.15, 0.12, 0.1] : [1, 0.86, 0.62];
  const paths: string[] = [];
  for (let i = 0; i < fibres; i++) {
    const x = r() * size;
    const y = r() * size;
    const len = 50 + r() * 130;
    const ang = r() * Math.PI * 2;
    const bend = (r() - 0.5) * len * 0.35;
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    const cx = (x + x2) / 2 - Math.sin(ang) * bend;
    const cy = (y + y2) / 2 + Math.cos(ang) * bend;
    const w = 0.3 + r() * 0.6;
    const o = 0.25 + r() * 0.5;
    // Draw the fibre once per tile neighbour it touches so the repeat has no seam.
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        const xs = [x, x2, cx].map((v) => v + dx);
        const ys = [y, y2, cy].map((v) => v + dy);
        if (Math.max(...xs) < 0 || Math.min(...xs) > size || Math.max(...ys) < 0 || Math.min(...ys) > size)
          continue;
        paths.push(
          `<path d='M${f1(xs[0]!)} ${f1(ys[0]!)}Q${f1(xs[2]!)} ${f1(ys[2]!)} ${f1(xs[1]!)} ${f1(ys[1]!)}' stroke-width='${f1(w)}' stroke-opacity='${o.toFixed(2)}'/>`,
        );
      }
    }
  }
  const [tr, tg, tb] = tint;
  const rgb = `rgb(${tint.map((v) => Math.round(v * 255)).join(' ')})`;
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>` +
    `<filter id='g' x='0' y='0'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' seed='7' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 ${tr} 0 0 0 0 ${tg} 0 0 0 0 ${tb} 1.6 0 0 0 -0.55'/></filter>` +
    `<rect width='${size}' height='${size}' filter='url(#g)'/>` +
    `<g fill='none' stroke='${rgb}' stroke-linecap='round'>${paths.join('')}</g></svg>`
  );
}

export const svgDataUri = (svg: string): string =>
  `url("data:image/svg+xml,${svg.replace(/[<>#%"{}\n]/g, (c) => encodeURIComponent(c))}")`;

function color(name: CoreName, theme: Theme): Oklch {
  return CORE[name][theme];
}

function themeDecls(theme: Theme): string[] {
  const out: string[] = [`  color-scheme: ${theme === 'hiru' ? 'light' : 'dark'};`];
  out.push('  /* Core colours (DESIGN_SYSTEM 2.1) */');
  for (const name of Object.keys(CORE) as CoreName[]) out.push(decl(name, oklchCss(color(name, theme))));
  out.push('  /* Semantic (DESIGN_SYSTEM 2.2) */');
  for (const [name, ref] of Object.entries(SEMANTIC)) out.push(decl(name, `var(--${ref})`));
  out.push('  /* Fuel palette, always paired with a hatch (DESIGN_SYSTEM 2.3) */');
  for (const [name, f] of Object.entries(FUEL)) {
    out.push(decl(name, 'ref' in f ? `var(--${f.ref})` : oklchCss(f[theme])));
  }
  out.push('  /* Depth and grain (DESIGN_SYSTEM 4.4, 4.5) */');
  for (const [k, v] of Object.entries(DEPTH)) out.push(decl(k, v));
  out.push(decl('depth-1', theme === 'hiru' ? 'var(--kage-1)' : 'var(--tomoshibi)'));
  out.push(decl('depth-2', theme === 'hiru' ? 'var(--kage-2)' : 'var(--tomoshibi)'));
  out.push(decl('grain', `var(--grain-${theme})`));
  out.push(decl('grain-blend', theme === 'hiru' ? 'multiply' : 'screen'));
  out.push(decl('grain-opacity', theme === 'hiru' ? '0.04' : '0.035'));
  // Seal ink sits on paper; in Yoru the knocked-out glyph reads in lamplight paper.
  out.push(decl('seal-paper', theme === 'hiru' ? 'var(--paper-raised)' : 'var(--paper)'));
  return out;
}

function staticDecls(): string[] {
  const out: string[] = [];
  out.push('  /* Families (DESIGN_SYSTEM 3, DEC TE-8) */');
  for (const [k, f] of Object.entries(FAMILIES)) out.push(decl(`font-${k}`, f.stack));
  out.push('  /* Type scale, perfect fourth (DESIGN_SYSTEM 3) */');
  for (const [k, s] of Object.entries(TYPE_SCALE)) {
    out.push(decl(`fs-${k}`, `${s.px / 16}rem`));
    out.push(decl(`lh-${k}`, String(s.lh)));
  }
  out.push(decl('lh-body-mincho', String(LH_BODY_MINCHO)));
  out.push('  /* Space: ken, ma scale, jo (DESIGN_SYSTEM 4.1) */');
  out.push(decl('ken', '8px'));
  MA.forEach((px, i) => {
    out.push(decl(`ma-${i + 1}`, `${px}px`));
  });
  out.push(decl('jo', `${JO.desktop}px`));
  out.push('  /* Radii: paper is cut, not rounded (DESIGN_SYSTEM 4.4) */');
  for (const [k, v] of Object.entries(RADII)) out.push(decl(k, v));
  out.push(decl('grain-hiru', svgDataUri(washiTileSvg('hiru'))));
  out.push(decl('grain-yoru', svgDataUri(washiTileSvg('yoru'))));
  out.push('  /* Motion (DESIGN_SYSTEM 5) */');
  for (const [k, m] of Object.entries(MOTION)) {
    out.push(decl(k, `${m.ms}ms`));
    if ('ease' in m) {
      const name = 'easeName' in m ? m.easeName : k.replace(/^t-/, '');
      out.push(decl(`ease-${name}`, m.ease));
    }
  }
  const spring = hankoSpringEasing();
  out.push(decl('ease-hanko-spring', spring.css));
  out.push(decl('t-hanko-spring', `${spring.ms}ms`));
  out.push('  /* Netsu thermal ramp, interpolate in OKLab (DESIGN_SYSTEM 2.4) */');
  NETSU.forEach((s, i) => {
    out.push(decl(`netsu-${i}`, oklchCss(s.oklch)));
  });
  out.push(
    decl(
      'netsu',
      `linear-gradient(in oklab to right, ${NETSU.map((_, i) => `var(--netsu-${i})`).join(', ')})`,
    ),
  );
  return out;
}

export const TOKENS_CSS_HEADER =
  '/* GENERATED by packages/ui/scripts/build-tokens.ts from packages/ui/src/tokens/*.ts. Do not edit. */';

/** The full `tokens.css`. */
export function renderTokensCss(): string {
  const hiru = themeDecls('hiru').join('\n');
  const yoru = themeDecls('yoru');
  const indent = (lines: string[]) => lines.map((l) => `  ${l}`).join('\n');
  return [
    TOKENS_CSS_HEADER,
    '',
    '/* Theme independent */',
    ':root {',
    staticDecls().join('\n'),
    '}',
    '',
    '/* Hiru (day): ink on washi. The default, and any subtree marked data-theme="hiru". */',
    ':root,',
    '[data-theme="hiru"] {',
    hiru,
    '}',
    '',
    '/* Yoru (night): the lantern is lit. Follows the system unless the lantern toggle chose Hiru. */',
    '@media (prefers-color-scheme: dark) {',
    '  :root:not([data-theme="hiru"]) {',
    indent(yoru),
    '  }',
    '}',
    '',
    '[data-theme="yoru"] {',
    yoru.join('\n'),
    '}',
    '',
    '/* Jo by breakpoint (DESIGN_SYSTEM 4.1) */',
    '@media (max-width: 1023px) {',
    `  :root { --jo: ${JO.tablet}px; }`,
    '}',
    '@media (max-width: 599px) {',
    `  :root { --jo: ${JO.mobile}px; }`,
    '}',
    '',
  ].join('\n');
}
