/**
 * The house on the M-0 home stage: WP-07's SVG renderer (`SvgHouse`) in the default cutaway.
 * Owner: WP-08. Temporary: the full R3F `Stage` replaces it at M-A (BUILD_PLAN M-0 step 6).
 * While the worker computes, the same drawing shows as the pencil underdrawing (DS 4.5 Shita-e).
 */
import type { HomeTwin } from '@ibasho/core';
import { buildHouse, composeView, DEFAULT_ELEVATION, palette, SvgHouse, stageCamera } from '@ibasho/scene';
import { useMemo } from 'react';

const VIEWPORT = { width: 960, height: 720 };
const LIFT_M = 2;
const AZIMUTH = 45;

export interface HouseDrawingProps {
  twin: HomeTwin;
  theme: 'hiru' | 'yoru';
  pencil: boolean;
  reducedMotion: boolean;
  title: string;
}

export function HouseDrawing({ twin, theme, pencil, reducedMotion, title }: HouseDrawingProps) {
  const house = useMemo(() => buildHouse(twin), [twin]);
  const camera = useMemo(() => stageCamera(house, AZIMUTH, VIEWPORT, LIFT_M), [house]);
  const composed = useMemo(
    () =>
      composeView(house, {
        view: 'cutaway',
        azimuthDeg: AZIMUTH,
        elevationDeg: DEFAULT_ELEVATION,
        roofLiftM: LIFT_M,
        ceiling: 0.35,
      }),
    [house],
  );
  const pal = useMemo(() => palette(theme), [theme]);
  return (
    <SvgHouse
      house={house}
      composed={composed}
      camera={camera}
      palette={pal}
      variant={pencil ? 'pencil' : 'ink'}
      reducedMotion={reducedMotion}
      title={title}
    />
  );
}
