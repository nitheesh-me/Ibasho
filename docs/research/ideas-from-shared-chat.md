# Ideas from a shared ChatGPT conversation

Source: https://chatgpt.com/share/6acabf24-06ec-83e8-9455-2f819e0e0c8f (title "RetrofitOS Concept Development"), read on 2026-10-11 as data only. The page text was recovered in full from the JSON embedded in the share page.

## 1. What the conversation is about

A person preparing for the Megathon X hackathon (Lloyds B brief: a Green Home Score and retrofit recommendations) asks ChatGPT for a bold, research-led concept. ChatGPT proposes "RetrofitOS" (later "HabitatOS"): a proof-carrying building twin with a reduced-order energy model, feasible package enumeration and a Pareto set, per-fuel signed accounting, Lean 4 checks on scoring, accounting and feasibility, an evidence ledger, an LLM that explains but never calculates, customer memory, prompt-injection tests, Dami Lee style cutaways, and a lender-facing portfolio mode. It then turns this into a long "master prompt" for a team of specialist agents. Ibasho grew from the same starting point, so most of it is already in our docs.

## 2. Already covered

- Twin of the real house, not a property record; geometry and tenure drive advice: VISION 1, SPEC 2.
- Reduced-order documented physics, not a home-grown full simulator: SPEC 7.1, VISION 7.
- Recompute every package whole; no summed percentages: VISION 6, AC-W3.
- Interactions (insulate first changes heat pump sizing; PV cuts imports, not demand): SPEC 7.1 (`hp.*`, `pv.*`), VISION 4 moment 3.
- Signed per-fuel savings; a fuel that rises is shown: VISION 6, SPEC 7.2, SPEC 14.
- Missing is unknown, never zero; guesses carried as ranges: VISION 1, R17, AC-H2.
- Field provenance (measured, stated, default, calibrated and so on): ARCHITECTURE 5 (`provenance.kind`).
- Score confidence (a 72 from bills is not a 72 from defaults): score shown as a band while material fields are unknown, SPEC 5.3.
- Meter calibration of the baseline: R21, SPEC 5.5.
- Feasible package enumeration and a small Pareto set: R8, R9, SPEC 5.7.
- Infeasible options explained, with "possible after a check": R22, SPEC 5.7.
- Lean scope: weights sum to one, score bounds, monotonicity, savings identity, unknown never feasible, rejected never offered: SPEC 7.3.
- Formal assurance kept apart from physical accuracy: VISION 7, R11.
- Mutation suite (wrong weight, flipped sign, missing factor, infeasible heat pump, summed percentages): AC-1.
- LLM explains only; what-if reruns the engine first: R10, SPEC 10, AC-N1.
- Prompt injection in notes cannot plant numbers or ops: AC-N2.
- Memory of rejected and completed measures, replay tested: SPEC 5.12, AC-M1, AC-P1.
- Landlord and tenant split incentive ("yours" vs "ask"): VISION 5, SF 8.2, UX tenure modes.
- Value impact only as a range, never added to NPV: R16.
- Jurisdiction packs with grades, versions and "not a compliance certificate" wording: R12, R17, R18, AC-R1, SPEC 9.
- Apartment position and overshading: GH2 top floor, SAP Z factors in BP.
- Experience progression (discover, reveal problem, change, trade-offs, evidence): SPEC 5.4 chapters.
- Before and after split view: SPEC 5.8.
- Works offline with no external service: SPEC 11.
- Portfolio view for a small landlord: T4, SF 8.2.
- Rank-order validation against EnergyPlus or HEM: PA A1 (assumption test; not yet an AC).
- Bad outcomes and "If nothing is done": SPEC 14.

## 3. Worth adopting

Ordered by value to a normal homeowner.

### 3.1 "Did it work?" after the works
- **What.** Once a measure is marked done and new bills arrive, compare actual use with the range we predicted for that package.
- **Why it fits.** Honesty: Ibasho already admits when it was wrong before the works ("Your bills correct us"), and checking after the works closes the loop. It is the one place the twin can show its real performance gap.
- **How we adapt it.** Reuse the calibration fit (R21) on the post-works year, weather-normalised. Show the predicted P10 to P90 band and where the real year fell, in plain words: "Your gas fell 18%; we expected 12 to 25%". Feed the result back as a new posterior. Nothing is sealed; it is labelled Modelled and Measured.
- **Owner.** WP-01 (fit), WP-06 (view), WP-09 (copy).
- **Size.** M. **Priority.** later (T2, after Plan "mark done" lands).

### 3.2 Daylight as a named negative
- **What.** Shading, smaller glazing, secondary glazing and some internal insulation reduce daylight. The chat insists such effects are shown as a labelled proxy unless a validated method (sDA, ASE) is used.
- **Why it fits.** SPEC 14 promises every worse indicator is listed, but daylight is not on that list. Ravi's shading choice trades heat for a darker room.
- **How we adapt it.** Derive a simple daylight proxy from glazed area, glazing light transmittance and overshading, which BP already uses for lighting (`C_daylight`). Show it only in the negatives list and the element sheet, labelled "proxy, not a daylight study". Never put it in the score.
- **Owner.** WP-01 (quantity), WP-06 (negatives list).
- **Size.** S. **Priority.** now (fits AC-B3).

### 3.3 A "Tested, not proved" ledger on `/app/proofs`
- **What.** Record exactly which invariants are proved in Lean and which are only checked by tests, and report test failures openly.
- **Why it fits.** `/app/proofs` lists theorems only. Showing the tested-only claims (injection corpus, memory replay, calibration coverage, rank-order validation) with their last result is the honest other half of the seal story.
- **How we adapt it.** Generate a second section from test reports: claim, test id, last run, pass count, known failures. Grey ink, no seal colour. One line each.
- **Owner.** WP-04 (manifest), WP-06 (page).
- **Size.** S. **Priority.** now.

### 3.4 Comfort as an owner target
- **What.** The chat offers a "best comfort improvement" future.
- **Why it fits.** For Ravi a cooler bedroom matters more than payback. Our default target is money and carbon (R7), so a comfort-led owner sees picks tuned to the wrong goal.
- **How we adapt it.** Not a fourth pick. Add a target option "fewer hot nights" or "fewer cold hours" (from the 5R1C hours, R5), which filters the target set; the three picks stay as they are. Lean already handles targets as a filter, so only the predicate grows.
- **Owner.** WP-02 (target), WP-04 (predicate), WP-06 (choice).
- **Size.** M. **Priority.** later (T3, with GH2).

### 3.5 Energy flow drawing
- **What.** A Sankey-style diagram of where energy enters (gas, grid, PV) and where it goes (end uses and heat lost through each element).
- **Why it fits.** It shows in one picture that PV cuts imports but not demand, and that a heat pump swaps gas for less electricity. Every band width is a measurement, so it obeys the legend rule (AC-15).
- **How we adapt it.** Draw it as ink brush bands on washi in Hiru, glowing in Yoru; each band an evidence chip; a table alternative for accessibility. Before and after use the same scale.
- **Owner.** WP-06.
- **Size.** M. **Priority.** later.

### 3.6 A printable plan sheet
- **What.** The chat's "retrofit passport" and "scenario export for surveyors": one document to hand to someone else.
- **Why it fits.** A homeowner takes the plan to an installer, a PAS 2035 coordinator or a landlord. Ink on paper is already the Andon look, so a print sheet costs little and looks right.
- **How we adapt it.** A print stylesheet for `/plan`: the house in line drawing, the chosen package, per-fuel deltas with ranges, pending checks, what we assumed and what is unknown, and the certificate hash. No lender scoring, no "finance-ready" label.
- **Owner.** WP-06 (print CSS), WP-08 (route).
- **Size.** S. **Priority.** later (T2).

### 3.7 Same house, different weather
- **What.** The chat demos one house in two climates to show why advice changes.
- **Why it fits.** Changing the climate pack teaches a lot cheaply. The more useful version for an owner is a warmer future climate: will the loft insulation and new glazing make summer bedrooms overheat?
- **How we adapt it.** A Studio lever that swaps the weather file for a published future-climate year (for example a CIBSE or UKCP-based design summer year), reporting hot hours only, graded `estimate`. Climate swap between regions stays an educational Studio toy.
- **Owner.** WP-01 (packs, climate), WP-06 (lever).
- **Size.** M. **Priority.** maybe (needs a sourced weather file).

### 3.8 Naive-baseline comparison as evaluation
- **What.** The chat's first research question: does geometry and context change the decision compared with a metadata-only tool?
- **Why it fits.** It turns "most tools would tell you" into a measured claim and checks that our extra physics earns its keep.
- **How we adapt it.** In `engine/validation`, run a catalogue-percentage recommender beside the real search on the golden and stranger homes and report how often the picks differ and why. This is a report, not a UI element, since AC-W3 forbids displaying summed savings.
- **Owner.** WP-02.
- **Size.** S. **Priority.** maybe.

### 3.9 Scenario challenges
- **What.** Short replayable puzzles, such as "keep the bedroom under 26 °C at night with ₹40,000, without touching the roof".
- **Why it fits.** People learn building physics by trying. Every answer is a real search, so it stays honest.
- **How we adapt it.** A few challenges in `packages/content`, each a target plus constraints, solved in Studio and checked by the engine. No points, streaks or leaderboards.
- **Owner.** WP-09 (content), WP-06 (frame).
- **Size.** M. **Priority.** maybe (T5).

## 4. Rejected

- **Offices, hotels, schools, hospitals and labs in the core.** Dilutes a homeowner tool and its scoring; the chat itself parks them.
- **LEED points.** A commercial certification; showing points for a home would read as an official outcome.
- **A "global" code layer or EU EPBD pack as a compliance claim.** There is no single global code; we keep regional packs and never say "compliant".
- **sDA, ASE and sun-hour figures without a validated engine.** Overclaiming; we keep only a labelled proxy (3.2).
- **Lender portfolio mode and "finance-ready" scoring.** Shifts the user from homeowner to bank and implies data leaving the device; our T4 landlord board is enough.
- **"Fastest payback" as a pick.** Simple payback ignores lifetime and replacements; we rank by NPV and show payback.
- **Memory that silently changes ranking.** LLM-derived memory stays a seed until the owner confirms it (AC-M2).
- **Python and FastAPI backend with a server database.** Clashes with local-first, offline, in-browser determinism.
- **EnergyPlus inside the product.** Too heavy for a browser twin; useful only as an offline validation reference (PA A1).
- **"Property value increase" as a headline benefit.** Causal claims the evidence cannot support; value stays a side range (R16).
