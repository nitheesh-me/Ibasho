import type { TypeLibrary } from '@ibasho/core';
import { BUILDING_TYPES_IN } from './building-types.ts';
import { SCHEDULES } from './schedules.ts';
import { SPACE_TYPES } from './space-types.ts';

/** The Indian type library (space types, schedules, building types) for the energy model. */
export const typesInLibrary: TypeLibrary = {
  spaceTypes: SPACE_TYPES,
  schedules: SCHEDULES,
  buildingTypes: BUILDING_TYPES_IN,
};
