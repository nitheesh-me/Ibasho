/**
 * The real energy stage provider (`real.energy`) with the merged type library (Indian types plus
 * the UK dwelling and office types), packaged as an engine module so the app registers it like any
 * pack. Swap in `apps/web/src/manifest.ts`: `energy: 'real.energy'`.
 */
import type { IbashoModule, StageProvider } from '@ibasho/core';
import { mergeTypeLibraries } from '@ibasho/core';
import { createRealEnergyProvider } from '@ibasho/engine';
import { typesGlobalLibrary } from '@ibasho/pack-types-global/engine';
import { typesInLibrary } from './library.ts';

/** The real energy provider over every shipped type pack. */
export const realEnergyProvider: StageProvider<'energy'> = createRealEnergyProvider(
  mergeTypeLibraries(typesInLibrary, typesGlobalLibrary),
);

export const realEnergyEngineModule: IbashoModule = {
  id: 'pack-types-in/real-energy',
  load: () => [realEnergyProvider],
};
