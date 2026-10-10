# @ibasho/pack-rules-uk

ENG, WLS, SCT stub, tenure, MEES, DNO, PAS 2035, applicability (`APPL.*`) rules.

- **Owner:** WP-03.
- **Layer:** engine half L1 (L0 only, no react/three/DOM, no `Math.*`). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

`./engine` exports:

- `rulesUkEngineModule`: the `IbashoModule` (default export of `src/engine/module.ts`), loading one `rule-pack` plugin.
- `rulesUk`: the `RulePackPlugin` (`id: 'rules-uk'`, regions `GB`).
- `DNO_RULES`, `UK_DNO_HP_LOOPED`: rule data.

Rules are plain `Rule` data from `@ibasho/core`. Evaluate them with `evaluateRules` from `packages/engine/src/rules` (built-ins such as the budget come from there too).

## Status (M-0)

| Rule | Effect | Grade | State |
|---|---|---|---|
| `UK.DNO.HP.LOOPED` | heat pump on a looped supply: `check` `dno-approval` (needs-check until recorded) | secondary (DEC SC-3, reviewer memory) | real |

PLACEHOLDER until M-B: the rest of SPEC 9 (PD, Building Regs, `ENG.MOIST.IWI`, `UK.DNO.G98`/`G99`, `UK.PAS2035`, MEES), `APPL.*`, the noise rule and its named function.

Tests: `test/rules-uk.test.ts` (rule data, registration, GH1 goldens for the DNO rule and the budget built-in).

Commands: `pnpm --filter @ibasho/pack-rules-uk typecheck`, `pnpm --filter @ibasho/pack-rules-uk test`.
