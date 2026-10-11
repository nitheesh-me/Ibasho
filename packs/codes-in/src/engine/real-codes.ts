/**
 * The real codes stage provider (`real.codes`) with every shipped code and rating pack and the
 * merged type library (for the reference designs on the real energy engine), as an engine module.
 * Swap in `apps/web/src/manifest.ts`: `codes: 'real.codes'`.
 */
import type { IbashoModule, StageProvider } from '@ibasho/core';
import { mergeTypeLibraries } from '@ibasho/core';
import { type CodesCatalogue, createRealCodesProvider } from '@ibasho/engine';
import { ASHRAE_APPG, CODES_UK } from '@ibasho/pack-codes-global/engine';
import { RATING_SCHEMES } from '@ibasho/pack-ratings/engine';
import { typesGlobalLibrary } from '@ibasho/pack-types-global/engine';
import { typesInLibrary } from '@ibasho/pack-types-in/engine';
import { CODES_IN, ECSBC_EDITIONS } from './data.ts';

export const CODES_CATALOGUE: CodesCatalogue = {
  india: CODES_IN,
  indiaEditions: ECSBC_EDITIONS,
  uk: CODES_UK,
  appG: ASHRAE_APPG,
  ratings: RATING_SCHEMES,
};

export const realCodesProvider: StageProvider<'codes'> = createRealCodesProvider(
  CODES_CATALOGUE,
  mergeTypeLibraries(typesInLibrary, typesGlobalLibrary),
);

export const realCodesEngineModule: IbashoModule = {
  id: 'pack-codes-in/real-codes',
  load: () => [realCodesProvider],
};
