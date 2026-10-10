/**
 * Engine module of pack `rules-uk` (ARCH 4.1). Owner: WP-03.
 */
import type { IbashoModule } from '@ibasho/core';
import { rulesUk } from './rule-pack.ts';

const rulesUkEngineModule: IbashoModule = {
  id: 'pack-rules-uk/engine',
  load: () => [rulesUk],
};

export default rulesUkEngineModule;
