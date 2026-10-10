# Acknowledgements

Ibasho stands on the shoulders of giants. Every borrowed library, algorithm, snippet, dataset, asset and idea is credited here. Agents append under the right heading: name, link, licence, what we used it for. Full citations for papers and standards are in `docs/refs.yml`.

## Libraries and tools

Runtime, app and engine:

- React and React DOM, https://github.com/facebook/react, MIT: the web app and the landing page.
- React Router, https://github.com/remix-run/react-router, MIT: app routes.
- Zustand, https://github.com/pmndrs/zustand, MIT: app state.
- Zod, https://github.com/colinhacks/zod, MIT: schemas for every untrusted input (`@ibasho/core/schemas`).
- Comlink, https://github.com/GoogleChromeLabs/comlink, Apache-2.0: the engine in a Web Worker.
- Dexie, https://github.com/dexie/Dexie.js, Apache-2.0: local storage of the twin in IndexedDB.
- FormatJS intl-messageformat, https://github.com/formatjs/formatjs, BSD-3-Clause: message formatting.
- Motion, https://github.com/motiondivision/motion, MIT: UI motion.
- culori, https://github.com/Evercoder/culori, MIT: colour maths for the Andon tokens.
- web-vitals, https://github.com/GoogleChrome/web-vitals, Apache-2.0: performance measures.
- Workbox and vite-plugin-pwa, https://github.com/GoogleChrome/workbox and https://github.com/vite-pwa/vite-plugin-pwa, MIT: offline app.
- Hono and @hono/node-server, https://github.com/honojs/hono and https://github.com/honojs/node-server, MIT: the local companion server and the agent link bridge.
- Model Context Protocol TypeScript SDK, https://github.com/modelcontextprotocol/typescript-sdk, MIT: the Ibasho MCP server.
- ws, https://github.com/websockets/ws, MIT: WebSocket client for the agent link.
- ollama-js, https://github.com/ollama/ollama-js, MIT: optional local model provider for the narrator.
- SunCalc, https://github.com/mourner/suncalc, BSD-2-Clause: sun position for the scene.

3D scene:

- three.js, https://github.com/mrdoob/three.js, MIT.
- React Three Fiber, drei, react-postprocessing and test renderer, https://github.com/pmndrs, MIT.
- postprocessing, https://github.com/pmndrs/postprocessing, Zlib.
- maath, https://github.com/pmndrs/maath, MIT; use-gesture, https://github.com/pmndrs/use-gesture, MIT; leva, https://github.com/pmndrs/leva, MIT.
- three-mesh-bvh, https://github.com/gkjohnson/three-mesh-bvh, MIT.
- three-custom-shader-material, https://github.com/FarazzShaikh/THREE-CustomShaderMaterial, MIT.
- N8AO, https://github.com/N8python/n8ao, ISC: ambient occlusion.
- gainmap-js by MONOGRID, https://github.com/MONOGRID/gainmap-js, MIT: gain map HDRI loading (through drei).

Build, assets and fonts tooling:

- Vite and @vitejs/plugin-react, https://github.com/vitejs, MIT.
- TypeScript, https://github.com/microsoft/TypeScript, Apache-2.0.
- tsx, https://github.com/privatenumber/tsx, MIT.
- Turborepo, https://github.com/vercel/turborepo, MIT; pnpm, https://github.com/pnpm/pnpm, MIT.
- Lightning CSS, https://github.com/parcel-bundler/lightningcss, MPL-2.0.
- glTF Transform, https://github.com/donmccurdy/glTF-Transform, MIT: model processing.
- meshoptimizer, https://github.com/zeux/meshoptimizer, MIT: mesh compression.
- sharp, https://github.com/lovell/sharp, Apache-2.0: texture and HDRI processing.
- SVGO, https://github.com/svg/svgo, MIT.
- opentype.js, https://github.com/opentypejs/opentype.js, MIT: baking seal glyphs to paths.
- subset-font, https://github.com/papandreou/subset-font, BSD-3-Clause: font subsets.
- Fontsource, https://github.com/fontsource/font-files, OFL-1.1 fonts packaged for npm.
- Storybook, https://github.com/storybookjs/storybook, MIT: component workshop.

Quality and tests:

- Vitest and @vitest/coverage-v8, https://github.com/vitest-dev/vitest, MIT.
- Playwright, https://github.com/microsoft/playwright, Apache-2.0; axe-core for Playwright, https://github.com/dequelabs/axe-core-npm, MPL-2.0.
- Testing Library (React, user-event), https://github.com/testing-library, MIT.
- happy-dom, https://github.com/capricorn86/happy-dom, MIT; fake-indexeddb, https://github.com/dumbmatter/fakeIndexedDB, Apache-2.0.
- fast-check, https://github.com/dubzzz/fast-check, MIT: property tests.
- Biome, https://github.com/biomejs/biome, MIT or Apache-2.0: format and lint.
- dependency-cruiser, https://github.com/sverweij/dependency-cruiser, MIT: layer rules.
- knip, https://github.com/webpro-nl/knip, ISC: unused files.
- size-limit, https://github.com/ai/size-limit, MIT: bundle budgets.

Proofs:

- Lean 4, https://github.com/leanprover/lean4, Apache-2.0: the spec, the theorems and the `ibasho-check` checker.

## Algorithms and vendored code

- fdlibm 5.3, Sun Microsystems (1993), freely distributable: `exp`, `log`, `log10` and `sqrt` in `packages/dmath` are ports, so every JavaScript engine gets the same bits.
- SHA-256 (FIPS 180-4): `packages/core/src/sha256.ts` implements the standard for content hashes.
- xoshiro and splitmix, Blackman and Vigna: the core seeded PRNG.
- Latin hypercube sampling, McKay, Beckman and Conover (1979): uncertainty runs.
- Strong Kleene three-valued logic, Kleene (1952): rule evaluation with unknown facts.
- OKLab, Bjorn Ottosson: colour space for the Andon palette.
- Machado, Oliveira and Fernandes (2009): colour vision deficiency simulation for palette checks.
- Spotlighting, Hines et al. (2024): marking untrusted notes before they reach a model.
- Proof-carrying numbers: the idea that every shown number carries its evidence.

## Data and standards

- SAP 10.2 and RdSAP 10 (BRE for DESNZ): monthly energy method, occupancy, lights and appliances, Table 12 and 12d carbon factors.
- ISO 52016-1:2017: energy needs for heating and cooling.
- NASA POWER climatology API, https://power.larc.nasa.gov: climate data for the climate pack.
- CIBSE and MCS design conditions: design temperatures.
- Ofgem energy price cap (1 October to 31 December 2026): tariffs.
- HM Treasury Green Book: discount rates.
- Boiler Upgrade Scheme (Ofgem, GOV.UK): grants.
- Energy Saving Trust and Which?: typical measure costs and savings.
- MCS 020 a): heat pump noise assessment.
- GPDO 2015 Schedule 2 and SI 2025/560 (legislation.gov.uk, Open Government Licence): permitted development rules in `packs/rules-uk`.
- Approved Documents L and F (DLUHC, Open Government Licence): renovation U-values and the AD F Diagram 3.1 ventilation categories.
- ENA Engineering Recommendations G98 and G99: grid export thresholds. Energy Efficiency (Private Rented Property) Regulations 2015 and the January 2026 MEES response: rental rules.
- Oxford City Council, Wyre Forest DC, Cornwall Council and Croydon Council householder guidance: secondary sources for heat pump, solar and wall insulation limbs.
- Eco Niwas Samhita 2018 and 2024 (BEE): RETV coefficients for `ens_retv`.
- Historic England, TrustMark PAS 2035: retrofit guidance.
- Nationwide (2026) house price and EPC study: value evidence.

## Assets (fonts, textures, HDRIs, models, sounds)

- Poly Haven, https://polyhaven.com, CC0-1.0: HDRIs and textures.
- Kenney Furniture Kit, https://kenney.nl/assets/furniture-kit, CC0-1.0: furniture models.
- Quaternius Ultimate House Interior Pack, https://quaternius.com/packs/ultimatehomeinterior.html, CC0-1.0: interior models.
- Yuji Syuku, https://github.com/google/fonts, OFL-1.1: seal and chapter kanji (baked to paths).
- Shippori Mincho B1, Zen Kaku Gothic New and M PLUS 1 Code (via Fontsource), OFL-1.1: interface type.
- Adobe Gain Map specification: HDR image format for the HDRIs.

The served credits page is `/app/assets/attribution.html`, generated from the asset manifest.

## Ideas and inspiration

- Dami Lee, architectural storytelling: https://www.youtube.com/@DamiLeeArch
- tldraw offline agent skill: pattern for the Ibasho agent link (local server, token file, skill, subagent, hook).
- Claude Code plugins and the Model Context Protocol specification: shape of the agent link.
