/**
 * `<HouseStage twin quantities style />`: the one-line mount for the app shell (WP-08).
 * Owner: WP-07.
 *
 * It wraps `Stage` with the M-A defaults: the cutaway at 45°, heat-flow motes and zone tints on,
 * hero assets fetched once from the served manifest, the pencil underdrawing while the engine
 * computes. It fills its parent box, so the caller sizes it. Everything `Stage` takes can still
 * be passed through `stage` for the views that need more (what-if, roof lift, lens).
 */
import type { HomeTwin, QualityTier, SearchResult } from '@ibasho/core';
import { useEffect, useState } from 'react';
import type { SceneCondition, SceneQuantities } from './quantities/types.ts';
import { Stage, type StageProps, type StageStyle } from './Stage.tsx';
import type { SelectionStore } from './select/store.ts';
import { loadAssets, type SceneAssets } from './three/assets.ts';

/** Layers the home stage shows by default at M-A. */
export const HOUSE_STAGE_LAYERS: readonly string[] = ['heat-flow', 'zone-tint'];
/** Where WP-11 serves the asset manifest (BLACKBOARD Interfaces, WP-11). */
export const DEFAULT_ASSETS_BASE = '/app/assets/';

export interface HouseStageProps {
  twin: HomeTwin;
  /** Explicit scene quantities. Otherwise from `result.graph`, else from the twin. */
  quantities?: SceneQuantities;
  /** `washi` (day), `yoru` (night) or `svg` (no WebGL, cheapest). Default `washi`. */
  style?: StageStyle;
  result?: SearchResult | null;
  condition?: SceneCondition;
  /** Active layer ids; default `HOUSE_STAGE_LAYERS`. Pass `[]` for a bare house. */
  layers?: readonly string[];
  /** Pencil underdrawing over the stage (while the engine computes). */
  pencil?: boolean;
  reducedMotion?: boolean;
  tierCap?: QualityTier;
  llmGenerating?: boolean;
  store?: SelectionStore;
  /** Show the `a11y-scene` outline (it is always in the DOM for screen readers). */
  showOutline?: boolean;
  /** Asset base URL ending in `/`, or `null` to stay procedural (tests, offline first paint). */
  assetsBase?: string | null;
  className?: string;
  /** Escape hatch: any other `Stage` prop, applied last. */
  stage?: Partial<StageProps>;
}

const assetCache = new Map<string, Promise<SceneAssets | null>>();

/** Fetch the manifest once per base URL; failures resolve to `null` (procedural materials). */
export function sharedAssets(base: string): Promise<SceneAssets | null> {
  let p = assetCache.get(base);
  if (!p) {
    p = loadAssets(base).catch(() => null);
    assetCache.set(base, p);
  }
  return p;
}

/** Resolve `HouseStage` props to `Stage` props (pure; the component adds the loaded assets). */
export function houseStageProps(p: HouseStageProps, assets: SceneAssets | null): StageProps {
  const out: StageProps = {
    twin: p.twin,
    result: p.result ?? null,
    style: p.style ?? 'washi',
    layers: p.layers ?? HOUSE_STAGE_LAYERS,
    view: 'cutaway',
    pencil: p.pencil ?? false,
    llmGenerating: p.llmGenerating ?? false,
    showOutline: p.showOutline ?? false,
    assets,
    ...(p.quantities ? { quantities: p.quantities } : {}),
    ...(p.condition ? { condition: p.condition } : {}),
    ...(p.reducedMotion !== undefined ? { reducedMotion: p.reducedMotion } : {}),
    ...(p.tierCap !== undefined ? { tierCap: p.tierCap } : {}),
    ...(p.store ? { store: p.store } : {}),
    ...(p.className ? { className: p.className } : {}),
  };
  return { ...out, ...p.stage };
}

export function HouseStage(props: HouseStageProps) {
  const style = props.style ?? 'washi';
  const base = props.assetsBase === undefined ? DEFAULT_ASSETS_BASE : props.assetsBase;
  const [assets, setAssets] = useState<SceneAssets | null>(null);
  // The SVG stage draws flat fills: it never needs the textures.
  const wantAssets = base !== null && style !== 'svg';
  useEffect(() => {
    if (!wantAssets || base === null || typeof fetch === 'undefined') return;
    let live = true;
    sharedAssets(base).then((a) => {
      if (live) setAssets(a);
    });
    return () => {
      live = false;
    };
  }, [base, wantAssets]);
  // Drop textures loaded earlier if the caller has since asked for a procedural or SVG stage.
  return <Stage {...houseStageProps(props, wantAssets ? assets : null)} />;
}
