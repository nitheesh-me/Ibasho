# @ibasho/pack-ratings

Rating ladders (WP-19, SPEC 23, R36) as `rating-scheme` step tables with sources: GHMC stars (primary), LEED v4.1 Optimize Energy Performance (cost and GHG tables), LEED v5 Enhanced Energy Efficiency, LEED v4.1 indoor water, IGBC energy, GRIHA energy, EDGE energy, BEE office stars. Estimates of points, never a certification.

- **Owner:** WP-19. **Layer:** engine half L1 (data only).

## Public API (`./engine`)

`RATING_SCHEMES`, each scheme by name (`GHMC_STARS`, `LEED41_COST`, `LEED41_GHG`, `LEED5_EEE`, `LEED41_WE`, `IGBC_ENERGY`, `GRIHA_ENERGY`, `EDGE_ENERGY`, `BEE_STAR_OFFICE`), `ratingsEngineModule` (registers them; the registry checks ascending steps and non-decreasing points).

Savings axis per scheme: GHMC, GRIHA and EDGE read savings against the ECSBC standard design; LEED and IGBC read the improvement below the ASHRAE 90.1 Appendix G target; BEE office stars read headroom below 190 kWh/m²·yr built-up EPI.

Commands: `pnpm --filter @ibasho/pack-ratings typecheck`.
