import type { IbashoModule } from '@ibasho/core';
import { BUILDING_TYPES_IN } from './building-types.ts';
import { SCHEDULES } from './schedules.ts';
import { SPACE_TYPES } from './space-types.ts';

/** Registers the Indian space types, schedules and building types (data only). */
export const typesInEngineModule: IbashoModule = {
  id: 'pack-types-in/engine',
  load: () => [...SCHEDULES, ...SPACE_TYPES, ...BUILDING_TYPES_IN],
};
export default typesInEngineModule;
