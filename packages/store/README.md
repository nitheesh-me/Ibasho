# @ibasho/store

Dexie database `ibasho`, repositories, migrations.

- **Owner:** WP-08 (App shell and store).
- **Layer:** L1 (imports L0 only). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

- `createDb()`, `createStore(db, clock?)`: repositories per ARCH 9 (homes, results, keeping the last `RESULTS_PER_HOME` per home).
- `DB_VERSION`, `V1`, `MIGRATIONS`, `applyMigrations`: the schema and the migration scaffold.

## Stubs

- PLACEHOLDER: the `MemoryRepo` and the `.ibasho` export and import codec are PLACEHOLDER (M-P, M-D, T2); storage persistence status too.

Commands: `pnpm --filter @ibasho/store typecheck`, `pnpm --filter @ibasho/store test`.

## v2 (ARCH 15.8, V-P)

`V2` adds `places`, `buildings`, `docs` (append-only `[buildingId+version]`), `commands`, `variants`, `buildingResults` (by `inputsHash`), `siteResults`, `scopedSettings` (`[scope+scopeId+id]`), `recsets`, `cityTiles`. Two names differ from ARCH 15.8 because Dexie cannot change a primary key: `buildingResults` (v1 `results` is keyed by search hash) and `scopedSettings` (v1 `settings` stays a key value store). The upgrade copies each v1 home into a place with one `single-family` building (`legacyHomeId`). `createStudioStore(db)` gives places (with `visit` for Revisit), buildings, docs, commands, variants, results, settings and `branchPlace` (Restart > Branch with lineage; the original stays byte-identical, AC-RS1).
