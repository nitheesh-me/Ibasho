/**
 * SVG renderer, component half: the no-WebGL fallback and the Pencil (Shita-e) stage.
 * Owner: WP-07.
 */
import type { ReactNode } from 'react';
import type { CameraModel } from '../camera/model.ts';
import type { ComposedSurface } from '../camera/compose.ts';
import type { ScenePalette } from '../colour/palette.ts';
import type { SceneTarget } from '../select/store.ts';
import type { HouseModel } from '../twin/house.ts';
import { svgItems, svgJunctions } from './project.ts';

export interface SvgHouseProps {
  house: HouseModel;
  composed: readonly ComposedSurface[];
  camera: CameraModel;
  palette: ScenePalette;
  /** `ink` is the full fallback drawing, `pencil` the underdrawing shown while computing. */
  variant: 'ink' | 'pencil';
  reducedMotion: boolean;
  highlight?: SceneTarget | null;
  onPick?: (t: SceneTarget) => void;
  showJunctions?: boolean;
  children?: ReactNode;
  title?: string;
}

const PENCIL_CSS = `
.ib-svg-house[data-variant="pencil"] path.ib-s { fill: none; stroke-opacity: 0.55; stroke-dasharray: 6 3; }
.ib-svg-house[data-variant="pencil"][data-motion="full"] path.ib-s { animation: ib-pencil 2.4s linear infinite; }
@keyframes ib-pencil { to { stroke-dashoffset: -18; } }
.ib-svg-house path.ib-s[data-hl="1"] { stroke-width: 2.5; }
`;

export function SvgHouse(p: SvgHouseProps) {
  const items = svgItems(p.house, p.composed, p.camera, p.palette);
  const { width, height } = p.camera.viewport;
  const hl = p.highlight;
  const pencil = p.variant === 'pencil';
  return (
    <svg
      className="ib-svg-house"
      data-variant={p.variant}
      data-motion={p.reducedMotion ? 'reduced' : 'full'}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={p.title ?? 'Drawing of the house'}
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      <style>{PENCIL_CSS}</style>
      {items.map((it) => {
        const isHl =
          !!hl &&
          ((hl.kind === 'element' && it.elementId === hl.id) || (hl.kind === 'junction' && it.junctionId === hl.id));
        return (
          <path
            key={it.key}
            className="ib-s"
            d={it.d}
            fillRule="evenodd"
            fill={pencil ? 'none' : it.fill}
            stroke={pencil ? p.palette.ink : isHl ? p.palette.windowGlow : it.stroke}
            strokeWidth={it.strokeWidth}
            strokeDasharray={it.dashed ? '5 3' : undefined}
            strokeLinejoin="round"
            opacity={it.opacity}
            data-element-id={it.elementId}
            data-hl={isHl ? '1' : undefined}
            onClick={it.elementId && p.onPick ? () => p.onPick?.({ kind: 'element', id: it.elementId! }) : undefined}
          />
        );
      })}
      {p.showJunctions
        ? svgJunctions(p.house, p.camera).map((j) => (
            <path
              key={j.junctionId}
              d={j.d}
              stroke={p.palette.warm}
              strokeWidth={hl?.kind === 'junction' && hl.id === j.junctionId ? 3 : 1.5}
              fill="none"
              data-junction-id={j.junctionId}
              onClick={p.onPick ? () => p.onPick?.({ kind: 'junction', id: j.junctionId }) : undefined}
            />
          ))
        : null}
      {p.children}
    </svg>
  );
}
