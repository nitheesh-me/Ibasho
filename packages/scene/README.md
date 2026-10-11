# @ibasho/scene

R3F stage, twin to geometry, layers, render styles, camera sequences, `a11y-scene`, SVG renderer.

- **Owner:** WP-07 (Scene). Skeleton created by WP-00 at G0.
- **Layer:** L3 (imports L0, ui, and engine result types as `import type`). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

For the app shell: `<HouseStage twin quantities style />` fills its parent with the M-A home stage (cutaway at 45°, heat-flow and zone tints on, hero assets fetched once from `/app/assets/`). Optional: `result`, `layers`, `pencil`, `reducedMotion`, `tierCap`, `llmGenerating`, `store`, `showOutline`, `assetsBase` (`null` stays procedural) and `stage` (any other `Stage` prop). `style` is `washi`, `yoru` or `svg`.

For the v3 studio (V-P, QA round 1 applied): `<CityStage />` fills its parent. Real data: pass `tiles` from `@ibasho/pack-city-hyderabad` `loadCityTiles()`, `hero` (GB1 from `packages/fixtures/src/buildings`), `compiled` (`@ibasho/plan` `compile(doc)`) and `hideContextIds` (`SiteContext.replacedIds`, or the pack's `HERO_CONTEXT_IDS`). Find: `focus` (or `focusFromHit(placeHit)`), `onFocusChange`, `ref.flyTo`. Chrome follows DS 13.7 (phone sheet, tablet breadcrumb, desktop ladder) with WP-06 `ScaleLadder`, `SunScrubber`, `Stepper` and `PreviewStamp`; the camera frames inside the area the chrome leaves free (`insets` adds the studio's own). Lens kernels run in a module worker (`kernels.ts`). Earlier text: with the building in its city (`src/city/`). Every prop is optional; with none it shows the Vindhya stand in on the stand in IIIT campus at 21 March 10:30. Data props are shaped like the v3 contracts: `tiles` (`CityTile[]`), `hero` (`BuildingDoc`), `compiled` (`CompiledBuilding`, lens ids from `meshes`), `site` (`SiteResult`), plus scene types `DaylightGrid`, `LanternDatum`, `PhototropicSpec` (`src/city/types.ts`). `undefined` means "use the labelled scene estimate", `null` means "not computed yet". Controlled or not: `level` (city, site, building, floor, room), `lens` (none, shadows, sun-hours, radiation, daylight, lanterns), `time` (`{ date, minutes }` local), `azimuthDeg`. Moments: `sweep` (1), penumbra and `heightOverrides` (2), radiation wick (3), daylight drawer at Floor level (4), `phototropic` (6), lanterns (8). `controls={false}` hides the built in ladder, chips, time strip and legend; `legendFor()` gives the legend data to show elsewhere. The stand ins are PLACEHOLDER: `standInCity()` (until WP-17's `packs/city-hyderabad`), `vindhyaStandIn()` (until the traced fixture), `previewSite()` and `previewDaylight()` (until WP-13 Preview fixtures and WP-16).

Design before you build (SPEC 27): `placement` (controlled) with `onPlacementChange`, `placeMode` (drag to move, blue handle to turn, button steps, ground level) and `onSiteCheck` (overlaps and the neighbours that shade it). `CityCompare` shows two or three plots or bearings side by side with one shared bar (scale, lens, time, azimuth). Pure helpers: `applyPlacement`, `movePlacement`, `placementCheck`, `ringsOverlap`. At night a sun lens shows as Lanterns and the hero is the brightest lantern; estimated heights are hatched only where they can shade the hero (dashed tops elsewhere). Harness: `dev/city.html?place=1`, `?compare=1`.

Underneath: `Stage` (one `<Canvas frameloop="demand">` with the still-life Bake/Live controller), SVG fallback `SvgHouse`, the T1 visual layers (`heatFlowLayer`, `thermalLensLayer`, `zoneTintLayer`) and render styles (`washiStyle`, `yoruStyle`), `buildHouse` (twin to house model), the shared camera model (`projectOrtho`, `fitCamera`), `ROOF_LIFT` and `sampleSequence`, the quality ladder, `buildOutline` (`a11y-scene`), `buildMotes` and scene quantities (`fromTwin`, `fromGraph`). See `src/index.ts`.

## Status

- Built: everything above, plus a dev harness in `dev/` (vite on port 5177).
- Tests: `test/` covers camera parity with three.js, the roof-lift sequence, the ladder, the still-life machine, outline parity (AC-H1), mote honesty, SVG painter order, cutaway composition, house build invariants (outward normals, planarity, every element drawn once, rooms and openings in bounds) and `HouseStage` defaults.
- Pack ui halves: `packs/home-uk/src/ui` has `measure-ui` for all 16 measure ids and archetype thumbnails for every built form. `packs/home-in/src/ui` is PLACEHOLDER (T3, M-G).
- City (V-P): `CityStage` with merged context (one draw call), instanced trees, BVH picking with a provenance chip, penumbra bands and uncertain top bands, a preview sun hours kernel (`shadow.ts`, 10 min steps, ground and roof on one grid), Hinata, Hidamari, Akari and Sora ramps, the lens shader injection (`materials.ts`), the phototropic canopy and fins, Yoru lanterns and the SVG plan fallback (`CitySvg`). About 28 draw calls and 80k triangles at Site level. Tests: `test/city.test.ts` and `test/city-real.test.ts` (the pack tiles and compiled GB1).
- Round 3 (city): the hero is the night lantern (lit window grid), paper bake (N8AO and depth ink edges on rest, `bake.ts`), sun bent film strip with EUI chart and seal only for real results, radiation rose, moment 7 (`addedFloors`: ghost floors, neighbour flash, ribbon; `cast.ts` in the kernel worker), pinch zoom and two finger pan, ladder short name.
- Facades (round 6): `src/city/facade.ts` builds openings, heads, sills, jambs and the document's shading rules as instanced card per storey. Roof radiation is painted at 1.5 m from a worker kernel.
- Landing stills: `dev/posters/` (WebP plus `manifest.json` with chapter, theme, alt text and sizes), rendered from the harness with `controls=0`.
- Not yet built (M-B and later): ghost, noise rings, fold assembly, split, miniatures, people.
- SwiftShader (the only renderer the browser guard allows) cannot bake tier 3 in reasonable time; screenshots use `tier=0` or `tier=1`.

## Commands

- `pnpm --filter @ibasho/scene typecheck`, `pnpm --filter @ibasho/scene test`.
- City harness: `dev/city.html` (`?level=&lens=&style=&date=&min=&photo=&sweep=1&close=<id>:<mm>&controls=0`); capture with `node packages/scene/dev/capture.mjs <outDir> name=city:<query>`.
- Screenshots: start the harness, `pnpm --filter @ibasho/scene dev`, then `node packages/scene/dev/capture.mjs <outDir> name=query ...` (for example `washi=style=washi&tier=1`). Kill the dev server afterwards.
