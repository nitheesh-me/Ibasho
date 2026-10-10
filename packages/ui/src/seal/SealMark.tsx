/**
 * The drawn impression of a seal (DESIGN_SYSTEM 7, 8). Owner: WP-06. Decorative: the accessible
 * name lives on the host (`Seal`, `Num`, `ClaimSeal`).
 *
 * Shapes say the level without colour (DESIGN_SYSTEM 12):
 * - Proved: filled square hanko, 証 knocked out of the ink, inner frame.
 * - Checked: square ring, 検 in seal ink.
 * - Modelled: round double ring, 模 in ink (never seal red).
 * - Cracked: the Checked seal split along a crack, halves pulled apart.
 * - Unverified: dashed square, empty.
 * - Pressing: the Checked seal mid press.
 *
 * From `md` up the seal carries its baked Yuji Syuku kanji and an ink texture filter (edge
 * wobble and paper showing through), seeded so a given seal always prints the same way. Below
 * `md` the kanji would blur into a blot, so the seal becomes a geometric mon of the same shape.
 */
import { useId } from 'react';
import { Glyph } from '../glyphs/Glyph.tsx';
import type { BakedChar } from '../glyphs/list.ts';
import type { SealKind } from './copy.ts';

export type SealSize = 'glyph' | 'sm' | 'md' | 'lg' | 'xl';

const KANJI: Partial<Record<SealKind, BakedChar>> = {
  proved: '証',
  checked: '検',
  cracked: '検',
  pressing: '検',
  modelled: '模',
};

/** Small deterministic hash (FNV-1a) for seeding a seal's print. */
export function sealSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

const LEFT = '0,0 24.5,0 19,12.5 23.5,19.5 15.5,28.5 19,40 0,40';
const RIGHT = '24.5,0 40,0 40,40 19,40 15.5,28.5 23.5,19.5 19,12.5';

export function SealMark({ kind, size, seed }: { kind: SealKind; size: SealSize; seed: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const rich = size === 'md' || size === 'lg' || size === 'xl';
  const filter = rich ? `url(#ib-ink-${uid})` : undefined;
  const char = KANJI[kind];

  const square = (key: string, inset = 0) => {
    const filled = kind === 'proved';
    const w = filled ? 0 : rich ? 2.4 : 3.2;
    const o = 2.5 + inset + w / 2;
    return (
      <rect
        key={key}
        x={o}
        y={o}
        width={40 - 2 * o}
        height={40 - 2 * o}
        rx={filled ? 2.2 : 1.6}
        fill={filled ? 'var(--seal)' : 'none'}
        stroke={filled ? 'none' : 'var(--seal)'}
        strokeWidth={w}
      />
    );
  };

  const stampBody = () => {
    if (kind === 'modelled') {
      return (
        <g>
          <circle
            cx="20"
            cy="20"
            r={rich ? 17 : 16}
            fill="none"
            stroke="currentColor"
            strokeWidth={rich ? 1.7 : 3}
          />
          {rich ? (
            <circle cx="20" cy="20" r="14.4" fill="none" stroke="currentColor" strokeWidth="0.6" />
          ) : null}
          {rich && char ? (
            <Glyph char={char} x={10.5} y={10.5} width={19} height={19} />
          ) : (
            <circle cx="20" cy="20" r="4.6" fill="currentColor" />
          )}
        </g>
      );
    }
    if (kind === 'unverified') {
      return (
        <g>
          <rect
            x="4"
            y="4"
            width="32"
            height="32"
            rx="1.6"
            fill="none"
            stroke="currentColor"
            strokeWidth={rich ? 1.8 : 3}
            strokeDasharray={rich ? '4.2 3.1' : '6 4.4'}
          />
          <circle cx="20" cy="20" r={rich ? 2.2 : 3.6} fill="currentColor" />
        </g>
      );
    }
    const inner =
      kind === 'proved' ? (
        <g>
          <rect
            x="6"
            y="6"
            width="28"
            height="28"
            rx="1"
            fill="none"
            stroke="var(--seal-paper)"
            strokeWidth="1"
          />
          {rich && char ? (
            <Glyph char={char} x={9} y={9} width={22} height={22} style={{ color: 'var(--seal-paper)' }} />
          ) : (
            <rect x="15" y="15" width="10" height="10" fill="var(--seal-paper)" />
          )}
        </g>
      ) : rich && char ? (
        <Glyph char={char} x={9.5} y={9.5} width={21} height={21} style={{ color: 'var(--seal)' }} />
      ) : (
        <rect x="15" y="15" width="10" height="10" fill="var(--seal)" />
      );
    return (
      <g>
        {square('frame')}
        {inner}
      </g>
    );
  };

  const body =
    kind === 'cracked' ? (
      <g>
        <clipPath id={`ib-cl-${uid}`}>
          <polygon points={LEFT} />
        </clipPath>
        <clipPath id={`ib-cr-${uid}`}>
          <polygon points={RIGHT} />
        </clipPath>
        <g clipPath={`url(#ib-cl-${uid})`} transform="translate(-1.6 1.1) rotate(-4 12 20)">
          {stampBody()}
        </g>
        <g clipPath={`url(#ib-cr-${uid})`} transform="translate(1.6 -0.7) rotate(3 28 20)">
          {stampBody()}
        </g>
      </g>
    ) : (
      stampBody()
    );

  return (
    <svg
      className="ib-seal__mark"
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
    >
      {rich ? (
        <defs>
          <filter
            id={`ib-ink-${uid}`}
            x="-8%"
            y="-8%"
            width="116%"
            height="116%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.55"
              numOctaves="2"
              seed={seed % 997}
              result="wob"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="wob"
              scale={size === 'md' ? 0.9 : 1.3}
              xChannelSelector="R"
              yChannelSelector="G"
              result="edge"
            />
            <feTurbulence
              type="fractalNoise"
              baseFrequency="1.7"
              numOctaves="2"
              seed={(seed >>> 10) % 997}
              result="grain"
            />
            <feColorMatrix
              in="grain"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -11 0 0 0 7.9"
              result="holes"
            />
            <feComposite in="edge" in2="holes" operator="in" />
          </filter>
        </defs>
      ) : null}
      <g filter={filter}>{body}</g>
    </svg>
  );
}
