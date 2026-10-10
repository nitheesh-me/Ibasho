/**
 * Engine half of pack `rules-uk`. Owner: WP-03.
 * M-0: one Kleene rule (`UK.DNO.HP.LOOPED`). Full SPEC 9 pack at M-B.
 */
export { default as rulesUkEngineModule } from './module.ts';
export { RULES_UK_ID, rulesUk } from './rule-pack.ts';
export { DNO_RULES, UK_DNO_HP_LOOPED } from './rules/dno.ts';
