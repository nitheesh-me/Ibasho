/**
 * Archetype thumbnails (ARCH 2: `src/ui` "archetype thumbnails"): a small ink elevation per built
 * form for onboarding and the "your kind of home" picker. Owner: WP-07.
 *
 * The drawing is data first (`thumbnailDrawing`), straight lines only, on a 96 by 64 grid, so it
 * matches the mon line style (DESIGN_SYSTEM 7) and can be tested without a DOM. Your home is
 * drawn solid; neighbours are dashed and faint, so the shared walls read at a glance.
 */
import type { BuiltForm } from '@ibasho/core';

export const THUMB_W = 96;
export const THUMB_H = 64;
const GROUND = 58;

export interface ThumbStroke {
  /** SVG path data: `M`, `L`, `H`, `V` and `Z` only. */
  d: string;
  /** Part of your home (solid) or a neighbour (dashed, faint). */
  own: boolean;
  /** Filled with a light wash of the current colour (the unit that is yours in a block). */
  wash?: boolean;
}

export interface ThumbDrawing {
  form: BuiltForm;
  strokes: ThumbStroke[];
}

/** Plain English labels; the app may pass a localised `title` instead. */
export const ARCHETYPE_LABEL: Readonly<Record<BuiltForm, string>> = {
  detached: 'Detached house',
  'semi-detached': 'Semi-detached house',
  'end-terrace': 'End of terrace',
  'mid-terrace': 'Mid terrace',
  'enclosed-end-terrace': 'Enclosed end of terrace',
  'enclosed-mid-terrace': 'Enclosed mid terrace',
  flat: 'Flat',
  maisonette: 'Maisonette',
  'independent-house': 'Independent house',
};

/** Built forms in picker order. */
export const ARCHETYPE_FORMS: readonly BuiltForm[] = Object.keys(ARCHETYPE_LABEL) as BuiltForm[];

const r1 = (x: number): string => String(Math.round(x * 10) / 10);
const rect = (x: number, y: number, w: number, h: number): string =>
  `M${r1(x)} ${r1(y)}H${r1(x + w)}V${r1(y + h)}H${r1(x)}Z`;

/** One two-storey pitched house: body, roof, door and four windows. */
function house(x: number, w: number, own: boolean, opts: { door?: 'left' | 'right' } = {}): ThumbStroke[] {
  const h = 22;
  const top = GROUND - h;
  const ridge = top - w * 0.38;
  const out: ThumbStroke[] = [
    { d: rect(x, top, w, h), own },
    { d: `M${r1(x - 1.5)} ${r1(top)}L${r1(x + w / 2)} ${r1(ridge)}L${r1(x + w + 1.5)} ${r1(top)}`, own },
  ];
  if (!own) return out;
  const ww = w * 0.22;
  const doorLeft = (opts.door ?? 'left') === 'left';
  const dx = doorLeft ? x + w * 0.16 : x + w * 0.84 - ww;
  const wx = doorLeft ? x + w * 0.62 : x + w * 0.16;
  out.push({ d: `M${r1(dx)} ${GROUND}V${r1(GROUND - 8)}H${r1(dx + ww)}V${GROUND}`, own });
  out.push({ d: rect(wx, GROUND - 9, ww, 5.5), own });
  out.push({ d: rect(x + w * 0.16, top + 3.5, ww, 5.5), own });
  out.push({ d: rect(x + w * 0.62, top + 3.5, ww, 5.5), own });
  return out;
}

/** A row of `n` houses of width `w` centred on the thumbnail; `ownAt` is yours. */
function row(n: number, ownAt: number, w = 22): ThumbStroke[] {
  const x0 = (THUMB_W - n * w) / 2;
  const out: ThumbStroke[] = [];
  for (let i = 0; i < n; i++)
    out.push(...house(x0 + i * w, w, i === ownAt, { door: i < n / 2 ? 'left' : 'right' }));
  return out;
}

/** Enclosed terraces are back to back: a dashed roof line behind shows the rear neighbours. */
function behind(n: number, w = 22): ThumbStroke {
  const x0 = (THUMB_W - n * w) / 2;
  return { d: `M${r1(x0 + 3)} ${GROUND - 22 - w * 0.38 - 4}H${r1(x0 + n * w - 3)}`, own: false };
}

/** A three storey block of units; `own` is the [column, storey, storeys tall] you live in. */
function block(own: [number, number, number]): ThumbStroke[] {
  const cols = 3;
  const floors = 3;
  const cw = 18;
  const fh = 13;
  const x0 = (THUMB_W - cols * cw) / 2;
  const top = GROUND - floors * fh;
  const out: ThumbStroke[] = [
    { d: rect(x0, top, cols * cw, floors * fh), own: false },
    { d: `M${r1(x0 - 2)} ${r1(top)}H${r1(x0 + cols * cw + 2)}`, own: false },
  ];
  for (let f = 1; f < floors; f++)
    out.push({ d: `M${r1(x0)} ${r1(top + f * fh)}H${r1(x0 + cols * cw)}`, own: false });
  for (let c = 1; c < cols; c++) out.push({ d: `M${r1(x0 + c * cw)} ${r1(top)}V${GROUND}`, own: false });
  const [col, storey, tall] = own;
  const uy = GROUND - (storey + tall) * fh;
  out.push({ d: rect(x0 + col * cw, uy, cw, tall * fh), own: true, wash: true });
  for (let s = 0; s < tall; s++)
    out.push({ d: rect(x0 + col * cw + cw * 0.3, uy + s * fh + 3.5, cw * 0.4, 5), own: true });
  return out;
}

/** A single storey flat-roofed house with a parapet (India: independent house). */
function independent(): ThumbStroke[] {
  const w = 40;
  const x = (THUMB_W - w) / 2;
  const h = 24;
  const top = GROUND - h;
  return [
    { d: rect(x, top, w, h), own: true },
    { d: `M${r1(x - 2)} ${top}V${top - 4}H${r1(x + w + 2)}V${top}`, own: true },
    { d: `M${r1(x + 6)} ${GROUND}V${GROUND - 11}H${r1(x + 13)}V${GROUND}`, own: true },
    { d: rect(x + 20, top + 6, 12, 7), own: true },
    // Stair head on the roof.
    { d: `M${r1(x + w - 14)} ${top - 4}V${top - 11}H${r1(x + w - 4)}V${top - 4}`, own: true },
  ];
}

export function thumbnailDrawing(form: BuiltForm): ThumbDrawing {
  let strokes: ThumbStroke[];
  switch (form) {
    case 'detached':
      strokes = house((THUMB_W - 30) / 2, 30, true);
      break;
    case 'semi-detached':
      strokes = row(2, 0, 26);
      break;
    case 'end-terrace':
      strokes = row(3, 0);
      break;
    case 'mid-terrace':
      strokes = row(3, 1);
      break;
    case 'enclosed-end-terrace':
      strokes = [behind(3), ...row(3, 0)];
      break;
    case 'enclosed-mid-terrace':
      strokes = [behind(3), ...row(3, 1)];
      break;
    case 'flat':
      strokes = block([1, 1, 1]);
      break;
    case 'maisonette':
      strokes = block([1, 1, 2]);
      break;
    case 'independent-house':
      strokes = independent();
      break;
  }
  // The ground line, shared by every form.
  strokes.push({ d: `M4 ${GROUND}H${THUMB_W - 4}`, own: true });
  return { form, strokes };
}

export interface ArchetypeThumbProps {
  form: BuiltForm;
  /** Accessible name; defaults to the English label. */
  title?: string;
  /** Rendered width in px (height follows the 3:2 grid). Default 96. */
  size?: number;
  className?: string;
}

/** Ink line thumbnail of a built form. Strokes use `currentColor`, so it follows the theme. */
export function ArchetypeThumb({ form, title, size = THUMB_W, className }: ArchetypeThumbProps) {
  const d = thumbnailDrawing(form);
  const label = title ?? ARCHETYPE_LABEL[form];
  return (
    <svg
      role="img"
      aria-label={label}
      className={className}
      width={size}
      height={(size * THUMB_H) / THUMB_W}
      viewBox={`0 0 ${THUMB_W} ${THUMB_H}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      strokeLinecap="round"
      data-form={form}
    >
      <title>{label}</title>
      {d.strokes.map((s) => (
        <path
          key={`${s.own ? 'o' : 'n'}${s.d}`}
          d={s.d}
          {...(s.wash ? { fill: 'currentColor', fillOpacity: 0.14 } : {})}
          {...(s.own ? {} : { strokeDasharray: '2 2', strokeOpacity: 0.45, strokeWidth: 1 })}
        />
      ))}
    </svg>
  );
}
