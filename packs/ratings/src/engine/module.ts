import type { IbashoModule } from '@ibasho/core';
import { RATING_SCHEMES } from './schemes.ts';

/** Registers the rating ladders (data only, checked monotone at registration). */
export const ratingsEngineModule: IbashoModule = {
  id: 'pack-ratings/engine',
  load: () => [...RATING_SCHEMES],
};
export default ratingsEngineModule;
