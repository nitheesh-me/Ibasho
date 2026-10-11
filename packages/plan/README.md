# @ibasho/plan

Integer-millimetre plan kernel (ARCH 15.1, BE 2).

- **Owner:** WP-14. **Layer:** L1 (L0 only; Math ban except exact ops and sqrt). L3 packages (editor, scene, pack ui halves) may import it for live previews.
- **Deps:** `@ibasho/core`, `@ibasho/dmath`, `clipper2-ts` 2.0.1 (BSL-1.0).

## Public API (`@ibasho/plan`)

- Polygons: `ringArea2`, `ringAreaMm2`, `polygonAreaMm2` (exact bigint mm²), `normaliseRing`, `rectRing`, `pointInRing`, `pointInPolygon`, `onSegment`, `bounds`, `centroid`, `edgeLength`, `perimeter`, `m2`.
- Clipper2: `union`, `intersect`, `difference`, `offset`, `triangulate`.
- Rooms and snapping: `rectPolygon`, `splitPolygon`, `snapToGrid`, `snapToPoints`, `snapOrthogonal`.
- Welding and adjacency: `weldRooms(specs, opts)` (T junctions inserted, segments with boundaries), `insertTJunctions`, `adjacencyOf`, `adjacencySymmetric` (B14).
- Facades: `segmentFacade`, `edgeAzimuthMdeg`, `windowGeom`, `projectionFactor` (PF = H / V, exact), `wwrPm`.
- Frames and angles: `toPlaceFrame`, `fromPlaceFrame`, `trueAzimuthMdeg`, deterministic `atan2`, `azimuthMdeg`, `sinCosMdeg`.
- Zoning: `autoZone(footprint, depth = 4570)` core plus perimeter zones.
- `compile(doc, { trueNorthMdeg?, meshes? })` to `CompiledBuilding` (ZoneTwin, Quantities, adjacency, checks, SurfaceSet meshes, placement). PLACEHOLDER for V-1: HomeTwin output (B15), Room3D, pitched roofs, daylight extent, RETV.
- Place search: `buildPlaceIndex({ cities, buildings })`, `searchPlaces(index, query, opts)`, `CURATED_ALIASES`, `normaliseName`, `editDistance`.

## Fixtures

`pnpm --filter @ibasho/plan gen:buildings` writes `packages/fixtures/src/buildings/` (GB1 Vindhya, GB2 Himalaya, GB3 HITEC office, GB4 Gachibowli apartments, GH1 London terrace, `places.json`, and `<id>.notes.json` with sources, status and unknowns). Space type ids used: office, office-open, lab, lab-heavy, data-centre, library, classroom, assembly, lobby, bank, circulation, stair, toilet-core, plant, parking, living, bedroom, kitchen.

Commands: `pnpm --filter @ibasho/plan typecheck`, `pnpm --filter @ibasho/plan test`.
