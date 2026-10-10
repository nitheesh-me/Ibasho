# Ibasho: Product and Experience Brief

Owner: Product & UX lead (content and experience)
Status: research brief, v0.1 (2026-10-10)
Inputs: `report/M1.typ` (founding plan), web research (sources at the end, cited inline as [S#]).

This brief defines the full customer experience for a normal person, not an energy assessor. It covers personas, information architecture, every screen, onboarding, revisit, persistence, loading, empty and error states, accessibility, i18n, mobile, microcopy, the what-if model, the LLM narrator surface and the landing page. Each section ends with decisions other agents can build against.

---

## 1. Experience thesis

**Ibasho (居場所)** is "a place where one belongs; where one can be oneself" [S1]. Researchers describe it as a physical and psychological place where one feels accepted [S1]. The product should feel like that: calm, personal, unhurried, and on your side. It should not feel like a compliance form or a sales funnel.

**Ibasho no kōjō** (improving one's place) is the verb. The product helps a home become more of an ibasho: warmer or cooler, cheaper to run, lower carbon, within the owner's rights and budget.

**Storytelling model.** Dami Lee's team structures videos as a funnel: open with an emotional, human idea, then descend into technical detail, alternating "tension and data" so people "start learning without even realizing they're learning" [S2]. We adopt this literally as the screen grammar:

| Funnel layer | Ibasho surface | Example |
|---|---|---|
| Human hook | Home stage (the isometric twin with people in it) | "Your back bedroom is the coldest room in January." |
| Tension | What-if, futures | "Insulate the loft, or swap the boiler first?" |
| Data | Numbers with ranges | "Gas −3,100 kWh/yr, electricity +1,400 kWh/yr" |
| Proof | Evidence drawer, Lean badge | "Savings equal before minus after. Proved." |

**Seven experience principles** (each traceable to an M1 rule):

1. **Your home first, the model second.** Every screen opens on the twin, never on a table.
2. **Unknown is not zero.** Missing facts become visible ranges, never silent defaults (M1: typed state).
3. **Recompute, never add.** Every what-if reruns the whole model; the UI never shows summed percentages (M1 rule 1).
4. **Show both directions.** A fuel that goes up is shown going up (M1 rule 2).
5. **Only what you can build.** Infeasible options are explained, not hidden silently (M1 rule 3).
6. **Every number opens.** Tap any figure to see its formula, inputs and proof status (M1 rule 4).
7. **The narrator only reads.** The AI explains computed evidence and remembers your constraints; it cannot change a number (M1 rule 5).

---

## 2. Personas

| | **Margaret, UK terrace homeowner** | **Ravi, Hyderabad top-floor tenant** | **Daniel, small UK landlord** |
|---|---|---|---|
| Home | 1905 mid-terrace, Leeds. Solid brick, gas combi, single glazed sash at back. | 3rd floor of 3, RCC flat roof, west-facing, 2BHK in Kondapur. | 3 flats: 1930s semi, 1970s flat, 1990s terrace. |
| Context | 64% of pre-1945 English homes have uninsulated solid walls; pre-1945 stock is most commonly mid-terrace (30%) [S3]. | Top floors take the roof's solar load; Telangana's Cool Roof Policy runs 2023 to 2028 with claimed indoor reductions of 2.1 to 4.3 °C [S4]. | Private rentals in England and Wales must reach EPC C equivalent by 1 Oct 2030, with a £10,000 cost cap (per commentary on the Jan 2026 response) [S5]. |
| Goal | Warm back bedroom, lower bills, not wreck the period look. | Survive April to June without the AC running all night; cannot alter the structure. | Comply by 2030 at least cost, keep tenants, defend decisions. |
| Constraints | Budget £8k, conservation-minded, no external wall insulation at front. | Tenant: no roof rights, no wall changes, can buy curtains, films, fans, maybe ask landlord for roof coating. | Cap per property, tenant in situ, wants evidence for exemption if needed. |
| Fears | Being sold a heat pump that does not work in an old house (Boiler Upgrade Scheme still offers up to £7,500 [S20]). | Wasting deposit money; landlord refusing. | Over-spending; picking measures that do not move the rating. |
| Data available | Postcode, EPC on register, gas and electricity bills. | City, floor, orientation, monthly electricity bill (TSSPDCL), AC tonnage. | EPCs for all three, rough bills, tenant notes. |
| Key what-if | "Loft + draught-proofing now, heat pump later?" | "Reflective roof coat (landlord) vs. external blinds (me)?" | "Cheapest path to C for each flat, under £10k?" |
| Win moment | Sees the back bedroom turn from blue to amber in the cutaway. | Sees afternoon heat wave hit the roof, then bounce off with a cool roof. | Portfolio board: three homes, three paths, one export for the letting agent. |
| Mode | Owner | Tenant (asks landlord) | Landlord (split incentive: pays, tenant saves) |

**Decision:** tenure is a first-class field (`owner | tenant | landlord`). It changes which measures are "yours", which are "ask", and the copy (Section 15). Ravi's "ask your landlord" is a generated, evidence-backed request letter, not a dead end.

---

## 3. Information architecture

### 3.1 Object model the UI exposes

| Object | What it is | Persisted | Owner agent |
|---|---|---|---|
| Home | Address, climate, archetype, people, tenure | Yes | Product |
| Twin | Typed building state; each field is `known`, `estimated(range, source)` or `unknown` | Yes, versioned | Architecture |
| Baseline | Model result for the twin today (kWh per fuel, cost, carbon, comfort, score) | Cached, recomputable | Building science |
| Scenario | A set of measures applied to the twin (a what-if) | Yes | Product |
| Futures | The Pareto set: cheapest, best return, lowest carbon (plus any pinned scenario) | Cached | Optimisation |
| Plan | The future the person chose, split into steps with status | Yes | Product |
| Evidence | Formula, inputs, sources, proof status for each number | Derived | Quality |
| Memory | Owner constraints and preferences ("no heat pump", "keep sash windows") | Yes | AI |
| Snapshot | Read-only, portable copy of Home + Twin + Plan | Exported | Product |

### 3.2 Sitemap

```
/                      Landing (scroll story)
/app                   Router: first run -> /app/begin, else -> /app/home/:id
/app/begin             Onboarding (5 steps, single route, step in state)
/app/home/:id          Home stage (twin + score + narrator)
  ?view=cutaway|plan|section|season
/app/home/:id/whatif   What-if studio (scenario tray, compare)
/app/home/:id/futures  Three futures (Pareto) + trade-off chart
/app/home/:id/plan     My plan (steps, progress, ask-landlord letters)
/app/home/:id/evidence Evidence ledger (all numbers, sources, proofs)
/app/home/:id/sharpen  "Make it more accurate" (ranked unknowns)
/app/homes             Portfolio (landlord mode, 2+ homes)
/app/memory            What Ibasho remembers about you (view, edit, forget)
/app/settings          Narrator, units, language, motion, data
/s#<payload>           Read-only shared snapshot viewer
```

Routing uses the URL for view state (deep links into a scenario and a selected element: `?scenario=s3&focus=roof`) so any screen can be bookmarked or shared within the device.

### 3.3 Navigation

* Desktop: left rail with five icons (Home, What-if, Futures, Plan, Evidence), plus a top-right home switcher. The twin stays mounted across tabs; panels slide over it, so the 3D scene never reloads.
* Mobile: bottom tab bar with four items (Home, What-if, Plan, More). The twin occupies the top 45% of the viewport; the sheet below is draggable with snap points and a keyboard or button alternative (WCAG 2.5.7) [S6].
* Command palette (`/` or `Ctrl K`): "loft insulation", "compare cheapest vs lowest carbon", "why is gas up". It doubles as the keyboard path into the 3D scene.

---

## 4. Screen inventory

| # | Screen | Purpose | Primary action | Key states |
|---|---|---|---|---|
| 1 | Landing | Tell the story, invite to begin | "Draw my home" | Static fallback without WebGL |
| 2 | Begin: Where | Locate climate | Postcode, city or map pin | Offline: city list only |
| 3 | Begin: Shape | Archetype picker | Pick an isometric thumbnail | "Not sure" option |
| 4 | Begin: Tune | 4 to 6 smart questions | Adjust or skip | Each skip becomes a range |
| 5 | Begin: People and rights | Tenure, budget, who lives there | Set tenure, budget band | Tenure changes copy |
| 6 | Begin: Reveal | The twin draws itself, first score | "Explore my home" | Progressive 3D |
| 7 | Home stage | The twin, score, top 3 insights | Tap an element or insight | Cutaway, plan, season views |
| 8 | Element sheet | One element (roof, wall, window, boiler) | Edit or "what if" | Known vs estimated |
| 9 | What-if studio | Build and compare scenarios | Toggle measures, drag sliders | Recomputing, infeasible |
| 10 | Futures | Pareto front and three named futures | "Make this my plan" | Empty if no feasible package |
| 11 | Plan | Steps, cost, progress, letters | Mark done, reorder | Revisit diff |
| 12 | Evidence ledger | All numbers with provenance | Open a number | Proof pending, failed |
| 13 | Sharpen | Ranked unknowns by value of information | Answer one question | Done state |
| 14 | Portfolio | Landlord board of homes | Open a home, export | One-home empty state |
| 15 | Memory | What the narrator remembers | Edit, forget | Empty |
| 16 | Settings | Narrator, language, units, motion, data | Export, import, wipe | Storage not persistent warning |
| 17 | Snapshot viewer | Read-only view of a shared home | "Make a copy" | Corrupt or newer version |
| 18 | Welcome back | Revisit summary | Continue plan | Model updated notice |

---

## 5. Onboarding: a home twin in under two minutes

### 5.1 Time budget

| Step | Target | Inputs | What happens behind |
|---|---|---|---|
| Where | 15 s | UK postcode, or city, or map pin | Geocode (UK: postcodes.io, free, no key [S7]); climate from bundled typical-year file, optional Open-Meteo refresh (free for non-commercial, no key [S8]); UK only: offer to look up EPC (opendatacommunities API [S9]) |
| Shape | 15 s | One tap on archetype | Archetype pack seeds geometry, constructions, systems with ranges |
| Tune | 45 s | Up to 6 questions | Each answer collapses a range; "Not sure" keeps it |
| People and rights | 20 s | Tenure, household size, budget band | Feasibility constraints and memory seeded |
| Reveal | 15 s | None | Baseline computed, twin animates in, first insight |
| **Total** | **~110 s** | | Skippable to "Reveal" from step 3 at any time |

Benchmark: Rewiring America's planner promises a plan "in under five minutes" from an address plus a few specifications [S10]; the Energy Saving Trust Home Energy Check asks age, wall type, heating, fuel, and fills unknowns with area-based suggestions [S11]. We aim for half that time, with the difference that our defaults are shown as ranges rather than hidden.

### 5.2 Step detail

**Where.** One field that accepts a UK postcode, an Indian PIN, or a city name. A "Use a map" link opens a stylised map with a pin. The output is a climate card ("Leeds: 2,300 heating degree days, mild summers") drawn in ink.

UK only, optional: "We found 3 certificates near this postcode. Is one yours?" Picking one pre-fills age band, wall type, glazing and heating, each tagged `source: EPC 2019`. Privacy note under the button: "Looked up on the public EPC register. Nothing about you is sent." Decision: the EPC lookup is a plugin (`region-uk`), off when offline.

**Shape.** A 3 by 3 grid of isometric thumbnails, each a tiny animated cutaway (static under reduced motion). Region packs supply archetypes:

| UK pack | India pack |
|---|---|
| Victorian or Edwardian terrace (solid brick) | Top-floor RCC flat |
| 1930s semi | Mid-floor RCC flat |
| Post-war semi (cavity) | Ground-floor flat |
| 1960s to 70s flat | Independent house (G+1) |
| 1990s to 2000s estate house | Villa in gated community |
| Bungalow | Row house |
| New build (post 2012) | Not sure |
| Converted flat | |
| Not sure | |

"Not sure" picks the most common archetype for the location and widens every range. Each thumbnail has an `alt` sentence ("A two-storey brick terrace with a pitched slate roof, neighbours on both sides").

**Tune.** Questions are ordered by value of information (which answer moves the result range the most), computed by the building-science engine. Typical UK order: heating system, loft insulation depth, glazing, wall type confirm, floor area, main bill. Typical India order: floor level, roof exposure (shaded by tank or terrace garden?), AC count and tonnage, west wall glazing, monthly bill, ceiling fan count. Each question uses pictures, not jargon ("Which looks most like your loft?" with three drawings: bare joists, thin yellow layer, deep fluffy layer).

**People and rights.** Tenure toggle with plain consequences:

* Owner: "You can change anything, subject to planning."
* Tenant: "We will separate what you can do from what you can ask for."
* Landlord: "We will look for the cheapest path to your target and show who benefits."

Budget band chips (UK: under £2k, £2k to 8k, £8k to 20k, over £20k, not sure; India: under ₹25k, ₹25k to 1 lakh, 1 to 3 lakh, over 3 lakh, not sure).

**Reveal.** The twin draws itself (Section 10). The score lands last, as a range if uncertainty is wide ("54 to 66, likely 61"). One insight appears, in the funnel order of Section 1: a human sentence first, a number second.

### 5.3 "Unknown is not zero" visual grammar

| Field state | Line style in 3D and 2D | Number style | Copy |
|---|---|---|---|
| Known (you told us, or a document) | Solid ink | `61` | none |
| Estimated (archetype or area default) | Pencil hatch, slightly lighter | `54 to 66` with a dot at the likely value | "Estimated from homes like yours" |
| Unknown and material | Dashed outline, breathing slowly (static under reduced motion) | Range plus a "sharpen" chip | "This matters. One question narrows it." |
| Unknown, not material | Pencil hatch | Not shown separately | "Doesn't change your result much" |

Ranges propagate: if the Lean-verified score bound holds for every point in the range, we show the range; we never collapse it to a midpoint without saying so. Decision: the score dial has a visible band, not a needle, while any material field is unknown.

---

## 6. The what-if interaction model

### 6.1 Three ways to ask "what if"

The model is Bret Victor's reactive document: the reader plays with the author's assumptions and sees the consequences [S21]. Here the "document" is the house.

1. **Touch the house.** Tap the loft in the cutaway; the element sheet offers "What if I insulate this?" with a depth slider (100, 200, 270, 300 mm). The twin updates in place.
2. **The measure tray.** A horizontal tray of measure cards (loft, walls, floor, glazing, draught-proofing, heat pump, solar PV, cool roof, shading, fans). Toggling a card adds it to the current scenario. Cards a person cannot do (tenure, memory, budget) appear greyed with the reason and an "Ask landlord" or "Override" action.
3. **Ask in words.** "What if I only had £3,000?" The narrator turns this into a constraint change, shows the parsed intent as chips ("budget ≤ £3,000"), and the engine recomputes. The LLM never estimates the result itself.

### 6.2 Recompute contract

| Latency | Behaviour |
|---|---|
| Under 100 ms | Numbers tick to new values, twin colours shift. No indicator. |
| 100 ms to 1 s | Changed numbers show a faint ink-wash shimmer; old value stays readable. |
| 1 to 10 s (full Pareto search) | A thin "drawing" line traces under the futures header, with stage labels (enumerating 64 packages, filtering 41 feasible, ranking). |
| Over 10 s | Percent done and a cancel. |

These thresholds follow common NN/g-derived guidance: an indicator beyond about 1 s, looped indicators for 2 to 10 s, percent-done beyond that [S12]. Recompute runs in a Web Worker so the scene never stutters.

### 6.3 Showing the delta

* **Ghost overlay.** The baseline house stays as a faint pencil ghost behind the scenario house; heat flow arrows show "before" in grey and "after" in colour.
* **Signed per-fuel bars.** Diverging bars per fuel, centred on zero: gas left (saving), electricity right if it rises. Never one net bar alone.
* **Delta sentence.** "Gas falls by about 3,100 kWh a year. Electricity rises by 1,400. Bills fall by £310 to £420."
* **Compare mode.** Two scenarios side by side (desktop) or swipe between them with a fixed comparison strip (mobile). Up to four pinned scenarios.
* **Season scrubber.** A year ring around the house: drag (or arrow keys) through months; the twin shows monthly heat loss (UK) or afternoon heat gain (India). This is the Dami Lee "tension" beat: January for Margaret, May at 4 pm for Ravi.

### 6.4 Infeasibility as story, not error

When a scenario breaks a constraint the house does not refuse; it explains: "A heat pump here needs a 6 kW unit. Your budget allows a 5 kW installed price. Add loft insulation first and a 5 kW unit fits." Every infeasible message names the rule (budget, tenure, physical, memory) and offers the nearest feasible scenario, computed by the optimiser.

### 6.5 Futures (Pareto)

Three named cards, always in this order: **Gentle** (cheapest that improves), **Wise** (best return), **Bold** (lowest carbon). Each card: cost range, annual saving range, carbon change, score change, comfort change, payback. Beneath: a cost vs carbon scatter of all feasible packages with the front drawn as an ink line; the three named points are marked; any point is tappable and keyboard focusable, with a table alternative. "Make this my plan" commits a future to the Plan.

Decision: the names are friendly but the axis is always stated ("Gentle: lowest upfront cost"). Japanese flourish on each card in small type (穏 / 賢 / 勇), decorative only, `aria-hidden`.

---

## 7. Revisit flow

On return, before the twin loads, the app reads local state (sub-100 ms from IndexedDB) and shows **Welcome back**:

| Block | Content | Source |
|---|---|---|
| Greeting | "Welcome back to 14 Ashby Street. It's been 23 days." Seasonal line ("Heating season has started.") | Local clock, climate |
| What changed | Model version change and its effect: "We improved how we model sash windows. Your score moved 61 → 59. See why." | Changelog plugin, recomputed baseline diff |
| What changed (prices) | "Electricity prices updated (region pack v2026.10). Wise future payback 9.1 → 8.4 years." | Region data pack version |
| Your plan | Progress ring: 2 of 5 steps done, money committed, carbon saved to date (estimated) | Plan |
| Nudge | One next action, highest value: "Answer one question about your floor to narrow your range by 40%." | Sharpen ranking |
| Memory check | "You told us no heat pump for now. Still true?" (once per 90 days) | Memory |

The **diff is the feature**: every recomputation on revisit is shown as before/after with the reason, never as a silently different number. Marking a step done prompts "Did it go as planned?" (actual cost, date, photo optional) and updates the twin from estimated to known.

---

## 8. Persistence: local-first, portable, honest

### 8.1 Storage model

* IndexedDB (via a thin repository layer, Dexie or idb) holds Homes, Twin versions (append-only, so undo and "what changed" are free), Scenarios, Plan, Memory, Settings.
* After the Reveal (a user gesture), call `navigator.storage.persist()`. Chromium and Safari grant or deny silently based on engagement; Firefox shows a prompt [S13]. Persisted origins are exempt from storage-pressure eviction [S13].
* **Safari caveat.** With tracking prevention on, Safari deletes script-written storage for an origin with no user interaction in the last seven days of browser use [S13]. MDN does not state that `persist()` exempts an origin from this rule [S13]. Decision: Settings shows a "Storage: protected / at risk" status; on Safari we recommend "Add to Home Screen" (installed web apps get a larger quota [S13]) and offer a one-tap export reminder.
* Every write is a small transaction; a version stamp on each record supports schema migrations (`migrations/` plugin folder, forward only, tested against fixture snapshots).

### 8.2 Export and import

* `.ibasho` file: JSON (schema-versioned), optionally gzip. Contains Home, Twin history, Scenarios, Plan, Memory (opt-in checkbox, off by default), model and data-pack versions, and a content hash.
* Import validates schema, shows a preview card ("Leeds terrace, 3 scenarios, plan 2 of 5"), and asks "Replace" or "Add as new home".
* Landlord export: one PDF-ready evidence report per home (for letting agents or an exemption file), generated client-side.

### 8.3 Shareable read-only snapshot

* URL form: `/s#v1.<base64url(deflate-raw(json))>`. The payload sits in the fragment, so it is never sent to any server. Compression Streams (including `deflate-raw`) are Baseline across current browsers since 2023 [S14].
* Content: Twin (current), chosen future, key results, no Memory, no address beyond city or postcode district. A "What's included" sheet appears before copying.
* Budget: target under 2 KB payload by sharing the twin delta from its archetype rather than full geometry. If over about 8 KB, fall back to "Download snapshot file" with a note.
* Viewer: read-only, banner "You are viewing Margaret's shared home. Make your own copy to explore." Numbers are recomputed on open with the viewer's model version; if they differ from the sender's, both are shown.

---

## 9. Loading states that feel like ink drawing

Evidence on skeleton screens is mixed: NN/g-linked sources favour them, while a 2017 Viget study found a skeleton performed worst on perceived speed, possibly because it draws attention to the wait [S12]. Carbon advises skeletons only for brief content loads [S15]. Decision: our loaders are **content, not placeholders**. They draw the actual house progressively, so time spent waiting is time spent seeing your home.

### 9.1 Progressive 3D reveal (the "ink stages")

| Stage | Budget | What is visible | Fallback |
|---|---|---|---|
| 0. Paper | 0 to 150 ms | Paper texture, title, the home's name in type | Static HTML, no JS needed |
| 1. Pencil | 150 to 500 ms | SVG isometric line drawing of the archetype, stroke-dashoffset animated (instant under reduced motion) | Stays as final view if WebGL is unavailable |
| 2. Ink | 0.5 to 1.5 s | three.js scene with flat ink materials, same camera as the SVG so the swap is seamless | |
| 3. Wash | 1.5 to 3 s | Watercolour-like thermal wash, shadows, people and furniture | Skipped on low-power devices |
| 4. Numbers | when baseline resolves | Score band and first insight settle in | Numbers can arrive before stage 3 |

Rules: never block numbers on visuals; never show a spinner in the main stage; the cross-fade between SVG and WebGL uses matched projection so nothing jumps. Low-end detection (device memory, `navigator.hardwareConcurrency`, a 1-frame timing probe) chooses a quality tier, overridable in Settings.

### 9.2 Inline loaders

* Number recomputing: previous value stays, a short brush stroke underline sweeps.
* Narrator thinking: the narrator's seal (a small hanko-style stamp) presses and lifts, plus "Reading your evidence…". With the deterministic template narrator this is instant.
* Model download (WebLLM, hundreds of MB): explicit opt-in with size, a real percent bar, and the template narrator works meanwhile.

---

## 10. Empty and error states

| Situation | What the person sees | Microcopy |
|---|---|---|
| No homes yet (first run) | Landing CTA or onboarding | "Let's draw your home. It takes about two minutes." |
| No scenarios | Tray with three suggested starters | "Try one change. The house will show you what it does." |
| No feasible package | Futures shows the closest-to-feasible and which constraint binds | "Nothing fits £1,500 yet. Raising it to £2,200 opens two options. Or ask your landlord about the roof." |
| No plan | Futures CTA | "Pick a future when you're ready. Nothing is committed." |
| Memory empty | Explanation | "As you tell Ibasho what you won't do, it remembers here. You can forget anything." |
| Offline | Small badge, everything still works | "Offline. Your home is saved on this device." |
| Postcode not found | Inline, keeps input | "We couldn't place that postcode. Try a nearby one or pick your city." |
| EPC lookup fails | Skips silently to manual with note | "The certificate register didn't answer. We'll ask a couple of questions instead." |
| WebGL unavailable or context lost | SVG isometric twin, full functionality | "Showing the drawing view. Everything still works." Auto retry on context restore. |
| Storage denied or full | Persistent banner with export | "This browser may clear your home. Save a copy to keep it safe." |
| Import invalid | Dialog with reason | "This file is from a newer Ibasho (v3). Update to open it." |
| Snapshot corrupt | Viewer error card | "This link is incomplete. Ask for it again, or for the file." |
| Narrator unavailable | Template narrator takes over silently, badge shows "Plain narrator" | none needed |
| Proof check failed (dev or data error) | Number shown with a red seal, not hidden | "We couldn't verify this number. We're showing it, marked, so you can judge." |
| Physics out of plausible range | Amber seal, link to evidence | "This is higher than most homes like yours. Check the floor area?" |

Tone rule: errors never blame the person, always say what still works, always offer one next step.

---

## 11. Accessibility

Target: WCAG 2.2 AA for all 2D UI, with documented equivalents for the 3D stage.

| Area | Decision | Reference |
|---|---|---|
| 3D for screen readers | A parallel DOM "scene outline" generated from the twin: a list of elements (roof, walls, windows, rooms) with state sentences ("Loft: estimated 100 mm insulation, losing about 18% of your heat"). Focus moves through this list; the 3D highlights the focused element. Do not depend on `@react-three/a11y`: its author reports it is no longer maintained [S16]. We build the same overlay idea as our own `a11y-scene` plugin. | [S16] |
| Live results | One polite `aria-live` region announces recompute results as a single sentence, debounced. | |
| Keyboard | Everything reachable; arrow keys orbit, `+`/`-` zoom, `[`/`]` move through seasons, `Enter` opens element sheet, `/` command palette. Visible focus never hidden by sheets (2.4.11 AA). | [S6] |
| Dragging | Every drag (sheet, slider, orbit, season ring) has a click or key alternative (2.5.7 AA). | [S6] |
| Targets | Minimum 24 by 24 CSS px; we use 44 px on touch (2.5.8 AA). | [S6] |
| Motion | Respect `prefers-reduced-motion`: render loop goes on-demand (frame only on change), no camera fly-throughs, ink draws become fades; plus an in-app toggle. Autoplaying motion over 5 s is pausable (2.2.2). | [S17] |
| Colour | Thermal palette is perceptually ordered and colour-blind safe (blue to amber, never red/green alone); every colour coded state also has a pattern (hatch) or label. Text contrast 4.5:1 minimum, 7:1 for numbers on the stage. | |
| Charts | Every chart has a "Show as table" switch and a one-sentence summary. | |
| Language | `lang` attributes on Japanese, Hindi, Telugu fragments so screen readers switch voice. Decorative kanji are `aria-hidden`. | |
| Cognitive | One primary action per screen; plain words; glossary tooltips; no time limits. | |

---

## 12. Internationalisation

* **Message format:** ICU MessageFormat (FormatJS or similar) with keys per plugin namespace (`core.*`, `region-uk.*`, `region-in.*`). Plurals and gender handled by ICU, not string concatenation.
* **Numbers and money:** `Intl.NumberFormat`. `en-IN` groups as 1,00,000 (lakh), `en-GB` as 100,000. Currency follows the home's region, not the UI language (a Japanese-language UI on a Leeds home still shows £).
* **Units:** kWh, kgCO₂e, °C, m² everywhere; optional "bill view" converts to money per month. Temperatures in °C only (°F is a locale pack option).
* **Languages:** English (en-GB, en-IN) at launch. Japanese is a flourish layer in English mode (section marks, the three future names, seasonal words like 寒 for the cold month) and a full locale later. Hindi and Telugu: locale packs, because Ravi's landlord letter is most useful in Telugu or Hindi; letters are generated from templates with translated strings, numbers inserted by code.
* **Fonts:** a Noto family subset per script (Noto Serif JP, Noto Sans Devanagari, Noto Sans Telugu), loaded lazily per locale, with `font-display: swap`.
* **Layout:** CSS logical properties throughout so an RTL pack is possible later. Text containers allow 40% expansion.

---

## 13. Mobile behaviour

* Portrait first. Twin in the top 45%, sheet below with three snap points (peek, half, full) and buttons for each.
* Gestures: one-finger orbit, pinch zoom, two-finger pan; a "reset view" button always visible.
* Quality tier defaults lower: no wash stage on battery saver or low memory; 30 fps cap; render on demand when idle.
* What-if on mobile: the tray scrolls horizontally; compare uses a swipe deck with a sticky delta strip.
* Installable PWA (manifest, offline shell via service worker). Install is offered after the Reveal, framed as "Keep your home safe on this phone", which also improves Safari storage longevity [S13].
* Haptics (where supported) only on commit actions ("Make this my plan"), off under reduced motion.

---

## 14. The narrator surface (LLM)

* Placement: a margin column on desktop ("marginalia"), a collapsible card on mobile. Styled as handwritten annotation on the drawing, which is the Dami Lee overlay idea applied to a live model.
* Every number in narration is a **chip** bound to an evidence id; tapping it opens the evidence drawer. Numbers are inserted by code from the result, the model writes only the connective text. Ungrounded numbers are stripped and logged (M1 test: at least 90% grounded).
* Adapters selectable in Settings: Template (default, deterministic, instant), Local (WebLLM in browser, or Ollama on the machine), Cloud (Claude via optional proxy). Badge shows which is active.
* Memory UI: when the person says "I won't do a heat pump", a small card appears: "Remembered: no heat pump. [Undo] [Edit]". The Memory screen lists all items with source sentence and date, and "Forget".

---

## 15. Microcopy and voice

Voice: **a calm architect friend who sketches while talking.** Warm, specific, unhurried, never salesy. Short sentences. British spelling in en-GB.

| Do | Don't |
|---|---|
| "Your back bedroom loses the most heat." | "Thermal envelope deficiency detected." |
| "About £310 to £420 a year." | "Save up to £420!" |
| "Gas goes down. Electricity goes up a little." | "Reduce your energy by 40%." |
| "You can ask your landlord for this. Here's a letter." | "Not available for tenants." |
| "We're not sure about your floor. One question fixes that." | "Data missing." |
| "This number is proved to add up." | "AI-verified!" |
| "Estimated from homes like yours." | Showing a default as if it were fact. |

Glossary rule: technical words appear with a dotted underline and plain definition (U-value: "how fast heat leaks through, lower is better"). Proof language: "proved" only for Lean-checked bookkeeping; physics is "modelled" and "checked against published ranges" (M1 honest boundary). Never "guaranteed".

Japanese flourishes: used as section seals and seasonal accents, always paired with English, never needed to understand anything.

---

## 16. Landing page: the scroll story

Structure follows the funnel: human hook, tension, data, proof, invitation [S2]. Each chapter is a pinned isometric scene that transforms as you scroll (scrollytelling), with a static image sequence under reduced motion. The landing page is a separate route sharing the design system, with chapter content in a data file so it can be updated as the product changes.

| # | Chapter | Scene | Line |
|---|---|---|---|
| 0 | Hero | A single terrace house drawn in ink, a window lights up | "居場所. A place where you belong. Let's make yours better." CTA: "Draw my home" |
| 1 | Two homes | Split screen: Leeds terrace in January, Hyderabad roof in May | "Same question, opposite answers. One home loses heat. The other can't get rid of it." |
| 2 | The twin | The house unfolds into a cutaway, labels appear in handwriting | "Ibasho draws a living copy of your home. Change it, and it recomputes." |
| 3 | Unknown is not zero | Hatched walls sharpen into ink as questions are answered | "If we don't know, we say so, and show you how much it matters." |
| 4 | What if | Measures drop onto the house; per-fuel bars swing both ways | "Insulation shrinks the heat pump you need. We never just add percentages." |
| 5 | Three futures | Three ghost houses side by side: Gentle, Wise, Bold | "Cheapest, best return, lowest carbon. Only ones you can actually build." |
| 6 | Proof | A number opens into its formula and a Lean seal stamps it | "Every number opens. The bookkeeping is proved." |
| 7 | Your rights | Tenant and landlord figures, a letter folds itself | "Renting? We separate what you can do from what you can ask for." |
| 8 | Private by default | The house sits inside a paper envelope on a phone | "Your home stays on your device. No account." |
| 9 | Invitation | Back to the hero house, now warm | "Draw my home" plus "See a sample home" (loads Margaret's twin read-only) |

Performance: landing first paint under 1.5 s on mid-range mobile; 3D chapters lazy-load; each chapter has a pre-rendered poster image.

---

## 17. Plugin points owned by experience

| Plugin type | Contributes | Example |
|---|---|---|
| Region pack | Archetypes, onboarding questions, prices, carbon factors, incentives copy, regulations copy | `region-uk`, `region-in-telangana` |
| Archetype | Geometry generator, thumbnail SVG, default ranges, alt text | `uk-victorian-terrace` |
| Measure | Card UI, element sheet controls, feasibility explanations | `cool-roof-coating` |
| Locale | ICU messages, fonts, number conventions | `locale-te` |
| Narrator adapter | Narration backend, capability flags | `narrator-template`, `narrator-webllm`, `narrator-claude` |
| Panel | A screen slot on the home stage (e.g. "comfort hours") | `panel-overheating` |
| Exporter | File or report outputs | `export-landlord-pdf` |
| Onboarding step | Insertable step with time cost declared | `step-epc-lookup` |

Each plugin declares its onboarding time cost and its accessibility description fields; the core rejects a step that would push the onboarding budget over 120 s.

---

## 18. Assumptions challenged

| Assumption | Challenge | Decision |
|---|---|---|
| "Score is the hero." | A single score invites gaming and anxiety; people care about rooms, bills and comfort. | Hero is the house and one human insight; score is secondary, shown as a band. |
| "More questions, more accuracy." | Drop-off kills accuracy faster than defaults do. | Ask in value-of-information order; let people stop any time; show the range cost of stopping. |
| "Skeletons make waiting feel shorter." | Mixed evidence [S12]. | Progressive real content (ink stages) instead of placeholders. |
| "3D is the interface." | 3D excludes screen reader users and low-end phones. | 3D is a view; the scene outline and SVG drawing are complete equivalents. |
| "Tenants can't act." | Tenants can do shading, fans, behaviour, and ask. | "Yours" vs "Ask" split and generated letters. |
| "UK EPC rules are fixed." | EPC metrics are being reformed (Home Energy Model to replace SAP, new fabric and heating metrics) [S18]. | Never show "your EPC band will be X"; show "indicative" and keep regulation copy in the region pack. |
| "Cloud LLM by default." | Privacy and offline goals conflict. | Template narrator default; local and cloud opt-in. |

---

## 19. The constrained, extraordinary demo (90 seconds)

1. Landing chapter 1: Leeds and Hyderabad split screen (10 s).
2. "See a sample home": Margaret's terrace draws itself in ink stages (10 s).
3. Scrub the season ring to January; back bedroom glows blue; narrator margin note (10 s).
4. Tap loft, slide to 270 mm; numbers tick; per-fuel bars move (10 s).
5. Toggle heat pump: gas bar swings left, electricity swings right; delta sentence (10 s).
6. Futures: three ghost houses; front line on the scatter; pick Wise (15 s).
7. Tap "£340 a year" chip; evidence drawer opens; Lean seal: "Savings = before minus after. Proved." (10 s).
8. Switch home to Ravi's flat; May, 4 pm; roof heat; tenant mode shows "Ask landlord: cool roof" with a Telugu letter preview (15 s).

---

## 20. Open questions for other agents

* Building science: value-of-information ranking for onboarding questions; monthly resolution for the season ring; comfort metric for India (overheating hours).
* Optimisation: nearest-feasible suggestion API for infeasible scenarios; sub-second Pareto for 6 measures in a worker.
* Architecture: twin delta encoding small enough for a 2 KB share link; migration strategy.
* Regulation: verify MEES cap and dates against GOV.UK primary text; confirm Telangana cool roof scope for existing residential [S4]; Hyderabad climate zone under ENS 2024 [S19].
* Design: hand-drawn ink shader and SVG to WebGL projection match; thermal palette validation.
* AI: grounding checker for chips; memory schema and expiry.

---

## Sources

* [S1] Ibasho meaning: Nihongo Master dictionary, https://www.nihongomaster.com/japanese/dictionary/word/60569/ibasho-%E5%B1%85%E5%A0%B4%E6%89%80-%E3%81%84%E3%81%B0%E3%81%97%E3%82%87 ; University of Hawaiʻi event on Ibasho (Emi Kiyota), https://nursing.hawaii.edu/events/ibasho ; Oxford Academic chapter, https://academic.oup.com/book/32262/chapter/268452794
* [S2] AIA, "Dami Lee encouraged architects to harness the power of storytelling at AIA25", https://www.aia.org/article/dami-lee-encouraged-architects-harness-power-storytelling-aia25 ; Future Commerce, https://www.futurecommerce.com/posts/only-at-visions-summit-architect-dami-lee-on-the-stories-behind-our-spaces
* [S3] English Housing Survey 2023 to 2024, climate resilient homes fact sheet, https://www.gov.uk/government/statistics/english-housing-survey-2023-to-2024-climate-resilient-homes-fact-sheet/english-housing-survey-2023-to-2024-climate-resilient-homes-fact-sheet
* [S4] Telangana Cool Roof Policy: Deccan Herald, https://www.deccanherald.com/india/telangana-adopts-cool-roof-policy-to-reduce-heat-stress-in-buildings-1206440.html ; The South First, https://thesouthfirst.com/news/what-is-cool-roofing-and-why-telangana-government-has-launched-the-policy-a-first-in-india ; Plaksha, https://plaksha.edu.in/blog/summer-buffer-indias-first-cool-roof-policy-takes-off-in-t
* [S5] MEES EPC C by 2030: Elmhurst Energy, https://www.elmhurstenergy.co.uk/blog/2026/01/22/domestic-private-rented-properties-required-to-meet-epc-band-c-by-october-2030/ ; Jones Day, https://www.jonesday.com/de/insights/2026/03/epc-c-by-2030-what-real-estate-investors-need-to-know-about-the-uks-new-minimum-energy-efficiency-standards ; Simmons & Simmons, https://www.simmons-simmons.com/en/publications/cmkws6657001itp58cb0i2cse/the-warm-homes-plan-mees-for-privately-rented-homes-epc-c-by-2030
* [S6] WCAG 2.2 new criteria: Tetralogical, https://tetralogical.com/blog/2023/10/05/whats-new-wcag-2.2 ; Deque, https://dequeuniversity.com/resources/wcag-2.2
* [S7] postcodes.io API docs, https://api.postcodes.io/docs/overview
* [S8] Open-Meteo, https://open-meteo.com/
* [S9] EPC open data (MHCLG), https://epc.opendatacommunities.org ; MHCLG digital blog, https://mhclgdigital.blog.gov.uk/2024/01/29/changes-to-the-energy-performance-certificates-open-data-service
* [S10] Rewiring America Personal Electrification Planner launch, https://www.rewiringamerica.org/press-release/personal-electrification-planner-tool-launch ; walkthrough, https://themainemonitor.org/pathway-to-home-electrification/
* [S11] Energy Saving Trust home energy advice tools FAQ, https://energysavingtrust.org.uk/tool/home-energy-advice-tools-faqs?loc=wales ; Waltham Forest guide, https://www.walthamforest.gov.uk/housing/energy-efficiency/retrofit-advice/identifying-measures-your-home
* [S12] Loading indicator guidance and skeleton evidence (secondary, citing NN/g and Viget 2017): https://theplusaddons.com/blog/skeleton-loading-screen/ ; https://uxdesign.cc/loading-progress-indicators-ui-components-series-f4b1fc35339a
* [S13] MDN, Storage quotas and eviction criteria, https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria ; web.dev, Persistent storage, https://web.dev/articles/persistent-storage
* [S14] web.dev, Compression Streams supported on all browsers, https://web.dev/blog/compressionstreams
* [S15] Carbon Design System loading pattern, https://carbondesignsystem.com/patterns/loading-pattern
* [S16] @react-three/a11y docs, https://a11y.docs.pmnd.rs/introduction ; how it works, https://a11y.docs.pmnd.rs/advanced/how-it-works ; maintenance comment, https://redlib.ssps.io/r/threejs/comments/1ky4mqc/seo_on_react_three_fibre
* [S17] W3C Understanding SC 2.3.3 Animation from Interactions, https://w3c.github.io/wcag/understanding/animation-from-interactions
* [S18] Home Energy Model consultation, https://www.gov.uk/government/consultations/home-energy-model-replacement-for-the-standard-assessment-procedure-sap ; Homebuilding, https://www.homebuilding.co.uk/eco-homes/energy/new-home-energy-model-to-change-how-epcs-are-assessed
* [S19] BEE Eco Niwas Samhita 2024, https://www.beeindia.gov.in/sites/default/files/BEE_ENS_2024.pdf
* [S20] Boiler Upgrade Scheme and Warm Homes Plan (secondary): https://niceic.com/views/the-warm-homes-plan-what-it-means-for-homeowners/ ; https://www.boxt.co.uk/boilers/guides/warm-homes-plan
* [S21] Bret Victor, Explorable Explanations, https://worrydream.com/ExplorableExplanations/

Verification notes: regulatory figures [S4], [S5], [S20] come partly from secondary commentary and must be confirmed against primary government text by the regulation agent before they appear in product copy. Skeleton-screen evidence [S12] is secondary.
