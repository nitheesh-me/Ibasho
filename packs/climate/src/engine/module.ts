/**
 * Engine module of pack `climate` (ARCH 4.1). Owner: WP-01.
 * M-0: London only. Manchester, Edinburgh, Hyderabad, Mumbai, Delhi, SAP Appendix U (rating mode)
 * and the London TMY arrive at M-A.
 */
import type { IbashoModule } from '@ibasho/core';
import { londonClimate } from './london.ts';

const climateEngineModule: IbashoModule = {
  id: 'pack-climate/engine',
  load: () => [londonClimate],
};

export default climateEngineModule;
