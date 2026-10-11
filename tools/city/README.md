# @ibasho/tools-city

Builds the offline city packs (WP-17, ARCH 15.7) from cached OpenStreetMap Overpass extracts (ODbL 1.0).

- `node tools/city/src/cli.ts fetch hyderabad|london [--refresh]`: Overpass to `cache/<area>-overpass.json` (committed, sorted).
- `node tools/city/src/cli.ts build hyderabad|london`: cache to gzip tiles plus `tiles.gen.ts` in the pack. Byte-identical from the same cache (Y3, tested).
- Areas in `src/areas.ts`. Heights: tagged height (plus or minus 5%), levels times a storey height by use, or unknown (range, footprint-size guess for the likely value).
- PLACEHOLDER (V-2): Overture, Open Buildings 2.5D heights, canopy and Copernicus terrain.
