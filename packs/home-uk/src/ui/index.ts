/**
 * UI half of pack `home-uk`: measure presentation (`measure-ui`, mon and fold for every measure
 * id) and archetype thumbnails. Owner: WP-07. Layer L3.
 */
export {
  HOME_UK_MEASURE_UI,
  HOME_UK_MON_IDS,
  MEASURE_PRESENTATION,
  measureUiId,
} from './measures.ts';
export { default as homeUkUiModule } from './module.ts';
export {
  ARCHETYPE_FORMS,
  ARCHETYPE_LABEL,
  ArchetypeThumb,
  type ArchetypeThumbProps,
  THUMB_H,
  THUMB_W,
  type ThumbDrawing,
  type ThumbStroke,
  thumbnailDrawing,
} from './thumbnails.tsx';
