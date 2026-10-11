import type { IbashoModule } from '@ibasho/core';
import { cityLondon } from './plugin.ts';

/** Engine module for the manifest: registers the `city-pack` plugin (data only). */
export const cityLondonEngineModule: IbashoModule = {
  id: 'pack-city-london/engine',
  load: () => [cityLondon],
};
export default cityLondonEngineModule;
