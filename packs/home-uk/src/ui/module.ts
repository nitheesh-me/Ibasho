/**
 * UI module of pack `home-uk` (ARCH 4.1): the `measure-ui` plugins. Owner: WP-07.
 * Archetype thumbnails are components, not plugins: import them from `@ibasho/pack-home-uk/ui`.
 */
import type { IbashoModule } from '@ibasho/core';
import { HOME_UK_MEASURE_UI } from './measures.ts';

const homeUkUiModule: IbashoModule = {
  id: 'pack-home-uk/ui',
  load: () => [...HOME_UK_MEASURE_UI],
};

export default homeUkUiModule;
