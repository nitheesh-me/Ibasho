# @ibasho/pack-climate

London, Manchester, Edinburgh, Hyderabad, Mumbai, Delhi climate packs, SAP Appendix U for rating mode, London TMY.

- **Owner:** WP-01. Skeleton created by WP-00 at G0.
- **Layer:** engine half L1 (L0 only, no react/three/DOM, no `Math.*`). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

`./engine` exports `climateEngineModule` (an `IbashoModule`), `londonClimate` (`ClimatePack`, id `climate-london`), and the helpers `planeIrradiance` and `verticalIrradiance`.

## Status

- **Done at M-0:** the London pack.
  - Monthly θ_e and irradiation on N, E, S and W vertical planes plus GHI come from the BP 4.3 table.
  - Wind comes from SAP 10.2 Table U2, region 1.
  - The design temperature is -3 °C (CIBSE 99.6%).
  - Planes between the compass points interpolate linearly in azimuth and tilt.
- **ESTIMATE placeholders** (no M-0 stage reads them): `thetaMax`, `thetaMin`, `dhi`, `rh`. The pack is graded `estimate` until they are replaced.
- **Not yet built (M-A):** the Collares-Pereira-Rabl transposition, which replaces linear tilt interpolation (that underestimates tilted PV planes); Manchester, Edinburgh, Hyderabad, Mumbai and Delhi; SAP Appendix U for `rating`; the London TMY.

Commands: `pnpm --filter @ibasho/pack-climate typecheck`, `pnpm --filter @ibasho/pack-climate test`.
