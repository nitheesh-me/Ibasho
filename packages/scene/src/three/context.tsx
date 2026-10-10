/**
 * Scene data shared by the stage, render styles and layers. Owner: WP-07.
 */
import type { HomeTwin, QualityTier, SearchResult } from '@ibasho/core';
import { createContext, useContext } from 'react';
import type { ComposedSurface, ViewSpec } from '../camera/compose.ts';
import type { CameraModel } from '../camera/model.ts';
import type { ScenePalette, Theme } from '../colour/palette.ts';
import type { TierSettings } from '../quality/ladder.ts';
import type { SceneQuantities } from '../quantities/types.ts';
import type { SelectionStore } from '../select/store.ts';
import type { HouseModel } from '../twin/house.ts';
import type { SceneAssets } from './assets.ts';
import type { HouseMaterials } from './materials.ts';

/** three.js layer for overlays drawn over the still-life frame. */
export const OVERLAY_LAYER = 1;

export interface LensState {
  /** Centre in CSS pixels from the canvas top-left. */
  x: number;
  y: number;
  /** Radius in CSS pixels. */
  r: number;
}

export interface SceneData {
  twin: HomeTwin;
  house: HouseModel;
  quantities: SceneQuantities;
  result: SearchResult | null;
  theme: Theme;
  palette: ScenePalette;
  camera: CameraModel;
  view: ViewSpec;
  composed: ComposedSurface[];
  materials: HouseMaterials | null;
  assets: SceneAssets | null;
  store: SelectionStore;
  reducedMotion: boolean;
  tier: QualityTier;
  settings: TierSettings;
  lens: LensState;
  /** Tell the still-life controller the scene graph changed (rebake). */
  invalidateBake(): void;
}

export const SceneDataContext = createContext<SceneData | null>(null);

export function useSceneData(): SceneData {
  const d = useContext(SceneDataContext);
  if (!d) throw new Error('useSceneData outside <Stage>');
  return d;
}
