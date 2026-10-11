# @ibasho/pack-benchmarks

EUI benchmarks for checking modelled results: BEE star bands (India, composite climate), CBECS 2018 site EUI medians (US, a cross check) and CIBSE TM46 typical values (UK), plus Eco Niwas Samhita apartments. Site energy, kWh/m² a year; each value carries its source and grade.

- **Owner:** WP-18. **Layer:** engine half L1 (data only).

## Public API (`./engine`)

`BENCHMARKS` (`BenchmarkPlugin[]`, ids such as `bee-office-composite`, `cbecs-office`, `cbecs-education`, `ens-apartments`, `tm46-dwelling`) and `benchmarksEngineModule`.

## Real energy stage against benchmarks and the Preview model

Hourly model (`packages/engine/src/enduse`), standard settings, mean-day weather, central EUI per conditioned m², 2026-10-11 (`node packages/fixtures/src/energy/compare-energy.ts gb1 gb2 gb3 gb4 gh1`).

| Building | Real EUI (range) | Preview EUI (range) | Benchmark | Run time |
|---|---|---|---|---|
| GB1 Vindhya (labs, data centre) | 182 to 231 | 128 to 177 | CBECS lab 150 to 400; education 95 to 240 | 0.2 s |
| GB2 Himalaya (teaching) | 110 to 140 | 73 to 101 | CBECS education 95 to 240 | 0.13 s |
| GB3 HITEC office | 130 to 166 | 115 to 159 | BEE office 110 to 230 (3 to 4 star); CBECS office 110 to 250 | 0.03 s |
| GB4 Gachibowli flats | 35 to 45 | 27 to 37 | ENS apartments | 0.09 s |
| GH1 London terrace | 125 to 159 | 120 to 165 | TM46 dwelling | 0.02 s |

The real model runs every zone hourly (5R1C), so it sees night cooling of labs and the data centre, latent loads in the monsoon and fan-first homes; the Preview model is monthly. Tests hold each golden building inside its benchmark band and within a factor of two of Preview.

## All eight building types on one generic plate

A 40 x 25 m plate, five floors, rooms in strips by each type's space mix, 30% glazing, Hyderabad weather (`packages/fixtures/src/energy/type-sweep.ts`; run it with `node` to reprint). EUI in kWh/m²·yr on conditioned area.

| Type | Real EUI (range) | Benchmark band |
|---|---|---|
| Office | 125 to 160 | BEE office 110 to 230 |
| Hotel | 124 to 157 | CBECS hotel 142 to 315 |
| Education | 133 to 169 | CBECS education 95 to 237 |
| Hospital | 285 to 363 | BEE hospital 250 to 500 |
| Lab | 196 to 250 | CBECS lab 473 to 1262 (US labs with reheat; not comparable) |
| Apartments | 38 to 48 | ENS apartments 25 to 80 |
| Rental | 38 to 48 | ENS apartments 25 to 80 |
| Single-family | 36 to 45 | ENS apartments 25 to 80 |

Wet labs (`lab-wet`, half the lab type's mix) take their outdoor air from a minimum of 4 to 8 air changes an hour (ANSI/AIHA Z9.5), so labs run well above offices; dry and computer labs (`lab`, as at IIIT) keep ASHRAE 62.1 rates; there is no Indian lab benchmark yet, so the test checks labs against offices rather than CBECS. The sweep test holds every other type inside its band (25% slack).

Commands: `pnpm --filter @ibasho/pack-benchmarks typecheck`.
