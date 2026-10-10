/**
 * Engine module of pack `money-uk` (ARCH 4.1). Owner: WP-02.
 * Ofgem cap Q4 2026 tariffs, SAP 10.2 monthly carbon, a flat lifetime trajectory, costs for every
 * SPEC 9 option and the like-for-like boiler, BUS, the loan stub, the EPC rating proxy and the
 * owner-occupier value table.
 */
import type { IbashoModule } from '@ibasho/core';
import { carbonSap102, carbonTrajectoryFlat } from './carbon.ts';
import { UK_MEASURE_COSTS, UK_SYSTEM_COSTS } from './costs/index.ts';
import { epcProxyRating } from './epc-proxy.ts';
import { UK_FINANCE } from './finance.ts';
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
    ...UK_SYSTEM_COSTS,
    ...UK_FINANCE,
    epcProxyRating,
    ...UK_GRANTS,
    valueUkOwnerOccupierV1,
  ],
};

export default moneyUkEngineModule;
