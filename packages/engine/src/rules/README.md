# engine/src/rules

Kleene rule evaluator (ARCH 5.4, RP 3, SPEC R22). Owner: WP-03. Import from `./index.ts`.

- `evalExpr(expr, env, fns?)`: three-valued evaluation. Missing or `'unknown'` facts are unknown; booleans compare as 1 and 0; strings allow `=` and `!=` only (else `RuleError`); a named function absent from `fns` is unknown.
- `unknownFacts(expr, env)`: the facts that make a condition unknown.
- `homeFacts(twin)`, `ownerFacts(owner)`, `packageFacts({ optionIds, capex? })`: fact environments (`h.*`, `o.*`, `p.*`). Option facts (`m.*`) come from `MeasureModel.facts`.
- `activeRules`, `isInForce`: jurisdiction (region containment, `CITY` behind a flag) and inclusive date filter.
- `evaluateRules(rules, ctx)`: built-ins plus pack rules to `{ feasibility, outcomes }`. Status: `blocked` if any block is true (or a needed check is recorded as failed); `needs-check` if any block is unknown or a check is needed and not recorded; else `feasible`. `outcomes` lists every rule value per subject for the certificate.
- `BUDGET_RULE` (`BUILTIN.BUDGET`): blocks when `p.capex > o.budget`; false when no budget is set (R24); unknown cost with a budget is needs-check.

Tests are colocated (`*.test.ts`) because the engine `test/` folder belongs to WP-02. They include the C3 properties: a definite Kleene result holds under every completion of up to 6 unknown facts, and an unknown block is never feasible.

PLACEHOLDER until M-B: named functions (`mcs020a_Lp_le`, `adf_category`, `ens_retv`, `mees_cap`, `dt_hosting`), the sentence renderer, `noise()`, the other built-ins (tenure, memory, conflicts, prereq, target), obligation application.
