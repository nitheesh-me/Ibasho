/**
 * Rules evaluator (ARCH 5.4). Owner: WP-03. WP-02 imports from here (or re-exports via src/index.ts).
 * Kleene `Expr` evaluator, fact builders (home, owner, package, derived), built-ins, evaluation and
 * status, the named functions with the noise fast path, obligations, the sentence renderer and the
 * rule lint.
 */
export {
  BUDGET_RULE,
  BUILTIN_RULES,
  CONFLICT_GLAZING_RULE,
  CONFLICT_WALL_RULE,
  PREREQ_BATTERY_RULE,
  TENURE_LEASE_RULE,
  TENURE_TENANT_RULE,
} from './builtins.ts';
export {
  type AdfClass,
  adfClassOf,
  adfClassOfMeasureId,
  type DerivableOption,
  derivePackageFacts,
  G98_W_PER_PHASE,
  kindOfMeasureId,
} from './derive.ts';
export {
  activeRules,
  evaluateRules,
  isInForce,
  packageEnv,
  packageFacts,
  type RuleCtx,
  type RuleOption,
  type RuleOutcome,
  type RulesEvaluation,
} from './evaluate.ts';
export {
  evalExpr,
  type FactEnv,
  type FactValue,
  type FnTable,
  type NamedFnImpl,
  RuleError,
  unknownFacts,
} from './expr.ts';
export { ART4_CODES, homeFacts, moneyFact, ownerFacts } from './facts.ts';
export * from './fns/index.ts';
export { lintRules, type RuleLintIssue } from './lint.ts';
export { normaliseObligations, obligationPatch } from './obligations.ts';
export { FACT_LABELS, type FactLabel, renderEffect, renderExpr, renderRule } from './render.ts';
