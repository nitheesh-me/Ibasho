/**
 * Engine half of pack `rules-uk`. Owner: WP-03.
 * The SPEC 9 rule set: permitted development, Building Regulations, DNO, schemes, `APPL.*`, nations.
 */
export { OPTION_FACTS } from './facts.ts';
export { default as rulesUkEngineModule } from './module.ts';
export { RULES_UK, RULES_UK_ID, rulesUk } from './rule-pack.ts';
export * from './rules/appl.ts';
export * from './rules/br.ts';
export * from './rules/dno.ts';
export * from './rules/nations.ts';
export * from './rules/pd.ts';
export * from './rules/schemes.ts';
