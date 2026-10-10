/**
 * Engine module of pack `money-uk` (ARCH 4.1). Owner: WP-02.
 * M-0: Ofgem cap Q4 2026 tariffs, SAP 10.2 monthly carbon, a flat lifetime trajectory, the M-0
 * measure costs, BUS and the owner-occupier value table.
 */
import type { IbashoModule } from '@ibasho/core';
import { carbonSap102, carbonTrajectoryFlat } from './carbon.ts';
import { UK_MEASURE_COSTS } from './costs/index.ts';
import { UK_GRANTS } from './grants.ts';
import { UK_TARIFFS } from './tariffs.ts';
import { valueUkOwnerOccupierV1 } from './value.ts';

const moneyUkEngineModule: IbashoModule = {
  id: 'pack-money-uk/engine',
  load: () => [
    ...UK_TARIFFS,
    carbonSap102,
    carbonTrajectoryFlat,
    ...UK_MEASURE_COSTS,
    ...UK_GRANTS,
    valueUkOwnerOccupierV1,
  ],
};

export default moneyUkEngineModule;
