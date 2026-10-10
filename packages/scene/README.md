# @ibasho/scene

R3F stage, twin to geometry, layers, render styles, camera sequences, `a11y-scene`, SVG renderer.

- **Owner:** WP-07 (Scene). Skeleton created by WP-00 at G0.
- **Layer:** L3 (imports L0, ui, and engine result types as `import type`). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

For the app shell: `<HouseStage twin quantities style />` fills its parent with the M-A home stage (cutaway at 45°, heat-flow and zone tints on, hero assets fetched once from `/app/assets/`). Optional: `result`, `layers`, `pencil`, `reducedMotion`, `tierCap`, `llmGenerating`, `store`, `showOutline`, `assetsBase` (`null` stays procedural) and `stage` (any other `Stage` prop). `style` is `washi`, `yoru` or `svg`.

Underneath: `Stage` (one `<Canvas frameloop="demand">` with the still-life Bake/Live controller), SVG fallback `SvgHouse`, the T1 visual layers (`heatFlowLayer`, `thermalLensLayer`, `zoneTintLayer`) and render styles (`washiStyle`, `yoruStyle`), `buildHouse` (twin to house model), the shared camera model (`projectOrtho`, `fitCamera`), `ROOF_LIFT` and `sampleSequence`, the quality ladder, `buildOutline` (`a11y-scene`), `buildMotes` and scene quantities (`fromTwin`, `fromGraph`). See `src/index.ts`.

## Status

- Built: everything above, plus a dev harness in `dev/` (vite on port 5177).
- Tests: `test/` covers camera parity with three.js, the roof-lift sequence, the ladder, the still-life machine, outline parity (AC-H1), mote honesty, SVG painter order, cutaway composition, house build invariants (outward normals, planarity, every element drawn once, rooms and openings in bounds) and `HouseStage` defaults.
- Pack ui halves: `packs/home-uk/src/ui` has `measure-ui` for all 16 measure ids and archetype thumbnails for every built form. `packs/home-in/src/ui` is PLACEHOLDER (T3, M-G).
- Not yet built (M-B and later): ghost, noise rings, fold assembly, split, miniatures, people.
- SwiftShader (the only renderer the browser guard allows) cannot bake tier 3 in reasonable time; screenshots use `tier=0` or `tier=1`.

## Commands

- `pnpm --filter @ibasho/scene typecheck`, `pnpm --filter @ibasho/scene test`.
- Screenshots: start the harness, `pnpm --filter @ibasho/scene dev`, then `node packages/scene/dev/capture.mjs <outDir> name=query ...` (for example `washi=style=washi&tier=1`). Kill the dev server afterwards.
