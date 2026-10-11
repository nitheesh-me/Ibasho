# @ibasho/pack-codes-in

Indian code thresholds for the real codes stage (WP-19, V-5): ECSBC 2024 (with the ECBC 2017 values it keeps until the final tables are read), Eco Niwas Samhita 2018, NBC 2016 openings, TSECBC 2014 scope (Telangana) and the 2026 Ministry of Power draft rating rule. Composite climate (Hyderabad). Every value has its clause, source and grade; `estimate` rows must be checked against the code text (docs/research/v3/energy-codes.md).

- **Owner:** WP-19. **Layer:** engine half L1 (data), plus `./real-codes` which packages the provider.

## Public API

- `./engine`: `CODES_IN`, `ECSBC_EDITIONS`, `SOURCES_IN`, types `Limit`, `Tiers`.
- `./real-codes`: `CODES_CATALOGUE` (this pack, `codes-global`, `ratings`), `realCodesProvider` (`real.codes`, a `StageProvider<'codes'>`), `realCodesEngineModule`. Swap in `apps/web/src/manifest.ts`: `codes: 'real.codes'`.

## What the real codes stage reports (golden buildings, real energy, nothing declared)

| Building | ECSBC EPI ratio to the standard design | ECSBC row | 90.1 App G PCI (PCIt about 0.5) | GHMC stars likely (possible) | Preview ratio |
|---|---|---|---|---|---|
| GB1 Vindhya | 0.82 to 1.04 | unknown (straddles 1) | 0.77 to 0.99, not met | 1 star (3) | 0.97 to 1.34 |
| GB2 Himalaya | 0.87 to 1.11 | unknown | 0.83 to 1.05, not met | none (2) | 1.06 to 1.46 |
| GB3 HITEC office | 0.88 to 1.12 | unknown; WWR 65% not met | 0.86 to 1.09, not met | none (2); BEE office 3 star (4) | 1.11 to 1.54 |
| GB4 apartments | ENS rows instead (RETV unknown until U and SHGC are given) | | 0.77 to 0.98, not met | | 1.0 to 1.38 |
| GB5 Qualcomm office | 0.86 to 1.10 | unknown | 0.83 to 1.06, not met | none (2) | 1.01 to 1.40 |

The real ratio sits lower than the Preview's because the reference design now runs on the same hourly engine as the design (model bias cancels). Envelope rows stay unknown until U-values, SHGC and roof finish are declared (`StageIn.codes.params`); with them, rows and tiers resolve (tests). Reproduce: `node packages/fixtures/src/codes/compare-codes.ts gb1 gb2 gb3 gb4 gb5`.

Commands: `pnpm --filter @ibasho/pack-codes-in typecheck`.
