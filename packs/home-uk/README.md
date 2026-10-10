# @ibasho/pack-home-uk

RdSAP 10 constructions, K1 junctions, archetypes, systems and measure models (engine); measure presentation and archetype thumbnails (ui).

- **Owner:** WP-01 (package files, `src/ids.ts`, `src/engine/**`); WP-07 (`src/ui/**`). Skeleton created by WP-00 at G0.
- **Layer:** engine half L1 (L0 only, no react/three/DOM, no `Math.*`); ui half L3 (L0, ui, engine result types). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

`./engine` exports an `IbashoModule` (default export allowed only there), `./ui` likewise; `./ids` exports the frozen measure and option ids.

`./engine` exports:
- `homeUkEngineModule`, the `IbashoModule`;
- `M0_MEASURES`: `ashpMeasure`, `draughtMeasure`, `loftMeasure`, the `MeasureModel`s with `apply` and `facts`;
- `UK_SYSTEMS`: `gasCombiCondensing` (efficiency 0.84) and `ashpSystem` (fixed SPF 2.65).

## Status

- **Done at M-0** (engine):
  - `loft`: 270 mm gives U 0.16, 300 mm gives U 0.14 (RdSAP 10 Table 16).
  - `draught`: f_dp = 1, and open chimneys are blocked.
  - `ashp`: fixed COPs, space 2.65 or 3.1 and DHW 2.75. A combi becomes a cylinder, which changes the heavy key.
  - Two systems.
- **Tests:** `test/gh1.test.ts` runs GH1 end to end through the engine pipeline: plausibility, measure directions, the light path equalling the full run bit for bit on all 18 M-0 packages in 3 modes, and hash and evidence. `test/bills.test.ts` keeps the bill fixtures valid.
- **Local adapter:** the engine half restates measure id, group, weight and kind as literals rather than importing `src/ids.ts`, because the layer rule `l1-imports-l0-only` blocks that import. A test checks them against `ids.ts`. The INTERFACES request is on the blackboard.
- **Not yet built (M-A):** RdSAP 10 constructions, K1 junctions, archetypes with `seed()`, the other nine measure groups, sub-measure models (cylinder, hob), `junctionEffects`, and EN 14825 bin SCOP.

Commands: `pnpm --filter @ibasho/pack-home-uk typecheck`, `pnpm --filter @ibasho/pack-home-uk test`.
