# Ibasho v3: AI memory, live recommendations and the design partner

Status: research brief, v3. Owner: AI and memory (WP-05 successor). Builds on `docs/research/ai-memory.md` (cited as AM) and the shipped `packages/ai` (README) and `@ibasho/core` contracts (`ai/ops.ts`, `ai/memory.ts`, `evidence/types.ts`, `twin.ts`).

Scope: v3 adds many buildings (office, hotel, school, hospital, lab, apartments, rentals, single family homes), many projects per owner, an India focus (Hyderabad), energy codes, LEED style points and parametric design. This brief says how the AI layer grows to match, without breaking the founding rule: **the engine computes, Lean checks the bookkeeping, the LLM only narrates and proposes**.

---

## 0. Decisions at a glance

| # | Decision | Why |
|---|---|---|
| V1 | **Memory gets scopes:** owner, portfolio, project, building, variant. Each preference is a typed key with a scope; lower scopes override higher ones, with the source shown. | One owner (a campus estates office, a landlord, Daniel) has goals that hold everywhere ("payback under 7 years") and constraints that hold for one building ("Vindhya is heritage facing; no external cladding"). |
| V2 | **Goals are typed targets, not prose:** `euiTarget`, `codeCompliance`, `leedPoints`, `budgetCap`, `paybackMax`, `carbonCap`, `comfort`, `daylight` (sDA, ASE), each with a unit, a scope and a hardness (`must`, `prefer`, `nice`). | The engine and the search consume them directly; the narrator can only cite them. |
| V3 | **Bi-temporal events:** every memory event carries `validFrom`/`validTo` (when it is true in the world) and `at` (when Ibasho recorded it). | Lets the owner say "from April the tariff is X" or "the lab wing closes in 2028" and lets the app answer "what did you recommend last March, and why?" Idea from Zep/Graphiti. |
| V4 | **Recommendations are a derived, versioned object** (`RecSet`) keyed by `inputsHash` of twin, memory, data packs and engine version. Never stored as truth; always recomputable. | Dynamic update without drift. A stale RecSet is detectable by hash, not by time. |
| V5 | **Live update in four tiers:** instant re-score of the shown picks (incremental), fast re-rank of the cached candidate pool, background full search in a worker, then narration. Each tier replaces the last only when its generation is current. | The UI responds within a frame, the honest answer arrives in seconds, and nothing flickers. |
| V6 | **Stability band (hysteresis):** a new leader replaces the old only when it wins outside the uncertainty band (p10 to p90) or a hard constraint changes. Otherwise both are shown as "tied within what we know". | Unknown is not zero. Prevents recommendations flipping on noise when someone drags a slider. |
| V7 | **"Why it changed" is computed, not written:** diff two evidence graphs by stable id, slice back to the changed leaves, attribute the delta to each change by exact Shapley over at most 4 change groups (engine re-runs), and emit a typed `ChangeExplanation`. The narrator renders it with slots. | Explanations are exact and auditable; the contributions sum to the total change in bigint fixed point, which the Lean checker can verify. |
| V8 | **Design partner = proposer, never evaluator.** The LLM (Ollama `qwen3:8b` locally) proposes `DesignOp[]` variations with a slot-only rationale. The op validator checks them, the engine evaluates them, the search adds survivors to the candidate pool tagged `origin: 'partner'`. | The LLM widens the search where humans have intuition (overhangs, room swaps, WWR by facade) but has zero authority over numbers. |
| V9 | **Offline partner first:** a deterministic proposer driven by engine sensitivities (finite differences on declared parameters) produces the same op format. The LLM is an enhancer. | Works on any device; gives a baseline to measure the LLM against. |
| V10 | **Cross-building learning is retrieval of decisions, never of numbers.** "You chose cool roofs on Himalaya" can seed a proposal for Vindhya; the engine re-evaluates it for Vindhya's geometry and climate. | Transfers the owner's taste and constraints, not someone else's results. |

---

## 1. What exists, and the gaps v3 must close

| Exists (v2) | Gap for v3 |
|---|---|
| `MemoryEvent` log per `homeId`, `Preferences` view, seeds, digest, forget, undo (`core/ai/memory.ts`) | Single home. No portfolio or project scope, no typed goals (EUI, LEED, code), money is `capGBP`, tenure is residential only. |
| `ScenarioOp` union: add/remove measure, setParam, tariff, budget, horizon, compare, explain, reject (`core/ai/ops.ts`) | No geometry or programme ops (floors, rooms, windows, overhangs, orientation, room function), no sweeps, no variant sets. |
| Evidence graph with deterministic ids `ev_<hash(quantity, subject)>`, typed inputs with roles, uncertainty p10/p50/p90, `derived` rank/compare nodes | Not used for diffs yet. Stable ids are exactly what a change explainer needs. |
| Grounding validator G1 to G8, slot grammar R10, template narrator first, `NarratorRouter`, `OllamaProvider`, outbound ledger | No causal language check ("because", "now leads"), no slots for change attributions, kinds lack EUI, points, daylight, INR. |
| Offline intent parser (70%+ exact on 120 utterances) | Vocabulary is retrofit measures only; no design vocabulary ("push the core north", "add a 600 mm overhang on the west"). |
| Lean `rejected_never_offered`, certificate checker for "nothing better hidden" | Needs extension: partner candidates must enter the same certified pool; attribution sums must be checked. |

---

## 2. Research summary

| Work | What it shows | What Ibasho takes |
|---|---|---|
| Zep / Graphiti, temporal knowledge graph for agent memory (Rasmussen et al. 2025) https://arxiv.org/abs/2501.13956 | Bi-temporal edges (event time and ingestion time) let memory answer "what was true when" and invalidate facts without deleting them. Reports gains on LongMemEval. | Bi-temporal fields on events (V3). We keep a typed log, not a graph DB: our keys are few and typed. |
| Letta memory blocks and sleep-time agents https://docs.letta.com/guides/agents/architectures/sleeptime , https://www.letta.com/blog/memory-blocks , paper https://arxiv.org/abs/2504.13171 | A background agent rewrites shared memory blocks while the user is idle; a bigger, slower model for reflection, a fast one for chat. | "Quiet hours" reflection: when idle, the local model proposes seeds and partner variations, which wait in the tray. Never applied without the owner. |
| Mem0 https://arxiv.org/abs/2504.19413 and A-MEM https://arxiv.org/abs/2502.12110 (AM 1.4) | Extract, then ADD / UPDATE / DELETE / NOOP against memory. | Still deterministic in Ibasho because keys are typed; scope is now part of the key. |
| Text2BIM (Du et al., arXiv 2408.08054, J. Comput. Civ. Eng. 2026) https://arxiv.org/abs/2408.08054 | Multi-agent LLMs turn text into BIM API calls; a rule-based model checker drives repair loops. | Validates the pattern: LLM emits typed operations, a checker repairs. We go further: ops are data, not code, so nothing executes that the validator did not admit. |
| LLM agent workflows for EnergyPlus models (Zhang et al., Energy and Buildings 2025) https://researchdiscovery.drexel.edu/esploro/outputs/journalArticle/Automatic-building-energy-model-development-and/991022197310804721 ; NREL "Advancing BEM with LLMs" https://research-hub.nrel.gov/en/publications/advancing-building-energy-modeling-with-large-language-models-exp/ | Naive prompting produces broken models; staged agents plus debugging agents do better. MCP based conversational editing cut inspection tasks from hours to minutes (Li et al. 2026, JBPS). | Natural language is a good front door for model editing; reliability comes from structure. Our typed `DesignOp` plus validator is the structure. |
| MOEA/D-LO, LLM as search operator (arXiv 2310.12541) https://arxiv.org/abs/2310.12541 ; LLM as candidate sampler in hierarchical MOO (arXiv 2601.13892) https://papers.cool/arxiv/2601.13892 ; LLM-designed operators (arXiv 2406.08987) https://arxiv.org/abs/2406.08987 | LLMs work as mutation and sampling operators inside a population search, with a real evaluator scoring every candidate. | V8: the partner is an extra operator feeding our deterministic search. The evaluator is always the engine. |
| MOLONE comparative explanations for human-in-the-loop preference BO (arXiv 2504.03744) https://arxiv.org/abs/2504.03744 ; R-XIMO (Misitano, Afsar, Lárraga, Miettinen) https://www.datalearner.com/academic/journal-papers/1387-2532/volumes-and-issues/705/paper-detail/4546 ; explainability in interactive MOO survey https://jyx.jyu.fi/handle/123456789/101928 | Users converge faster when shown which inputs and which objectives drive "A over B"; R-XIMO suggests which objective to give up to improve another. | Two explanation types: "why A over B" (contrastive, at one time) and "why it changed" (temporal, V7). The trade-off hint ("to gain 4 LEED points, accept 1.3 years longer payback") is computed from the front. |
| Adapton, demand-driven incremental computation (Hammer et al., PLDI 2014) https://people.mpi-sws.org/~hammer/adapton-pldi2014.pdf ; miniAdapton https://arxiv.org/abs/1609.05337 | Store results plus a dependency graph; mark dirty on change; recompute only what an observer demands. Not always faster than from scratch. | Tier 1 of live update (V5): the evidence graph is already the dependency graph; only nodes the visible panel reads are recomputed first. Fall back to full recompute when the dirty set is large. |
| Shapley value decomposition (efficiency axiom: contributions sum to the total) https://en.wikipedia.org/wiki/Shapley_value | Fair, order-free attribution of a total change to several causes. | V7: exact for up to 4 change groups (16 engine runs, cached). Efficiency is a bookkeeping identity Lean can check. |
| Proof-Carrying Numbers (arXiv 2509.06902), Spotlighting (arXiv 2403.14720), Dual LLM, CaMeL (AM 1.4) | Grounding and injection defence. | Unchanged; extended with rule G9 and new kinds. |
| Ollama structured outputs https://docs.ollama.com/capabilities/structured-outputs ; Ollama `qwen3:8b` https://ollama.com/library/qwen3:8b ; Qwen3 card https://huggingface.co/Qwen/Qwen3-8B | `format` takes a JSON schema (Zod `z.toJSONSchema()`), schema should also be in the prompt. `qwen3:8b` is 8.19B, Q4_K_M, 5.2 GB, tagged tools and thinking. Native context 32K. Community notes: use `/api/chat` with `think: false` for structured calls; reasoning plus structured output in one call has been unreliable. | Partner calls use `/api/chat`, `think: false`, `format: <schema>`, explicit `num_ctx` (16K is enough), `temperature: 0`, fixed `seed`. If we want reasoning, a separate unconstrained "think" call feeds a short summary into the constrained call. |

---

## 3. Memory across buildings and projects

### 3.1 Hierarchy

```
Owner (person or estates office)
 └─ Portfolio  (for example "IIIT Hyderabad campus", "Daniel's rentals")
     └─ Project (a retrofit round, a new build, a competition entry)
         └─ Building (Vindhya Bhavan, Himalaya, a WeWork floor plate, GH1)
             └─ Variant (a parametric design or a retrofit package under study)
```

Every memory event names its scope: `{ level: 'owner' | 'portfolio' | 'project' | 'building' | 'variant'; id }`. Resolution is "nearest scope wins", like CSS cascade, and the effective view records which scope each value came from so the garden card can say "from your campus rules" or "set for Vindhya only".

### 3.2 Typed goals and constraints

| Key | Type | Example | Consumed by |
|---|---|---|---|
| `euiTarget` | kWh/m2.yr, hardness | 90, `must`, building | Search feasibility (`must`), ranking (`prefer`) |
| `codeCompliance` | `{ code: 'ECSBC-2024' \| 'ECBC-2017' \| 'ENS' \| 'ASHRAE-90.1-2022' \| 'IECC-2024' \| 'UK-Part-L-2021' ..., tier?: 'compliant' \| 'plus' \| 'super' }` | ECBC Super, portfolio | Rules packs (Kleene: unknown stays unknown) |
| `ratingTarget` | `{ scheme: 'LEED-v4.1' \| 'LEED-v5' \| 'IGBC' \| 'GRIHA'; points?: number; credits?: string[] }` | LEED EA points 12 or more | Score pack |
| `budgetCap` | `{ amount: bigint; currency: 'INR' \| 'GBP' \| ...}` | 2.5 crore, project | Feasibility |
| `paybackMax`, `horizonYears`, `discountRate` | years, % | 7 years | Ranking, money pack |
| `carbonCap` | tCO2e/yr, scope | portfolio | Ranking |
| `comfort` | `{ adaptive?: 'IMAC' \| 'EN16798' \| 'ASHRAE55'; maxOverheatHours? }` | IMAC (India Model for Adaptive Comfort) | Physics checks |
| `daylight` | `{ sDA300_50?: number; ASE1000_250Max?: number }` | sDA 55%, ASE under 10% | Site analysis pack |
| `rights` | per element: roof, facade, structure, windows, plant space | tenant: no structure | Feasibility (existing) |
| `rejected`, `completed`, `snoozed` | measure or design-op family | "no external shading on the heritage facade" | Feasibility, Lean theorem (existing, now scoped) |
| `priorities` | ranked list extended with `daylight`, `views`, `water`, `low-maintenance`, `upfront-cost`, `running-cost` | | Tie-break order, narrator emphasis |
| `rates` | tariff ids, escalation, grid factor, gas price | TSSPDCL HT tariff | Money pack; changes fire re-recommendation |

Rule: every goal value is entered by the owner or imported from a pack. An LLM may only propose a goal as a seed.

### 3.3 Event additions (extend `MemoryPayloads`)

| Event | Payload | Note |
|---|---|---|
| `goalSet` | `{ key, value, hardness, scope }` | Replaces `budgetSet` (kept as alias for v2 data) |
| `goalCleared` | `{ key, scope }` | |
| `constraintSet` | `{ key: 'rights' \| 'designLimit', value, scope }` | `designLimit` holds geometry limits ("floor-to-floor at least 3.3 m") |
| `variantCreated` / `variantArchived` | `{ variantId, parentId, ops }` | A variant is a named op list over a base, so it replays |
| `recommendationShown` | `{ recSetId, inputsHash, leaderIds }` | Needed to explain changes later ("last time we showed B") |
| `recommendationPinned` / `Unpinned` | `{ recSetId, itemId }` | Pinned items stay visible and are always re-scored |
| `partnerProposed` | `{ proposalId, ops, rationale, provider }` | Always actor `llm-proposal` or `engine` (offline proposer) |
| `partnerAccepted` / `partnerDismissed` | `{ proposalId, reason? }` | Dismissal reasons teach the proposer (section 6.5) |
| `externalDataChanged` | `{ pack, from, to }` | Tariff, code version, weather file, grid factor |

All events gain `scope` and optional `validFrom`/`validTo`. The digest becomes `digest(scopeChain, focus)`.

### 3.4 Cross-building decision memory

A small, typed "decision record" per accepted or rejected option: `{ building feature vector, op family, verdict, reason code }`. Feature vector: building type, climate zone (NBC/ECBC zone, ASHRAE 169 zone), age band, storeys, WWR band, structure, tenure. Retrieval is nearest neighbour over this vector (plain weighted Hamming distance, deterministic; no embeddings needed).

Use: when Vindhya is opened, the proposer sees "Himalaya (same campus, same zone, similar WWR): owner accepted cool roof, rejected external fins (reason: maintenance)". It may then propose a cool roof for Vindhya and avoid fins, but the **numbers for Vindhya come from Vindhya's engine run**. The narrator may say "you chose this on [[b:himalaya]]" (a new building slot), never "it saved X there, so it will here".

### 3.5 Lean extension

Generalise `Ctx` to a scope chain and prove:

- `scoped_rejection_never_offered`: a measure rejected at any scope on the chain is absent from every offered package for that building.
- `scope_override_sound`: the effective preference equals the nearest defined scope (functional spec of the resolver; TS mirror tested against it by the existing differential oracle).
- `partner_pool_monotone`: adding partner candidates to the pool never removes a certified-front member that still dominates (the front is recomputed over the union; the certificate covers the union).

---

## 4. Live recommendations (dynamic update)

### 4.1 The RecSet object

```ts
export interface RecSet {
  id: string;                        // content hash
  inputsHash: string;                // twin + effective memory + packs + engine version
  generation: number;                // monotonically increasing per building view
  tier: 'instant' | 'rerank' | 'full';
  objectives: ObjectiveId[];         // e.g. ['capex', 'opex', 'eui', 'carbon', 'leedPoints']
  items: RecItem[];
  hiddenByMemory: { count: number; byKey: Record<string, number> };
  certificate?: { id: string; rung: CheckerRungId };   // only on tier 'full'
}
export interface RecItem {
  id: string;                        // stable: hash of the op list, not the position
  role: 'least-upfront' | 'best-return' | 'lowest-carbon' | 'best-eui' | 'most-points' | 'pinned' | 'partner';
  ops: DesignOp[];                   // what to build
  evidence: EvidenceId[];            // every number shown
  stability: 'clear' | 'tied' | 'new' | 'unchanged';
  origin: 'search' | 'partner' | 'owner';
}
```

Item ids are hashes of their op list, so "the same package" is recognisable across recomputes even when its numbers move.

### 4.2 Four tiers

| Tier | Trigger | Work | Budget | Shows |
|---|---|---|---|---|
| T0 instant | Every edit (slider, drag a window, change a rate) | Apply `TwinPatch`; mark dirty nodes in the evidence graph; recompute only nodes read by visible panels for the current leaders and pinned items | under 50 ms, main thread or worker | Numbers move on current cards; seals crack (R11) |
| T1 re-rank | 150 ms after the last edit (debounce) | Re-score the cached candidate pool (last full search, typically hundreds of packages) with incremental engine | under 1.5 s, worker | Leaders may reorder within the band; "re-checking" marker |
| T2 full | 600 ms idle, or on hard-constraint change | Full search in a worker, cancellable via `AbortSignal`; certificate checker | seconds | New RecSet with certificate; seals re-press |
| T3 narrate | After T2 lands | Template story at once, local LLM polish if ready | template under 100 ms | Story and change explanation |

Every tier result carries the `generation` it was started for; results with an older generation are dropped (no race where a slow search overwrites a newer edit). Hard constraints (rights, `must` goals, rejections) skip T1 and go straight to T2, because the pool itself may now be invalid.

### 4.3 Stability band

Leader A is replaced by B on the visible card only if B beats A on the card's objective at B's p90 versus A's p10 (or the reverse for minimised objectives), or if A became infeasible. Otherwise the card shows A with a "tied within what we know" note and a link to B. Each item carries `stability` so the UI can animate "new", "moved", "unchanged" without guessing.

### 4.4 Change triggers beyond the owner

| Trigger | Source | Behaviour |
|---|---|---|
| Tariff, grid factor, escalation | money and climate packs | `externalDataChanged` event; next visit opens with "What changed since you were here" |
| Code version (for example ECBC 2017 to ECSBC 2024) | rules packs | Compliance re-evaluated; any lost compliance is a top-of-page notice |
| Snooze expiry | memory `validTo` | Measure returns to the pool; narrator acknowledges it |
| Completed measure, new meter data | owner | Calibration refit (existing), then re-recommend |
| Pack or engine upgrade | app | Old RecSet kept for comparison; change explainer separates "your house changed" from "our model changed" |

---

## 5. Explaining why a recommendation changed

### 5.1 Algorithm

1. **Diff inputs.** Compare the old and new `inputsHash` components: twin patches, effective memory, pack versions, engine version. Group them into at most 4 **change groups** by origin (for example "you widened the west windows", "tariff rose", "you ruled out fins", "engine 3.1"). More than 4 changes are grouped by subsystem.
2. **Diff evidence.** Old and new graphs share stable ids. Changed nodes are those whose value differs beyond rounding. Slice backwards through `inputs` to the changed leaves, giving a causal path per output (for example `eui` <- `cooling.load` <- `solar.gain.west` <- `window.w3.area`).
3. **Attribute.** For each headline quantity (leader's EUI, capex, opex, points, and the leader identity itself), run the engine on each subset of change groups: 2^k runs, at most 16, cached by hash, on the worker. Compute exact Shapley contributions in bigint fixed point. By the efficiency property, contributions sum to the total delta exactly.
4. **Explain the leader switch.** If the leader changed, find the first reason it lost: became infeasible (which rule or memory key), lost on its objective (which group contributed most to the gap), or fell inside the band. This is a typed reason, not prose.
5. **Emit** a `ChangeExplanation`, add attribution nodes to the evidence graph (`derived.kind: 'attribution'`), and let the checker verify the sum identity.

```ts
export interface ChangeExplanation {
  from: { recSetId: string; at: string };
  to:   { recSetId: string; at: string };
  groups: { id: string; origin: 'owner-edit' | 'memory' | 'external-data' | 'model-update'; label: string; events: string[] }[];
  quantities: { evidenceId: EvidenceId; delta: EvidenceId; contributions: { group: string; evidenceId: EvidenceId }[] }[];
  leader?: {
    card: RecItem['role']; was: string; now: string;
    reason: { kind: 'infeasible'; rule: string } | { kind: 'outscored'; mainGroup: string } | { kind: 'band' };
  };
  paths: { output: EvidenceId; chain: EvidenceId[] }[];   // for the red thread (VISION moment 5)
}
```

### 5.2 Why Shapley and not one-at-a-time

One-at-a-time deltas depend on order and do not sum to the total when changes interact (a bigger west window matters more after the tariff rise). Shapley is order-free and sums exactly. With k at most 4 groups the cost is 16 engine evaluations, cached; above that, groups are merged rather than sampling (sampling would make explanations non-deterministic).

### 5.3 Narration

Template first, slots only. Example (template, en-GB):

> Your best-return option is now [[p:cool_roof_plus_glazing]] instead of [[p:glazing_only]]. Most of the change came from the new tariff, which added [[e:41|approx]] a year to running costs; the wider west windows added [[e:42|approx]]. [[p:glazing_only]] is still on the table and sits within what we know of the leader.

New validator rule:

| Rule | Check | On failure |
|---|---|---|
| G9 Causal claims | Any causal or change connective ("because", "due to", "now", "instead of", "most of the change") must sit in a sentence that cites an attribution node or a `leader.reason`, and the ordering words ("most", "mainly") must match the largest contribution | Repair, then template |
| G10 Cross-building | A `[[b:..]]` building slot may not share a sentence with a computed number of another building | Repair |

New slots: `[[p:..]]` (package or variant), `[[b:..]]` (building), `[[g:..]]` (goal, renders value and scope). New evidence kinds: `eui`, `points`, `daylightPct`, `sunHours`, `irradiance`, `endUse`, `waterUse`, `attribution`, money in INR with lakh and crore formatting (`en-IN` locale rounding policy: to the nearest thousand rupees below one lakh, else to two significant figures in lakh or crore).

### 5.4 Two more explanation types

| Type | Question | Computation |
|---|---|---|
| Contrastive | "Why A and not B?" | Per-objective differences from the front, plus the first rule or memory key that excludes B if infeasible (existing "why not") |
| Trade-off hint | "What would it take to get B's points?" | Neighbour on the Pareto front along the requested objective; reports the cost on the others (R-XIMO idea), all as evidence |
| Counterfactual goal | "What budget would make the heat pump option appear?" | Bisection on the goal value with the engine (deterministic, bounded steps); answer is an evidence node with its formula `bisect(goal, feasible)` |

---

## 6. The design partner

### 6.1 DesignOp: typed operations over the building model

Extends `ScenarioOp`. Every op names targets by stable ids from the plan model (floors, zones, rooms, openings, surfaces) and every numeric parameter is range-checked by the owning pack's schema (ARCH 5.6), never by the JSON schema (Claude and Ollama ignore numeric bounds).

| Family | Ops (examples) |
|---|---|
| Massing | `setOrientation(deg)`, `setFloorCount`, `setFloorToFloor`, `extrudeFootprint`, `addCourtyard`, `setAspectRatio` |
| Plan | `addFloor`, `addRoom(floor, polygon, function)`, `setRoomFunction(roomId, fn)`, `swapRooms`, `moveCore(direction)`, `splitRoom`, `mergeRooms` |
| Openings | `setWWR(facade, ratio)`, `addWindow`, `resizeWindow`, `setGlazing(openingId, productId)`, `setSillHeight` |
| Shading | `addOverhang(facade, depth, extension)`, `addFins(facade, depth, spacing)`, `addJali(facade, porosity)`, `addLightShelf` |
| Envelope | `setWallAssembly`, `setRoofAssembly`, `setRoofFinish(albedo class)` (cool roof), `addInsulation` |
| Systems | `setHVAC(systemId)`, `setSetpoint`, `setLPD`, `addDaylightControls`, `addPV(surface, coverage)`, `addSolarHotWater`, `setWaterFixtures` |
| Operations | `setSchedule(roomFn, scheduleId)`, `setOccupancy`, `setRates(tariffId)` |
| Meta | `sweep({ op, param, values })`, `variant({ name, ops })`, `compare`, `explain`, `reject` |

`sweep` is the parametric primitive: the partner proposes the axis ("west overhang depth 0 to 1.2 m in 4 steps"), the engine evaluates each point, the UI draws the curve. Values are proposed as **step indices into a pack-declared grid**, not raw numbers, so the LLM still never writes a quantity: `{ op: 'sweep', target: 'facade:west', param: 'overhang.depth', grid: 'standard', steps: 'all' }`. Where an op needs a value (a room function, an orientation), it is an enum or a grid index.

This keeps D1 intact for proposals: the partner chooses *what to try*, the pack defines *what values exist*, the engine says *what happens*.

### 6.2 The loop

```
 Owner goal or question ──► Proposer (offline sensitivity, or LLM via router)
                                 │ DesignOp[] + slot-only rationale
                                 ▼
                         OpValidator (schema, grid, rights, codes, memory, geometry sanity)
                                 │ admitted ops
                                 ▼
                         Engine (worker): evaluate variants and sweeps, evidence
                                 │
                                 ▼
                         Candidate pool (origin 'partner') ──► Search + certificate over the union
                                 │
                                 ▼
                         Proposal tray (ghosted geometry in the 3D scene, evidence chips)
                                 │ Accept / Tweak / Dismiss (reason)
                                 ▼
                         Memory events (partnerAccepted / partnerDismissed)
```

Budget: at most N evaluations per proposal round (default 64, a setting), so a proposer cannot flood the engine. Proposals that are dominated on every objective by an existing item are shown only as "tried, not better" in a collapsible list (honesty: show what was tried).

### 6.3 Offline proposer (default)

1. Compute local sensitivities of each objective to each declared parameter by one-sided finite differences on grid neighbours (engine runs, cached).
2. Rank levers by improvement per unit cost on the owner's top priority, filtered by rights, memory and codes.
3. Propose the top three single-lever moves and the best two-lever combination; propose a sweep on the most sensitive continuous parameter.

This is deterministic, explainable ("the biggest lever on cooling for this building is the west glass") and gives a baseline score for the LLM proposer.

### 6.4 LLM proposer on Ollama `qwen3:8b`

| Concern | Choice |
|---|---|
| Endpoint | `POST /api/chat`, `stream: false` for proposals, `format: <JSON schema>` from Zod, `think: false` |
| Determinism | `options: { temperature: 0, seed: <hash of request>, num_ctx: 16384 }` |
| Prompt content | Building summary as typed facts (type, zone, geometry stats, end-use split as **evidence ids with labels and ranks**, not values), effective goals, memory digest, sensitivities from 6.3, the op catalogue for this building, dismissed proposal reasons |
| Numbers in the prompt | Labels and ranks only ("cooling is the largest end use", rank evidence). The model reasons over order, not magnitude, which small models handle better and which removes any temptation to echo digits |
| Schema size | Two-stage decoding: stage 1 picks op families and targets (small enum schema); stage 2 fills each op with that family's schema. Keeps each schema small, which helps 8B models and grammar-constrained decoding |
| Reasoning | Optional separate `think: true` unconstrained call that returns a short plan; its text is discarded except as a hint to the constrained call, and is never shown |
| Output check | Zod validation, then OpValidator, then G1 to G10 on the rationale |
| Failure | Fall back to the offline proposer; mark the tray "suggested by Ibasho's rules" vs "suggested by your local model" |
| Quiet hours | When the app is idle and the device is on power, run a round in the background (Letta sleep-time idea); results wait in the tray. Off by default on battery; a setting |

The provider stays behind `NarratorRouter.planOps` (AM 4.2): Ollama locally, WebLLM `Qwen3-4B` in browser, Claude optional with the outbound ledger.

### 6.5 Learning from dismissals without learning numbers

Dismiss reasons are a small enum: `cost`, `looks`, `maintenance`, `not-allowed`, `disruption`, `already-tried`, `other`. Two dismissals of the same op family with the same reason produce a seed ("Avoid external fins on this campus?"). Accepting the seed writes a scoped `rejected` entry, which the Lean theorem then covers. The proposer prompt receives dismissed families so it stops repeating them.

### 6.6 Portfolio optimisation

For a portfolio with a shared budget (a campus, Daniel's rentals), the engine already gives each building a Pareto front. Allocation across buildings is a multiple-choice knapsack over those fronts (pick one option per building, total capex within budget, maximise the chosen objective). It is small (tens of buildings, tens of options each), solved exactly by dynamic programming over quantised budget in bigint, and its certificate is checkable the same way as the per-building front. The AI layer only narrates it ("spend first on Himalaya's roof; it buys the most EUI per rupee") with slots to the allocation evidence.

---

## 7. UX

| Element | Behaviour |
|---|---|
| Recommendation rail | Cards for least upfront, best return, lowest carbon, best EUI, most points, plus pinned and partner items. Each card shows `stability` with a quiet ink mark: new, moved, tied, unchanged |
| Change ribbon | After any T2 update, a thin ribbon: "Best return changed. Why?" Opens the change story with a waterfall of Shapley contributions (bars sum visibly to the total) |
| Timeline | Scrub past RecSets for this building (from `recommendationShown` events) and compare any two; the explainer runs on any pair |
| Partner tray | Ghosted geometry in the 3D scene (an overhang drawn in pencil), evidence chips, Accept / Tweak / Dismiss with reason chips |
| Memory garden v3 | One garden per scope; portfolio stones appear in every building's garden in a muted ink with "from your campus rules"; scope badge on every card; bi-temporal items show "from April" |
| Settings | Rates (tariffs, escalation, grid factor, discount rate), levels (uncertainty band width shown, evaluation budget per round, quiet hours on or off, provider choice with locality badge) |
| Plain and pro modes | Plain mode says "cooler rooms, smaller bill"; pro mode shows EUI, LEED EA points, sDA/ASE and the attribution table. Same evidence, different templates |

---

## 8. Contracts to add to `@ibasho/core` (proposals for INTERFACES)

| File | Additions |
|---|---|
| `ai/memory.ts` | `Scope`, `ScopeChain`, `Goal` union (3.2), new payloads (3.3), `validFrom`/`validTo`, `digest(scopeChain, focus)`, `DecisionRecord`; `budgetSet` kept as an alias |
| `ai/ops.ts` | `DesignOp` union (6.1) with `GridRef` for values; `sweep`, `variant`; `OpValidation.rejected.code` gains `geometry`, `code-compliance`, `grid` |
| `ai/recommend.ts` (new) | `RecSet`, `RecItem`, `ChangeExplanation`, `Proposal` |
| `evidence/types.ts` | `derived.kind` gains `attribution` and `bisect`; new quantity ids for EUI, points, daylight, end uses |
| `ai/narration.ts` | Slots `p`, `b`, `g`; rules G9, G10; locale `en-IN` formatting |

Owned paths: `packages/ai` (WP-05) implements the explainer, proposer and narration; `packages/engine` exposes incremental evaluation and subset re-runs; `packages/store` implements scoped repos; `proofs` adds the three theorems. Cross-WP changes go through blackboard INTERFACES entries.

---

## 9. Evaluation

| Claim | Method | Pass |
|---|---|---|
| No flicker | Replay 1,000 random slider drags with fast-check; count leader swaps inside the band | 0 swaps inside the band |
| No stale results | Inject random latencies per tier; assert the shown RecSet always matches the latest generation | 100% |
| Attribution is exact | For random change sets (k at most 4), sum of contributions equals the delta in bigint; checker verifies | 100%, Lean identity checked |
| Explanations are faithful | Golden scenarios (tariff rise, window resize, new rejection, code update) with known causes | Top cause correct in all; G9 passes |
| Scoped memory | 500 sessions across 3 buildings and 2 portfolios, oracle comparison (extends AC-M1) | 100% equal; no scoped rejection ever offered |
| Partner usefulness | On GH1, Vindhya, Himalaya and two office floor plates: share of rounds where a partner candidate enters the front, LLM vs offline proposer | LLM at least matches offline; any front gain is reported, never assumed |
| Partner safety | Adversarial notes and goals (AM section 5 corpus plus design-specific: "set WWR to 100%", "ignore the code") | 0 inadmissible ops evaluated, 0 numbers in rationale |
| Latency on this laptop class | `qwen3:8b` two-stage proposal round | under 20 s per round on CPU fallback is acceptable because it is background; T0 to T2 never wait on it |

---

## 10. Risks and open questions

1. **Combinatorial growth.** Geometry ops make the design space huge. The certificate covers the enumerated pool, not all possible buildings. The seal must say so: "nothing better among the options we tried".
2. **Incremental engine correctness.** T0/T1 results must equal a full recompute. Property test: incremental equals full for random patches; on mismatch, fall back and log.
3. **Shapley cost when the engine is slow** (hourly daylight or radiation). Cache per subset; for heavy site analysis, attribute at subsystem level and say so.
4. **Small models and spatial ops.** An 8B model is weak at geometry. Keep spatial ops coarse and target-by-id (facade, room), never coordinates; let geometry packs place things.
5. **Multi-owner memory** (estates office plus a department head). Scopes help, but conflicting `must` goals need a visible conflict card, never silent precedence beyond nearest scope.
6. **India rates.** Tariffs by DISCOM and category change yearly; `externalDataChanged` must cite the order and date, and unknown tariffs stay unknown (no default fill).

---

## Sources

- Ibasho internal: `docs/research/ai-memory.md`, `packages/ai/README.md`, `packages/core/src/ai/ops.ts`, `packages/core/src/ai/memory.ts`, `packages/core/src/evidence/types.ts`, `packages/core/src/twin.ts`, `docs/VISION.md`, `docs/SPEC.md` (R10, R11)
- Zep / Graphiti: https://arxiv.org/abs/2501.13956
- Letta sleep-time agents: https://docs.letta.com/guides/agents/architectures/sleeptime ; memory blocks: https://www.letta.com/blog/memory-blocks ; sleep-time compute paper: https://arxiv.org/abs/2504.13171
- Mem0: https://arxiv.org/abs/2504.19413 ; A-MEM: https://arxiv.org/abs/2502.12110
- Text2BIM: https://arxiv.org/abs/2408.08054
- LLM workflow for EnergyPlus models (Energy and Buildings 2025): https://researchdiscovery.drexel.edu/esploro/outputs/journalArticle/Automatic-building-energy-model-development-and/991022197310804721
- NREL, Advancing BEM with LLMs: https://research-hub.nrel.gov/en/publications/advancing-building-energy-modeling-with-large-language-models-exp/
- Fine-tuned small LLMs for PV EnergyPlus models (E3S 2026): https://www.e3s-conferences.org/10.1051/e3sconf/202671606011
- AutoBEE (Tongji): https://a434.tongji.edu.cn/Auto_BEE.pdf
- MOEA/D-LO: https://arxiv.org/abs/2310.12541 ; LLM operators: https://arxiv.org/abs/2406.08987 ; hierarchical MOO with LLMs: https://papers.cool/arxiv/2601.13892
- MOLONE: https://arxiv.org/abs/2504.03744 ; R-XIMO: https://www.datalearner.com/academic/journal-papers/1387-2532/volumes-and-issues/705/paper-detail/4546 ; explainability in interactive MOO: https://jyx.jyu.fi/handle/123456789/101928
- Adapton (PLDI 2014): https://people.mpi-sws.org/~hammer/adapton-pldi2014.pdf ; miniAdapton: https://arxiv.org/abs/1609.05337
- Shapley value: https://en.wikipedia.org/wiki/Shapley_value
- Ollama structured outputs: https://docs.ollama.com/capabilities/structured-outputs ; `qwen3:8b`: https://ollama.com/library/qwen3:8b ; Qwen3-8B card: https://huggingface.co/Qwen/Qwen3-8B ; notes on `think: false` with structured output: https://researchai.ucsf.edu/class/lma/ollama_bash
- Phototropic housing (inspiration for orientation and shading ops): https://www.aprilli.com/sustainability/phototropic-housing-gbbcb
