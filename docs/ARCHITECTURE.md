# Ibasho: Architecture

Status: director synthesis v2, 2026-10-10. Normative. v2 applies `review/DECISIONS.md` (TE-1 to TE-8 and the science rulings that change contracts). WP-00 turns the contracts in §4 and §5 into `packages/core/src/**` before M-0 (`BUILD_PLAN.md`). After M-0, contract changes go through `docs/BLACKBOARD.typ` (INTERFACES).

---

## 1. Principles

1. **Plugins where data or behaviour varies by place or time; typed modules elsewhere.** Climate, constructions, archetypes, measures, costs, physics stages, thermal models, tariffs, carbon, grants, rules, narrators, scene layers, render styles, exporters, locales and checker rungs are registry plugins. Chapters, onboarding steps, panels, sounds and migrations are plain typed modules: they never vary at runtime, so they do not need a registry.
2. **Pure, deterministic engine.** The engine is TypeScript in a Web Worker. All transcendental maths goes through `@ibasho/dmath`, and a lint bans `Math.*` in `engine` and packs. The same twin with the same plugin versions gives a byte-identical result and certificate in Node, Chromium and Firefox.
3. **Every number is evidence.** UI components cannot render a bare number (`<Num ev={id}/>` only). The evidence graph is built lazily: full nodes for the baseline, the front and the picks, and the rest on demand.
4. **Float for physics, fixed point for bookkeeping.** Physics runs in float64. Outputs are quantised once (Wh, gCO2e, micro-pence). After that the bookkeeping uses integers with spec-defined rounding that Lean mirrors exactly.
5. **Lean owns the spec, not the data.** Lean owns formulas, weights, anchors, reference prices, rule semantics, fixed-point rounding and well-formedness predicates. Pack data (tariffs, factors, grants, rules) changes quarterly, so it travels inside each certificate and is checked against those predicates.
6. **Check what can be wrong.** Certificates carry dominance witnesses and the facts each rule needs. Proofs target the rule evaluator, the noise test, the front and memory, not identities that hold by definition.
7. **The LLM has no authority.** It writes slots, proposes typed ops and seeds memories. The engine, the validator and the owner decide.
8. **Local first.** IndexedDB, a service worker, no server. Network features are optional plugins.
9. **Layered imports, enforced.** dependency-cruiser fails CI on any forbidden edge (§3).

## 2. Monorepo layout

```
ibasho/
  package.json  pnpm-workspace.yaml  turbo.json  tsconfig.base.json  biome.json  .npmrc  .nvmrc
  docs/  report/
  proofs/                     Lean 4 lake package "ibasho-proofs" (core only)
  packages/
    core/                     kernel: contracts, registry, event bus, evidence graph builder, fixed point, Q, intervals, units, PRNG, hashing
    dmath/                    deterministic exp, log, pow, sin, cos, atan2, acos (fdlibm port), test vectors
    spec-gen/                 GENERATED from Lean: spec constants, rule semantics ids, Certificate types, cert schema, seals.json, specHash
    engine/                   worker API, pipeline runner, physics stages, thermal (5R1C), calibration, rules evaluator, search, finance, score, uncertainty, evidence
    verify/                   certificate emitter, TS mirror checker, seal resolver, Lean bridge (node)
    ai/                       narrator core, grounding, template narrator, providers, ops, notes quarantine, memory domain
    store/                    Dexie DB, repositories, migrations, export/import, snapshot codec
    ui/                       Andon design system: tokens, CSS, components, mon icons, motion, Storybook
    scene/                    R3F stage, twin to geometry, layers, render styles, camera sequences, a11y-scene, SVG renderer
    content/                  landing chapters, glossary, voice guide, measure guidance (disruption, next step)
    agent-bridge/             agent link protocol, Hono sub-app, browser client (ARCH 14)
    fixtures/                 golden homes, bills, results, certs, rules goldens, injection corpus (per-owner folders)
  packs/                      each a workspace package with separate ./engine and ./ui exports
    climate/                  src/engine: London, Manchester, Edinburgh, Hyderabad, Mumbai, Delhi (+ SAP Appendix U, London TMY)
    home-uk/                  src/engine: RdSAP 10 constructions, K1 junctions, archetypes, systems, measure models
                              src/ui: measure presentation (mon id, fold spec), archetype thumbnails
    home-in/                  same split, India
    money-uk/                 src/engine: tariffs, reference link, carbon, trajectory, grants, finance, value, measure costs, EPC rating proxy
    money-in/                 src/engine: TGSPDCL, DERC, AEML slabs, CEA, PM Surya Ghar, measure costs
    rules-uk/                 src/engine: ENG, WLS, SCT stub, tenure, MEES, DNO, PAS 2035, applicability, city (T4)
    rules-in/                 src/engine: ENS, Telangana, RWA, DT, applicability
  apps/
    web/                      the app (/app/), public/assets/** (curated assets)
    landing/                  landing page (/)
    companion/                optional local Node helper: LLM proxy, POST /verify, mounts the agent bridge
    mcp/                      stdio MCP server: headless engine tools + live tools via the bridge (ARCH 14)
  integrations/
    claude-code/              Claude Code plugin: skill, subagent, .mcp.json, hooks, iq helper, evals
  tests/                      e2e, visual, a11y, demo, stranger homes, mutation, differential, determinism matrix
  tools/                      assets/, lint/ (no-dash, tatami, legend, no-math, mon), verify/
```

## 3. Layering

```
L0  core, dmath, spec-gen                   (spec-gen imports nothing; core imports spec-gen types; dmath imports nothing)
L1  engine, verify, store, packs/*/engine   (import L0 only; packs implement core interfaces)
L2  ai                                      (L0, L1 types only)
L2  ui                                      (L0 only)
L3  scene, packs/*/ui                       (L0, ui, engine result types)
L4  apps/*                                  (anything)
```

Forbidden edges:
- `ui` → `engine`
- `engine` or `packs/*/engine` → `react`, `three`, DOM, `Math.*` (lint)
- `packages/*` → `apps/*`
- `packs/*` → engine internals
- `packs/*/engine` → `packs/*/ui`

Type-only cross-layer imports use `import type`.

Threads:
- **Worker:** engine, `packs/*/engine`, the mirror checker.
- **Main:** store, AI providers (WebLLM, from T2, in its own worker), ui, scene, `packs/*/ui`, apps.

Plugins with functions are never posted across threads.

## 4. Kernel (`packages/core`)

### 4.1 Plugin model

```ts
export type IsoDate = `${number}-${number}-${number}`;
export type SemVer = `${number}.${number}.${number}`;
export type RegionCode = 'GB' | 'GB-ENG' | 'GB-WLS' | 'GB-SCT' | 'IN' | 'IN-TG' | 'IN-DL' | 'IN-MH';
export type Grade = 'primary' | 'secondary' | 'announced' | 'estimate';
export interface SourceRef { id: string; title: string; url?: string; clause?: string; retrieved: IsoDate }
export interface Provenance { sources: SourceRef[]; lastChecked: IsoDate; grade: Grade }

export interface PluginBase<K extends PluginKind> {
  kind: K; id: string; version: SemVer; title: MessageKey;
  regions?: RegionCode[]; validFrom?: IsoDate; validTo?: IsoDate;
  provenance?: Provenance; requires?: string[];
  side: 'engine' | 'ui' | 'both';            // 'both' only for pure data plugins
}

export type EnginePluginKind =
  | 'region' | 'climate' | 'construction' | 'archetype' | 'system' | 'physics-stage' | 'thermal-model'
  | 'measure' | 'measure-cost' | 'tariff' | 'export-tariff' | 'carbon' | 'carbon-trajectory' | 'grant'
  | 'finance' | 'value-evidence' | 'rule-pack' | 'indicator' | 'epc-proxy' | 'calibration'
  | 'search-strategy' | 'importer';
export type UiPluginKind =
  | 'measure-ui' | 'narrator' | 'template-pack' | 'polarity-lexicon' | 'visual-layer' | 'render-style'
  | 'exporter' | 'locale' | 'checker-rung';
export type PluginKind = EnginePluginKind | UiPluginKind;
```

```ts
export interface Query { region?: RegionCode; asOf?: IsoDate; ids?: string[]; side?: 'engine' | 'ui' | 'both' }
export interface PluginRegistry {
  register(p: AnyPlugin): void;                 // throws on duplicate id or failed validate()
  get<K extends PluginKind>(kind: K, id: string): PluginOf<K>;
  all<K extends PluginKind>(kind: K, q?: Query): readonly PluginOf<K>[];   // sorted by id, stable
  has(id: string): boolean;
  fingerprint(q?: Query): string;               // sha256 of sorted id@version
  onChange(cb: () => void): () => void;
}
export interface IbashoModule { id: string; load(): AnyPlugin[] | Promise<AnyPlugin[]> }
export interface ModuleManifest { engine: ModuleRef[]; ui: ModuleRef[] }   // apps/web/src/manifest.ts
```

`registry.validate` checks the following:

| Check | Rule |
|---|---|
| Ids | Unique |
| Dates | `validFrom ≤ validTo` |
| Dependencies | Every `requires` id is present |
| Provenance | Every numeric plugin carries provenance |
| Visual layers | A `visual-layer` that encodes numbers has `Legend` and `evidenceAt` (AC-15) |
| Rule packs | Every rule's named functions exist in `spec-gen`, or the rule is marked `unverifiedRule: true` (its seal reads "Unverified rule") |
| Measure ids | Every `measure` id has a `measure-cost` entry in every active money pack for its region. Contract test only: every `measure` id has a `measure-ui` and content entry |

**Boot.** The main thread and the worker each build a registry from their half of the manifest. They compare `fingerprint({ side: 'both' })`, and a mismatch is a hard error. Engine and UI plugin sets legitimately differ, so they are not compared (DEC TE-6).

### 4.2 Event bus

```ts
export type AppEvent =
  | { t: 'twin.changed'; homeId: string; version: number }
  | { t: 'result.ready'; homeId: string; resultHash: string }
  | { t: 'cert.verdict'; resultHash: string; rung: CheckerRungId; coverage: 'all' | 'sample'; ok: boolean }
  | { t: 'memory.event'; event: MemoryEvent }
  | { t: 'narration.state'; generating: boolean; origin: 'llm' | 'template' }
  | { t: 'ui.chapter'; chapter: ChapterId } | { t: 'ui.focus'; elementId?: string };
export interface EventBus { emit(e: AppEvent): void; on<T extends AppEvent['t']>(t: T, cb: (e: Extract<AppEvent, { t: T }>) => void): () => void }
```

The scene subscribes to `narration.state` and drops one quality tier while an LLM is generating.

### 4.3 Numbers

```ts
// packages/core/src/fixed/*.ts   integer fixed point, mirrors proofs/Ibasho/Spec/Fixed.lean
export type Wh = bigint; export type GCO2e = bigint; export type MicroPence = bigint;
export const Fixed: {
  roundHalfEven(n: bigint, d: bigint): bigint;
  discountFactors(rPpb: bigint, years: number): bigint[];   // scaled 1e12, recurrence per SPEC §7.4
  mulDiv(a: bigint, b: bigint, d: bigint): bigint;           // with named rounding point
};
// packages/core/src/exact/q.ts   exact rationals for score only
export interface Q { readonly n: bigint; readonly d: bigint }
// wire format for both: decimal strings, never JSON floats
export interface Ival<T = number> { lo: T; hi: T }
export type Fuel = 'electricity' | 'gas' | 'oil' | 'lpg' | 'biomass' | 'district';   // mirrors Lean Fuel
export type Month = 0|1|2|3|4|5|6|7|8|9|10|11;
export type FuelMonthly<T> = Record<Fuel, readonly [T,T,T,T,T,T,T,T,T,T,T,T]>;
```

`packages/dmath` exports `exp`, `log`, `log10`, `pow`, `sin`, `cos`, `atan2`, `acos` and `sqrt`, ported from fdlibm. It ships test vectors that run in Node, Chromium and Firefox (AC-D1). `core/src/rand.ts` provides seeded xoshiro128** and Latin hypercube sampling. `core/src/hash.ts` provides canonical JSON plus SHA-256.

## 5. Contracts

All live in `packages/core/src/**`. Field comments are normative.

### 5.1 Fields

```ts
export type InputSource =
  | { kind: 'stated' } | { kind: 'measured'; how: 'bill' | 'meter' | 'survey' }
  | { kind: 'document'; doc: 'epc' | 'lease' | 'survey'; ref?: string }
  | { kind: 'default'; pluginId: string } | { kind: 'derived'; from: string[] }
  | { kind: 'calibrated'; posterior: Ival<number> };
export type NumField =
  | { state: 'known'; value: number; source: InputSource }
  | { state: 'estimated'; value: number; range: [number, number]; source: InputSource }
  | { state: 'unknown'; range: [number, number]; material: boolean; source: InputSource };
export type Choice<E extends string> =
  | { state: 'known'; value: E; source: InputSource }
  | { state: 'estimated'; value: E; options: E[]; source: InputSource }
  | { state: 'unknown'; options: E[]; material: boolean; source: InputSource };
export type Tri = true | false | 'unknown';
```

### 5.2 The twin

```ts
export interface HomeTwin {
  schema: 'ibasho.twin/2'; id: string; version: number;
  region: RegionCode; climatePackId: string;
  location: { lat: number; lon: number; district?: string };
  archetypeId: string;
  form: { builtForm: BuiltForm; storeys: NumField; storeyHeightM: NumField; footprintM2: NumField; perimeterM: NumField;
          frontAzimuthDeg: NumField; roof: Choice<'pitched' | 'flat' | 'rafters'>; pitchDeg?: NumField; floorLevel?: number };
  zones: { livingAreaFrac: NumField };                     // SAP two-zone split, used by 5R1C and room tints
  elements: Element[];
  junctions: Junction[];                                   // explicit psi junctions (R19)
  ventilation: { chimneysOpen: NumField; chimneysBlocked: NumField; extractFans: NumField; ap50?: NumField;
                 draughtProofedFrac: NumField; floorType: Choice<'suspended-unsealed' | 'suspended-sealed' | 'solid'>;
                 shelteredSides: NumField; system: Choice<VentSystem> };
  systems: { space: SystemRef; dhw: SystemRef & { class: 'combi' | 'cylinder' | 'instant' | 'geyser' };
             boilerAgeYears?: NumField; cooling?: SystemRef[]; pv?: PvArray[]; battery?: NumField; hob: Choice<'gas' | 'electric' | 'induction'>;
             emitters: { kOversize: NumField; radiators?: RadiatorSpec[] }; controls: Choice<ControlType> };
  occupancy: { people: NumField; setpointC: NumField; heatingHours: NumField; acHoursPerNight?: NumField; fans?: NumField };
  site: { overshading: Choice<OvershadingClass>; garden?: GardenGeom; neighbours?: NeighbourOpening[]; boundaries?: Boundary[] };
  legal: { tenure: Choice<'owner' | 'tenant' | 'landlord' | 'leaseholder'>; designations: Designations;
           roofIsCommonArea?: Tri; leaseCovenant?: Choice<'absolute' | 'qualified' | 'silent' | 'unknown'>;
           epc?: { band: Band; sap?: number; issued: IsoDate }; sanctionedLoadKW?: NumField; valueGBP?: NumField;
           supply: { phases: NumField; looped: Tri; fuseA?: NumField } };    // DNO rules
  checks: { kind: CheckKind; at: IsoDate; result: 'pass' | 'fail' | 'conditional'; ref?: string }[];   // R22
  meters?: MeterData;                                       // each series carries { quality: 'meter' | 'kwh' | 'money' | 'direct-debit' }
  done: { measureId: string; optionId: string; at: IsoDate; costGBP?: number }[];
}
export type CheckKind = 'moisture-assessment' | 'dno-approval' | 'structural' | 'pas2035-assessment' | 'asbestos';

export interface Element {
  id: string; kind: 'wall' | 'party-wall' | 'roof' | 'floor' | 'window' | 'door' | 'rooflight';
  zone: 'living' | 'rest' | 'both';
  orientationDeg?: number; tiltDeg?: number; areaM2: NumField; parentId?: string;
  constructionId: string; u: NumField; g?: NumField; frameFactor?: NumField; absorptance?: NumField;
  geometry: ElementGeom; finish?: string; frontsHighway?: Tri; onBoundary?: Tri;
}
export interface Junction {
  id: string;                                              // 'jn-lintel-front-bay'
  kind: 'lintel' | 'sill' | 'jamb' | 'eaves' | 'ground-floor' | 'party-wall' | 'intermediate-floor' | 'corner' | 'joist-end';
  elementIds: string[]; lengthM: NumField; psi: NumField;  // SAP Table K1 default unless stated
  path: [number, number, number][];                        // polyline in house coordinates, for seams and the lens
}
```

### 5.3 Engine plugins

```ts
export interface ClimatePack extends PluginBase<'climate'> {
  location: { lat: number; lon: number; name: MessageKey }; zone: AnchorZone;   // 'uk-temperate' | 'in-warm-humid' | 'in-composite'
  months: { thetaE: number; thetaMax: number; thetaMin: number; ghi: number; dhi: number; rh: number; windMs: number }[];
  design: { thetaEdC: number; grade: Grade };
  hourly?: () => Promise<HourlyClimate>;                   // TMY (London in T1); else synthesised from months
  irradiance(azimuthDeg: number, tiltDeg: number): number[];   // dmath only
}

export interface StageIO {                                 // typed per stage (DEC TE-6)
  geometry: { in: HomeTwin; out: GeometryOut }; fabric: { in: GeometryOut; out: FabricOut };
  ventilation: { in: GeometryOut; out: VentOut }; gains: { in: GainsIn; out: GainsOut };
  'heat-balance': { in: BalanceIn; out: DemandMonthly }; cooling: { in: BalanceIn; out: CoolingMonthly };
  dhw: { in: DhwIn; out: DhwMonthly }; systems: { in: SystemsIn; out: FuelMonthly<number> };
  renewables: { in: RenewIn; out: RenewOut }; delivered: { in: DeliveredIn; out: FuelMonthly<bigint> };
}
export interface PhysicsStage<S extends keyof StageIO> extends PluginBase<'physics-stage'> {
  stage: S; modes: RunMode[];
  run(input: StageIO[S]['in'], ctx: StageCtx): { output: StageIO[S]['out']; evidence: EvidenceDraft[] };
}
export type RunMode = 'rating' | 'standard' | 'your-home';
export interface ThermalModel extends PluginBase<'thermal-model'> {           // 5R1C in T1, rooms in T5
  zones: string[];
  run(twin: HomeTwin, pkgPatch: TwinPatch, climate: HourlyClimate, ctx: StageCtx): { zoneTempsC: Float64Array[]; hotHours: number; coldHours: number; evidence: EvidenceDraft[] };
}

export interface MeasureModel extends PluginBase<'measure'> {            // engine half (packs/*/src/engine)
  group: string; weight: 'heavy' | 'light';                                // heavy = changes demand
  options: { id: string; title: MessageKey; params: Record<string, { value: number | string; min?: number; max?: number; unit?: Unit }> }[];
  measureKind: MeasureKind; touches: Element['kind'][];
  apply(twin: HomeTwin, optionId: string): TwinPatch;                     // pure parameter deltas
  junctionEffects?(twin: HomeTwin, optionId: string): { junctionId: string; psiAfter: number }[];   // R19
  subMeasures?: { id: string; group: string }[];                          // e.g. cylinder, hob, gas-disconnect
  lifetimeYears: number; conflicts?: string[]; prereq?: string[];
  facts(twin: HomeTwin, optionId: string): Record<FactId, Tri | number | string>;   // inputs for rules (RP §4)
}
export interface MeasureCost extends PluginBase<'measure-cost'> {         // money packs, joined by option id
  optionId: string;
  cost(twin: HomeTwin, asOf: IsoDate): { lo: MicroPence; mid: MicroPence; hi: MicroPence; vatRate: Q; grade: Grade };
  omDeltaPerYear?: MicroPence; replacements?: { atYear: number; cost: MicroPence }[];
}
export interface MeasureUi extends PluginBase<'measure-ui'> { measureId: string; mon: MonId; fold: FoldSpec }   // packs/*/src/ui

export interface TariffPlugin extends PluginBase<'tariff'> {
  fuel: Fuel; currency: 'GBP' | 'INR';
  bill(whByMonth: Wh[], ctx: { days: number[]; sanctionedLoadKW?: number }): { total: MicroPence; byMonth: MicroPence[]; slabs?: SlabTable };
}
export interface CarbonPack extends PluginBase<'carbon'> { factor(fuel: Fuel, month: Month): bigint /* µg per Wh */; includesTD: boolean }
export interface CarbonTrajectory extends PluginBase<'carbon-trajectory'> { factor(fuel: Fuel, year: number): bigint }
export interface GrantPlugin extends PluginBase<'grant'> {
  eligible(twin: HomeTwin, owner: OwnerCtx, pkg: PackageSpec, asOf: IsoDate): { amount: MicroPence; conditions: MessageKey[]; stacksWith: string[]; obliges?: string[] } | null;
}
export interface EpcProxy extends PluginBase<'epc-proxy'> { sap(ratingResult: SimResult): { sap: number; band: Band; nearThreshold: boolean } }
export interface CalibrationPlugin extends PluginBase<'calibration'> { fit(twin: HomeTwin, meters: MeterData, weather: ActualWeather | null, sim: SimFn): CalibrationPosterior }
export interface SearchStrategy extends PluginBase<'search-strategy'> { plan(groups: ChoiceGroup[]): SearchPlan; complete: boolean }
```

The score weights, anchors, band thresholds and reference prices come from `@ibasho/spec-gen` and are never a plugin. `indicator` plugins add only unweighted side indicators.

### 5.4 Rules

```ts
export type Authority = 'LPA' | 'LPA-prior-approval' | 'LBC' | 'building-control' | 'freeholder' | 'landlord' | 'RWA' | 'DISCOM' | 'DNO' | 'highway' | 'neighbour';
export type Effect =
  | { kind: 'block'; reason: MessageKey }
  | { kind: 'consent'; authority: Authority; typicalWeeks?: number }
  | { kind: 'oblige'; spec: Obligation }                  // applied before physics; idempotent (Lean)
  | { kind: 'check'; check: CheckKind }                   // unknown until twin.checks records it (R22)
  | { kind: 'warn'; risk: MessageKey } | { kind: 'info'; note: MessageKey };
export type Expr =                                        // JSON AST; evaluated by TS and by Lean (Kleene)
  | { and: Expr[] } | { or: Expr[] } | { not: Expr }
  | { cmp: '<' | '<=' | '=' | '>=' | '>' | '!='; left: FactRef; right: FactRef | number | string }
  | { in: FactRef; set: (string | number)[] } | { fn: NamedFn; args: FactRef[] } | { const: Tri };
export type NamedFn = 'mcs020a_Lp_le' | 'adf_category' | 'ens_retv' | 'mees_cap' | 'dt_hosting';   // each defined in Lean
export interface Rule {
  id: string; jurisdiction: RegionCode | 'CITY'; measures: MeasureKind[] | '*'; scope: 'measure' | 'package';
  when: Expr; effect: Effect; effectiveFrom: IsoDate; effectiveTo?: IsoDate;
  source: { url: string; clause: string; grade: Grade }; explain: MessageKey;
}
export interface Feasibility {
  status: 'feasible' | 'needs-check' | 'blocked';
  consents: { ruleId: string; authority: Authority }[]; obligations: { ruleId: string; spec: Obligation }[];
  checks: { ruleId: string; check: CheckKind }[]; warnings: { ruleId: string; risk: MessageKey }[];
  blockedBy?: string[]; unknownBy?: { ruleId: string; facts: FactId[] }[];
}
```

Applicability is no longer a method on measures. It is a set of `APPL.*` rules in the rule packs, so Lean evaluates it with everything else.

Evaluation order (RP §3):
1. Filter by jurisdiction and `asOf`.
2. Evaluate measure rules over option facts.
3. Evaluate package rules over facts derived from the option set (counts, totals, noise inputs).
4. Apply obligations.
5. Re-run physics.
6. Decide status.
7. Build the ledger.

### 5.5 Engine API (worker, via Comlink)

```ts
export interface EngineApi {
  init(manifestIds: string[], sharedFingerprint: string): Promise<void>;
  simulate(req: { twin: HomeTwin; pkg?: PackageSpec; modes: RunMode[]; asOf: IsoDate; thermal?: boolean }): Promise<SimResult>;
  search(req: SearchRequest, onProgress?: (p: SearchProgress) => void): Promise<{ jobId: string; result: Promise<SearchResult> }>;
  cancel(jobId: string): void;                               // honoured between slices (≤ 50 ms)
  evidence(resultHash: string, ids: EvidenceId[] | { quantity: QuantityId; packageId?: string }): Promise<EvidenceNode[]>;  // lazy
  uncertainty(resultHash: string, packageIds: string[], samples: number): Promise<UncertaintyResult>;              // after first paint
  calibrate(req: { twin: HomeTwin; meters: MeterData; weather: ActualWeather | null }): Promise<CalibrationPosterior>;
  valueOfInformation(twin: HomeTwin): Promise<{ fieldPath: string; bandReduction: number }[]>;
  flips(resultHash: string, param: 'price.gas' | 'price.electricity' | 'discount'): Promise<FlipPoint[]>;
  noise(req: { twin: HomeTwin; units: AshpUnit[] }): Promise<NoiseResult>;   // < 5 ms, enclosure included
}
export interface SearchRequest { twin: HomeTwin; owner: OwnerCtx; target: Target; memory: { rejected: string[]; completed: string[] }; asOf: IsoDate }
export interface SearchResult {                              // columnar; structured-cloneable typed arrays
  hash: string; specHash: string;
  baseline: Record<RunMode, SimResult>;
  heavy: { keys: string[]; deliveredWh: Record<RunMode, BigInt64Array> };     // [key][fuel][month]
  packages: PackageTable;                                    // columns: heavyIdx, lightOpts, status, n0, npv, carbonSaved, witness, ruleIds...
  front: Uint32Array; picks: { leastUpfront?: number; bestReturn?: number; lowestRunningCarbon?: number };
  needsCheck: Uint32Array;                                   // R22 lane candidates
  graph: EvidenceGraph;                                      // baseline, front, picks only; rest via evidence()
  certificate: Certificate;                                  // type from @ibasho/spec-gen
}
```

**Cancellation.** The search runs in slices of about 20 ms. Between slices it yields a macrotask so a `cancel` message can arrive (DEC TE-6).

### 5.6 UI-side plugins and typed modules

```ts
export interface VisualLayerPlugin extends PluginBase<'visual-layer'> {
  layerId: string; requires: QuantityId[]; encodesNumbers: boolean;
  Overlay: React.FC<LayerProps>;          // animated, drawn over the still-life frame
  ReducedMotion: React.FC<LayerProps>; Svg?: React.FC<LayerProps>;
  Legend?: React.FC<LegendProps>; evidenceAt?(hit: THREE.Intersection, res: SearchResult): EvidenceId | undefined;
  budget: { drawCalls: number; triangles: number; particles?: number };
}
export interface RenderStylePlugin extends PluginBase<'render-style'> { styleId: 'washi' | 'yoru' | string; Bake: React.FC; Live: React.FC; tier: QualityTier }
export interface ExporterPlugin extends PluginBase<'exporter'> { format: 'ibasho' | 'pdf' | 'csv' | 'letter'; export(ctx: ExportCtx): Promise<Blob> }
export interface ImporterPlugin extends PluginBase<'importer'> { accepts: string[]; parse(file: Blob): Promise<MeterData | Partial<HomeTwin>> }
export interface LocalePack extends PluginBase<'locale'> { locale: string; messages: Record<MessageKey, string>; fonts?: FontRef[] }
export interface CheckerRung extends PluginBase<'checker-rung'> { rung: 'lean-native' | 'lean-wasm' | 'mirror'; available(): Promise<boolean>; check(cert: Certificate, scope: 'all' | 'sample'): Promise<Verdict[]> }
// Typed modules (not plugins): Chapter, OnboardingStep { timeCostS }, Panel, Migration, SoundCue (T5)
```

The narrator, grounding, ops and memory contracts are AM §3.4, §4.1, §6.1 and §7.1, with one change: op parameter ranges come from `MeasureModel.options[].params`, not from a zod schema on the measure. They live in `packages/core/src/ai/*.ts`.

## 6. Data flow and the factorised search

```
 Onboarding / edits / ops ─► store.twins.append ─► bus 'twin.changed' ─► debounce 16 ms
                                                          ▼
 engine worker
   simulate (fast path, < 100 ms) ─ baseline + one package, all modes
   search (job, sliced):
     1 groups ─► APPL rules (Kleene) ─► option lists
     2 heavy combos (fabric, vent, controls) × DHW class ─► full physics × 3 modes ─► quantise ─► cache   [GH1: 432]
     3 light combos (heat, sub-measures, PV, battery) on cached demand ─► delivered per fuel-month          [GH1: 10,800]
     4 package rules + obligations (obligation changes heavy key ─► step 2 for that key)
     5 fixed-point bookkeeping: bills, carbon (fuel, month, year), finance, EPC band, target test
     6 front + witnesses + picks + needs-check lane
     7 evidence graph for baseline, front, picks ─► certificate
   after first paint: 5R1C for baseline and picks; uncertainty (LHS 200) for baseline and picks
                                                          ▼  SearchResult (structured clone, typed arrays)
 main: store.results.put ─► worker mirror check (all if ≤ 200 ms, else front + picks + hash-seeded 500)
       ─► seals ─► bus 'cert.verdict'; optional companion POST /verify (Lean native, all) ─► upgrade seals
       ├─► ai: EvidenceBundle ─► template narrator ─► validator ─► narrator strip (optional Ollama polish)
       ├─► scene: geometry, junctions, zone temps ─► still-life bake + overlays
       └─► ui: <Num ev=...> chips everywhere
```

**Factorisation assumption.** The heat source does not change space-heating demand except through the DHW system class (cylinder losses are internal gains) and controls (both are in the heavy key). AC-7 checks the light path against full simulation on 200 random packages within 1 Wh.

**Caching.** Heavy results are cached by `hash(patchedTwin, mode, fingerprint)` (LRU 4k). Price, tariff and discount changes skip physics and recompute only the fixed-point bookkeeping. That is why flip points are cheap.

## 7. Evidence model

```ts
export type EvidenceId = `ev_${string}`;
export type SealLevel = 'checked' | 'modelled' | 'unverified' | 'cracked';   // numbers never 'proved'
export interface EvidenceNode {
  id: EvidenceId; quantity: QuantityId;
  subject: { homeId: string; packageId?: string; measureId?: string; elementId?: string; junctionId?: string; zone?: string; month?: number; mode: RunMode };
  value: { fixed: string; unit: Unit } | { exact: Q } | { float: number } | { interval: Ival<number> } | { cat: string };
  unit: Unit; formula: { id: FormulaId; doc: string; expr?: string };
  inputs: { id: EvidenceId; role: string }[];
  provenance: { kind: 'computed' | 'stated' | 'measured' | 'document' | 'default' | 'catalogue' | 'tariff' | 'owner-claim' | 'calibrated';
                plugin?: { id: string; version: SemVer }; sources?: SourceRef[]; grade?: Grade };
  uncertainty?: { p10: number; p50: number; p90: number };
  seal: SealLevel; check?: { id: CheckId; rung: CheckerRungId; coverage: 'all' | 'sample' };
  derived?: { kind: 'rank' | 'ratio' | 'percent' | 'compare' | 'sign'; of: EvidenceId[] };
  rounding: { mode: 'sig' | 'step'; value: number };
}
export interface Claim { id: ClaimId; theorems: string[]; notProved: MessageKey; appliesTo: { resultHash: string } }   // Proved seals
```

Rules:
- Stages emit drafts, and the pipeline runner (WP-01) assigns ids.
- Seal levels are assigned by `verify`, never by the engine.
- `Claim`s carry the Proved seals (SPEC §7.3).

## 8. Lean integration

### 8.1 Layout

```
proofs/
  lean-toolchain  lakefile.toml
  Ibasho/Spec/V2/…                      current spec; V1 kept for historical certificates (TE-2)
    Fixed.lean        fixed-point types, roundHalfEven, discount recurrence (SPEC §7.4)
    Units.lean        Wh, gCO2e, micro-pence; Fuel; Month
    Score.lean        Dim F C E A H R T, weights, groups, anchors per zone, normalisers, bounds, monotone
    Accounting.lean   FuelMonthVec := Fuel → Month → Int; saving, carbon (monthly factors), carbonSaving_eq
    Finance.lean      N0, B_t, NPV, paybacks, lifetime carbon by year (fixed point); net_cost_nonneg, grants_le_cost
    Tariff.lean       slab bills; slab_bill_monotone, marginal_saving_eq
    Rules/Kleene.lean Expr AST, Kleene eval over fact tables; kleene_sound, unknown_never_feasible
    Rules/Noise.lean  MCS 020 a) as rational enclosure (tabulated 10^(k/100) bounds, 333/106 < π < 355/113); noise_enclosure_sound, noise_sum_ge_max
    Rules/{Adf,Mees,Oblige,Budget,Tenure,Memory,Conflicts,Prereq,Target}.lean
    Enum.lean         choice-group product; enum_complete_sound
    Pareto.lean       Dominates, checkFront, witnesses; checkFront_sound/complete, witness_sound, lexMin_nondominated, checkPicks_sound
    Memory.lean       rejected_never_offered, rejection_antitone, restore_monotone, pareto_subset_feasible (AM §7.2, proved)
    Interval.lean     Ival, fabricLoss_enclosed (surrogate, /app/proofs only; DEC SC-7)
    Packs.lean        well-formedness predicates: slabs monotone, factors ≥ 0, dates ordered, value ordering, anchors valid
  Ibasho/Cert/{Schema,Wire,Check,Sound}.lean   Init-only checker core (WASM-ready); check_sound
  Ibasho/Cert/Json.lean                        Lean.Data.Json adapter (native exe)
  Ibasho/Seals.lean                            claims and bookkeeping theorems for seals.json
  Main/{Check,Gen,Ref}.lean                    exes ibasho-check (--batch), ibasho-gen (--check, --audit), ibasho-ref
  Test/{Golden,Mutants}/                       certificates; one mutant per M1 bug, each fails its named check
```

The toolchain is `leanprover/lean4:v4.34.0`, core only.

### 8.2 Generated artefacts (`lake exe ibasho-gen`, committed, CI fails on drift)

| Output | Path | Consumer |
|---|---|---|
| Spec constants: weights, groups, anchors per zone, band thresholds, reference price pack, fixed-point constants | `packages/spec-gen/src/generated/spec.ts` | engine, verify |
| Named function ids and Expr schema | `packages/spec-gen/src/generated/rules.ts` | registry, rule packs |
| `Certificate` TS types and JSON schema | `packages/spec-gen/src/generated/cert.ts`, `cert.schema.json` | engine emitter, verify, store |
| Seal manifest: claims and theorems, plain sentence, not-proved line, statement, axioms | `packages/spec-gen/src/generated/seals.json` | verify, ui, `/app/proofs` |
| `specHash` and supported historical spec hashes | `packages/spec-gen/src/generated/specHash.ts` | verify |

### 8.3 Certificate `ibasho.cert/2` (columnar)

```jsonc
{
  "schema": "ibasho.cert/2", "specHash": "…", "engine": { "version": "…" },
  "packs":   { "tariffs": […], "carbon": {…}, "trajectory": {…}, "grants": […], "rules": […], "value": {…} },  // data, checked by Packs.lean predicates
  "context": { "owner": {…}, "target": {…}, "memory": { "rejected": […], "completed": […] }, "asOf": "2026-10-10" },
  "groups":  [ { "id": "loft", "options": ["none","270","300"], "facts": { "270": {…} } } ],                 // Lean rebuilds the product
  "baseline": { "standard": "<int64 b64 fuel×month>", "your-home": "…", "rating": "…" },
  "heavy":   { "keys": […], "delivered": { "your-home": "<int64 b64>" , … } },                               // trusted physics
  "light":   { "delivered": "<int64 b64 sparse>" },                                                         // trusted physics
  "claimed": { "status": "<u8 b64>", "n0": "<int64 b64>", "npv": "…", "carbonSaved": "…", "witness": "<u32 b64>", "ruleIds": […] },
  "front": "<u32 b64>", "picks": {…}, "needsCheck": "<u32 b64>"
}
```

Trusted inputs: physics outputs, twin facts and pack data (pack data only after the predicates pass). The checker re-derives everything else.

| Check id | Re-derivation | Catches |
|---|---|---|
| `spec.known` | `specHash` is current or historical | Unknown spec |
| `packs.wellformed` | Packs.lean predicates | Bad tariff, negative factor, expired grant applied |
| `enum.complete` | Lean builds the choice-group product and matches it one to one | Dropped packages |
| `acct.saving`, `acct.carbon` | Per (fuel, month), signs kept, monthly factors | Flipped sign, missing factor, summed percentages |
| `money.bills` | Slab-exact bills | Average-price shortcut |
| `fin.recompute` | N0, NPV, lifetime carbon in fixed point | Value added into NPV, wrong grant |
| `feas.recompute` | Kleene eval of every rule over facts; noise by enclosure | Infeasible heat pump accepted, rejected measure re-offered |
| `target.recompute` | Target predicate | Pick outside the target |
| `pareto.front`, `pareto.witness` | Front non-dominated; every other package has a valid witness, a rule or a target miss | Dominated option shown, hidden better option |
| `pareto.picks` | Lexicographic optima with stated tie-breaks | Wrong pick label |
| `score.recompute` | Exact Q for displayed packages | Wrong weight, unclamped sub-score |

### 8.4 Checker ladder

- `mirror`: `packages/verify/src/mirror`, runs in the worker. It checks everything when the estimate is ≤ 200 ms, else the front, the picks and a hash-seeded sample of 500. The seal states the coverage.
- `lean-native`: CI, `pnpm verify`, and companion `POST /verify`. Always checks everything.
- `lean-wasm`: T5.

### 8.5 CI order

1. `lake build`
2. `ibasho-gen --audit` (standard axioms only)
3. `ibasho-gen --check`
4. Vitest with fast-check certificate generation
5. `ibasho-check --batch`
6. `ibasho-ref` differential
7. Mutation suite
8. Mirror parity
9. Determinism matrix (Node, Chromium, Firefox)
10. Playwright: e2e, a11y, visual, tatami, demo, stranger homes, `renderer.info` under SwiftShader

Lean steps cache `.lake`.

## 9. Persistence (`packages/store`)

Dexie database `ibasho` v1.

| Table | Key | Indexes | Content |
|---|---|---|---|
| `homes` | `id` | `updatedAt` | name, region, archetypeId, active version, plan |
| `twins` | `[homeId+version]` | `homeId` | append-only `HomeTwin` versions |
| `scenarios` | `id` | `homeId` | pinned scenarios |
| `results` | `hash` | `homeId`, `createdAt` | columnar `SearchResult` (LRU 10 per home) |
| `certs` | `resultHash` | | certificate + verdicts per rung with coverage |
| `memory` | `id` | `[homeId+at]`, `type` | append-only `MemoryEvent`s (AM §7.1) |
| `narration` | `[bundleHash+section+provider]` | | validated rendered sections |
| `settings` | `key` | | narrator, motion, units, quality tier, EPC key |
| `blobs` | `id` | | photos, imported CSVs |

- `persist()` is requested after Reveal.
- Migrations are typed modules, tested against fixture DB snapshots.
- Export `.ibasho` is gzipped JSON: `{ schema, homes, twins, scenarios, plan, memory?, packVersions, hash }`.
- Snapshot codec (T2): twin delta from the archetype seed, then canonical JSON, then `deflate-raw`, then base64url.

## 10. Rendering (`packages/scene`)

- **One `<Canvas>`**, with `frameloop="demand"` by default.
- **Still-life** (DEC TE-8). When the camera rests for 300 ms, the active render style's `Bake` pass renders one high-quality frame plus depth: PBR, N8AO, accumulated soft shadows, paper multiply. Layer `Overlay`s (motes, people, lens, noise rings, seams) then animate over it, depth-tested against the baked depth. A camera move switches to the cheap `Live` pass.
- **Miniatures** (futures cards, landing) are baked to textures once per result hash.
- **Before and after** is a scissor split of one scene: the baseline and the package geometry render into two scissor rects, with the shoji divider drawn in DOM. No portal.
- **Twin to geometry** is procedural from `Element.geometry` and `Junction.path`, so geometry and physics share one source. Props come instanced from Kenney and Quaternius. Meshes carry `userData.elementId` or `junctionId`.
- **T1 layers**:
  - `heat-flow`: instanced motes, one per 10 W.
  - `thermal-lens`: Netsu ramp inside a draggable mask; junction lines at ψ·ΔT W/m.
  - `ghost`: baseline pencil overlay.
  - `noise-rings`: MCS 020 a), 1 dB rings, 37.0 threshold.
  - `fold-assembly`: origami, gold seams and new-risk hatches per R19.
  - `zone-tint`: 5R1C zone temperatures.
  - `people`: comfort state from zone temperatures.
- **T1 render styles**: Washi (Hiru), Yoru, and the SVG renderer (fallback and Pencil stage). Sumi, Netsu and Shita-e WebGL are T5.
- **Cameras**: orthographic by default, with 45° azimuth snaps. Perspective is used only for the roof lift. Sequences are JSON keyframes.
- **Quality tiers**: the `PerformanceMonitor` ladder lowers DPR, then disables N8AO, then shadows. The tier drops one step while an LLM is generating.
- **CI**: `renderer.info` counts on GH1 key frames under SwiftShader (AC-PERF). Frame rate is measured by hand at each milestone.
- **a11y-scene**: a DOM outline generated from twin and evidence. DOM focus highlights the mesh, and a mesh click focuses the DOM item.

## 11. Companion (`apps/companion`, optional)

Node 26 + Hono on `127.0.0.1:7357`. Routes:
- `POST /llm/claude` (T2): proxy with the user's key from env.
- `POST /llm/ollama-cors`: optional pass-through when `OLLAMA_ORIGINS` cannot be set.
- `POST /verify`: spawns `lake exe ibasho-check`.
- `GET /health`.

CORS is restricted to the app origin. The companion is never required; the app probes it and adds rungs or providers when it is present.

## 12. Build, scripts, conventions

| Script (root) | Does |
|---|---|
| `pnpm dev` | turbo: web + landing + Storybook |
| `pnpm build` | build all; landing and web into `dist/` (`/` and `/app/`) |
| `pnpm test` | Vitest all packages |
| `pnpm e2e` | Playwright |
| `pnpm proofs` | `lake build && lake exe ibasho-gen` |
| `pnpm verify [cert]` | Lean checker on a certificate or the golden set |
| `pnpm assets` | fetch, transcode, subset, write manifest (seal glyphs are baked by `packages/ui` at build time) |
| `pnpm lint` | Biome, dependency-cruiser, knip, and `tools/lint/{no-dash,no-math,legend,mon}` |
| `pnpm contracts` | cross-WP contract tests (run at every gate) |

Conventions:
- TypeScript strict, `exactOptionalPropertyTypes`, ESM only.
- No default exports except `IbashoModule`.
- Ids in kebab-case; units in names.
- SI internally; money and energy as bigint fixed point after quantisation.
- No JSON floats on the certificate wire.
- ICU messages.
- Every package has a `README.md` stating its owner WP, plugin ids and public API.

## 13. Dependencies (exact versions)

Versions were verified against the npm registry on 2026-10-10. `.npmrc`: `save-exact=true`, `strict-peer-dependencies=true`, `auto-install-peers=false`. Node 26.1.0, pnpm 11.1.1. **T1 dependencies are installed at G0. Later-tier dependencies are installed when their tier starts.**

**Root (dev, T1)**

| Package | Version |
|---|---|
| typescript | 6.0.3 |
| @biomejs/biome | 2.5.15 |
| turbo | 2.11.7 |
| vitest, @vitest/coverage-v8 | 5.0.3 |
| fast-check | 4.10.2 |
| happy-dom | 20.14.6 |
| @playwright/test | 1.64.0 |
| @axe-core/playwright | 4.13.0 |
| dependency-cruiser | 18.5.0 |
| knip | 6.41.0 |
| tsx | 4.23.15 |
| @types/node | 26.6.5 |
| size-limit, @size-limit/preset-app | 14.2.0 |
| culori / @types/culori | 4.0.2 / 4.0.1 |

**Apps (T1)**

| Package | Version |
|---|---|
| vite | 8.3.4 |
| @vitejs/plugin-react | 6.1.2 |
| lightningcss | 1.33.0 |
| vite-plugin-pwa | 2.0.0 |
| workbox-window, workbox-build | 7.4.1 |
| react, react-dom | 19.3.0 |
| @types/react, @types/react-dom | 19.3.0 |
| react-router | 8.4.0 |
| zustand | 5.0.15 |
| comlink | 4.4.2 |
| zod | 4.6.5 |
| intl-messageformat | 12.1.3 |
| web-vitals | 6.2.3 |
| @testing-library/react | 16.3.3 |
| @testing-library/user-event | 14.6.7 |

**UI (T1)**

| Package | Version |
|---|---|
| motion | 14.1.0 |
| @use-gesture/react | 10.3.1 |
| @fontsource/shippori-mincho-b1, @fontsource/zen-kaku-gothic-new | 5.3.0 |
| @fontsource-variable/m-plus-1-code | 5.3.0 |
| opentype.js | 1.3.4 (dev; bakes Yuji Syuku seal glyphs to SVG paths) |
| storybook, @storybook/react-vite | 10.6.1 |

**Scene (T1)**

| Package | Version |
|---|---|
| three / @types/three | 0.186.1 / 0.186.0 |
| @react-three/fiber | 9.8.1 |
| @react-three/drei | 10.7.9 |
| @react-three/postprocessing | 3.2.0 |
| postprocessing | 6.39.5 |
| n8ao | 2.0.1 |
| three-custom-shader-material | 6.4.0 |
| three-mesh-bvh | 0.9.16 |
| maath | 0.10.8 |
| suncalc / @types/suncalc | 2.1.1 / 1.9.2 |
| @react-three/test-renderer | 9.1.1 (dev) |
| leva | 0.10.1 (dev only) |

**Store (T1)**: dexie 4.4.6, dexie-react-hooks 4.4.0, fake-indexeddb 6.2.5 (dev).

**AI (T1)**: ollama 0.6.4.

**Companion (T1)**: hono 4.13.13, @hono/node-server 2.1.4.

**Tools (T1)**: @gltf-transform/core and @gltf-transform/cli 4.5.1, meshoptimizer 1.3.0, sharp 0.35.5, svgo 4.1.0, subset-font 2.9.0. System tools: ffmpeg (present), pyftsubset (present), toktx (absent: textures ship as WebP until it is installed).

**Later tiers**

| Tier | Packages |
|---|---|
| T2 | @mlc-ai/web-llm 0.2.85, @anthropic-ai/sdk 0.133.0 |
| T3 | @fontsource/noto-sans-telugu and noto-sans-devanagari 5.3.0 |
| T5 | howler 2.2.4, tone 15.1.22, roughjs 4.6.6, rough-notation 0.5.1, @takram/three-atmosphere 0.19.1, @fontsource/klee-one 5.3.0 |

**Lean**: `leanprover/lean4:v4.34.0`, core only. No Mathlib in `proofs/`.

**Deliberately not used**:

| Package | Reason |
|---|---|
| TypeScript 7.0 | Tooling peers cap below 6.1 |
| ESLint | Biome covers lint and format |
| `@theatre/*` | Its R3F binding peers on Fiber 8 |
| `@react-three/a11y` | Unmaintained |
| GSAP | Motion covers this |
| vanilla-extract | Not needed |
| A vector DB | Not needed |
| SharedArrayBuffer cancellation | Needs cross-origin isolation |
| drei `MeshPortalMaterial` | Replaced by the scissor split |

## 14. Agent link: MCP server and Claude Code plugin (WP-12)

Goal: an AI agent (Claude Code, or any MCP client) can explore a home the way a person does, headless or live in the open app. It follows the pattern of the tldraw offline skill: a local server, a per-launch token file, a skill, a subagent, a SubagentStart hook, a tiny helper, and an installer.

**Principle.** The agent gets the same power as the user's hands, never more. It edits the twin only through typed `Op`s (ARCH 5.5), reads numbers only as evidence ids with values, and its prose to the user goes through the narrator validator (G1 to G8). No arbitrary code execution in the app. Lean seals and grounding rules apply unchanged.

**Pieces and owners**

| Path | Owner | What |
|---|---|---|
| `packages/agent-bridge/` | WP-12 | Protocol types (zod), Hono sub-app (HTTP + WebSocket) mounted by the companion, browser client `connectAgentLink()` used by `apps/web` |
| `apps/mcp/` | WP-12 | stdio MCP server (`@modelcontextprotocol/sdk`). Runs the engine headless in Node; forwards `live_*` tools to the bridge when the app is open |
| `integrations/claude-code/` | WP-12 | Claude Code plugin: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `skills/ibasho/SKILL.md`, `agents/ibasho-explorer.md`, `.mcp.json`, `hooks/` (SubagentStart context inject), `bin/iq.mjs` helper, `evals/` for `claude plugin eval` |
| `tools/agent-install/` | WP-12 | `pnpm agent:install [--mode plugin or direct] [--scope user or project] [--dry-run] [--uninstall]` |

Mount points owned by others (one line each, requested via INTERFACES): the companion mounts the bridge sub-app (WP-05); `apps/web` calls `connectAgentLink()` when Settings > Agent link is on (WP-08).

**Discovery.** The companion writes `~/.config/ibasho/server.json` `{port, token, pid, startedAt, sessions}` on start and removes it on clean exit. Every route except `GET /health` needs `Authorization: Bearer <token>`. Bind 127.0.0.1 only. The browser tab connects by WebSocket with a pairing code shown in Settings, so a random local page cannot join.

**MCP tools.** Headless tools need no browser:

| Tool | Does |
|---|---|
| `ibasho_list_homes` | fixtures, `.ibasho` files in `~/.config/ibasho/homes/`, and live sessions |
| `ibasho_get_home` | twin summary, knowns and unknowns, provenance |
| `ibasho_simulate` | baseline in a run mode; returns values with evidence ids |
| `ibasho_what_if` | apply `Op[]` to a copy; returns deltas per fuel with evidence ids |
| `ibasho_search_futures` | full search; front, picks, witnesses, why-not list, certificate hash |
| `ibasho_evidence` | one evidence node: formula, inputs, sources, seal |
| `ibasho_why_not` | why a measure is absent and what check would unlock it |
| `ibasho_verify` | check a certificate with the TS mirror, or Lean `ibasho-check` if built |
| `ibasho_memory_list`, `_remember`, `_forget` | the "things you told us" log (typed events only) |
| `ibasho_compare` | two homes or two packages side by side |

Live tools need the app open with Agent link on:

| Tool | Does |
|---|---|
| `ibasho_live_sessions`, `ibasho_live_state` | open tabs; current home, route, chapter, layer, selection |
| `ibasho_live_apply` | apply `Op[]` in the app; the change shows an "agent" mark and is undoable |
| `ibasho_live_view` | layer, camera preset, time of day and month, chapter, focus element |
| `ibasho_live_thread` | pull the red thread from a number to its evidence |
| `ibasho_live_screenshot` | PNG of the stage (for the agent to look at) |
| `ibasho_live_say` | slotted narration rendered in the narrator strip, validated, values filled from evidence |

Resources: `ibasho://docs/{vision,spec}`, `ibasho://schema/twin`, `ibasho://schema/ops`, `ibasho://home/{id}`, `ibasho://cert/{hash}`. Prompts: `explore-my-home`, `compare-futures`, `audit-the-numbers`.

**Privacy.** Agent link is off by default. Turning it on says plainly that the connected agent may send what it reads to its model provider. Every live call is listed in the outbound ledger (SPEC 5.14).

**Installer.** `plugin` mode registers `integrations/claude-code` as a local marketplace and installs it (`claude plugin marketplace add`, `claude plugin install ibasho@ibasho`). `direct` mode mirrors tldraw: copies the skill to `~/.claude/skills/ibasho`, the agent to `~/.claude/agents/ibasho-explorer.md`, runs `claude mcp add ibasho -- node <repo>/apps/mcp/dist/index.js`, and merges the SubagentStart hook into `~/.claude/settings.json` with a timestamped backup. Every installed file carries `installed-by:ibasho`; `--uninstall` removes only marked files and entries.

**Dependencies (T1, WP-12):** `@modelcontextprotocol/sdk` 1.32.1, `ws` 8.22.0 (Node side of the bridge tests).
