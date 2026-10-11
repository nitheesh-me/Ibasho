# @ibasho/pack-green-home

Green Home Score, poor-home detection, retrofit recommendations, per-fuel savings, carbon and an
indicative value range for UK homes (Lloyds Megathon brief, problem statement 2), computed on the
existing Ibasho home physics (SAP 10.2 style monthly heat balance and the home-uk measure models).

- **Owner:** WP-25. **Layer:** engine half L1. Contracts in `@ibasho/core` (`greenhome.ts`).
- **API (`./engine`):** `assessProperty(property, usage, { asOf?, retrofits? })` returns a
  `GhAssessment` (score with seven components, poor flag and issues, improvement potential,
  prioritised feasible retrofits with suitability, per-fuel savings and reason, the whole package,
  carbon, value range, warnings). A what-if is the same call with `retrofits`. Also `scoreProperty`,
  `annualise`, `RETROFIT_CATALOGUE`, `EMISSION_FACTORS`, `runProperty`, `buildTwin`.
- **Score:** weights exactly 1/4, 1/5, 3/20, 3/20, 1/10, 1/10, 1/20; monotone sub-score mappings in
  `src/engine/score.ts` (header); integer sub-scores, exact sum in twentieths, rounded halves up.
- **Savings:** retrofits run in interaction order (fabric, controls, heat pump, solar); each saving
  is what it adds after the chosen ones above it, so the list sums to the package, which is one
  whole-house physics run; negative values are increases. Applied to the metered baseline as ratios.
- **Carbon:** DESNZ 2024 GHG conversion factors, electricity 0.20705 and gas 0.18290 kg CO2e/kWh.
- **Value:** Ibasho value table v1 (EPC band price studies) on the current value estimate; an
  indicative range, never causal or guaranteed.
- **Data:** `scripts/gen-portfolio.ts` (seed 10001, about 3 s) writes the synthetic portfolio to
  `packages/fixtures/src/portfolio/`; `scripts/evaluate.ts` writes the held-out evaluation there.

PLACEHOLDER: a drop-in module matching the app's local `apps/web/src/portfolio/model.ts`
(`portfolio()`, `analyseHome()`) is not written yet; the app swap needs it or an adapter. The
portfolio README (schema, sources, assumptions, label rules, evaluation write-up) is still to come;
`evaluation.md` and `evaluation.json` hold the current metrics.

Commands: `pnpm --filter @ibasho/pack-green-home typecheck`, `pnpm --filter @ibasho/pack-green-home test`.
