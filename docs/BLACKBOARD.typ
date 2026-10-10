// Ibasho agent blackboard. Shared coordination surface for all agents.
// Compile (optional):  typst compile docs/BLACKBOARD.typ deliverables/BLACKBOARD.pdf
//
// PROTOCOL (read before writing)
// 1. Append only. Never delete or rewrite another agent's entry; mark it resolved instead.
// 2. One entry per fact. Use the #entry helper below. Newest at the bottom of each section.
// 3. Never wait, sleep or poll for another agent. If you are blocked, add a BLOCKER entry,
//    finish your work as far as possible, and return. The orchestrator will resume you.
// 4. Claim directories before editing them (CLAIMS). Do not edit directories claimed by others.
// 5. Interface changes go in INTERFACES with the file path of the source of truth.
// 6. No em dashes or en dashes as punctuation.

#let entry(who, kind, body, status: "open") = block(
  width: 100%, inset: 6pt, radius: 3pt, stroke: 0.5pt + luma(200),
)[
  #text(8pt, weight: "bold")[#who] #h(4pt) #text(8pt, fill: luma(110))[#kind · #status] \
  #body
]

#set document(title: "Ibasho · Agent Blackboard")
#set text(font: "Inter", size: 9.5pt)
#set page(paper: "a4", margin: 1.6cm)

= Ibasho agent blackboard

== Claims
// #entry("builder:engine-physics", "claim")[packages/engine/src/physics/**]
#entry("orchestrator", "claim", status: "active")[`docs/research/**`, `docs/*.md`, `docs/review/**`: research and director workflow (phase 1).]
#entry("builder:WP-00", "claim", status: "active")[G0 scaffold. Root files (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `biome.json`, `.npmrc`, `.nvmrc`, `.gitignore`, `.dependency-cruiser.cjs`), `packages/core/**`, and until G0: skeletons of every package, pack and app, `packages/spec-gen/**` placeholder, `tools/lint/**`, `.github/**`, `tests/smoke/**`, plus `tests/` skeleton and `CLAUDE.md`.]
#entry("builder:WP-01", "claim", status: "active")[M-0 step 1 (thin physics): `packages/dmath/**`, `packages/engine/src/{pipeline,physics}/**`, `packs/climate/**`, `packs/home-uk/{package.json,README.md,src/engine/**}`, `packages/fixtures/src/{homes,bills}/**`.]
#entry("builder:WP-06", "claim", status: "active")[M-0 step 5: `packages/ui/**`. Andon token sources and generated `tokens.css`, fonts wired (three families), baked seal glyphs, minimal `Num`, `Seal`, `ClaimSeal` with tests and stories.]
#entry("builder:WP-11", "claim", status: "active")[Hero asset set (gate M-A): `tools/assets/**` (fetch, process, manifest, attribution, tests) and `apps/web/public/assets/**` (processed files, `manifest.json`, `attribution.html`).]

== Interfaces
// #entry("architect", "interface")[`Measure` plugin contract lives in packages/core/src/plugins/measure.ts]
#entry("builder:WP-00", "interface", status: "final")[Contracts are in `packages/core/src/**` (import `@ibasho/core`). Zod schemas for untrusted input are in `@ibasho/core/schemas` (`parseTwin`, `RuleSchema`, `ExprSchema`, `ScenarioOpSchema`, `MemoryEventSchema`, `TwinPatchSchema`). Deviations from ARCH text: `EngineApi.simulate` returns `SimBundle` (one `SimResult` per requested mode plus an `EvidenceGraph`); `VisualLayerPlugin.quantities` holds the quantity ids ARCH 5.6 calls `requires` (that name already means plugin ids); `NamedFn`/`NAMED_FNS` come from `@ibasho/spec-gen`; `IbashoModule`, `ModuleRef`, `ModuleManifest` take `AnyPlugin[]`. Added interfaces for kinds ARCH names but does not spell out: `RegionPlugin`, `ConstructionPlugin`, `ArchetypePlugin`, `SystemPlugin`, `ExportTariffPlugin`, `FinancePlugin`, `ValueEvidencePlugin`, `IndicatorPlugin`, `RulePackPlugin`. Request changes here; WP-00 applies them.]
#entry("builder:WP-00", "interface", status: "final")[Measure and option ids: `packs/home-uk/src/ids.ts` (owner WP-01, frozen at M-0). Measure ids: `loft`, `wall-ewi`, `wall-iwi`, `floor`, `draught`, `glazing-secondary`, `glazing-double`, `controls`, `mvhr`, `ashp`, `pv`, `battery`, `cylinder-jacket`, `solar-thermal`, sub-measures `cylinder` and `hob-induction`. Option ids are kebab-case (`loft-300`, `heat-ashp-radiators-plus`, `pv-3kwp`, ...). Costed assessments: `assess-moisture`, `assess-pas2035`. GH1 counts check out in `packs/home-uk/test/ids.test.ts` (216 fabric combos x 2 DHW classes = 432 heavy; 216 x 50 light = 10,800 packages). WP-05: narrator slots should use these ids (`[[m:loft-300]]`, not `loft_300`).]
#entry("builder:WP-00", "interface", status: "final")[Entry points: packs export `./engine` (`src/engine/index.ts`), `./ui` (home packs) and `./ids` (home packs); packs have no `src/index.ts`. Apps start at `src/main.tsx`; `apps/web/src/manifest.ts` exports the empty `ModuleManifest`. `packages/fixtures` exports `"./*": "./src/*"` and has no index. Boot helpers in core: `loadModules(registry, refs)` and `assertSharedFingerprint(registry, remoteFingerprint)`.]
#entry("builder:WP-00", "interface", status: "final")[Ownership as code: `tools/lint/ownership.ts` maps every path to one WP (BUILD_PLAN 2 after G0) and `pnpm lint` fails on uncovered or overlapping paths. Where BUILD_PLAN is silent: pack tests go with the engine half except `packs/home-*/test/ui/**` (WP-07); engine paths not given to WP-01 or WP-03 (package files, `test/`) are WP-02; `packages/fixtures/**` outside the listed folders is WP-10; `pnpm-lock.yaml`, `knip.json` and `CLAUDE.md` are root files (WP-00); `docs/BLACKBOARD.typ`, `docs/STATUS.typ`, `docs/refs.yml` are shared append; other `docs/**`, `report/**`, `deliverables/**` are orchestrator. WP-10: `tests/contracts/ownership.test.ts` should call `checkOwnership` and `outsideOwnership` from there.]
#entry("builder:WP-00", "interface", status: "open")[spec-gen is a PLACEHOLDER with the final export shape: `Certificate`, `CertCheckId`, `NAMED_FNS`, `SCORE_WEIGHTS` (wire rationals), `SCORE_GROUPS`, `BAND_THRESHOLDS`, `FIXED`, `SEARCH_LIMITS`, `SPEC_HASH`, `HISTORICAL_SPEC_HASHES`, `SPEC_GEN_IS_PLACEHOLDER = true`, plus `cert.schema.json` and `seals.json`. WP-04 replaces `src/generated/**` (first P1 deliverable). WP-04: keep the barrel and these names, or post the rename here. Verify must not show a Checked seal while `SPEC_GEN_IS_PLACEHOLDER` is true.]

== Decisions
#entry("orchestrator", "decision", status: "final")[Stack: pnpm monorepo, Vite + React + TS + R3F, IndexedDB, Lean 4 lake package, Vitest + Playwright. Local-first, offline-first.]
#entry("orchestrator", "decision", status: "final")[LLM narrator is a plugin. Local first: templated fallback always on, then WebLLM, Ollama, Claude.]
#entry("orchestrator", "decision", status: "final")[Hobby project. Asset and library licensing is not a constraint (personal use).]
#entry("director", "decision", status: "final")[Definitive plan: `docs/VISION.md`, `docs/SPEC.md` (director rulings R1 to R18 in section 0), `docs/ARCHITECTURE.md` (contracts and exact dependency versions), `docs/DESIGN_SYSTEM.md` (Andon), `docs/BUILD_PLAN.md` (WP-00 to WP-11, disjoint ownership, gates G0 and M-A to M-H).]
#entry("director", "decision", status: "final")[Hero home GH1: 1905 London mid-terrace in a conservation area. Score weights F 1/5, C 1/5, E 3/20, A 3/20, H 1/10, R 1/10, T 1/10; score always from Standard mode. Futures Gentle, Wise, Bold per SPEC R7 and R8.]
#entry("director", "decision", status: "final")[TypeScript 6.0.3 (not 7), Biome (no ESLint), no Theatre.js, no `@react-three/a11y`. Lean v4.34.0 core only.]

#entry("director", "decision", status: "final")[Plan v2 after red-team review. Rulings: `docs/review/DECISIONS.md`. Supersedes the earlier v1 entries on futures names (now Least upfront, Best return, Lowest running carbon), the score display (number plus four groups, no letter; letters only for the estimated EPC band), and the Lean role (owns spec and predicates; pack data travels in certificates). New: three run modes (rating, standard, your-home), factorised search (GH1: 432 heavy, 10,800 packages), fixed-point bookkeeping, explicit psi junctions, hourly 5R1C, Kleene rules in Lean, M-0 walking skeleton, per-owner pack and fixture folders (`docs/BUILD_PLAN.md` section 2). T1 local LLM: Ollama.]

#entry("orchestrator", "decision", status: "final")[New WP-12 Agent link (user request 2026-10-11): MCP server `apps/mcp`, bridge `packages/agent-bridge` mounted by the companion, Claude Code plugin `integrations/claude-code`, installer `tools/agent-install`. Spec: ARCHITECTURE 14, BUILD_PLAN WP-12, SPEC 13. WP-05 and WP-08 each add one mount line on request. WP-00: workspace globs must include `integrations/*` if it holds a package.json.]
#entry("builder:WP-00", "decision", status: "final")[Every ARCH 13 T1 version, plus WP-12's `@modelcontextprotocol/sdk` 1.32.1 and `ws` 8.22.0, was checked with `npm view` on 2026-10-11 and exists. No substitutions. Installed at G0 with strict peers and no peer errors. pnpm 11 build approvals live in `pnpm-workspace.yaml` `allowBuilds` (only `esbuild`). Playwright Chromium and Firefox are installed.]
#entry("builder:WP-00", "decision", status: "final")[`no-math` bans every `Math` member in `packages/engine/**` and `packs/*/src/engine/**` except the ones ECMAScript defines exactly (`abs ceil floor trunc round sign min max imul fround clz32` and the constants), bans aliasing `Math`, and bans the `**` operator (implementation-approximated for floats). `Math.sqrt` goes through `dmath` too. One-line escape: `// lint-allow no-math: <reason>`.]
#entry("builder:WP-00", "decision", status: "final")[Tooling: dependency-cruiser gained `not-to-unresolvable` (an undeclared workspace import would otherwise slip past the layer rules) and uses a plain `node_modules/` prefix (it rejects regexes that safe-regex flags). Turbo: `agentGuidance: false` (no AGENTS.md), and `typecheck`, `test` and `build` depend on `^typecheck` so a change in a dependency invalidates the cache; the `tools-lint` test is never cached because it reads the whole repo.]

== Blockers
// #entry("builder:scene", "blocker")[Needs `HomeTwin` geometry type from packages/core. Returned early.]

== Handoffs
// #entry("builder:engine-physics", "handoff")[Physics done; optimiser can consume `simulate(twin)`; see packages/engine/README.md]
#entry("builder:WP-00", "handoff", status: "done")[G0 scaffold complete. G0-1 to G0-6 green locally (2026-10-11): `pnpm install --frozen-lockfile && pnpm lint && pnpm -r typecheck && pnpm test && pnpm build` exits 0; dependency-cruiser reports `ui-not-engine` on `tools/lint/__fixtures__/ui-imports-engine.ts`; `no-math` reports `Math.exp` in `packages/engine/__lint_fixtures__/math-exp.ts`; `packages/core` line coverage 100% (thresholds 95% on `fixed/`, `exact/`, `plugin/`, `hash.ts`, `sha256.ts`); `discountFactors` equals the Python-computed vectors in `packages/core/test/vectors/discount.json`; `pnpm smoke` boots both apps to a blank Andon page in Chromium and Firefox. What exists: root config, `packages/core` (contracts, registry, bus, Fixed, Q, Ival, units, canonical hashing, SHA-256, `xoshiro128**` and LHS, evidence graph builder, zod schemas; 137 tests), skeletons with README and owner for every package, pack and app in ARCH 2 (including WP-12's), the spec-gen placeholder, `tools/lint` (no-dash, no-math, legend, ownership), `.github/workflows/ci.yml` (Lean job runs once `proofs/lakefile.toml` exists), `tests/smoke`, `tests/` skeleton, `CLAUDE.md`. Stubbed: every skeleton `src/index.ts`; `pnpm m0` and `pnpm e2e` print a placeholder; `pnpm contracts` passes with no tests; `pnpm verify` and `pnpm assets` exit 1 with a message; the companion serves only `GET /health`. Ownership of skeletons, `packages/spec-gen/**`, `tools/lint/**`, `.github/**` and `tests/smoke/**` now transfers per BUILD_PLAN 2. M-0 can start with WP-01.]

