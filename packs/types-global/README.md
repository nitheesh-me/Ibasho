# @ibasho/pack-types-global

UK space types (living, bedroom, kitchen, office) and schedules for the energy stage, with sources (NCM activity database, SAP 10.2, CIBSE Guide A). Merge with the Indian library: `mergeTypeLibraries(typesInLibrary, typesGlobalLibrary)`.

- **Owner:** WP-18 (`src/ui/**` is WP-07). **Layer:** engine half L1 (data only).

## Public API (`./engine`)

`typesGlobalLibrary`, `SPACE_TYPES_GLOBAL`, `SCHEDULES_GLOBAL`, `typesGlobalEngineModule`.

Commands: `pnpm --filter @ibasho/pack-types-global typecheck`.
