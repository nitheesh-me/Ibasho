/**
 * `@ibasho/editor/core`: the editor's pure parts (geometry, checks, commands, room functions),
 * without React or the UI kit, so workers can import them. Owner: WP-15.
 */
export * from './checks.ts';
export * from './geom.ts';
export * from './ops.ts';
export { SHADE_PRESETS_DATA as SHADE_PRESETS } from './presets.ts';
export * from './snap.ts';
export * from './spaces.ts';
