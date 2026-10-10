/**
 * `@ibasho/scene` public API. Owner: WP-07. Layer L3 (ARCH 3).
 */

export {
  buildOutline,
  elementLabel,
  type OutlineGroup,
  type OutlineItem,
  outlineTargets,
} from './a11y/model.ts';
export { SceneOutline, type SceneOutlineProps } from './a11y/SceneOutline.tsx';
export { type ComposedSurface, composeView, type ViewKind, type ViewSpec } from './camera/compose.ts';
export {
  AZIMUTH_STEP,
  type CameraModel,
  cameraBasis,
  DEFAULT_ELEVATION,
  eyeDirection,
  fitCamera,
  orthoFrustum,
  projectOrtho,
  snapAzimuth,
} from './camera/model.ts';
export {
  blendMatrices,
  type CameraKey,
  type CameraSequence,
  ROOF_LIFT,
  reducedSequence,
  sampleSequence,
  sequenceDuration,
} from './camera/sequence.ts';
export {
  NETSU_RANGE,
  netsuGradientCss,
  netsuHex,
  netsuLinear,
  palette,
  type ScenePalette,
  type Theme,
} from './colour/palette.ts';
export { K1_FIXTURE_PSI, withFixtureJunctions } from './fixtures/junctions.ts';
export {
  DEFAULT_ASSETS_BASE,
  HOUSE_STAGE_LAYERS,
  HouseStage,
  type HouseStageProps,
  houseStageProps,
  sharedAssets,
} from './HouseStage.tsx';
export { evidenceForHit, evidenceForTarget } from './layers/evidence.ts';
export { buildMotes, type MoteField, moteCount } from './layers/motes.ts';
export { heatFlowLayer, T1_LAYERS, thermalLensLayer, zoneTintLayer } from './layers/plugins.tsx';
export {
  effectiveTier,
  initialLadder,
  type LadderEvent,
  type LadderState,
  stepLadder,
  TIERS,
  type TierSettings,
} from './quality/ladder.ts';
export { fromGraph, nodeNumber } from './quantities/from-graph.ts';
export { fromTwin, JANUARY_NIGHT, surfaceTemp } from './quantities/from-twin.ts';
export type {
  ElementFlow,
  JunctionFlow,
  LeakPath,
  SceneCondition,
  SceneQuantities,
  ZoneTemp,
} from './quantities/types.ts';
export { WATTS_PER_MOTE } from './quantities/types.ts';
export { Stage, type StageProps, type StageStyle, stageCamera } from './Stage.tsx';
export {
  createSelectionStore,
  type SceneTarget,
  type SelectionStore,
  targetOfHit,
} from './select/store.ts';
export { initialStill, REST_MS, type StillState, tick } from './still-life/machine.ts';
export { bakeRecipe, T1_STYLES, washiStyle, yoruStyle } from './styles/styles.tsx';
export { plinthOf, svgItems } from './svg/project.ts';
export { SvgHouse, type SvgHouseProps } from './svg/SvgHouse.tsx';
export { loadAssets, type SceneAssets } from './three/assets.ts';
export type { StillStats } from './three/StillLife.tsx';
export {
  buildHouse,
  drawnIds,
  type HouseModel,
  type Opening,
  type Room,
  type Surface,
} from './twin/house.ts';
export { layoutProps, type PropItem } from './twin/layout.ts';
