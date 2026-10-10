# @ibasho/core

The kernel: every contract in ARCHITECTURE 4 and 5, plus the services every layer shares.

- **Owner:** WP-00 (Architect). Contract changes after M-0 go through `docs/BLACKBOARD.typ` (INTERFACES) and WP-00 applies them.
- **Layer:** L0. Imports only `@ibasho/spec-gen` (and `zod` in `./schemas`). No DOM, React or three.js types: UI contracts use structural stand-ins (`Component<P>`, `SceneHit`, `BlobLike`, `AbortSignalLike`).

## Entry points

| Import | What |
|---|---|
| `@ibasho/core` | Types, contracts and runtime services below |
| `@ibasho/core/schemas` | Zod schemas for data that crosses a trust boundary: `HomeTwinSchema`/`parseTwin`, `TwinPatchSchema`, `RuleSchema`, `ExprSchema`, `EffectSchema`, `ScenarioOpSchema`, `OpPlanSchema`, `MemoryEventSchema`, wire strings. Each is annotated with its TS type, so drift fails `tsc` |

## Runtime services (real, tested)

| Module | API |
|---|---|
| `plugin/registry.ts` | `createRegistry()` (`register`, `registerAll`, `get`, `all`, `has`, `fingerprint`, `onChange`, `validate`), `checkPlugin`, `checkMaintenance`, `matchesQuery`, `loadModules`, `assertSharedFingerprint`, `RegistryError` with typed issues |
| `events/bus.ts` | `createEventBus({ onError })`: typed `AppEvent`s, synchronous, every handler runs before errors are rethrown |
| `fixed/index.ts` | `Fixed.roundHalfEven`, `divRound`, `mulDiv`, `discountFactors` (SPEC 7.4 recurrence), `growthFactors`, `applyFactor`, `parseScaled`, `formatScaled`, `percentToPpb`, `toWire`, `fromWire` |
| `exact/q.ts` | `Q.of`, arithmetic, `cmp`, `clamp`, `floor`, `roundHalfEven`, `toScaled`, `fromDecimal`, `toWire`, `fromWire` (normalised `n/d`) |
| `ival.ts` | `ival`, `Iv.*` (float, modelled ranges), `IvBig.*` (exact bigint) |
| `units.ts` | `Fuel`, `Month`, `FuelMonthly`, `Unit`, `quantise` (the one float to integer boundary, half even), money and energy helpers |
| `hash.ts`, `sha256.ts` | `canonicalJson`, `canonicalHash`, synchronous `sha256Hex` (FIPS 180-4, no dependencies) |
| `rand.ts` | `xoshiro128ss(seed)`, `splitmix32`, `shuffle`, `latinHypercube(n, dims, rng)` |
| `evidence/graph.ts` | `createEvidenceGraphBuilder` (`addDrafts` with in-batch keys, `markExternal`, `build` checks dangling inputs and cycles), `evidenceId`, `indexGraph`, `mergeGraphs`, `graphHash` |
| `fields.ts`, `rules.ts` | Kleene `triAnd`, `triOr`, `triNot`; `numCentral`, `numRange`; `exprFns`, `exprFacts` |

## Contracts (types)

`twin.ts` (HomeTwin, Element, Junction, TwinPatch), `engine.ts` (engine plugins, `StageIO`, `STAGE_ORDER`, `SimResult`, `SimBundle`), `rules.ts` (Expr, Rule, Effect, Obligation, Feasibility), `api.ts` (EngineApi, SearchRequest, SearchResult, PackageTable; optional `doNothing` and `negatives` for M-B), `maintenance.ts` (SPEC 14: `MaintenancePlugin` decay models, `DoNothingRequest`/`DoNothingResult` for "If nothing is done", `Negative`/`NegativesByPackage`), `ui.ts` (UI plugins and typed modules), `evidence/types.ts`, `ai/*.ts` (narration, providers, ops, memory, `MemoryRepo`), `certificate.ts` (re-exports `Certificate` from spec-gen).

## Deviations from ARCHITECTURE text (recorded on the blackboard)

- `EngineApi.simulate` returns `SimBundle` (one `SimResult` per requested mode plus evidence), since it accepts several modes.
- `VisualLayerPlugin.quantities` holds the quantity ids ARCH 5.6 calls `requires`, because `PluginBase.requires` already means plugin ids.
- `NAMED_FNS` and `NamedFn` are re-exported from `@ibasho/spec-gen` (the generated list is the source of truth).
- Added the `maintenance` engine kind (SPEC 14); `OwnerCtx` gained optional `escalation` and `counterfactual` (SF 5.1, DEC SC-F5).
- Added kinds' interfaces not spelled out in ARCH: `RegionPlugin`, `ConstructionPlugin`, `ArchetypePlugin`, `SystemPlugin`, `ExportTariffPlugin`, `FinancePlugin`, `ValueEvidencePlugin`, `IndicatorPlugin`, `RulePackPlugin`.

## Tests

`pnpm --filter @ibasho/core test` runs Vitest with coverage. Thresholds (G0-4): lines at or above 95% for `fixed/`, `exact/`, `plugin/`, `hash.ts`, `sha256.ts`. G0-5: `test/vectors/discount.json` holds discount factors at 3.5%, 3.0% and 7.0% for 25 years, computed independently in Python integer arithmetic.
