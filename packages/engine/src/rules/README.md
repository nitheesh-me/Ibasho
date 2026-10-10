# engine/src/rules

Rules evaluator, named functions and noise (ARCH 5.4, RP 3 and 6, SPEC R22, SPEC 9). Owner: WP-03. Import from `./index.ts` (re-exported by `@ibasho/engine`).

## Evaluation

- `evalExpr(expr, env, fns?)`: three-valued (Kleene) evaluation. Missing or `'unknown'` facts are unknown; booleans compare as 1 and 0; strings allow `=` and `!=` only (else `RuleError`); a named function absent from `fns` is unknown.
- `unknownFacts(expr, env)`: the facts that make a condition unknown.
- `activeRules`, `isInForce`: jurisdiction (region containment, `CITY` behind a flag) and the inclusive `asOf` date filter.
- `evaluateRules(rules, ctx)`: built-ins plus pack rules to `{ feasibility, outcomes }`. Status: `blocked` if a block is true (or a needed check is recorded `fail`); `needs-check` if a block is unknown or a check is needed and not recorded; else `feasible`. `consent`, `oblige`, `warn` apply when true or unknown. Uses `DEFAULT_FNS` unless `ctx.fns` is given.
- Environments: measure rules see `h.*`, `o.*`, `k.*` and the option's `m.*`; package rules see `h.*`, `o.*`, `k.*`, the derived `p.*` facts and then `ctx.pkg` (caller wins). `packageEnv(ctx)` returns that environment.

## Facts

- `homeFacts(twin)`: the RP 4 table, including `h.wall.u`, `h.wall.solidMasonry`/`h.wall.traditional`, `h.art4.<code>` (codes `P1.A`, `P14.A`, `P14.G` and so on), `h.dhw.class`, `h.vent.ap50`, `h.floor.type`, `h.glazing.swToFloor`, `h.envelope.areaM2`, `h.past.adf.*`, `h.epc.*`, `h.value.gbp`. See the header of `facts.ts`.
- `ownerFacts(owner)`, `packageFacts({ optionIds, capex?, fundedPas2035? })`.
- `derivePackageFacts(options, home)`: `p.kind.<kind>`, `p.adf.major`/`minor`/`now`, `p.vent.provided`, `p.airtighter`, `p.export.W`, `p.export.limitW` (3,680 W per phase), `p.envelope.share`, `p.funded.pas2035`.
- `K_FACTS`: constants for named-function arguments (`k.adf.B`, `k.ens.retv.max`, ...).

## Named functions (`fns/`)

- `mcs020a_Lp_le` (`noise.ts`): MCS 020 a) by rational enclosure, a line-for-line mirror of Lean `Ibasho.Spec.V2.Noise`. Argument: the `m.ashp.noise` fact string (`encodeNoiseSites`).
- `adf_category` (`adf.ts`): AD F Diagram 3.1, mirror of Lean `adfCategory`; named form `(major, minor, rank)` is "at least rank".
- `mees_cap` (`mees.ts`): `(spendMp, valueGbp)`, within the PRS cap. `dt_hosting` (`dt.ts`): `(existingKw, addKw, ratedKva)`. `ens_retv` (`ens.ts`): `(climate, envelopeM2, opaque, glazingU, glazingSolar, limit)`. All exact (bigint rationals).
- `noise({ twin, units })` (`noise-site.ts`): the `EngineApi.noise` fast path from site geometry (positions from `site.neighbours`, reflecting surfaces, barriers from `site.boundaries`); `noiseFact(twin, units)` gives the `m.ashp.noise` fact for measure models.

## Built-ins, obligations, sentences, lint

- `BUILTIN_RULES`: `BUILTIN.BUDGET`, `BUILTIN.TENURE.TENANT`, `BUILTIN.TENURE.LEASE`, `BUILTIN.PREREQ.BATTERY-PV`, `BUILTIN.CONFLICT.EWI-IWI`, `BUILTIN.CONFLICT.GLAZING`. Memory and target stay in the search (WP-02).
- `normaliseObligations(list)`: strictest per kind, sorted, idempotent. `obligationPatch(twin, list)`: `{ patch, unpatched }`; only tightens, so applying twice equals once.
- `renderExpr`, `renderRule`, `FACT_LABELS`: plain English sentences ("If the electricity supply is looped, a DNO approval is needed first.").
- `lintRules(rules)`: C7 (grade, https source, explain key, unique ids, dates, no named function in `block`/`check` rules, reviewer-memory rules cite DEC).

Tests are colocated (`*.test.ts`) because the engine `test/` folder belongs to WP-02: Kleene and status (C3), named functions (C1 noise golden inside [31.95, 32.05), C4 adf monotone), `noise()` p95 under 5 ms (C6), obligations idempotent (C4), renderer and lint.
