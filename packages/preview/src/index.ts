/**
 * `@ibasho/preview`: Preview stage providers and job runner (ARCH 15.5, WP-13). Layer L1.
 * Every output is shaped exactly like the real stage's and stamped Preview (R26).
 */
import type { IbashoModule } from '@ibasho/core';
import { PREVIEW_PROVIDERS } from './providers.ts';

export {
  climateOf,
  computeCodes,
  computeEnergy,
  computeGeometry,
  computeOptimise,
  computeSite,
  DEFAULT_PLACE,
  moneyOf,
  providerId,
  stampFor,
} from './compute.ts';
export { CLIMATES, type MonthlyClimate } from './model/climate.gen.ts';
export { LEVERS } from './model/optimise.ts';
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
