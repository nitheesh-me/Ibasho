/**
 * `@ibasho/preview`: Preview stage providers and job runner (ARCH 15.5, WP-13). Layer L1.
 * Every output is shaped exactly like the real stage's and stamped Preview (R26).
 */
import type { IbashoModule } from '@ibasho/core';
import { PREVIEW_PROVIDERS } from './providers.ts';

export { type HeadlineBill, headlineBill } from './bill.ts';
export {
  climateOf,
  codePacksFor,
  computeCodes,
  computeEnergy,
  computeGeometry,
  computeOptimise,
  computeSite,
  DEFAULT_PLACE,
  FHS_NOTIONAL,
  moneyOf,
  type PlacementChange,
  placementChange,
  providerId,
  stagesForPlacementChange,
  stampFor,
  UK_NOTIONAL_DWELLING,
  UK_NOTIONAL_NONDOM,
} from './compute.ts';
export { CLIMATES, type MonthlyClimate } from './model/climate.gen.ts';
export { inCentralLondon, inGreaterLondon, isNewBuildUk } from './model/codes-uk.ts';
export type { EnergyParams } from './model/energy.ts';
export { type GapInputs, goalGap, goalGaps } from './model/gaps.ts';
export { LEVERS } from './model/optimise.ts';
export { PARAM_PRESETS, pvKwpFor } from './model/params.ts';
export { SPACE_LOADS } from './model/space-types.ts';
export {
  PREVIEW_PROVIDERS,
  PreviewCancelled,
  previewCodes,
  previewDaylight,
  previewEnergy,
  previewGeometry,
  previewOptimise,
  previewRadiation,
  previewSun,
  setPreviewTimer,
} from './providers.ts';
export {
  createPreviewStudio,
  DEFAULT_DEVICE_FACTOR,
  type JobInputs,
  type JobOutcome,
  PreviewAbort,
  RESOLUTIONS,
  type RunOptions,
  runPreviewJob,
} from './run.ts';
export { PREVIEW_SETTING_DEFS, settingNumber } from './settings.ts';
export { STAGE_MS, stageMs } from './timings.ts';

/** Engine module for the manifest: registers the seven Preview `stage-provider` plugins. */
export const previewEngineModule: IbashoModule = { id: 'preview/engine', load: () => [...PREVIEW_PROVIDERS] };
