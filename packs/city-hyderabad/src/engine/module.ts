import type { IbashoModule } from '@ibasho/core';
import { cityHyderabad } from './plugin.ts';
import { cityHyderabadRaidurg } from './raidurg/area.ts';

/** Engine module for the manifest: registers the `city-pack` plugins (data only; tiles are fetched only on request). */
export const cityHyderabadEngineModule: IbashoModule = {
  id: 'pack-city-hyderabad/engine',
  load: () => [cityHyderabad, cityHyderabadRaidurg],
};
export default cityHyderabadEngineModule;
