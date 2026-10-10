/**
 * Line drawings for onboarding (DS 8 `PictureQuestion`, UX 5.2). Owner: WP-08.
 *
 * Ink line drawings on a 48 by 32 grid, straight lines and circles only, stroked in the current
 * text colour so they follow Hiru and Yoru. Decorative: every use sits next to its text label.
 */
import type { ReactNode } from 'react';
import type { ThumbKind } from './archetypes.ts';
import type { PictureId } from './questions.ts';

function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 32"
      className={className ?? 'ib-pic'}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const joists = (
  <>
    <path d="M4 26 H44" />
    {[8, 16, 24, 32, 40].map((x) => (
      <path key={x} d={`M${x} 26 V22`} />
    ))}
  </>
);
const roof = <path d="M2 22 L24 4 L46 22" />;

function layers(n: number) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const y = 21 - i * 3;
    rows.push(<path key={i} d={`M5 ${y} H43`} strokeDasharray="2 2" opacity={0.75} />);
  }
  return rows;
}

function pane(x: number, panes: number, film: boolean) {
  const out = [<path key="f" d={`M${x} 6 H${x + 16} V26 H${x} Z`} />];
  for (let i = 1; i < panes; i++) out.push(<path key={`p${i}`} d={`M${x + 1 + i} 7 V25`} opacity={0.6} />);
  if (film) out.push(<path key="film" d={`M${x + 4} 10 L${x + 12} 18`} opacity={0.5} />);
  return out;
}

function draughts(n: number) {
  const out = [<path key="door" d="M14 4 H34 V28 H14 Z" />, <circle key="knob" cx={30} cy={16} r={1} />];
  for (let i = 0; i < n; i++) {
    const y = 8 + i * 6;
    out.push(<path key={i} d={`M4 ${y} H10 M6 ${y + 2} H11`} opacity={0.7} />);
  }
  return out;
}

export function Picture({ id }: { id: PictureId }) {
  switch (id) {
    case 'loft-bare':
      return <Frame>{[roof, joists]}</Frame>;
    case 'loft-thin':
      return <Frame>{[roof, joists, ...layers(1)]}</Frame>;
    case 'loft-deep':
      return <Frame>{[roof, joists, ...layers(4)]}</Frame>;
    case 'glass-single':
      return <Frame>{pane(16, 1, false)}</Frame>;
    case 'glass-double':
      return <Frame>{pane(16, 2, false)}</Frame>;
    case 'glass-new':
      return <Frame>{pane(16, 2, true)}</Frame>;
    case 'draught-most':
      return <Frame>{draughts(0)}</Frame>;
    case 'draught-some':
      return <Frame>{draughts(2)}</Frame>;
    case 'draught-none':
      return <Frame>{draughts(4)}</Frame>;
  }
}

/** A house: a box with a gable roof between x0 and x1, `storeys` floors high. */
function house(x0: number, x1: number, storeys: number, key: string) {
  const base = 28;
  const top = base - storeys * 8;
  const mid = (x0 + x1) / 2;
  return (
    <g key={key}>
      <path d={`M${x0} ${base} V${top} H${x1} V${base}`} />
      <path d={`M${x0 - 1} ${top} L${mid} ${top - 6} L${x1 + 1} ${top}`} />
      <path d={`M${mid - 2} ${base} V${base - 5} H${mid + 2} V${base}`} />
    </g>
  );
}

export function Thumb({ kind }: { kind: ThumbKind }) {
  switch (kind) {
    case 'terrace':
      return (
        <Frame className="ib-thumb">
          {[house(2, 16, 2, 'a'), house(16, 32, 2, 'b'), house(32, 46, 2, 'c')]}
          <path d="M2 28 H46" />
        </Frame>
      );
    case 'semi':
      return (
        <Frame className="ib-thumb">
          {[house(9, 24, 2, 'a'), house(24, 39, 2, 'b')]}
          <path d="M4 28 H44" />
        </Frame>
      );
    case 'detached':
      return (
        <Frame className="ib-thumb">
          {house(14, 34, 2, 'a')}
          <path d="M6 28 H42" />
        </Frame>
      );
    case 'bungalow':
      return (
        <Frame className="ib-thumb">
          {house(8, 40, 1, 'a')}
          <path d="M4 28 H44" />
        </Frame>
      );
    case 'flat':
      return (
        <Frame className="ib-thumb">
          <path d="M10 28 V4 H38 V28" />
          {[10, 16, 22].map((y) => (
            <path key={y} d={`M14 ${y} H20 M28 ${y} H34`} />
          ))}
          <path d="M4 28 H44" />
        </Frame>
      );
    case 'unsure':
      return (
        <Frame className="ib-thumb">
          <circle cx={24} cy={16} r={11} strokeDasharray="2 2" />
          <path d="M20 12 L22 9 H26 L28 12 L24 16 V19" />
          <circle cx={24} cy={23} r={0.6} />
        </Frame>
      );
  }
}
