# @ibasho/pack-types-in

Indian space types, schedules and the eight building types for the energy stage: loads as low, typical and high values with sources (ECBC 2017, NBC 2016 Part 8, ASHRAE 62.1 outdoor air, BEE and the BT brief), 24 hour weekday, Saturday and Sunday or holiday schedules (academic vacation in May and June for teaching spaces).

- **Owner:** WP-18. **Layer:** engine half L1 (data only).

## Public API (`./engine`)

`typesInLibrary` (`TypeLibrary`: space types, schedules, building types), `SPACE_TYPES`, `SCHEDULES`, `scheduleById`, `day`, `BUILDING_TYPES_IN`, `TYPES_IN_SOURCES`, `TYPES_IN_PROVENANCE`, `typesInEngineModule`. UK homes merge in `typesGlobalLibrary` from `@ibasho/pack-types-global/engine` with `mergeTypeLibraries` (core).

`scripts/gen-weather.ts` writes the mean-day weather table used by the energy stage (`packages/engine/src/zones/weather.gen.ts`) from the Hyderabad TMYx EPW and the London TMY.

Commands: `pnpm --filter @ibasho/pack-types-in typecheck`.
