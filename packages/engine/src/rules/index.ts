/**
 * Rules evaluator (ARCH 5.4). Owner: WP-03. WP-02 imports from here (or re-exports via src/index.ts).
 * M-0: Kleene `Expr` evaluator, fact builders, the budget built-in, evaluation and status.
 * Not yet: named functions (`mcs020a_Lp_le` and the rest), sentence renderer, `noise()` (M-B).
 */
export { BUDGET_RULE, BUILTIN_RULES } from './builtins.ts';
export {
  activeRules,
  evaluateRules,
  isInForce,
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
export { homeFacts, moneyFact, ownerFacts } from './facts.ts';
