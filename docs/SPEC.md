# Ibasho: Product Specification

Status: director synthesis v2, 2026-10-10. Normative for all builder agents. Where a research brief and this spec disagree, this spec wins. To change it, raise a BLOCKER on `docs/BLACKBOARD.typ`. v2 applies `review/DECISIONS.md`. Rulings changed in v2 are marked **(v2)**.

References use the form `BP §3.7` for the research briefs in `docs/research/`:

| Prefix | Brief |
|---|---|
| BP | building-physics |
| SF | score-finance |
| RP | regulation-planning |
| LV | lean-verification |
| AM | ai-memory |
| SV | storytelling-visual |
| UX | ux-product |
| PA | prior-art |

`DEC PR-3` refers to a row in `review/DECISIONS.md`.

---

## 0. Director rulings

Builders treat these as fixed.

| # | Topic | Ruling |
|---|---|---|
| R1 | Hero home | **GH1**: 1905 solid-brick mid-terrace, London, conservation area, gas combi, owner-occupier. No budget is set at Reveal; the demo sets £15,000 after the futures appear. Perfect it first. GH2 (Hyderabad top-floor flat, tenant) is the second act. GH3 (1930s cavity semi, Manchester, landlord) drives landlord mode. |
| R2 | Score weights | SF §2.1: F 1/5, C 1/5, E 3/20, A 3/20, H 1/10, R 1/10, T 1/10. **(v2)** Four display groups: Fabric and heating (F, H; 3/10), Running cost (A, E; 3/10), Carbon (C, R; 3/10), Comfort (T; 1/10). Water and flood stay an unweighted side indicator. |
| R3 | Run modes **(v2)** | Three modes run on every heavy simulation. **`rating`** (UK only): SAP 10.2 and RdSAP 10 conventions (UK-average climate, heating October to May, no opaque gains, RdSAP 10 Table 32 prices and standing charges, published rating formula). It drives only the estimated EPC band. **`standard`**: SAP occupancy and set-points on the home's own climate pack, all 12 months, fixed reference prices and SAP 10.2 factors. It drives the score. It makes no ±5% SAP claim. **`your-home`**: actual occupants, thermostat, hours, tariffs and calibration. It drives bills, savings, finance, comfort story and narration. |
| R4 | A indicator **(v2)** | Cost per m² per year at a **pinned reference price pack** (`prices/reference-v1`, SAP 10.2 Table 12 unit prices and standing charges), owned by the Lean spec. Anchors are re-derived so a NEED-median home lands mid-scale (test AC-S3). A tariff change never moves the score. Income burden appears in the finance view only. |
| R5 | T indicator **(v2)** | Hourly 5R1C (ISO 52016-1 family) per zone (living area, rest of home) on hourly climate. It counts occupied hot hours above 26 °C (bedrooms at night, as in CIBSE TM59) and cold hours below 18 °C. It runs for the baseline, the three picks and any package the owner opens. T-lite is removed. |
| R6 | Carbon **(v2)** | Vectors are indexed by **(fuel, month)** everywhere: engine, certificate and Lean. Standard: SAP 10.2 monthly factors. Your home: DESNZ latest generation factor plus T&D losses, from the same workbook. India: CEA weighted average adjusted to consumption by T&D losses, graded `estimate` until read. Lifetime carbon uses the `carbon-trajectory` plugin (DESNZ Green Book long-run marginal factors by year). Carbon is **operational only**; embodied carbon is a T5 plugin. |
| R7 | Picks **(v2)** | All picks come from the **target set**: feasible packages that meet the owner's target. The default target saves money in year 1 **and** cuts running carbon. For landlords it is an estimated EPC band whose lower bound is at least C. **Least upfront** = lexicographic min of (N0, −carbon saved, −NPV). **Best return** = max NPV at the owner's discount rate; ties go to lower N0, then more carbon saved. **Lowest running carbon** = max lifetime operational tCO2e saved; ties go to higher NPV, then lower N0. The empty package is never a pick. IRR is shown, never ranked. Best return is hidden in release builds until AC-5b passes. |
| R8 | Pareto axes | (N0 ↓, lifetime operational tCO2e saved ↑, NPV ↑), central values, over the target set. Lean `Outcome` uses exactly these fields. |
| R9 | Search **(v2)** | **Factorised and exhaustive.** Heavy groups change demand (fabric, ventilation, controls) and are keyed by DHW system class; they run full physics in all three modes. Light groups (heat source and its sub-measures, PV, battery) run on cached monthly demand. Completeness holds up to 1,024 heavy and 65,536 total packages. Above that, branch and bound runs, and the certificate says "front correct relative to listed candidates". GH1: 432 heavy simulations, 10,800 packages. Uncertainty (200 Latin hypercube samples) runs after first paint, for the baseline and the three picks. |
| R10 | Narrator slot grammar | `[[e:12]]`, `[[e:12\|approx]]`, `[[e:12\|abs]]`, `[[m:loft_300]]`, `[[f:3]]` (AM §3.2). The template narrator is the default and always renders first. |
| R11 | Seals **(v2)** | **Proved** (証) sits only on *claims*, never on a number. **Checked** (検) sits on numbers whose arithmetic the certificate re-derived, and names the rung (Lean, mirror). **Modelled** (模) sits on physics. **Cracked** marks a failed check. Every seal shows one line saying what is not proved. The lead claims are: "Nothing better is hidden", "What you ruled out never came back" and "Every option shown passes every rule we encoded". Score bookkeeping theorems live on `/app/proofs`. Narration never carries a seal. |
| R12 | Lean **(v2)** | Core only, `leanprover/lean4:v4.34.0`, no Mathlib in the checker, no `sorry`, no `native_decide`. Lean owns formulas, weights, anchors, band thresholds, reference prices, rule semantics (Kleene), fixed-point rounding and pack **well-formedness predicates**. Pack data (tariffs, grants, factors, rules) travels in the certificate and is checked against those predicates, not for equality. |
| R13 | Camera sequences | Theatre.js is dropped. Sequences are JSON keyframes played by our own `camera-sequence` module. |
| R14 | 3D accessibility | Our own `a11y-scene` module (parallel DOM outline). `@react-three/a11y` is not used. |
| R15 | Landing | A separate Vite app, `apps/landing`, with content from `packages/content`. In T1 it has 5 chapters, each declaring the plugin ids it needs. |
| R16 | Value uplift | UK only, from the SF §4.2 table, driven by the estimated EPC band. The range spans the band's ±1 uncertainty, and it is never added to NPV. India shows "No reliable Indian evidence yet". |
| R17 | Unverified data | Anything graded `estimate` or `announced`, or listed as a check in DECISIONS, shows a visible badge. |
| R18 | Not advice | Every consent card and finance view says "check with your planning authority" or "not financial advice", with the source link. |
| R19 | Thermal bridges **(v2)** | Junctions the scene draws (lintel, sill, jamb, eaves, ground floor, party wall, intermediate floor) carry explicit ψ (SAP Table K1 defaults) times length from geometry. The remaining area uses y. Measures declare their ψ effect per junction kind. A **gold seam** is drawn only where a package lowers ψ, and a **new-risk hatch** where it raises ψ (IWI at joist ends and party-wall returns). |
| R20 | Numbers **(v2)** | Physics runs in float64 through `dmath` (deterministic exp, log, pow, trig); `Math.*` is banned in `engine`. Outputs are quantised to integer Wh, gCO2e and micro-pence. Bookkeeping uses fixed-point integers with half-even rounding per year step, defined in Lean and mirrored in TS. The score uses exact rationals (seven terms, cheap). |
| R21 | Calibration **(v2)** | Bills are weather-normalised to the actual year's degree days (Open-Meteo archive online, or climatology with a wider band offline). The fit estimates mean set-point θ, infiltration n_inf and wall U, with priors (U for 9-inch brick 1.2 to 1.9, central 1.5). The result is a posterior range, not a point, and the fit is weighted by data quality. Comfort take-back sits in the central case, saturating near 21 °C. |
| R22 | Needs-check lane **(v2)** | A package that is blocked only by undecided rules is `needs-check`. It appears in a "Possible after a check" lane that names the check, and it stays out of the certified front until the owner records that the check is done. |
| R23 | Language **(v2)** | User-facing labels, routes and chapter titles are English. Japanese appears as decorative glyphs (`aria-hidden`) and as internal code names only. |
| R24 | Budget timing **(v2)** | Onboarding never asks for a budget. The futures screen asks after the first futures appear, and the answer recomputes the picks. |

---

## 1. Scope tiers

| Tier | Contents | Exit criterion |
|---|---|---|
| **T1 Hero** | GH1 end to end. Onboarding (UK). Story mode, 5 chapters. Studio. The 12 UK measure groups. Rules for GH1. Calibration with all bill input types. What-if with radiator and flow temperature levers, plus heat pump noise drag. Three futures with why not and the needs-check lane. Mending with before and after. Evidence and claim seals. A plain "Things you told us" list. Revisit, persistence, offline. A 5-chapter landing page. Template narrator plus Ollama. Render styles Washi, Yoru and SVG. Layers heat-flow, thermal lens, ghost and noise rings. | The 90-second demo (VISION §5) runs offline on a mid laptop with all T1 acceptance criteria green, including the stranger-homes gate AC-SG1. |
| **T2 Owner tools and voices** | "My boiler just broke" trigger-point flow. "Check my quote". Staged pathway. Compare mode. Snapshot share links. Claude and WebLLM providers. | Each flow passes its AC on GH1 and the three stranger homes. |
| **T3 India** | Region pack (climate, constructions, 9 measures, TGSPDCL slab tariff, Telangana rules), GH2, tenant "ask" letters (en, te, hi) | The GH2 Story runs, and the ranking of cool roof, shading and PV is computed from exact slab bills. |
| **T4 Landlord and city** | GH3, portfolio board, MEES 2030 ledger, evidence export, street view (Machi) with shared ground loop and cumulative noise | Daniel's three homes each show the cheapest path to C under the cap. |
| **T5 Depth** | Memory garden skin, sound, Sumi, Netsu and Shita-e render styles, per-room thermal model, embodied carbon, robustness sampling, Chrome AI, Lean WASM rung, `proofs-extra` (monthly-chain enclosure research), Japanese locale | Each ships behind a plugin flag with no regressions. |

Everything outside T1 still ships as a registered stub where its kind exists, so the architecture is exercised from day one.

## 2. Personas and golden homes

| | GH1 Margaret | GH2 Ravi | GH3 Daniel |
|---|---|---|---|
| Home | 1905 mid-terrace, London, conservation area (Article 2(3) land). 2 storeys, about 84 m² TFA. Solid brick 230 mm (U prior 1.2 to 1.9). Loft 50 mm (U 0.68). Suspended timber floor. Front bay double glazed pre-2002. Rear sash single glazed. One open chimney. Gas combi condensing (η 0.84), about 9 years old. Radiators k_os prior 1.0 to 1.8 | 3rd floor of 3. Bare 150 mm RCC roof (U 3.3). 230 mm brick. West-facing glazing. 2BHK, about 95 m². Two 1.5 TR 3★ split ACs, 4 ceiling fans, electric geyser | 1930s cavity semi, Manchester. Unfilled cavity (U 1.5). Loft 100 mm. Gas boiler 2009. EPC E |
| Tenure | Owner-occupier | Tenant (roof is a residents' association common area) | Landlord, tenant in situ |
| Budget | Not set at Reveal; £15,000 in the demo | ₹40,000 own; landlord unknown | £10,000 cap (MEES) |
| Bill fixtures | `gh1-bills-low.json` (prebound, model over-predicts) and `gh1-bills-high.json` (bills above model) | 12 monthly TGSPDCL bills | Annual, from EPC estimate only |
| Key what-if | Radiators and loft before a heat pump? | Cool roof (landlord) or shading and fans (me)? | Cheapest path to C under the cap |
| Win moment | Radiator drag: flow temperature, efficiency and bill move together | Afternoon heat on the roof, then a cool roof bounces it | Three homes, three paths, one export |

Fixture files live in `packages/fixtures/src/homes/` (schema in `ARCHITECTURE.md` §5.2). Every field carries `known`, `estimated` or `unknown` state. **Stranger homes** (AC-SG1) are seeded from three random UK archetypes with no tuning.

## 3. Modes

**Experience modes.**
- **Story**: 5 guided chapters (§5.4), about 3 minutes. The default on first visit and for "See a sample home".
- **Studio**: free exploration of the same home: stage, what-if, futures, plan, evidence, things you told us. Story chapters deep-link into Studio and back.

**Run modes**: `rating`, `standard`, `your-home` (R3). The UI labels which mode produced each number. One line sits by the score: "Scored for a typical household, so your bills do not change it."

## 4. Information architecture

```
/                          Landing (apps/landing)
/app/                      Router: no home -> /app/start, else last home
/app/start                 Onboarding, 5 steps (step in state)
/app/home/:id              Home stage (Story or Studio), ?chapter=&view=&scenario=&focus=
/app/home/:id/whatif       What-if
/app/home/:id/futures      Three futures, the front, why not, possible after a check
/app/home/:id/after        Mending and before/after
/app/home/:id/plan         Plan: steps, disruption, next steps, letters (T3)
/app/home/:id/evidence     Evidence ledger (all numbers)
/app/home/:id/sharpen      Ranked unknowns
/app/home/:id/told         Things you told us (memory list)
/app/settings              Narrator, language, units, motion, data, storage status
/app/proofs                What we prove (generated from seals.json)
T2: /app/home/:id/boiler   Trigger-point flow     /app/home/:id/quote   Check my quote
T2: /app/s#v1.<payload>    Read-only snapshot     T4: /app/homes, /app/home/:id/street
```

Desktop has three zones: the scene (about 62%), the narrator strip (one tatami wide) and the data and evidence panels. The left rail holds Home, What if, Futures, Plan and Evidence. The top right holds the home switcher and the day/night lantern. Mobile puts the scene in the top 45%, with a bottom sheet below that has three snap points and button alternatives, and a tab bar (Home, What if, Plan, More). A command palette opens on `/` or `Ctrl K`. The scene stays mounted across routes.

## 5. Screens and flows

Each screen lists its content, interactions, states and acceptance criteria (AC). QA tests reference every AC id.

### 5.1 Landing (`apps/landing`, T1: 5 chapters)

- The chapters come from `packages/content/landing/chapters.ts`:
  1. **Hero.** A lantern in a dark room whose paper becomes the house's walls.
  2. **Your home, drawn.** Unknown is not zero.
  3. **What if.** Radiators and loft move the heat pump's bill.
  4. **Three futures.** Only ones you can build.
  5. **Proof and privacy.** "Nothing better is hidden", your home stays on your device, and the invitation.
- Each chapter has a baked poster plus at most one live miniature (one shared WebGL context). Reduced motion and no-WebGL show posters.
- The CTA is one gold button, "Step into your home", leading to `/app/start`. The secondary link "See a sample home" opens GH1 read-only in Story mode.
- A chapter renders only when its `requires` plugin ids are registered.
- **AC-L1** FCP < 1.5 s on mid mobile (Lighthouse, throttled). **AC-L2** All chapters readable with JS disabled. **AC-L3** The chapter list is driven entirely by the content file.

### 5.2 Onboarding (5 steps, budget 120 s)

| Step | Target | Inputs | Behind the scenes |
|---|---|---|---|
| Where | 15 s | UK postcode, city or map pin | postcodes.io. If an EPC API key is configured and the person consents, EPC lookup is the default first action (DEC PR-8). Planning designations come from a cached planning.data.gov.uk extract. |
| Shape | 15 s | One of a 3 by 3 grid of archetype miniatures | The archetype seeds geometry, constructions, junctions and systems with ranges. |
| Tune | 45 s | Up to 6 picture questions, ordered by value of information | Each answer narrows a range; "Not sure" keeps it. |
| People and rights | 20 s | Tenure (owner, tenant, landlord), household size, boiler age band | Seeds feasibility and memory. **No budget** (R24). |
| Reveal | 15 s | None | Baseline computed; the house draws itself in ink stages; first insight. |

- Value of information: for each unknown field, the engine computes how much knowing it would narrow the P10 to P90 band of annual delivered energy. Questions are sorted by that, largest first.
- The person can skip to Reveal from step 3. "Show me a sample home" loads GH1.
- Onboarding steps are typed modules with `timeCostS`. A unit test rejects any configuration over 120 s.
- **AC-G1** Cold start to Reveal ≤ 120 s for a scripted user. **AC-G2** Every defaulted field is visibly marked as estimated. **AC-G3** Works offline (city list only, no EPC lookup).

### 5.3 Home stage

- Default view after Reveal: the house with people in it, the score below it, one insight card and the narrator strip.
- Views (`?view=`): `cutaway` (default, orthographic), `section`, `plan`, `year` (12-month ring).
- Tap any element (roof, wall, window, floor, door, junction, system) to open the **element sheet**. It shows:
  - state (known, estimated, unknown)
  - U-value, ψ or efficiency
  - heat loss in W on a typical January night (with θe named) and in kWh/yr
  - "What if" actions, plus "Sharpen" if the field is unknown.
- **Score**: a number 0 to 100 with four group bars. Tap for all seven. While any material field is unknown, the number shows as a band. The **estimated EPC band** is a separate letter chip showing ±1 band until AC-R1 passes.
- Room tints show **zone** temperatures (living area, rest of home) from 5R1C, labelled with the zone name. No single-room claim is made.
- **AC-H1** Every element in the scene is reachable from the DOM outline, and the reverse. **AC-H2** The score shows a band iff a material field is unknown. **AC-V1** Every highlighted element, junction or zone has its own evidence node, not a shared aggregate.

### 5.4 Story chapters (T1: 5, about 3 minutes)

| # | Title (code name) | Opens with | Interaction | Insight card | Studio link |
|---|---|---|---|---|---|
| 1 | Your home (`ie`) | "This is your home. On a typical January night at X °C outside, it loses Y." | Roof lifts; breathing heat; thermal lens | Biggest loss element or junction | stage `cutaway` |
| 2 | Your bills (`kan`) | "Let's check us against your bills." | Bill input; the old estimate fades to a ghost | Size and direction of the correction | `/evidence?focus=calibration` |
| 3 | What if (`kokoromi`) | "Bigger radiators, or the loft first?" | Radiator and loft levers; flow temperature, efficiency, bill | The lever that moves the bill most | `/whatif` |
| 4 | Three futures (`michi`) | "Many changes are possible. Three stand out." | Folding screen, front, why not, needs-check lane, budget question | The three futures | `/futures` |
| 5 | Your place (`ibasho`) | "Here is your home, mended." | Fold-in, before and after split, "Nothing better is hidden" seal, plan saved | Next step and who to call | `/after`, `/plan` |

- Odd chapters are tension beats; even chapters are relief. Each chapter is skippable from the timeline. Gold mist bands transition between chapters.
- **AC-S1** Every numeric phrase in a chapter opener is an evidence slot. **AC-S2** The full Story is playable with the keyboard only. **AC-S4** The scripted Story runs ≤ 200 s.

### 5.5 Calibration ("Your bills correct us")

- **Inputs**, each with a quality weight:

  | Input | Quality weight |
  |---|---|
  | Annual or monthly kWh | high |
  | Pounds per bill, with the tariff | medium |
  | Monthly direct debit | weak: wide band, flagged "direct debit is smoothing, not use" |
  | Smart meter CSV (half-hourly or daily) | highest |

  UK formats arrive through `importer` plugins.
- **Fit** (R21): weather-normalised. The posterior covers θ, n_inf and U_wall, with priors from RdSAP 10 and the in-situ literature. Electricity baseload fits appliance scaling within ±30%.
- **Without bills**: the band-dependent prior (Few et al. 2023) shows the expected metered range beside the model.
- **UI**: the ghost of the old estimate fades. The caption states the direction and size of the correction and which parameters moved. Evidence node `calibration.posterior`.
- **AC-C1** Synthetic bills generated from known (θ, n_inf, U_wall) give a 90% posterior that contains the truth in ≥ 85% of 200 trials. **AC-C2** No calibrated U leaves its prior range. **AC-C3** The `gh1-bills-high` fixture produces an upward correction with matching copy.

### 5.6 What-if

There are three ways to ask (UX §6.1):
- touch the house
- toggle measure cards in the tray
- ask in words: the offline intent parser or the LLM planner returns `ScenarioOp[]` (AM §6).

- Every change recomputes the whole package in the worker. Latency contract:

  | Latency | Indicator |
  |---|---|
  | < 100 ms | none |
  | 100 ms to 1 s | ink-wash shimmer on changed numbers |
  | 1 to 10 s | staged progress ("simulating 432 fabric options, pricing 10,800 packages, ranking") |
  | > 10 s | percent done and cancel |

- **Levers**: budget, energy price, discount rate, radiator oversize k_os, flow temperature cap. Heat pump levers show flow temperature, SCOP from bins, cylinder and gas-disconnect choices.
- **Noise drag** (Studio): drag the outdoor unit. MCS 020 a) Lp is shown at each assessment window, with the 37.0 dB(A) threshold ring and the consent card live. If the rational enclosure straddles 37.0, the card shows `needs-check`.
- **Flip points**: for each price lever, every value at which the Best return pick changes. Found by scanning tariff breakpoints over cached package energies; there can be several (DEC SC-F6).
- **Infeasible change**: the house explains, names the rule, and offers the nearest feasible scenario (smallest edit distance in the measure set, then lowest N0).
- **Proposal cards** for parser or LLM ops show ghosted geometry, a parameter diff, and Accept, Tweak or Dismiss. Read-only ops run at once.
- **AC-W1** p95 single-scenario recompute plus render < 150 ms on GH1. **AC-W2** Full GH1 search (432 heavy × 3 modes, 10,800 packages) < 1 s in the worker on the reference laptop. **AC-W3** The UI never displays a sum of per-measure savings. **AC-W4** Cancelling a running search returns control within one slice (≤ 50 ms).

### 5.7 Three futures

- A folding screen with three panels in fixed order: **Least upfront**, **Best return**, **Lowest running carbon**. Each card states its axis in plain words; the kanji 穏 賢 勇 are decorative.
- **Four figures per card**: upfront cost range, yearly saving range, running carbon saved per year, comfort change. "More" reveals the rest: per-fuel deltas, lifetime tCO2e, NPV, payback, cash positive from month 1, estimated EPC band, consents, disruption.
- **Behind the cards**: a cost vs carbon scatter of the target set (ink dots) with the front as a gold brushstroke. Hovering a dominated package draws a dotted line to its witness. A table alternative is available.
- **Why not?** Every applicable measure missing from all three picks, with its reason: rule id, memory, tenure, dominated by X, or outside your budget.
- **Possible after a check** (R22): needs-check packages that would join the front, each naming the check and its cost from the money pack (for example "a moisture assessment for inside insulation", graded `estimate` until sourced).
- **Budget question** (R24) appears once the futures are shown.
- **AC-F1** Certificate checks `pareto.front`, `pareto.witness` and `pareto.picks` pass for every displayed result. **AC-F2** Every package outside the front names a rule id, a witness or the target. **AC-F3** No needs-check package appears in the front.

### 5.8 After: mending and before/after

- Origami fold-in per measure (hinge folds, 120 ms stagger).
- Gold seams and new-risk hatches per R19.
- A **split view** of one scene (scissor): baseline on the left, the recomputed future on the right. The divider is a shoji. No numbers are interpolated.
- The seal "Nothing better is hidden" presses after the certificate passes. Per-fuel signed deltas, bills, payback and NPV appear, with a sensitivity strip at 0%, 3.5% and 7%.
- **AC-K1** Gold seam count equals the number of junctions whose ψ the package lowers. **AC-K2** "After" numbers are byte-identical to the engine result. **AC-K3** Each new-risk hatch links to its junction evidence.

### 5.9 Plan

- The chosen future becomes ordered steps. Each step shows: measure, cost range, who acts (you, ask landlord, ask freeholder, planning), **disruption** (days of work, rooms out of use, can you stay in), and **next step** (installer type, accreditation such as MCS or TrustMark with PAS 2035, and three questions to ask). Disruption and next-step content comes from `packages/content/measures/`.
- The consent ledger shows authority and typical weeks. Grants are applied with `validTo`.
- Mark a step done with actual cost, date and an optional photo. Twin fields move from estimated to known, and a permanent seam is drawn.
- **AC-P1** Marking a measure done removes it from future searches and records `measureCompleted`. **AC-P2** Every T1 measure has disruption and next-step content (contract test).

### 5.10 Evidence drawer, ledger and seals

- Any number is an evidence chip. Clicking it draws the red thread to the drawer.
- The drawer has three tabs:
  - **In words**: one plain sentence.
  - **How**: formula, inputs as further chips with provenance, sources with dates, plugin id and version.
  - **Check**: seal level, check id, rung and timing, and a certificate excerpt. For claims it also shows the theorem statement and axioms, plus the "not proved" line.
- Seals follow R11. During recompute, seals crack and re-press in order.
- The ledger route lists every number in the current result, filterable by seal and provenance.
- `/app/proofs` lists every theorem from `seals.json` in plain words: claim theorems first, then bookkeeping (score bounds, weights, monotonicity, savings identity, interval surrogate).
- **AC-E1** 100% of numbers rendered in the app are evidence chips (DOM audit). **AC-E2** Every Proved seal names a theorem in `seals.json` and sits on a claim, never on a number. **AC-E3** A corrupted certificate gives a Cracked seal linked to the failing row. **AC-Q1** (manual) Hallway test, 5 people: none describes any seal as "guaranteed".

### 5.11 Sharpen

Ranked unknowns by value of information, with one-tap picture questions. Shows how much each answer narrows the score band and the Best return saving range. **AC-SH1** Answering the top question narrows the band (property test on GH1).

### 5.12 Things you told us (T1 memory list)

- A plain list, grouped as: rights and tenure, budget and horizon, priorities, ruled out (never or snoozed), done, suggestions awaiting your OK (seeds).
- Each item shows what is remembered, where it came from, what it changes (linked packages), and edit and forget.
- A counter reads "N futures hidden by things you ruled out", with a restore action.
- The karesansui garden is a T5 skin over the same data.
- **AC-M1** Replaying 500 random sessions never puts a rejected measure in an offered package or recommendation. **AC-M2** LLM-originated memory appears only as a seed until confirmed. **AC-M3** Forget performs real deletion after 30 days, or at once on "empty now".

### 5.13 Welcome back (revisit)

- On return the app reads IndexedDB (< 100 ms), then shows:
  - a greeting with the month and the days since the last visit
  - what changed: model version and data pack diffs, as before and after with the reason
  - plan progress and one next action
  - a memory check once per 90 days.
- Old certificates still check against the pack data they carry, so seals stay valid. A recompute with new packs shows a diff instead of cracking.
- **AC-O1** A data pack bump that changes a number shows a before/after diff, never a silent change. **AC-O2** Revisiting after a pack bump shows no Cracked seal on the old result.

### 5.14 Settings

Settings covers:
- narrator choice with locality badges, plus the Ollama setup card
- outbound ledger history
- language, units, motion, quality tier
- storage status (protected or at risk), with Safari advice
- export `.ibasho`, import, wipe
- a run mode explainer
- the discount rate preset (society 3.5%, my savings rate, my loan APR)
- the EPC API key (stored only on this device).

### 5.15 Later tiers (summary; full specs land with their tier)

- **T2 trigger point**: "My boiler just broke", 60 s on the saved twin. Like-for-like gas against heat pump, with BUS, cylinder and gas disconnect.
- **T2 quote check**: enter a quote and see it against the cost range, with line items that usually differ.
- **T2 staged pathway**: steps at trigger points, each stage feasible given the last.
- **T2 compare**: up to 4 pinned scenarios.
- **T2 snapshot**: `/app/s#v1.<base64url(deflate-raw(json))>`. **AC-SN1** GH1 payload < 2 KB.
- **T4 street**: the aggregate equals the sum of per-home recomputed deltas (AC-ST1). Neighbours are labelled "imagined" unless the owner added them.
- **T4 portfolio**: SF §8.2.

## 6. Cross-cutting states

| State | Treatment |
|---|---|
| App boot | 居 drawn in sumi strokes (a pre-baked SVG path); paper grain fades in |
| Scene loading | Ink stages: Paper (0 to 150 ms), then Pencil SVG (to 500 ms), then Ink WebGL (to 1.5 s), then Wash (to 3 s). Numbers never wait for visuals |
| Recompute | < 300 ms: changed numbers re-bleed. Long search: inkstone grinding with stage labels |
| Narrating | Sentences settle one by one after validation; a "Plain narrator" marker on template fallback sections |
| Empty | Empty tatami room, one line: "Every home starts empty" |
| Error | Torn washi with a gold mend line, what still works, one next step, details drawer |
| Offline | Unlit lantern badge: "Working offline. Everything still computes here." |
| No WebGL / context lost | Full SVG cutaway from the twin; auto retry on restore |
| Storage at risk | Persistent banner with export |
| Proof failed | Number shown with a Cracked seal, never hidden |
| Physics implausible | Amber note: "Higher than most homes like yours. Check the floor area?" |

Persistence: IndexedDB (Dexie), append-only twin versions and memory events. `navigator.storage.persist()` is requested after Reveal (a user gesture). Migrations run forward only. `.ibasho` export and import come with a preview. The PWA can be installed after Reveal.

## 7. Computed quantities

Every quantity is an evidence node with id `<domain>.<quantity>[.<fuel>][.<month>]`. Seal column: **C** = Checked (certificate re-derives it), **M** = Modelled. Numbers are never P (R11).

### 7.1 Physics (engine, float64 via dmath, quantised at the boundary)

| Quantity id | Meaning | Formula | Unit | Seal |
|---|---|---|---|---|
| `geom.tfa`, `geom.volume`, `geom.area.<element>`, `geom.len.<junction>` | Areas, volume, junction lengths | BP §3.1 | m², m³, m | M |
| `occ.n` | Standard occupancy | SAP Table 1b | persons | M |
| `fabric.htr` | Σ A·U + Σ ψ·L + y·A_rest | BP §3.2, R19 | W/K | M |
| `fabric.u.<element>`, `fabric.psi.<junction>` | U-values, junction ψ | BP §3.2, SAP K1 | W/m²K, W/mK | M |
| `fabric.hlp`, `fabric.tmp` | Heat loss parameter, thermal mass | BP §3.2 | W/m²K, kJ/m²K | M |
| `vent.ninf`, `vent.neff.m`, `vent.hve.m` | Infiltration and ventilation | BP §3.3 | ach, W/K | M |
| `gain.solar.m`, `gain.opaque.m`, `gain.int.m` | Gains (opaque off in `rating`) | BP §3.4 to §3.6 | W | M |
| `heat.util.m`, `heat.theta_i.m`, `heat.qh.m` | Utilisation, mean internal temperature, space heating | BP §3.7 | 1, °C, kWh | M |
| `cool.qc.m`, `cool.qlat.m` | Sensible cooling (η_c = 1 when L_c ≤ 0) and latent | BP §3.8, DEC SC-6 | kWh | M |
| `dhw.qw.m`, `dhw.cyl_loss.m` | Hot water and cylinder losses | BP §3.9 | kWh | M |
| `hp.design_load`, `hp.size_kw`, `hp.flow_design`, `hp.scop_bins`, `hp.spf` | Heat pump chain, EN 14825 bins, Ruhnau 2019 COP | BP §3.10, DEC SC-2 | kW, °C, 1 | M |
| `pv.yield.m`, `pv.beta.m`, `pv.selfuse.m`, `pv.export.m` | PV and self-use | BP §3.11 | kWh | M |
| `energy.delivered.<fuel>.m` | Delivered energy by fuel and month | BP §3.10 | Wh (quantised) | M |
| `thermal.zone.<z>.hourly`, `comfort.hot_hours`, `comfort.cold_hours` | 5R1C zone temperatures and hours | R5 | °C, h | M |
| `calibration.posterior` | Fitted θ, n_inf, U_wall ranges and effect | R21 | K, ach, W/m²K, % | M |
| `uncert.<q>.p10/p50/p90` | Latin hypercube band | BP §9 | as q | M |
| `rule.noise.lp.<position>` | MCS 020 a) Lp enclosure | RP §6.1 | dB(A) | C (enclosure) |
| `rule.adf.category` | AD F ventilation category | RP §6.2 | A/B/C | C |

### 7.2 Bookkeeping (fixed point, TS and Lean agree)

| Quantity id | Meaning | Source | Unit | Seal |
|---|---|---|---|---|
| `acct.saving.<fuel>.m` | Signed saving per fuel and month | M1, BP §3.12 | Wh | C |
| `acct.carbon.<fuel>.m`, `acct.carbon_saving` | Σ_f Σ_m ΔE·EF_f,m | R6 | gCO2e/yr | C |
| `money.bill.<fuel>`, `money.bill_saving` | Tariff plugin, slab exact, standing charges | BP §7, SF §7 | micro-pence/yr | C |
| `score.sub.<dim>`, `score.group.<g>`, `score.total` | Clamped linear sub-scores, groups, total | SF §2.2, R2 | 0 to 100 | C |
| `epc.sap_est`, `epc.band_est` | Rating-mode SAP estimate and band ±1 | R3 | points, band | M |
| `value.uplift.low/central/high` | Value range from band transitions | SF §4.2, R16 | £ | C (ordering) + M (inputs) |
| `fin.n0`, `fin.grants` | Net upfront, applied grants | SF §5.2, §6 | £ | C |
| `fin.b.t`, `fin.npv`, `fin.payback_*` | Yearly saving, NPV with replacements, residual value and counterfactual boiler, paybacks | SF §5.2, DEC SC-F5 | £, yr | C |
| `fin.irr` | Only when cash flows change sign once | SF §5.2 | % | M |
| `fin.lifetime_tco2e`, `fin.cost_per_tonne` | Trajectory-weighted lifetime carbon | R6 | tCO2e, £/t | C |
| `fin.loan_monthly`, `fin.cash_positive_m1` | Annuity vs B_1/12 | SF §5.2 | £/month, bool | C |
| `feas.status`, `feas.consents`, `feas.checks` | Kleene evaluation, consent ledger, needed checks | RP §3, R22 | enum | C |
| `pareto.front`, `pareto.witness.<pkg>`, `pareto.picks` | Front, dominance witnesses, picks | R7, R8 | ids | C |
| `flip.<param>` | All flip points | §5.6 | param units | M |

### 7.3 Claims (Proved seals)

| Claim shown to the owner | Lean theorems | Where it appears |
|---|---|---|
| Nothing better is hidden | `check_sound`, `checkFront_sound`, `checkFront_complete`, `witness_sound`, `enum_complete_sound` | Futures, After |
| What you ruled out never came back | `rejected_never_offered`, `rejection_antitone`, `restore_monotone` | Futures, Things you told us |
| Every option shown passes every rule we encoded | `kleene_sound`, `unknown_never_feasible`, `feasibleB_sound` | Futures, consent cards |
| The three picks are what their names say | `lexMin_nondominated`, `checkPicks_sound` | Futures cards |
| The noise test is decided only when rounding cannot change it | `noise_enclosure_sound`, `noise_sum_ge_max` | Noise drag |
| Score bookkeeping (bounds, weights, monotone) | `weights_sum_one`, `score_bounds`, `score_monotone` | `/app/proofs` only |

### 7.4 Fixed-point spec (summary; normative text in `proofs/Ibasho/Spec/Fixed.lean`)

- Energy is in integer Wh, carbon in integer gCO2e, and money in integer micro-pence (micro-paise for INR). Products that may exceed 2^53 use bigint.
- Prices are integer micro-pence per Wh. Factors are integer µg CO2e per Wh.
- Discount factors are integers scaled by 10¹², computed by recurrence `D_t = roundHalfEven(D_{t−1} · 10⁹ / (10⁹ + r_ppb))`.
- Escalation and degradation use the same recurrence form.
- Every rounding point is named in the spec and mirrored exactly in TS. Display rounding happens only in the renderer.

## 8. Score specification

- **Weights and groups**: R2. Lean `weights_sum_one`.
- **Indicators and anchors**: SF §2.1 to §2.3 with R4 and R5. Anchors are per climate pack and validated by the Lean predicate `anchors_valid`.
- **Normaliser**: lower-is-better `s = 100·clamp((worst − x)/(worst − best), 0, 1)`; higher-is-better is mirrored.
- **Inputs** are quantised to milli-units before normalising.
- **Display**: an integer score, four group bars, and all seven sub-scores on tap. If a heat pump raises cost and lowers carbon, both arrows show.
- **The score has no letter.** The estimated EPC band (R3) uses SAP thresholds A ≥ 92 (flagged source), B ≥ 81, C ≥ 69, D ≥ 55, E ≥ 39, F ≥ 21, else G. It shows ±1 band until AC-R1 passes.

## 9. Measures and rules in T1 (GH1)

**UK choice groups.** Heavy groups (change demand):

| Group | Options |
|---|---|
| `loft` | 270 mm, 300 mm |
| `wall` | EWI 100 mm, finish chosen per elevation; IWI vapour-open wood fibre, U about 0.5 to 0.6 |
| `floor` | Suspended timber insulation |
| `draught` | Draught-proofing plus chimney balloon |
| `glazing` | Secondary low-E, double A-rated |
| `controls` | TRVs plus weather compensation |
| `vent` | MVHR, only if AP50 ≤ 5; not applicable to GH1 |

Light groups (cached demand):

| Group | Options |
|---|---|
| `heat` | ASHP, ASHP plus radiators+. Each brings a **cylinder** when replacing a combi (cost range, 0.5 to 0.7 m² floor space, standing losses, legionella cycle). Each has a sub-choice: keep gas hob, or **induction hob plus gas disconnect** (removes the gas standing charge) |
| `pv` | 2, 3, 4 kWp |
| `battery` | 5, 10 kWh (requires PV) |
| `cylinder` | Jacket |
| `solar-thermal` | 3 m² |

The cylinder jacket and solar thermal are not applicable to a combi. GH1 search size: (3·3·2·2·3·2 heavy) × DHW class gives 432 heavy simulations; (1 + 2·2) × (1 + 3·3) gives 50 light variants, for 10,800 packages.

Interaction oracles BP §6.3 1 to 8 are tests, plus a new oracle 9: **IWI worsens joist-end and party-wall junction ψ**.

**Rules active for GH1** (RP §5, corrected per DEC SC-3). The evaluation is three-valued. An unknown block yields `needs-check`. `oblige` applies before physics.

| Rule | Effect for GH1 | Grade |
|---|---|---|
| `ENG.PD.ASHP.*` | Noise 37.0 by rational enclosure; volume; count; highway (Article 2(3)); listed; flat roof | as RP |
| `ENG.PD.EWI.ART23` | Render, stone, timber, plastic or tile cladding on **any elevation** of Article 2(3) land: consent (LPA) | secondary |
| `ENG.PD.EWI.LOOK` | Non-matching finish: consent (LPA). The front is **consent, not block** | secondary |
| `ENG.PD.PV.WALL23` | Wall-mounted PV fronting a highway on Article 2(3) land: consent (LPA) | secondary |
| `ENG.PD.ART4` | Roof-slope PV restrictions arrive only through an Article 4 direction recorded for the area | primary |
| `ENG.BR.L.RENOV` | If more than 50% of an element or more than 25% of the envelope is renovated, oblige the whole element to the improved U (wall 0.30), where technically, functionally and economically feasible (15-year payback), else the best feasible. The threshold U of 0.70 *triggers* the upgrade and is not a floor. Traditional-building relaxations are surfaced | primary |
| `ENG.BR.L.FLOW55` | Emitters sized for flow ≤ 55 °C | primary |
| `ENG.BR.L.HPSIZE` | Meet design heat loss | primary |
| `ENG.BR.F.CAT` | Oblige ventilation by `adf_category` | primary |
| `ENG.BR.O.ADVISORY` | Overheating warning (Ibasho advisory; Part O does not apply) | primary |
| `ENG.BR.L.HIST` plus **`ENG.MOIST.IWI`** | IWI on solid masonry is `needs-check` until a BS 5250 / BS EN 15026 assessment is recorded; the assessment is costed | secondary |
| `ENG.BR.NOTIFY` | Building control or competent person scheme | secondary |
| **`UK.DNO.G98`** | PV or PV plus battery export ≤ 3.68 kW per phase: notify after install. Above that, **`UK.DNO.G99`**: consent (DNO) before install | secondary |
| **`UK.DNO.HP`** | Heat pump connection notification; looped supply: needs-check | secondary |
| **`UK.PAS2035`** | When a funded scheme applies: oblige PAS 2035 retrofit assessment and coordinator (costed) | secondary |
| `UK.BUS` | Grant | secondary |
| Built-ins | budget, tenure, memory, conflicts, prereq, target | n/a |

Each rule has one golden test.

## 10. Narrator and memory requirements

- The template narrator renders every section instantly and deterministically (seed = bundle hash).
- **T1 optional provider: Ollama** (`/api/chat` with schema). T2: WebLLM (default `Qwen3-1.7B-q4f16_1-MLC`, lite `Qwen3-0.6B`, rich `Qwen3-4B`, download only on consent) and Claude (`claude-haiku-5-5` narration, `claude-sonnet-5-5` planning, `claude-opus-5-5` opt-in review; BYO key or companion proxy). T5: Chrome Prompt API.
- Grounding validator G1 to G8 (AM §3.3), one structured repair, then template fallback per section. A sentence renders only after it validates.
- Notes go only to the quarantined extractor. Narrators see typed `OwnerFact`s.
- Cloud is never chosen automatically. The outbound ledger is shown before the first send.
- While an LLM generates, the scene drops one quality tier.
- **AC-N1** Across golden bundles × providers × voices, 0 digits or number words are rendered from any LLM. **AC-N2** Injection corpus (60 notes): 0 planted numbers, 0 unconfirmed ops, 0 active memories. **AC-N3** A provider failure falls back to the template within 100 ms.

## 11. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Still-life rendering: one baked frame on camera rest, with only the light overlay animating. 60 fps target, 30 fps floor on Iris Xe class (manual, every milestone). CI gate on `renderer.info`: ≤ 150 draw calls, ≤ 300k triangles, ≤ 20k particles. Search and recompute budgets as in §5.6 |
| Bundle | App shell JS ≤ 250 KB gzip before the 3D chunk. Three font families, unicode-range slices. Seal glyphs as baked SVG paths |
| Offline | Full app offline after first load. Online-only features are plugins that degrade silently |
| Privacy | No account, no analytics. Third-party requests only from opt-in plugins (postcodes.io, EPC, Open-Meteo, LLM providers), each disclosed |
| Accessibility | WCAG 2.2 AA; scene outline; every drag has a key or click path; 44 px touch targets; reduced motion; tables for charts; colour plus hatch |
| i18n | ICU messages per package namespace. `Intl.NumberFormat` (en-IN lakh grouping). Currency follows the home region. en-GB in T1; en-IN, te, hi in T3 |
| Determinism | Same twin + same plugin versions = byte-identical result and certificate across Node, Chromium and Firefox (AC-D1) |
| Writing | No em or en dashes as punctuation in product copy or docs (CI lint) |

## 12. Global acceptance criteria and test oracles

| Id | Criterion | Test |
|---|---|---|
| AC-1 | Every M1 injected bug fails its named check: wrong weight, flipped sign, missing factor, infeasible heat pump accepted (including by the noise rule), savings by adding percentages | Mutation suite, `ibasho-check` and mirror |
| AC-2 | Every seal theorem uses only `propext`, `Classical.choice`, `Quot.sound` | `ibasho-gen --audit` |
| AC-3 | TS bookkeeping equals the Lean reference on 10k random cases | `ibasho-ref` differential |
| AC-4 | Mirror and Lean checkers agree on golden, random and mutant certificates | Parity test |
| AC-5 | BP §8 validation targets within tolerance | `engine/validation` |
| AC-5b | NEED SWI (−16%) and CWI plus loft (−9%) medians reproduced within ±5 points; gates the Best return pick | `engine/validation` |
| AC-6 | Interaction oracles BP §6.3 1 to 8, plus oracle 9 (IWI junctions) | Engine tests |
| AC-7 | Property tests: Q_H non-increasing as any U falls; η ∈ [0, 1]; Q_C finite and ≥ 0 for every pack and month; add then remove a measure returns the baseline bit-exactly; monthly energy balance closes; light-path results equal full simulation on 200 random packages within 1 Wh | fast-check |
| AC-8 | MCS 020 a) golden: LwA 60, Q 4, r 8.0, Type 1 partial view gives 32.0 dB(A), with the enclosure inside [31.95, 32.05) | Rules test, both checkers |
| AC-9 | Value table ordering low ≤ central ≤ high for every upward move | Lean predicate on pack data |
| AC-10 | The 90-second demo script passes end to end offline | Playwright `demo.spec.ts` |
| AC-11 | No four panel corners meet (tatami rule) at 3 breakpoints | Playwright layout lint |
| AC-12 | axe-core: 0 serious or critical violations on every route | Playwright + axe |
| AC-13 | Visual regression of GH1 key frames in Hiru and Yoru | Playwright screenshots |
| AC-14 | Netsu ramp: OKLCH L strictly increasing; adjacent stops ΔE_OK ≥ 0.06 under deuteranopia and protanopia | `ui` token test |
| AC-15 | Every visual layer that encodes a number has a Legend and `evidenceAt` | Registry check |
| AC-D1 | Determinism across Node, Chromium and Firefox (same result hash) | CI matrix |
| AC-R1 | Rating-mode band within ±1 band of the lodged EPC on ≥ 90% of 500 EPC open-data records, and exact on ≥ 50%; until this passes, every band shows ±1 and no "compliant" label exists | `engine/validation/epc-confusion` |
| AC-S3 | A NEED-median home scores 40 to 60 at the reference price pack | Score test |
| AC-SG1 | Three random, untuned UK archetype homes: compute without NaN, baseline within NEED ranges, futures non-empty, template narration passes G1 to G8 | `tests/stranger` (gate before M-D) |
| AC-PERF | `renderer.info` counts within budget on GH1 key frames | Scene CI |
| AC-Q1 | Hallway test: no participant reads a seal as "guaranteed" | Manual, recorded on the blackboard |

## 13. Agent link (WP-12, ARCH 14)

A person can ask an AI agent, for example Claude Code, to explore their home with them. The agent uses the same typed operations as the person's hands. It works headless on fixtures and `.ibasho` files, or live in the open app once **Settings > Agent link** is on and the pairing code is entered.

- Off by default. The toggle says, in one line, that a connected agent may send what it reads to its model provider.
- Agent edits appear with an "agent" mark, are undoable, and are listed in the outbound ledger.
- Agent prose shown in the app passes the narrator validator. An agent cannot place a number the engine did not compute.
- Install: `pnpm agent:install` (Claude Code plugin, or direct skill + subagent + MCP + hook, like the tldraw offline skill). `--uninstall` removes only what it installed.

Acceptance: BUILD_PLAN WP-12 L1 to L8.

## 14. Bad outcomes: ignored maintenance, custom requests, negative impacts

Ibasho shows what makes a home worse as plainly as what makes it better.

- **Ignored maintenance.** A "do nothing" future that ages the home: boiler efficiency drifts down, seals and draught-proofing wear, an unserviced heat pump loses efficiency, and a counterfactual boiler replacement falls due. Each effect comes from a documented decay model in a pack (`maintenance` plugin kind), with its source and a range, never a guess presented as fact. Shown as a fourth line beside the three futures: "If nothing is done".
- **Custom requests.** The owner can ask "what if I only do the front room", "what if I keep the gas hob", "what if prices rise 20%". The intent parser (WP-05) turns the request into typed `Op`s; the engine recomputes the whole package; the answer cites evidence like any other result. Requests that cannot be expressed as ops get a plain "I can't model that yet" and are logged.
- **Negative impacts.** Every result lists what gets worse beside what gets better: a fuel that rises, a negative NPV, extra disruption, a new risk (moisture, overheating, noise). No result hides a negative behind a total.

Acceptance:
- **AC-B1** The "If nothing is done" line exists for GH1 and every value in it has evidence and a decay source.
- **AC-B2** 30 custom requests from a gold set map to the expected ops or to the "can't model that yet" answer; none produces a number not computed by the engine.
- **AC-B3** For every package shown, each indicator that worsens appears in its negatives list (property test).
