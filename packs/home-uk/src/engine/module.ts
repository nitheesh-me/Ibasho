/**
 * Engine module of pack `home-uk` (ARCH 4.1). Owner: WP-01.
 * M-0: the three measure groups of the walking skeleton (loft, draught, ASHP) and two systems.
 */
import type { IbashoModule } from '@ibasho/core';
import { ashpMeasure } from './measures/ashp.ts';
import { draughtMeasure } from './measures/draught.ts';
import { loftMeasure } from './measures/loft.ts';
import { UK_SYSTEMS } from './systems.ts';

const homeUkEngineModule: IbashoModule = {
  id: 'pack-home-uk/engine',
  load: () => [loftMeasure, draughtMeasure, ashpMeasure, ...UK_SYSTEMS],
};

export default homeUkEngineModule;
