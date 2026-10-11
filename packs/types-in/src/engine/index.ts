/**
 * Indian type pack (WP-18, ARCH 15.3): space types, schedules and the eight building types,
 * pure data plugins with sources. `typesInLibrary` is what the real energy stage reads.
 */
import type { TypeLibrary } from '@ibasho/core';
import { BUILDING_TYPES_IN } from './building-types.ts';
import { SCHEDULES } from './schedules.ts';
import { SPACE_TYPES } from './space-types.ts';

export { BUILDING_TYPES_IN } from './building-types.ts';
export { day, SCHEDULES, scheduleById } from './schedules.ts';
export { PROV as TYPES_IN_PROVENANCE, SRC as TYPES_IN_SOURCES } from './sources.ts';
export { SPACE_TYPES } from './space-types.ts';
export { typesInEngineModule } from './module.ts';

export const typesInLibrary: TypeLibrary = {
  spaceTypes: SPACE_TYPES,
  schedules: SCHEDULES,
  buildingTypes: BUILDING_TYPES_IN,
};
