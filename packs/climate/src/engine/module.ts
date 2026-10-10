/**
 * Engine module of pack `climate` (ARCH 4.1). Owner: WP-01.
 * Six city packs (London with the PVGIS TMY) and the SAP 10.2 Appendix U `rating` climate.
 */
import type { IbashoModule } from '@ibasho/core';
import { CLIMATE_PACKS } from './packs.ts';

const climateEngineModule: IbashoModule = {
  id: 'pack-climate/engine',
  load: () => [...CLIMATE_PACKS],
};

export default climateEngineModule;
