# @ibasho/preview

Preview stage providers for the seven studio stages (ARCH 15.5, SPEC 19, R26).

- **Owner:** WP-13. **Layer:** L1 (L0, plus `@ibasho/plan` for the geometry stage and its replay data in `packages/fixtures/src/{preview,buildings}`).
- Every output has the real stage's shape; every evidence node has `provenance.kind = 'preview'` and seal `preview`; every result stamp has `impl: 'preview'`.

## Public API

- `PREVIEW_PROVIDERS` (seven `StageProvider`s, ids `preview.<stage>`), `previewEngineModule` (an `IbashoModule` for the manifest), and each provider by name.
- `runPreviewJob(req, { doc, place?, tiles?, settings?, goals?, objectives?, previous? }, onEvent, { deviceFactor?, signal?, providers? })` returns `{ end, outputs }`.
- `createPreviewStudio({ deviceFactor? })` gives `runJob(req, inputs, onEvent, onEnd?)` and `cancel(jobId)`; a newer generation for the same building cancels the older job (H9). Run it in the engine worker.
- `PreviewAbort`, `setPreviewTimer` (tests), `RESOLUTIONS`, `STAGE_MS`, `stageMs`.
- Design levers: `JobInputs.energyParams` (`EnergyParams` from core, read as `StageIn.energy.params`), presets `PARAM_PRESETS` and `pvKwpFor`.
- `PREVIEW_SETTING_DEFS` (tariff, demand charge, grid factor, cool set point, resolution, render quality; each with unit, source and `affects`), `settingNumber`.
- `compute*` functions per stage and `stampFor`, `climateOf`, `moneyOf`.

Events: each stage emits fraction 0, progress every 250 ms, a rough partial at 25% of its recorded time, refined at 60%, final at 100%. Rough energy has only the big end uses and `eui.partial = true`. Cancel answers within one 40 ms slice.

## Model (plain and labelled Preview)

Monthly climate from the Hyderabad TMYx EPW (`scripts/gen-climate.ts`); loads per space type; conduction, ventilation, solar and roof gains; COP per system; obstruction from city tiles with a per-blocker shading ledger; T0 daylight from glazing ratios; exact bills (HT energy plus demand, LT-I slabs per flat, UK unit plus standing); code pre-checks and a rating ladder against a standard-design baseline; exhaustive optimiser over eight levers (256 options) with front, witnesses, picks, screening and an overhang sweep. Recorded fixtures: `pnpm --filter @ibasho/preview gen:preview` writes `packages/fixtures/src/preview/<id>/<stage>.json` and `timings.json`; tests recompute them byte for byte. Providers recompute rather than ship the JSON, which is what lets edited buildings respond.

Commands: `pnpm --filter @ibasho/preview typecheck`, `pnpm --filter @ibasho/preview test`.

## Design before you build and canonical bills

- `headlineBill(result)`: the one bill every screen should show (see `src/bill.ts` for what changes it).
- `DEFAULT_DEVICE_FACTOR` (0.1): fast replay by default; compiled geometry and the energy model are cached.
- Codes follow the plot: `codePacksFor` picks `codes-in` or `codes-uk`; English new builds get Part L 2021, Future Homes Standard, Part O and London Plan pre-checks (`src/model/codes-uk.ts`).
- Goals: `JobInputs.goals` gives `CodesOut.gaps`; `goalGaps(goals, inputs)` after the optimiser; presets in `GOAL_PRESETS` (core).
- Placement: `placementChange(prev, next)` and `stagesForPlacementChange(kind)`; a move reuses the compiled geometry.
