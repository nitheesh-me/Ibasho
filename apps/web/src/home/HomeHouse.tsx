/**
 * The house on the home stage (SPEC 5.3, ARCH 10). Owner: WP-08.
 *
 * Mounts WP-07's `HouseStage`: the cutaway at 45 degrees with heat-flow motes and zone tints,
 * Washi by day and Yoru by night, the pencil underdrawing while the engine computes. On Reveal
 * (onboarding just finished) the roof-lift sequence plays once, when the baseline is ready;
 * reduced motion skips it.
 *
 * Without WebGL (or if the 3D stage fails) the house is the SVG renderer: drawn in pencil while
 * the engine computes, then inked, so the Reveal still draws itself in ink stages.
 */
import type { HomeTwin, SearchResult } from '@ibasho/core';
import { HouseStage, ROOF_LIFT } from '@ibasho/scene';
import { Component, type ReactNode, useEffect, useState } from 'react';
import type { Theme } from '../shell/Shell.tsx';
import { HouseDrawing } from './HouseDrawing.tsx';

/** True when this browser can give us a WebGL 2 context. */
export function webglAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

class StageBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface HomeHouseProps {
  twin: HomeTwin;
  result: SearchResult | null;
  theme: Theme;
  /** True while the engine computes: the pencil underdrawing. */
  pencil: boolean;
  reducedMotion: boolean;
  /** Play the Reveal (roof lift) once the result is ready. */
  reveal: boolean;
  title: string;
}

export function HomeHouse({ twin, result, theme, pencil, reducedMotion, reveal, title }: HomeHouseProps) {
  const [gl] = useState(webglAvailable);
  const [revealKey, setRevealKey] = useState<number | undefined>(undefined);
  const play = reveal && !reducedMotion && gl && result !== null;
  useEffect(() => {
    if (play) setRevealKey((k) => (k === undefined ? 1 : k));
  }, [play]);

  const svg = (
    <HouseDrawing twin={twin} theme={theme} pencil={pencil} reducedMotion={reducedMotion} title={title} />
  );
  if (!gl)
    return (
      <div className="ib-house" data-renderer="svg">
        {svg}
      </div>
    );

  return (
    <div className="ib-house" data-renderer="stage">
      <StageBoundary fallback={svg}>
        <HouseStage
          twin={twin}
          result={result}
          style={theme === 'yoru' ? 'yoru' : 'washi'}
          pencil={pencil}
          reducedMotion={reducedMotion}
          stage={{
            ...(revealKey !== undefined ? { sequence: ROOF_LIFT, sequenceKey: revealKey } : {}),
          }}
        />
      </StageBoundary>
    </div>
  );
}
