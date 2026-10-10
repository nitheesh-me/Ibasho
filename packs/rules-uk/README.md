# @ibasho/pack-rules-uk

ENG, WLS and SCT stubs, tenure, MEES, DNO, PAS 2035 and applicability (`APPL.*`) rules (SPEC 9, RP 5.1 to 5.4, DEC SC-3, SC-4).

- **Owner:** WP-03.
- **Layer:** engine half L1 (L0 only, no react/three/DOM, no `Math.*`). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

`./engine` exports:

- `rulesUkEngineModule`: the `IbashoModule` (default export of `src/engine/module.ts`), loading one `rule-pack` plugin.
- `rulesUk` (`id: 'rules-uk'`, regions `GB`) and `RULES_UK` (the rule list), plus every rule constant and the per-file lists `PD_RULES`, `BR_RULES`, `DNO_RULES`, `SCHEME_RULES`, `APPL_RULES`, `NATION_RULES`.
- `OPTION_FACTS`: the `m.*` facts the rules read, for measure models (WP-01).

Rules are plain `Rule` data from `@ibasho/core`. Evaluate them with `evaluateRules` from `@ibasho/engine` (built-ins come from there).

## Rules

| File | Rules | Effects |
|---|---|---|
| `rules/pd.ts` | `ENG.PD.ASHP.{NOISE, VOLUME, COUNT, HWY23, LISTED, SCHEDMON, FLATROOF, PITCHED, COOLONLY, BOUNDARY1M, SITING}`, `ENG.PD.ART4.{PV, ASHP, EWI}`, `ENG.PD.PV.{WALL23, FLAT23, PROJ, LISTED}`, `ENG.PD.EWI.{ART23, LOOK, FLAT}`, `ENG.LB.ANY` | consent (LPA, prior approval, LBC); `SITING` info. Never a block. `BOUNDARY1M` retired after 2025-05-28 |
| `rules/br.ts` | `ENG.BR.L.RENOV.{EWI, IWI, ENV}`, `ENG.BR.L.TRAD`, `ENG.BR.L.FLOW55`, `ENG.BR.L.HPSIZE`, `ENG.BR.F.CAT.{B, C}`, `ENG.BR.O.ADVISORY`, `ENG.BR.L.HIST`, `ENG.MOIST.IWI`, `ENG.MOIST.IWI.COST`, `ENG.BR.NOTIFY` | oblige (wall 0.30 with 0.70 as trigger, flow 55, design load, ventilation by `adf_category`, costed moisture assessment), check (moisture), warn, consent (building control) |
| `rules/dno.ts` | `UK.DNO.HP.LOOPED`, `UK.DNO.HP`, `UK.DNO.G98`, `UK.DNO.G99` | check (DNO approval), info (notify), consent (DNO) |
| `rules/schemes.ts` | `UK.PAS2035`, `UK.BUS`, `EW.MEES.NOW`, `EW.MEES.CAP` | oblige (costed PAS 2035 assessment), info, warn |
| `rules/appl.ts` | `APPL.CYLINDER-JACKET.COMBI`, `APPL.SOLAR-THERMAL.COMBI`, `APPL.MVHR.AP50`, `APPL.LOFT.ACCESS`, `APPL.FLOOR.SUSPENDED` | block (unknown gives needs-check) |
| `rules/nations.ts` | `SCT.STUB`, `WLS.STUB` | warn: not encoded in T1 |

Grades: primary where the legal text was read (GPDO, SI 2025/560, MCS 020 a), AD L, AD F, PRS Regs), secondary for rules from council guidance or reviewer memory (these cite their DEC row), announced for the 2026 MEES cap.

Unknown option facts are read at their worst case: until measure models emit the `OPTION_FACTS`, a heat pump on GH1 lists the noise, volume and count consents. That is honest, not a bug.

PLACEHOLDER: Wales and Scotland are warning stubs (T1 encodes England). `rules-in` is a stub until T3.

Tests: `test/rules-uk.test.ts`: one golden per rule and built-in (fires and quiet), the SPEC 9 acceptance cases (C2), the boundary rule retirement (C5), the rule lint and renderer over the whole pack (C7), and GH1 through the M-0 measure models.

Commands: `pnpm --filter @ibasho/pack-rules-uk typecheck`, `pnpm --filter @ibasho/pack-rules-uk test`.
