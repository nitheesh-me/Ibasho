# Ibasho: Product Specification

Status: director synthesis v2, 2026-10-10. Normative for all builder agents. Where a research brief and this spec disagree, this spec wins. To change it, raise a BLOCKER on `docs/BLACKBOARD.typ`. v2 applies `review/DECISIONS.md`. Rulings changed in v2 are marked **(v2)**.

**v3 (2026-10-11).** Sections §15 to §26 add the v3 studio: many building types in a real 3D city, energy codes, site and daylight analysis, EUI and end uses, ratings, optimisation and the design partner (`PLAN-V3.md`). Sections §0 to §14 stay in force and now specify the `single-family` and `rental` building types; where §15 onward and §0 to §14 overlap for those types, §0 to §14 win. v3 briefs are cited as EC, TE, SD, BE, RB, SO, BI, AR, UV and SC (`research/v3/`, key in `PLAN-V3.md`).

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

---

# Part II: v3 studio

## 15. v3 director rulings

Builders treat these as fixed. They add to R1 to R24.

| # | Topic | Ruling |
|---|---|---|
| R25 | Building types | Eight types: `office`, `hotel`, `education`, `hospital`, `lab`, `apartments`, `rental`, `single-family`. Each is a `building-type` plugin: a mix of space types, schedules, system archetypes, benchmarks and code classes (TE §4, EC §6). `rental` is tenure layered on a type (who owns, who pays, who decides), not a geometry. `lab` loads stay PLACEHOLDER until a sourced profile lands (SC §4.3). |
| R26 | Prototype first | Every flow (§18) ships first on **Preview** data: fixtures shaped exactly like real outputs (same contracts, evidence ids, units). Preview values carry provenance kind `preview` and seal level `preview`, show a "Preview" stamp, and never carry Checked or Proved. A stage turns real by changing its stage provider (§19); no flow may break during a swap. |
| R27 | Building model | The editable source is `ibasho.building/1` (BE §2): Site > Building > Storey > Room2D, with per-segment boundary, window rule and shading rule, plus Room3D for non-extruded rooms and a massing mode. Plan coordinates and heights are integer millimetres. A pure `compile()` produces the engine twin, quantities and plan checks. The engine never reads the document. GH1 compiles from a document to within 1% of today's hand twin on every element area. |
| R28 | Location and weather | A place has latitude, longitude, elevation, true north, a climate pack and an ordered list of code packs. Hyderabad (17.45 N, 78.35 E for the IIIT campus) uses the TMYx 2011 to 2025 EPW for Shamshabad (station 431285) as the typical year; the climate pack's monthly tables are derived from the same EPW (SD §2). London keeps its pack. Weather files pass `@ibasho/core/schemas` and are hashed. |
| R29 | City context | Context buildings come from a local city pack (Overture or OSM footprints; heights fused from user entry, OSM `height`, OSM levels times type floor-to-floor, then Google Open Buildings 2.5D). Every height carries its source and a range. Unknown heights are drawn hatched and analysed as a low to high range, never as a default treated as fact (SD §3, UV §2). Photo tiles are opt-in, off by default and never used in analysis. |
| R30 | Site analysis | One visibility kernel per sensor grid (sky patches and sun directions) serves shadows, sun hours, radiation, sky view, ASE, the direct part of sDA and views (SD §1.3). The CPU kernel (three-mesh-bvh in a worker) is canonical and the only path into a certificate. The GPU path is labelled "preview" in the legend. Every result states its method, resolution, period and "Modelled". |
| R31 | Daylight tiers | T0 instant: ECBC manual daylight extent method and ASE. T1 fast: sky component plus split flux. T2 browser: path-traced daylight coefficients. T3 reference: Radiance via the companion. A value is labelled "sDA" only from a tier whose error band against the SD §7 reference rooms is measured; until then it is "sDA (simplified)". ASE may be called ASE from T0. |
| R32 | Energy | The 5R1C kernel generalises to N zones with cooling capacity, latent load, inter-zone coupling and per-window solar with monthly shading factors from the site result (SO §2). Search runs on the ISO 52016-1 monthly method fitted per building to the hourly model, with the fit recorded; fronts and picks re-run hourly. EnergyPlus through the companion is an optional reference row and never turns a number Checked. Without a site result, shading is `unknown` and the pack default applies with a visible note. |
| R33 | End uses and EUI | End uses: cooling, heating, lighting, equipment, fans, pumps, hot water, other, and PV generation as a negative bar. EUI is reported as site and source energy per m² of conditioned area per year, with its range. If any end use is unknown, EUI is labelled "partial" and shows the missing use; it is never summed as zero. |
| R34 | Codes | Code rules use the existing `Rule` and `Expr` grammar plus a `comply` effect (pass, fail or unknown, with margin) and a metric registry (EC §5, §7). Every code result carries an **applicability status**: "Reference identified", "Partial check available", "Local adoption must be confirmed", "Professional assessment required", "Not a certificate" (SC §4.1). The edition in force is chosen by permit date; an unknown date gives "Local adoption must be confirmed". The word "compliant" never appears; results read "pre-check: passes" or "pre-check: fails by X". |
| R35 | Baselines and targets | A `baseline-builder` clones the proposed building into each code's reference design (ECSBC standard design, ASHRAE 90.1 Appendix G baseline) and runs it on the same engine and rung. Targets and points read from the ratio, not from absolute kWh. The EUI target line names its source (code baseline, BEE band, benchmark median). |
| R36 | Ratings | LEED v4.1 and v5, IGBC, GRIHA, EDGE, BEE Star and GHMC stars are `rating-scheme` plugins with step tables. Points show as likely, possible or unknown, labelled "estimate, not a certification". Rating points never enter the home score. |
| R37 | Objectives and picks | The Pareto outcome generalises R8 to a list of 2 to 4 integer axes, each with a direction, chosen from capex, operating cost, EUI, lifetime carbon, comfort hours, sDA, ASE and NPV. Defaults: homes keep R7 and R8; other types use capex, operating cost and EUI with picks **Least upfront**, **Lowest running cost** and **Lowest energy**, each inside the goal set (§25). |
| R38 | Optimisation | Screen (Morris, recorded as Modelled), factorise (heavy and light as R9), exhaustive below the R9 cap, deterministic NSGA-II on the core PRNG above it, with each heavy candidate's light completion solved exactly. Surrogates choose what to simulate next and never supply a displayed number. Every seal says "nothing better among the options we tried" and links the list. |
| R39 | India money and carbon | Tariffs are dated slab tables with fixed charges, demand charges per kVA, time-of-day deltas and category cliffs (TE §7). Bills are computed per month so cliffs and free-unit schemes are exact; results report months over a cliff. Diesel generation has its own cost and carbon. Carbon uses the CEA weighted average for a building's footprint and the combined margin for savings, both labelled (TE §8). Water uses HMWSSB slabs and the free 20 kL rule. |
| R40 | Comfort | Homes keep R5. Other types and Indian homes add IMAC adaptive comfort (mixed mode and naturally ventilated lines) with a stated fan air-speed credit; the headline is "hours comfortable with fans alone", then hours with AC at each set point, with monsoon humidity limits (TE §4.2, BI §5). |
| R41 | Settings | Every rate and level is a `Setting` with value, unit, range, source, grade, scope (app, place, building, scenario), depth (plain or pro) and `affects`. Resolution: scenario over building over place over app over pack default. Changing a setting marks every dependent number stale before recompute (UV §7). Render quality never changes a number; analysis resolution does and stamps every result. |
| R42 | Memory and recommendations | Memory events gain a scope (owner, portfolio, project, building, variant) and two dates (valid in the world, recorded). Goals are typed with a unit and a strength (must, prefer, nice). Recommendations are a derived `RecSet` keyed by an inputs hash and never stored as truth; a new leader replaces the old only outside the uncertainty band (AR §3, §4). "Why it changed" is computed by exact Shapley over at most four change groups (AR §5). |
| R43 | Design partner | The partner (offline proposer first, Ollama `qwen3:8b` optional) proposes typed `DesignOp`s whose values are indices into pack-declared grids. It never writes a number. Each round is capped at 64 engine evaluations, and options tried that were not better are listed (AR §6). |
| R44 | Score by type | The seven-part Green Home Score (R2) applies to `single-family`, `rental` and individual flats in `apartments` only. Other types show EUI against their target, code status and the rating ladder. |
| R45 | Reference buildings | Fixtures from the IIIT drawings store room functions, never personal names. The source PDFs stay in `docs/research/v3/sources/` as reference and never ship in an app bundle. |

## 16. Personas and golden buildings (v3)

Personas are in `PLAN-V3.md` §4. Golden buildings live in `packages/fixtures/src/buildings/` as `ibasho.building/1` documents; Preview results for each live in `packages/fixtures/src/preview/`.

| Id | Building | Type | Why |
|---|---|---|---|
| GB1 | **Vindhya Bhavan**, IIIT Hyderabad: courtyard ring, 3 storeys plus partial cellar, about 165 × 81 m, facades at 40, 130, 220 and 310° | education with lab, office and a data centre | Hero (`PLAN-V3.md` §8) |
| GB2 | **Himalaya**, IIIT Hyderabad: four blocks of 3, 4, 3 and 6 storeys, about 158 m long | education and office | Neighbour context, self-shading, second fixture |
| GB3 | **HITEC City office**: 15 storeys, 59 × 37 m plate, long facades ESE and WNW (modelled on a public listing, RB §6) | office (coworking) | Large office, MoP 2026 draft threshold, fair split |
| GB4 | **Gachibowli apartment block** with GH2 as its top-floor unit | apartments, rental | Ravi; unit position; roof rights rule |
| GH1 | 1905 London terrace (§2) | single-family | Regression; London context |

Unknowns are carried, not filled (RB §8): glazing specs, wall and roof build-ups, external shading and many neighbour heights stay ranges.

## 17. Information architecture (v3)

```
/app/                                  Studio home: places and samples; no place -> /app/new
/app/new                               New flow (§18.1)
/app/p/:placeId                        City and Site levels (?level=city|site&lens=&t=)
/app/p/:placeId/b/:buildingId          Building, Floor, Room levels
                                       ?level=building|floor|room&floor=&room=&mode=make|look|choose|prove|tell
                                       &lens=&variant=&compare=a,b
/app/p/:placeId/b/:buildingId/evidence Evidence ledger
/app/settings                          Settings ledger (§24)
/app/proofs                            What we prove (unchanged)
/app/home/:id                          Kept; redirects to the single-family building view
```

Keyboard: `[` and `]` move down and up the scale ladder; `M`, `L`, `C`, `P`, `T` switch modes; `I` inspects a point; `/` or `Ctrl K` opens the palette.

## 18. The five flows

Every flow runs on desktop (1280 px and up), tablet (768 to 1279 px) and phone (360 to 767 px). Drawing a building from scratch needs tablet or desktop; the phone offers looking, choosing, telling and light edits (room function, window size, shading toggles).

### 18.1 New

| Step | Plain prompt | Behind the scenes | Target |
|---|---|---|---|
| Place | "Where is it?" Search a place, drop a pin, or pick a sample (IIIT campus, London terrace, HITEC City office) | Place created with climate and code packs; city pack loads nearest first | 20 s |
| Type | Eight type cards, each with its mon and a 24 hour schedule strip | Type plugin seeds space mix, schedules, systems | 10 s |
| Building | Draw a footprint, trace a PDF, take an OSM outline, or start from a template; stack floors | Building document created; massing mode until rooms exist | 60 s |
| Rooms, windows, shading | Auto-zone by type, or paint room functions; window ratio per facade; overhang, fins, chajja, jaali presets | Compile on release; live plan checks | 60 s |
| See | First results: rough within 2 s, refining through the staged bar | Stages §19 | 30 s |

**AC-NW1** A scripted New flow on GB3 from an empty studio to first results takes ≤ 3 minutes. **AC-NW2** Every defaulted field is visibly an estimate, and an untyped room widens the EUI range.

### 18.2 Revisit

Welcome back reads IndexedDB in under 100 ms and shows: the days since the last visit; what changed (tariff, code edition, weather file, data pack, engine version), each as a before and after with its source; plan progress; one next action. Old results keep their certificates; a recompute shows a diff, never a silent change. **AC-RV1** A tariff pack bump on GB1 shows a diff card listing every changed headline number.

### 18.3 Restart

Two actions: **Start over** (a new empty place; the old one stays in the studio) and **Branch** (copy a place or building into a new project with a lineage link). Nothing is deleted unless the person asks. **AC-RS1** Branching GB1 then editing the branch leaves the original's document and results byte-identical.

### 18.4 Current plus what-if

The building as it is (baseline) beside up to three variants: side by side (2 or 4 views), swipe, or a difference lens. Levers per type (WWR per facade, overhang depth, glazing, roof finish, set point, LPD, HVAC, PV, tariff). Every lever recomputes the whole variant. **AC-W5** Variants differ from the baseline only by their listed changes (diff equals command log). **AC-W6** The difference lens refuses two results of different resolution and says why.

### 18.5 Update

Edit geometry or a setting; dependent numbers take the stale hatch at once; the staged bar runs only the stages the change touches (a tariff change skips geometry, site and energy). **AC-U1** A setting change marks exactly its `affects` set stale before any recompute. **AC-U2** A geometry edit invalidates only the zones it touches.

## 19. Progress, Preview and stage providers

**Stages, in order**: `geometry`, `sun` (sun and shadows), `radiation`, `daylight`, `energy`, `codes`, `optimise`. Narration follows and never blocks a number.

- Each stage is served by a `stage-provider` plugin, `preview` or `real`, chosen in the app manifest. Both return the same contract and emit the same progress events.
- Progress events carry stage, stage index, fraction, tier (`rough`, `refined`, `final`), an optional estimate of time left and a partial result. The bar shows the seven stages as beads, the current one filling, and names what it is doing.
- Rough results appear first and sharpen in place. Every number shows its tier until final.
- Cancel is always visible after 1 s and returns within one slice (≤ 50 ms). An edit cancels stale jobs; a result from an older generation is dropped.
- Preview providers replay recorded timings scaled to the device so the prototype feels like the real thing.

| Latency | Indicator |
|---|---|
| < 100 ms | none |
| 100 ms to 1 s | ink-wash shimmer on changed numbers |
| 1 to 10 s | staged bar with stage names and rough results |
| > 10 s | percent, time left and cancel |

**AC-PG1** No main-thread task over 50 ms during any job (long-task observer). **AC-PG2** First rough result within 2 s on GB1 at Standard resolution (real providers, reference laptop). **AC-PG3** Every Preview number shows the Preview stamp and no Checked seal (DOM audit). **AC-PG4** Swapping one stage from preview to real is a one-line manifest change and the contract test for that stage passes for both.

## 20. Make: the editor

Specified in BE §3 and UV §5. Required behaviour:

- Tools: select, footprint, wall, room (rectangle and polygon), split, merge, opening, shading, measure, underlay. Depths: Massing, Plan, Detail.
- Snapping to grid (100 mm default), 15° angles, existing edges, context edges and plot edges; typing a number while dragging sets it.
- Storeys: add, copy up with linked windows, set floor-to-floor, setbacks per edge.
- Room function painter from the type's space types; an untyped room is unknown.
- Openings by rule (ratio, repeating, single, detailed) per segment; shading by rule (overhang, fins, louvres, light shelf, balcony, screen) with presets chajja, jaali, verandah, courtyard, cool roof.
- Live plan checks drawn on the model: unclosed room (torn edge), overlap (warm hatch), window larger than its wall, and code meters that need no simulation: WWR, SRR, projection factor, ECBC daylight extent, RETV and openable area for homes (EC §3.3).
- Every change is a command of Immer patches: undo, redo, named versions and a film strip of past versions with their EUI. Agent and partner edits carry their origin and undo the same way.
- Underlay: a PDF page scaled by two points and a distance; trace assist proposes walls and rooms from vector paths and dimension labels for the person to confirm (BE §4.1).

**AC-ED1** ECBC Note 4-2 worked example gives PF = 0.345. **AC-ED2** Room areas sum to the storey's floor area with exactly 0 mm² overlap. **AC-ED3** Every tool is reachable by keyboard and through the plan outline. **AC-ED4** Phone: every drag has a button alternative at 360 px.

## 21. Look: lenses

Every lens shares one panel: What, When, Where, How fine (Sketch, Standard, Fine), Result (legend, three key numbers, histogram, table), Inspect. One continuous ramp on screen at a time.

| Lens | Model | Unit |
|---|---|---|
| Shadows | Sun position (NREL SPA port on dmath), shadow per step | time |
| Sun hours | Ray cast per grid point every 6, 15 or 60 min | h/day, h/yr |
| Radiation | Cumulative sky (Perez, Tregenza 145 or Reinhart 577 patches) from the EPW, BVH occlusion | kWh/m²·yr |
| Daylight | Tiers R31 on a 0.8 m work plane (ECBC) or 0.75 m (LM-83), at least one point per m² | % area, lux |
| Glare risk | ASE1000,250 and sun in view | % area |
| Views and sky | Sky view factor and view rays (LEED v5 quality views rules) | % |
| Thermal and comfort | Zone temperatures, fan-first hours | °C, h |
| Impact on neighbours | Difference of neighbour sun hours with and without the building; shading ledger | h, kWh |

**AC-LK1** NREL SPA golden vector within 0.001°. **AC-LK2** Every legend shows unit, resolution, period, method and "Modelled". **AC-LK3** The shading ledger closes exactly in fixed point for every receiver. **AC-LK4** ASE on the SD §7 reference room within 3 points of the Radiance reference.

## 22. Building results and quantities

Evidence ids extend §7. Seal: **C** Checked, **M** Modelled, **E** estimate badge (R17).

| Quantity id | Meaning | Unit | Seal |
|---|---|---|---|
| `geom.gfa`, `geom.nca`, `geom.facade.<bin>`, `geom.wwr.<facade>`, `geom.pf.<opening>` | Gross and conditioned area, facade areas, WWR, projection factor | m², 1 | C |
| `site.sunhours.<sensor set>`, `site.irr.<surface>.m`, `site.svf.<sensor set>`, `site.shade.<window>.m` | Sun hours, monthly irradiation, sky view, shading factor | h, Wh/m², 1 | M |
| `site.ledger.<receiver>.<blocker>` | Sun lost to each blocker | Wh | C (identity) |
| `day.sda.<room>`, `day.ase.<room>`, `day.ecbc_share.<floor>`, `day.views.<floor>` | Daylight metrics with tier | % | M |
| `enduse.<use>.m`, `pv.gen.m`, `dg.kwh.m` | End uses, PV, diesel | Wh | M |
| `eui.site`, `eui.source`, `eui.target.<source>` | EUI and its target | kWh/m²·yr | C (arithmetic), M (inputs) |
| `bill.<carrier>.m`, `bill.cliff_months`, `water.kl.m`, `water.bill.m` | Bills, cliff months, water | paise, kL | C |
| `carbon.op`, `carbon.saved` | Operational carbon (footprint and margin factors named) | gCO2e | C |
| `comfort.fan_hours.<room>`, `comfort.ac_hours.<room>.<setpoint>` | Fan-first and AC comfort hours | h | M |
| `code.<ruleId>.status`, `code.<ruleId>.margin` | Pre-check result and margin, applicability status | enum, metric unit | C |
| `base.<code>.eui`, `base.<code>.ratio` | Baseline EUI and ratio | kWh/m²·yr, 1 | C (ratio) |
| `rating.<scheme>.points`, `rating.<scheme>.level` | Points and level as likely, possible, unknown | points | C (lookup) |
| `split.<party>.<carrier>` | Landlord, tenant or member share | paise | C |

**AC-BR1** EUI is "partial" whenever any end use is unknown (property test). **AC-BR2** Bills on a slab fixture are exact, and crossing 200 units flags a cliff month. **AC-BR3** A split sums exactly to the bill with nothing counted twice (checker row).

## 23. Prove: codes and ratings

- The Prove mode lists every code and rating relevant to the place, building type and size, each with its applicability status (R34), edition, clause references, grade and result.
- India first: TSECBC 2014 (Telangana non-residential with plot over 1,000 m² or built-up area over 2,000 m²), ECBC 2017, ECSBC 2024 tiers and renewables shares, Eco Niwas Samhita (RETV ≤ 15 W/m², roof U ≤ 1.2, openable area ≥ 12.5% in composite climate), NBC 2016 openings, the MoP 2026 draft rating rule at 20,000 m². Global: ASHRAE 90.1-2022 Appendix G, IECC. EPBD appears as policy context only. All thresholds read from memory stay `estimate` until checked against the code PDFs (EC §7.8).
- The rating ladder (Moment 5) puts GHMC stars (5 to 30% savings for 1 to 6 stars), BEE Star, ECSBC tiers, LEED v4.1 and v5 energy points, IGBC and EDGE (20% each in energy, water and embodied carbon; 40% energy for Advanced) on one savings axis.
- Water credits (LEED indoor and outdoor) and EDGE water need no simulation: fixtures, room function and occupancy.
- Optimisation can take a code or rating step as a goal: "cheapest bundle that reaches GHMC 3 stars".

**AC-CD1** Every rule has a source URL, a clause and a grade; `estimate` rules show the badge. **AC-CD2** No screen contains the words "compliant" or "certified" (copy lint). **AC-CD3** Rating step tables pass the Lean monotone and nesting predicates. **AC-CD4** A building with an unknown permit date shows "Local adoption must be confirmed" for every edition-dependent rule.

## 24. Settings ledger

Groups: Money, Carbon, Comfort, Codes and targets, Weather, Analysis resolution, Render quality, Display, Privacy and data (UV §7.2). Each row shows its value, unit, origin chip ("Your value", "TGSPDCL FY 2026-27", "Pack default"), grade and "changes N numbers". Changing a value previews the impact before Apply. "How much does this matter?" runs a tornado chart from the engine. Presets are packs ("Hyderabad 2026 defaults", "UK 2026 defaults").

**AC-SET1** Every setting has unit, source, scope and `affects` (registry check). **AC-SET2** The "changes N numbers" count equals the stale set size.

## 25. Choose: goals, optimisation and the partner

- **Goals** are typed (R42): EUI target, code step, rating level, budget cap in rupees or pounds, maximum payback, carbon cap, comfort hours, daylight. Each has a unit, a scope and a strength. The goal set filters the candidates as R7's target set does. An LLM may only suggest a goal for the owner to confirm.
- **Design space** per type: envelope (WWR per facade, glazing, wall and roof U, roof finish), shading per facade, massing (orientation, setbacks, phototropic generator), internal (LPD, daylight controls), systems (VRF, split, chiller with DOAS, set point), supply (PV, battery, diesel strategy, tariff category) (SO §7.1).
- **Output**: the three picks, the front as ink dots with a brushstroke, a parallel-coordinates view, sweeps as design curves, why-not reasons and the "possible after a check" lane.
- **Live update** in four tiers (instant re-score under 50 ms, re-rank under 1.5 s, full search with certificate, narration). Leaders change only outside the band; otherwise "tied within what we know".
- **Partner**: proposals appear as ghosted cards with their ops and the engine's result; Accept, Tweak or Dismiss with a short reason. Two dismissals with the same reason suggest a rule for the owner to accept.

**AC-OP1** N-axis certificate checks pass on GB1 and GH1. **AC-OP2** NSGA-II with the same seed gives byte-identical results in Node and Chromium. **AC-OP3** The partner writes 0 numbers across the gold set; a raw number in a proposal is rejected. **AC-OP4** Shapley contributions sum exactly to the total change (checker row). **AC-OP5** No leader flip inside the uncertainty band over 500 random slider sessions.

## 26. v3 non-functional requirements and global acceptance

| Area | Requirement |
|---|---|
| Responsiveness | Breakpoints 360, 768, 1280, 1600. No horizontal scroll. Touch targets 44 px, drawing tools 48 px. Every gesture has a button |
| Performance | City level ≤ 150 draw calls and ≤ 400k triangles on the Hyderabad pack. Any lens shows something within 500 ms. Sun hours for one building plus 300 m context at Standard within 10 s in a worker. At most two workers by default |
| Offline | City packs, weather and data packs cache locally; everything computes offline once loaded |
| Determinism | CPU site results, energy, codes and the front are byte-identical across Node and Chromium (AC-D1 extends) |
| Copy | No em or en dashes; no "compliant", "certified", "guaranteed"; Indian number grouping (lakh, crore) in en-IN |

| Id | Criterion | Test |
|---|---|---|
| AC-X1 | All five flows complete at 360, 768, 1280 and 1600 px | Review pass by the QA agents (BUILD_PLAN §11), one capped browser |
| AC-X2 | Every context building has a height source; unknown heights render hatched with a penumbra | Scene test |
| AC-X3 | BESTEST 600 and 900 annual loads inside the ASHRAE 140 ranges (hourly kernel) | Engine validation |
| AC-X4 | Guideline 14 on a calibrated building: monthly NMBE ≤ 5% and CV(RMSE) ≤ 15% | Engine validation (when bills exist) |
| AC-X5 | The Vindhya demo (`PLAN-V3.md` §8) runs offline with no Preview stamp on its path | Manual, recorded on the blackboard |
| AC-X6 | Fixtures from the IIIT drawings contain no personal names | Fixture lint |

## 27. Design before you build (proactive flow)

Today most flows start from a building that exists and look back. This flow starts from nothing and looks forward: design the building, place it on a real map, and see its performance before construction starts, when changes are cheapest.

**Flow (a sixth flow beside new, revisit, restart, what-if and update):**
1. **Brief.** Building type, rough size (area or headcount), storeys, budget band, goals (for example net zero ready, LEED Gold, ECSBC Super, Part L and the Future Homes Standard, lowest operating cost). Goals become typed targets.
2. **Design.** Room by room or massing first, in the editor: rooms with functions, floors, cores, windows by façade, overhangs and fins. A starter template per type is offered, never forced.
3. **Place.** Pick a city (Hyderabad, London; more as city packs land), then drag the building onto a free plot, rotate it, set ground level. The site check flags overlaps with existing buildings and shows the neighbours that shade it.
4. **Test sites and orientations.** Try the same design on two or three plots or rotations side by side: sun hours, radiation, daylight, cooling and heating, EUI, carbon, bills, code standing for that location.
5. **Shape it to the goals.** The optimiser proposes changes (orientation, window share by façade, shading depth, glazing, insulation, PV) that meet the targets at the lowest cost; the partner explains trade offs, never writes numbers.
6. **Commit to a design.** Save it as a branch with its assumptions, so it can later become the "as built" building and be revisited.

**Rules:** everything is labelled Preview until the real stages land. Codes follow the plot's location (UK: Part L 2021, Part O, the Future Homes Standard and the London Plan energy hierarchy; India: ECSBC, ENS, NBC). A designed building is never shown as compliant or certified; it shows where it stands against each target with ranges.

**Acceptance:**
- AC-PD1 From a blank brief, a person designs a two-storey office, places it in London and in Hyderabad, and sees both results side by side in under 5 minutes.
- AC-PD2 Moving or rotating the building on the map reruns only the stages that depend on placement, with the progress bar, and never freezes the page.
- AC-PD3 Each target shows a gap (met, not met, unknown) with its source.
