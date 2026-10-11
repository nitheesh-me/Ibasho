# @ibasho/pack-city-london

City context pack `city-london` (`ibasho.city/1`, ARCH 15.7). Built by `tools/city` from OpenStreetMap (ODbL 1.0, OpenStreetMap contributors).

- **Owner:** WP-17. **Layer:** engine half L1, data only.
- Tiles: 250 m, gzip JSON in `src/engine/tiles/`, listed in the generated `src/engine/tiles.gen.ts`. Frame: x east, y north, integer mm from the pack origin.
- Each building: footprint (courtyards as `holes`), height `{ lo, likely, hi, source }` (`osm-height`, `osm-levels` or `unknown`; an unknown likely height is a guess from footprint size), levels, names (`name`, `aliases`, `addr`) and sources.

## Public API (`./engine`)

`cityLondon` (the `city-pack` plugin), `cityLondonEngineModule`, `loadCityTiles(read?)`, `loadCityTile(tx, ty, read?)`, `decodeTile(bytes)`, `fetchReader`, `TILE_FILES`, `ORIGIN`, `TILE_SIZE`, `EXTENT`, `HERO_CONTEXT_IDS` (OSM ids a golden building replaces).

Rebuild: `node tools/city/src/cli.ts build london` (refetch with `fetch london --refresh`).
STUB: OSM context only, around the GH1 fixture's stated location.
