/**
 * Engine module of pack `home-uk` (ARCH 4.1). Owner: WP-01.
 * Every SPEC 9 measure model, the UK systems and the maintenance decay models (SPEC 14).
 */
import type { IbashoModule } from '@ibasho/core';
import { UK_MAINTENANCE } from './maintenance/index.ts';
import { UK_MEASURES } from './measures/index.ts';
import { UK_SYSTEMS } from './systems.ts';

const homeUkEngineModule: IbashoModule = {
  id: 'pack-home-uk/engine',
  load: () => [...UK_MEASURES, ...UK_SYSTEMS, ...UK_MAINTENANCE],
};

export default homeUkEngineModule;
