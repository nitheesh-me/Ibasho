/** Shared fixtures for the scene unit tests (WP-07). */
import type { HomeTwin } from '@ibasho/core';
import gh1 from '../../fixtures/src/homes/gh1.twin.json' with { type: 'json' };
import { withFixtureJunctions } from '../src/fixtures/junctions.ts';
import { fromTwin } from '../src/quantities/from-twin.ts';
import { buildHouse } from '../src/twin/house.ts';

export const twin: HomeTwin = withFixtureJunctions(gh1 as unknown as HomeTwin);
export const house = buildHouse(twin);
export const quantities = fromTwin(twin);
