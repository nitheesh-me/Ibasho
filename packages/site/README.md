# @ibasho/site

The real site analysis stages: sun and shadows, radiation and daylight (SD, SPEC R29 to R31, ARCH 15.5). Same contract as the Preview stages, `impl: 'real'`.

- **Owner:** WP-16. **Layer:** L1 (imports `@ibasho/core` only; no DOM, no React). Deterministic: no `Math` transcendentals, a deterministic BVH, fixed iteration orders.

## Public API

- `SITE_PROVIDERS` (`siteSun`, `siteRadiation`, `siteDaylight`): `StageProvider`s with ids `site.<stage>`, rough, refined and final results, progress and cancel (`SiteCancelled`). Run them in the engine worker.
- `computeSite(stage, input, tier, asOf)`: the same signature as `@ibasho/preview`'s `computeSite`, synchronous.
- Pieces: `spa`, `julianDay`, `sunGeocentric`, `sunTopocentric` (NREL SPA); `weatherFor`, `parseEpw`, `decodeWeather`, `SHIPPED_WEATHER`; `skyPatches`, `skyVector`, `perezParams`, `efficacy`; `solarYear`, `sunBins`, `skyYear`; `Bvh`, `buildScene`, `surfaceSensors`; `surfaceJob`, `drain`, `ledgerCloses`; `daylightJob`, `angularTransmittance`; `groundSunHours` (one day on a ground grid, not in `SiteResult` yet); `atan`, `atan2`, `asin`, `acos`.

## Swapping Preview for real (one line)

- With the `StageProvider` runner (`@ibasho/preview` `runPreviewJob` or `createPreviewStudio`): pass `providers: [...PREVIEW_PROVIDERS.filter((p) => !['sun', 'radiation', 'daylight'].includes(p.stage)), ...SITE_PROVIDERS]`.
- With the web studio runner (`apps/web/src/studio/preview/runner.ts`): import `computeSite` from `@ibasho/site` instead of `@ibasho/preview` for the three site stages. It must run in the studio worker (a final stage takes seconds).
- `@ibasho/site` must be a dependency of the app (install window).

## Method

| Step | Method | Source |
|---|---|---|
| Sun position | NREL SPA, full port on deterministic maths, hour centres, Delta T 69 s | Reda and Andreas 2008 |
| Weather | Hyderabad TMYx 2011 to 2025 EPW (with its illuminance columns); London PVGIS TMY (DNI from GHI and DHI, dew point from RH); or a parsed EPW on `SiteContext.epw` | Climate.OneBuilding, JRC |
| Sky | Perez 1993 all-weather sky per hour, normalised to DHI, summed per month over Tregenza 145 patches (Reinhart 577 at Fine) | Perez 1993, Robinson and Stone 2004 |
| Sun | 12 x 24 sun bins: DNI-weighted vector sum (exact cosine total) and mean direction for the ray | |
| Kernel | Binned SAH BVH, Moller-Trumbore, float64; hero mesh plus context walls to `height.likely` inside the radius; unknown heights left out and listed; a neighbour the hero overlaps is treated as replaced | Wald 2007, PBRT |
| Surfaces | Sensors at the resolution grid (rough x4, refined x2), 5 cm proud; SVF, sunshine hours (DNI 120 W/m2 and over, visible, in front), monthly irradiation with and without context, ground reflection albedo x GHI x (1 - nz) / 2 | |
| Ledger | Each ray's annual Wh rounded once, then booked to received or to the first building hit; closes exactly per receiver (`ledgerCloses`); self shading is booked to the building's own id | SD 5.1, AC-LK3 |
| Daylight (T1) | Work plane 0.8 m; sky daylight coefficients through window apertures (S x S samples per patch), hourly direct sun, split-flux inter-reflection, LM-83 blinds (over 2% of sensors above 1,000 lux direct: sun off, rest x 0.2); ASE1000,250 direct only; ECBC UDI 100 to 2,000 lux for 90% of 09:00 to 17:00; views: a ray through glazing running 7.5 m or more | LM-83, BRE split flux, ECBC 4.2.3, LEED v5 |

Labels: radiation and sun hours are `method: 'T0'`, daylight `T1`; sDA must be shown as "sDA (simplified)" until measured (R31). Ranges: sDA and the ECBC share plus or minus 12 points (SD 1.6 says 10 to 15 until measured), ASE plus or minus 3, views plus or minus 5, widened across sampled storeys.

## Accuracy (measured here)

| Check | Result |
|---|---|
| SPA golden vector (SD V1, AC-LK1) | zenith 50.111622, azimuth 194.340241 (paper 50.11162, 194.34024), within 1e-5 degrees |
| Inverse trig vs platform | max error 4.4e-16 |
| Isolated box roof vs weather file GHI | Hyderabad 1,894 vs 1,907 kWh/m2 (-0.7%); London 1,016 vs 1,017 (-0.1%) |
| Box walls, Hyderabad, kWh/m2.yr | S 1,071, E 1,052, W 978, N 498; north wall sun only May to July |
| Box walls, London | S 873, E 613, W 688, N 347 |
| Wall SVF, roof SVF | 0.50 and 1.00 (within 0.01) |
| Canyon SVF, H/W = 1 (SD V5) | within 0.03 (145 patches), 0.015 (577, 2,305) of 1/sqrt(5) |
| Cube shadow hours, 21 December (SD V6) | at least 99% of 1 m cells equal an analytic box test |
| BVH vs brute force | identical nearest hits on 2,000 random rays |
| Ledger identity (AC-LK3) | exact for every receiver on the box, courtyard, neighbour and Vindhya cases |

Not yet measured (open): Radiance or Ladybug comparison (SD V4), sDA and ASE against the reference rooms (SD V9, AC-LK4), CPU vs GPU (V7), Node vs Chromium determinism run.

## Real versus Preview (Standard resolution)

From `pnpm --filter @ibasho/site gen:compare gb1 gb2 gh1` (JSON in `packages/fixtures/src/site/compare-<id>.json`).

| Vindhya Bhavan (gb1) | Real | Preview |
|---|---|---|
| Wall irradiation, mean, kWh/m2.yr | 707 | 895 |
| Window irradiation | 743 | 890 |
| Roof irradiation | 1,881 | 1,680 |
| Sun hours per year, mean surface | 1,714 | 1,885 |
| Sky view factor, mean surface | 0.435 | 0.527 |
| Ledger rows / lost MWh.yr | 370 / 2,447 | 543 / 762 |
| sDA %, mean room | 19.5 | 17.5 |
| ASE %, mean room | 9.5 | 3.7 |

Himalaya (gb2): walls 734 vs 923, roofs 1,862 vs 1,699, SVF 0.40 vs 0.53, sDA 33 vs 39, ASE 15 vs 7. London terrace (gh1): walls 609 vs 559, roof 1,014 vs 926, sun hours 953 vs 1,627. The Preview's roofs miss diffuse detail and its walls under-count the four courtyards and the wings shading each other; the real ledger is larger because it books self shading and diffuse sky loss, not only beam.

## Runtime (Node 26, one core, CPU cap; ms, rough / refined / final)

| Building | Sun (radiation reuses it) | Daylight |
|---|---|---|
| Vindhya gb1 (265 surfaces, 46 rooms) | 403 / 784 / 2,946 | 306 / 2,478 / 6,998 |
| Himalaya gb2 (211 surfaces, 85 rooms) | 206 / 649 / 2,341 | 492 / 3,466 / 10,493 |
| London terrace gh1 | 148 / 4 / 15 | 22 / 60 / 124 |

The first rough result is under 0.6 s for every golden building (AC-PG2 asks for 2 s).

## PLACEHOLDER and open items

- Room outlines: the compiled building has none for middle storeys, so daylight rooms are strips behind windowed walls sized to the room's floor area (requested `SurfaceSet.rooms`).
- `@ibasho/dmath` is now a dependency and supplies `atan`, `atan2`, `asin`, `acos`; `exp`, `log`, `sin`, `cos` are still local copies in `src/dmath` and can switch to it the same way. three-mesh-bvh is not imported (no install); the kernel is behind `Bvh.cast`, so it can swap.
- Not modelled: trees, terrain, inter-building reflections (flag "reflected sun not included"), glare (DGP).
- `parseEpw` checks its input itself until `EpwSchema` exists in `@ibasho/core/schemas`.

Commands: `pnpm --filter @ibasho/site typecheck`, `pnpm --filter @ibasho/site test` (34 tests, about 7 s), `gen:weather`, `gen:compare`.
