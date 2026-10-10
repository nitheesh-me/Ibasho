# @ibasho/scene

R3F stage, twin to geometry, layers, render styles, camera sequences, `a11y-scene`, SVG renderer.

- **Owner:** WP-07 (Scene). Skeleton created by WP-00 at G0.
- **Layer:** L3 (imports L0, ui, and engine result types as `import type`). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

`Stage` (one `<Canvas frameloop="demand">` with the still-life Bake/Live controller), SVG fallback `SvgHouse`, the T1 visual layers (`heatFlowLayer`, `thermalLensLayer`, `zoneTintLayer`) and render styles (`washiStyle`, `yoruStyle`), `buildHouse` (twin to house model), the shared camera model (`projectOrtho`, `fitCamera`), `ROOF_LIFT` and `sampleSequence`, the quality ladder, `buildOutline` (`a11y-scene`), `buildMotes` and scene quantities (`fromTwin`, `fromGraph`). See `src/index.ts`.

## Status

- Built: everything above, plus a dev harness in `dev/` (vite on port 5177).
- Tests: `test/` covers camera parity with three.js, the roof-lift sequence, the ladder, the still-life machine, outline parity (AC-H1), mote honesty and SVG painter order.
- PLACEHOLDER: `packs/home-uk/src/ui` (measure UI and archetype thumbnails) is not started.
- SwiftShader (the only renderer the browser guard allows) cannot bake tier 3 in reasonable time; screenshots use `tier=0` or `tier=1`.

## Commands

- `pnpm --filter @ibasho/scene typecheck`, `pnpm --filter @ibasho/scene test`.
- Screenshots: start the harness, `pnpm --filter @ibasho/scene dev`, then `node packages/scene/dev/capture.mjs <outDir> name=query ...` (for example `washi=style=washi&tier=1`). The script pins itself to a few cores at low priority. Kill the dev server afterwards.
