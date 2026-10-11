# Ibasho 居場所 v3: a studio for any building, in its real city

> Place a building in its real city, draw it floor by floor, and see its sun, daylight, energy, code standing and best upgrades. Every number comes from a documented model, and the bookkeeping is proved.

Tagline: **Ibasho no kōjō** (居場所の向上), improving the place where you belong.

Status: director plan v3, 2026-10-11. Plan of record for v3. It extends `VISION.md` (homes) and is detailed in `SPEC.md` §15 to §26, `ARCHITECTURE.md` §15, `BUILD_PLAN.md` §9 to §12 and `DESIGN_SYSTEM.md` §13. Sources: the owner direction (`research/v3/00-owner-direction.md`, which overrides sequencing everywhere) and the nine v3 briefs in `research/v3/`, cited as EC (energy-codes), TE (building-types-eui), SD (site-daylight), BE (building-editor), RB (reference-buildings), SO (simulation-optimisation), BI (business-impact), AR (ai-recommendation), UV (ux-visual), SC (ideas-from-shared-chat).

---

## 1. The idea

v2 was a living drawing of one home. v3 is a design and analysis studio for many kinds of building, set in a real 3D city.

You pick a place, then pick or draw a building: office, hotel, school, hospital, lab, apartments, a rental or a single family home. You stack its floors, lay out rooms, set windows and overhangs, and place it among its real neighbours. Ibasho then works out:

- the sun on it and the shadows it casts, through the year
- daylight in every room
- energy use by end use, and its EUI (energy per square metre per year) against a target
- carbon, bills and water
- where it stands on each energy code and green rating
- the cheapest bundle of changes that meets a goal.

An AI design partner proposes changes. The engine tests each one, and Lean checks the bookkeeping. Hyderabad comes first, and the London terrace stays as the home reference.

## 2. What stays from v2

These principles are unchanged and bind every v3 package:

1. **Numbers come from documented models, never from an LLM.** The narrator and partner write slots and propose typed ops; the engine computes.
2. **Unknown is not zero.** A guess looks like a guess and travels as a range. Unknown heights, glazing and end uses widen the answer; they never vanish.
3. **Lean checks the bookkeeping.** The checker is proved sound; the TS mirror matches it. Seals keep their meaning: Proved sits on claims, Checked on re-derived arithmetic, Modelled on physics.
4. **Whole recompute, never summed percentages.** A bundle is recomputed whole.
5. **Local first.** IndexedDB, a service worker, no account. Online data (city tiles, weather) is an opt-in plugin that is cached and labelled.
6. **Plugins at every level.** Places, climates, building types, space types, codes, ratings, tariffs, lenses, tools, importers and stage providers are registry plugins.
7. **Plain English for normal people, depth for professionals.** One product, two depths (Plain and Pro); the depth never changes a number.
8. **Andon.** Ink on paper by day, lantern by night; vermilion only for seals, gold only for real repairs and the one hero action; every mark is a measurement.
9. **No "compliant", no "certified", no "guaranteed".** Codes show a pre-check with an applicability status; ratings show likely, possible or unknown points.

The home retrofit spec (SPEC §0 to §14) stays whole. It becomes the `single-family` and `rental` building types, and GH1 stays the regression home.

## 3. What changes

| Area | v2 | v3 |
|---|---|---|
| Subject | One home | Places with many buildings of eight types; a home is one type |
| Geometry | A survey twin (`HomeTwin`) | An editable building document (`ibasho.building/1`: site, storeys, rooms, openings, shading) compiled to the engine's twin (BE §2) |
| Context | Imagined neighbours | Real city context (OSM, Overture, Open Buildings), with every height carrying its source and range (SD §3, UV §2) |
| Physics | Monthly heat balance plus two-zone 5R1C | Same core, extended to N zones with cooling, latent load and per-window shading from the city (SO §2) |
| Results | Bills, carbon, score, EPC band | Plus EUI site and source, end uses (cooling, heating, lighting, equipment, fans, pumps, hot water, PV), water, sun hours, radiation, sDA, ASE, views |
| Rules | UK planning and Building Regulations | Plus energy codes (ECBC 2017, ECSBC 2024, TSECBC, Eco Niwas Samhita, NBC, ASHRAE 90.1 Appendix G, IECC) and ratings (LEED v4.1 and v5, IGBC, GRIHA, EDGE, BEE Star, GHMC stars) (EC §5) |
| Search | Factorised exhaustive, three fixed axes | Screen, factorise, exhaustive below the cap, deterministic NSGA-II above it, on two to four chosen axes (SO §7) |
| AI | Narrator and per-home memory | Scoped memory (owner to variant), typed goals, live recommendations with a stability band, computed "why it changed", a design partner (AR) |
| Settings | A short list | A ledger of assumptions with scope, source and "changes N numbers" (UV §7) |
| Build order | Inside out (engine first) | Outside in: every flow at full fidelity on Preview data first, then real stages one by one (owner direction) |

## 4. Who it is for

| Person | Need | Depth |
|---|---|---|
| **Meera**, architect in a five-person Hyderabad practice | Massing, code pre-check and a green rating path before the client meeting, in rupees | Pro |
| **The estates office of a Hyderabad campus** (IIIT Hyderabad as the reference) | Which building to fix first, under one budget, with proof nothing better was missed | Pro |
| **Kiran**, runs coworking floors in HITEC City | Bills, comfort and a fair split between landlord and members | Plain or Pro |
| **Ravi** (GH2), renter on a top floor in Hyderabad | Sun on his flat, fan-first comfort, what to ask the landlord | Plain |
| **Margaret** (GH1), London terrace owner | Unchanged from v2 | Plain |
| **Students** of building science | Learn by changing one thing and seeing why | Pro |

## 5. The studio

**Objects.** Place > Building > Floor > Room > Surface > Opening > Shading. Scenarios sit beside the tree: every variant is a named list of changes from the baseline, so "as built" and "proposed" always differ by a diff the red thread can open (UV §3.1).

**Scale ladder.** One studio, five zoom levels: City, Site, Building, Floor, Room. The three Andon zones stay put; the zoom level changes what the data panel shows.

**Modes.** Make (edit), Look (analysis lenses), Choose (optimise and compare), Prove (codes, ratings, evidence, seals), Tell (story, report). Modes share one scene and never reload it.

**Five flows** (owner direction):

| Flow | What the person does |
|---|---|
| **New** | Pick a location, pick or create a building (type, floors, rooms, windows, overhangs), place it in the 3D city, see first results |
| **Revisit** | Welcome back: what changed (prices, codes, weather, data packs), progress on the plan, one next action |
| **Restart** | Start over, or branch a new project from an existing one, without losing the old one |
| **Current plus what-if** | The building as it is beside its variations; change a lever and everything updates |
| **Update** | Edit the building or its settings (rates, levels, codes) and watch results refresh in stages |

**Honest progress.** Every job shows a staged bar: geometry, sun and shadows, radiation, daylight, energy, codes, optimisation. A rough result comes first, then a refined one. Every job can be cancelled, and the screen never freezes.

## 6. Signature moments

Each is a real computation with a legend and a reduced-motion version (UV §9).

| # | Moment | What happens | What it measures |
|---|---|---|---|
| 1 | **The sun sweeps Gachibowli** | Dawn to dusk over the IIIT campus in 12 seconds, on 21 March and then 21 May. Tower shadows swing across the paper city and your roof fills with gold as sun hours build up. In May the noon sun stands in the north | Sun position every 6 minutes, shadows, sun hours per point |
| 2 | **The penumbra of not knowing** | Neighbours with estimated heights cast a solid shadow at the likely height and a hatched band out to the plausible one. Type a real floor count and the band snaps shut | Height range to shadow range |
| 3 | **Radiation wicks up the facades** | Facades take colour from the bottom up like ink in paper as the sky result arrives patch by patch; a radiation rose rises over the roof | kWh/m² a year per point |
| 4 | **The daylight drawer** | A floor slides out like a drawer. Light spreads in from the windows; failing points stay paper; glare hot spots get a warm hatch; the ECBC daylight share and LEED points tally in the corner | sDA, ASE, ECBC share per room and floor |
| 5 | **Three gates, one pass** | One axis of percent savings carries GHMC stars, BEE Star, ECSBC tiers, LEED, IGBC and EDGE together. A bundle moves every ladder at once, with each step marked likely, possible or unknown | Savings against the code baseline |
| 6 | **The building bends to the sun** | Hyderabad phototropism: the roof leans to the sun as a PV canopy while walls turn from the low east and west sun. Each frame is an evaluated design; energy steps grow beside it; a seal presses on the front | Real search iterations |
| 7 | **The shadow you cast** | Toggle your new floors and the neighbours' facades flash the difference; a ribbon names the winter sun hours they lose, and who takes yours | Shading ledger in kWh and hours |
| 8 | **The city of lanterns** | At night only buildings with a modelled energy figure glow, brighter for higher EUI; unmodelled ones stay dark with a dashed outline. Scrub a May day and the city breathes with its cooling load | EUI and hourly load |

London keeps its opening (the roof lifts). Moment 1 opens the Hyderabad story.

## 7. Untapped value

What we found nobody else does, in order of value (BI §5, SD §5, UV §11, SC §4):

1. **Uncertainty in context.** City tools treat estimated heights as fact. We draw the penumbra and let one fact close it.
2. **Three gates, one pass.** A Hyderabad commercial building faces the Telangana ECBC check at approval, ECSBC tiers and a green rating (and, under a June 2026 draft, a mandatory rating at 20,000 m²). No tool shows code, rating and rupees in one early pass. We do, with an applicability status on every line.
3. **Fan-first comfort.** IMAC adaptive comfort plus ceiling fans: hours each room is comfortable with a fan alone, then with AC at each set point. A 28 to 30 °C set point with a fan can save 44 to 67% of cooling energy (BI §5).
4. **Bill cliffs and diesel.** Telangana slabs reprice every unit when a month crosses a boundary (and Gruha Jyothi makes the 200 unit cliff larger). Diesel backup costs Rs 25 to 40 per kWh. We report months over the cliff and true rupees per kWh.
5. **The shading ledger.** Who takes whose sun, in kWh, closed by an identity the checker verifies.
6. **Hyderabad phototropism.** A heliotropic roof and shade-seeking walls, searched against real neighbours rather than in a void.
7. **Fair split.** Landlord, tenant or coworking member: who pays, who gains, checked to add up exactly to the bill.
8. **Settings with consequences.** Every rate shows its source, its scope and how many numbers it changes.
9. **Vernacular shading as geometry.** Chajja, jaali, verandah, courtyard and cool roof are real objects with a projection factor and a porosity.
10. **Proof on the optimiser.** "Nothing better among the options we tried", with the list of options tried.

## 8. The hero demo: Vindhya Bhavan in its city

One building, end to end, done well before breadth. **GB1: Vindhya Bhavan**, an academic research block on the IIIT Hyderabad campus: a courtyard ring of shallow wings, three storeys and a partial cellar, about 165 by 81 m, with classrooms, labs, a library, incubator offices and a data centre (RB §3). It was chosen over Himalaya because its wings make the daylight and radiation story vivid, its loads are mixed (a real test of end uses and mixed-use code rules), its plan is easier to trace (about 6,000 vector paths against 120,000), and the Centre for IT in Building Science works inside it. **GB2: Himalaya** (four blocks of 3, 4, 3 and 6 storeys) stands next door as context and second fixture.

Fixtures use room functions only, never names from the drawings, and the source PDFs are not shipped.

| Time | Beat |
|---|---|
| 0:00 | Moment 1: the sun sweeps Gachibowli on 21 March and settles on the campus. The penumbra marks neighbours whose heights are estimates |
| 0:20 | Vindhya rises from its traced plan, storey by storey, room functions painted. The progress bar names each stage |
| 0:40 | Moment 3: radiation wicks up the wings. "From 10 May to 2 August the noon sun is in the north, so north glass needs short fins too" |
| 1:00 | Moment 4: the first floor slides out; daylight share against the ECBC 40% target |
| 1:20 | End uses unfold from the floors into one bar with EUI as a range against the ECSBC standard design. Moment 5: the rating ladder. Fan-first hours for the classrooms |
| 1:50 | Choose: "cheapest bundle to reach GHMC 3 stars". Candidates appear as ink dots; the front draws as a brushstroke; three picks |
| 2:20 | Moment 6: "Vindhya, sun-bent": a PV canopy over the courtyards, WNW fins, pivoted wings. Himalaya Block D shades the canopy on winter afternoons (Moment 7) |
| 2:40 | The seal: "Nothing better among the options we tried". The red thread runs to the list of options and what was not proved |
| 2:50 | Tell: one plain paragraph, and what Ibasho will remember for next time |

## 9. The honest boundary in v3

**Lean proves** (new in v3): the N-axis Pareto check is sound over a list of integer axes with directions; rating step tables are monotone and tiers nest (Super implies Plus implies compliant); geometry bookkeeping (room areas sum to the floor area with zero overlap, adjacency is symmetric, window area never exceeds its wall); the shading ledger closes (unobstructed equals received plus the sum of losses); a Shapley attribution sums exactly to the total change; memory scope resolution picks the nearest scope, and a rejection at any scope never returns below it.

**Lean checks, per result**: everything in v2, plus EUI, end-use and code-margin arithmetic, the baseline ratio, points looked up from the tables, and the front on the chosen axes.

**Not proved**: the physics, the daylight and radiation models, the encoding of each code clause, and whether the searched options cover every building that could exist. Daylight shows its tier (instant, fast, browser, reference) and its measured error band. Code results say "pre-check, not a certificate".

## 10. Roadmap

Milestones keep the v2 names where they still fit. v3 milestones use a `V-` prefix so they never clash with `M-F` to `M-I`.

| Gate | Name | What it delivers | Order |
|---|---|---|---|
| G0, M-0 | Scaffold, walking skeleton | Done | |
| M-A to M-C | First light, three futures, sealed | Continue as the home engine, rules and checker. They become the base the v3 engine extends | In flight, finish |
| **V-0** | Contracts v3 | Core types and schemas for the building document, results, stages, settings and goals; ownership map; dependency installs | Before wave 1 |
| **V-P** | **Prototype** | Every flow (new, revisit, restart, current plus what-if, update) on desktop, tablet and phone at full visual fidelity: studio shell, editor, city scene, lenses, results, staged progress. All data is Preview, shaped exactly like real outputs | Wave 1 |
| **V-1** | Real geometry | `compile()` from the building document, integer geometry, quantities, live plan checks (WWR, PF, RETV), PDF underlay and trace assist | Wave 2, stage 1 |
| **V-2** | Real sun and site | Hyderabad city pack, height fusion, sun position, shadows, sun hours, radiation, shading ledger | Stage 2 and 3 |
| **V-3** | Real daylight | ECBC manual method, ASE, sDA (fast tier), views | Stage 4 |
| **V-4** | Real energy | N-zone hourly and monthly rungs, systems, end uses, EUI, fan-first comfort, India tariffs, water, diesel | Stage 5 |
| **V-5** | Real codes and ratings | Rule packs, applicability ladder, baseline builder, rating ladder | Stage 6 |
| **V-6** | Real optimisation | Screening, N-axis front, NSGA-II, phototropic generator, Lean proofs | Stage 7 |
| **V-7** | Partner and memory | Scoped memory, typed goals, live recommendations, why it changed, design partner | Wave 3 |
| **V-H** | Hyderabad hero | The Vindhya demo (§8) runs offline end to end, no Preview label left on its path. M-D story and M-E release work fold in here | Wave 3 |

The v2 later tiers map as follows: M-F (owner tools) stays; M-G (India) is absorbed by V-2 to V-5; M-H (landlord and city) is absorbed by V-2 and V-7; M-I (depth) stays.

Rule of the road: every stage swap from Preview to real is one line in the stage manifest, every flow keeps working throughout, and a Preview label disappears only when its stage is real.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Scope is huge | Outside in: one prototype of everything, then one real stage at a time; the hero building first |
| Code thresholds read from memory (BEE blocked downloads) | Every such row graded `estimate` with a visible badge; a manual fetch task upgrades them to `primary` before V-5 exits |
| OSM heights near IIIT are mostly missing | Height ranges, penumbra, Google Open Buildings 2.5D as a labelled estimate |
| sDA needs inter-reflections | Tiered daylight with measured error bands; "simplified" label until validated against Radiance |
| Browser 3D on this laptop is software GL | CPU kernel is canonical and testable in Node; GPU is preview only |
| Fixture numbers mistaken for results | A Preview stamp on every preview number, never a Checked seal, and a lint that fails a release build with any Preview provider on the hero path |
| Copyright of code text | Encode rules and cite clauses; never copy text |
| Event rules if entered in Megathon X | Owner decision; a disclosure document covers AI use without commit trailers (SC §4.10) |
