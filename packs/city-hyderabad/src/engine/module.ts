import type { IbashoModule } from '@ibasho/core';
import { cityHyderabad } from './plugin.ts';

/** Engine module for the manifest: registers the `city-pack` plugin (data only). */
export const cityHyderabadEngineModule: IbashoModule = {
  id: 'pack-city-hyderabad/engine',
  load: () => [cityHyderabad],
};
export default cityHyderabadEngineModule;
