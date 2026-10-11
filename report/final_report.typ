// Final report. Compile from the repo root:
//   typst compile --root . report/final_report.typ deliverables/final_report.pdf
// Main body: pages 1 to 3, references end on page 3, then the appendix (gallery and feature list).
#import "@preview/fletcher:0.5.8" as fletcher: diagram, node, edge

#let accent = rgb("#1f6f5c")
#let muted = rgb("#5b6770")
#let tint = rgb("#eef5f2")
#let proof = rgb("#8a5a00")
#let rule-c = rgb("#d5dedb")

#set document(title: "Team #124 · Ibasho · Final report", author: "Team #124")
#set page(
  paper: "a4",
  margin: (x: 1.8cm, top: 1.85cm, bottom: 1.5cm),
  header: context {
    set text(7.5pt, fill: muted, font: "Inter")
    grid(columns: (1fr, auto), align: (left + horizon, right + horizon),
      [Ibasho · Final report · Megathon X · Lloyds problem statement 2],
      box(fill: accent, inset: (x: 6pt, y: 3pt), radius: 2pt,
        text(font: "Inter", 8pt, weight: "bold", fill: white)[Team \#124]),
    )
    v(-4pt)
    line(length: 100%, stroke: 0.5pt + rule-c)
  },
  footer: context [
    #set text(7.5pt, fill: muted, font: "Inter")
    Team \#124 · Ibasho
    #h(1fr)
    #counter(page).display("1 / 1", both: true)
  ],
)
#set text(font: "Libertinus Serif", size: 10.4pt, lang: "en", region: "gb")
#set par(leading: 0.55em, spacing: 0.75em, justify: true)
#set list(indent: 0.3em, body-indent: 0.45em, spacing: 0.5em, marker: text(fill: accent)[▸])
#set enum(indent: 0.3em, body-indent: 0.45em, spacing: 0.5em)
#show heading.where(level: 1): it => {
  set text(font: "Inter", size: 10.5pt, weight: "bold", fill: accent)
  v(0.45em)
  block(below: 0.45em, it.body)
}
#show heading.where(level: 2): it => {
  set text(font: "Inter", size: 9pt, weight: "semibold")
  block(above: 0.6em, below: 0.35em, it.body)
}
#show table.cell.where(y: 0): set text(font: "Inter", weight: "semibold", size: 7.5pt)
#show table: set par(justify: false)
#show table: set text(size: 8.6pt)
#set table(stroke: none, inset: (x: 4.5pt, y: 3.4pt))
#let rows(..args) = table(
  ..args,
  fill: (_, y) => if y == 0 { tint },
  stroke: (_, y) => if y > 0 { (top: 0.4pt + rule-c) },
)
#let met = text(fill: accent, weight: "bold", font: "Inter", size: 7.5pt)[Met]
#let part = text(fill: proof, weight: "bold", font: "Inter", size: 7.5pt)[Partly]
#let differs = text(fill: proof, weight: "bold", font: "Inter", size: 7.5pt)[Differs]
#let notyet = text(fill: muted, weight: "bold", font: "Inter", size: 7.5pt)[Not yet]

// ───────────────────────── Title ─────────────────────────
#grid(columns: (1fr, auto), align: (left + bottom, right + bottom),
  [
    #set text(font: "Inter")
    #text(19pt, weight: "bold")[Ibasho]
    #h(3pt) #text(12pt, fill: muted, font: "Noto Sans CJK JP")[居場所の向上] \
    #text(10.5pt, fill: muted)[See how a building will live in its city. Final report.]
  ],
)
#v(2pt)
#line(length: 100%, stroke: 1pt + accent)
#v(2pt)

= The brief, and why we widened it

Lloyds asked for a Green Home Score for a home, a way to spot poor homes, feasible retrofits ranked in order, energy savings for electricity and gas separately, carbon, and an indicative property value range. One rule binds it all: every number comes from a documented model, and the AI only explains.

We kept that rule and widened the subject. A home's energy depends on more than the home. A flat on a top floor in Hyderabad cooks in May; the same flat beside a taller block does not. On the same floor plate, a lab uses about 1.6 times the energy of an office. A terrace in London and a block in Gachibowli need different physics, codes and tariffs. Sustainability starts at a desk and grows: desk, room, floor, building, community, area and city. A score for one house, cut off from its street, misses most of that.

= What we deliver, and why this focus

Ibasho is a local design and analysis studio. You pick a place, pick or draw a building, set it among its real neighbours, and see its sun and shade, daylight, energy by end use, bills, carbon, code standing and green rating path, then compare changes. It serves both sides of sustainability: *reactive*, for a building that exists and needs to improve (the brief's retrofit question), and *proactive*, for a building still on paper, where a change costs almost nothing. It covers eight building types (office, hotel, school, hospital, lab, apartments, rental and single family home) in Hyderabad and London.

We chose this focus for four reasons. A homeowner, an architect, a campus estates team and a business all ask the same question at different scales. A real city with real neighbours makes context visible. Documented models make every number traceable, and an independent checker re-derives the sums. And it all runs on the user's own machine, with no account and no data leaving the device.

Inside this frame, the brief is one case: a single UK home, judged on its own. We answer it in full with a calculation package that uses the brief's exact score weights, savings per fuel, carbon and value range, and test it on a 500 home synthetic portfolio with a held out split.

#block(fill: tint, inset: 6pt, radius: 3pt, width: 100%)[
  #set text(9.4pt)
  *Headline results.* On 85 held out homes, the package ranks improvement potential with a rank correlation of 0.77, against 0.25 for a simple baseline, and picks feasible retrofits with an F1 score of 0.995, against 0.71. Home P10001, the brief's example, scores 38, Poor, as in the brief. These figures measure agreement with our own simulator, not accuracy on real homes.
]

#grid(columns: (1fr, 1fr), gutter: 8pt,
  figure(box(stroke: 0.4pt + rule-c, image("final/img/poster-sun.jpg", width: 100%)), caption: text(7.5pt)[The sun across the IIIT Hyderabad campus on 21 March.], supplement: none, numbering: none, gap: 3pt),
  figure(box(stroke: 0.4pt + rule-c, image("final/img/poster-lanterns.jpg", width: 100%)), caption: text(7.5pt)[At night, modelled buildings glow by their energy use.], supplement: none, numbering: none, gap: 3pt),
)

= How it works

#figure(
  diagram(
    spacing: (7mm, 5mm),
    node-stroke: 0.6pt + accent,
    node-fill: tint,
    node-corner-radius: 3pt,
    node-inset: 4pt,
    edge-stroke: 0.6pt + muted,
    {
      let t(x) = text(font: "Inter", size: 7pt, x)
      node((0, 0), t[Place and city\ OpenStreetMap, weather], name: <p>)
      node((1, 0), t[Building\ storeys, rooms, windows], name: <b>)
      node((2, 0), t[Seven calculation steps\ geometry, sun, radiation,\ daylight, energy, codes, search], name: <s>)
      node((3, 0), t[Results with evidence\ ranges, sources, method], name: <r>)
      node((4, -0.55), t[Proof checker\ re-derives the sums], name: <l>, stroke: 0.6pt + proof)
      node((4, 0.55), t[Narrator and agent\ explain, never compute], name: <n>)
      edge(<p>, <b>, "-|>")
      edge(<b>, <s>, "-|>")
      edge(<s>, <r>, "-|>")
      edge(<r>, <l>, "-|>")
      edge(<r>, <n>, "-|>")
    },
  ),
)

A building is stored as storeys, rooms, walls, windows and shades in whole millimetres. Seven calculation steps run in order. Each gives a rough answer in under a second, then a refined and a final one. Facts we do not know, such as a neighbour's height or a wall's insulation, are carried as ranges and never guessed. A package of measures is always recomputed as a whole, never summed.

The physics is standard and published. Sun position uses the NREL Solar Position Algorithm @reda2004. Sky brightness uses the Perez all weather models @perez1990 @perez1993 over the Tregenza sky patches @tregenza1987, with hourly weather from Climate.OneBuilding @tmyx for Hyderabad and PVGIS @pvgis for London. Daylight uses the IES metrics @lm83. Building energy uses the ISO 13790 hourly model @iso13790. UK homes use the SAP 10.2 heat balance @sap102 with RdSAP 10 wall and roof values @rdsap10. City buildings come from OpenStreetMap @osm.

Every number carries its source and a label: *Preview* means a plain model; *Modelled* means documented physics, not yet measured. For each building result, a checker written in the Lean 4 proof assistant @lean4 re-derives the savings, carbon, bills, score and ranking. The narrator and the AI agent receive numbers only as evidence, and any sentence that writes its own number is rejected.

= Meeting the brief, as one case

For a single UK home, the calculation package answers every question in the brief, on the UK home model above. The Homes screens in the studio still run a simpler local model over 40 homes; moving them onto the package is the next step.

#rows(columns: (1.05fr, 3.6fr, auto),
  [Brief asks for], [What the package does], [State],
  [Green Home Score], [The brief's seven weights (25, 20, 15, 15, 10, 10, 5) and five bands, each component's share shown. A better state never scores lower.], met,
  [Poor homes, potential], [Poor and Very poor homes flagged with key issues; homes ranked by improvement potential. No meter data reads "unavailable", never zero.], met,
  [Feasible retrofits], [Only retrofits that suit the home, in interaction order, each with High, Medium or Low suitability and a reason.], met,
  [Savings, carbon], [Electricity and gas apart, in kWh a year, from one whole house run; a rise shows as negative. Carbon from DESNZ 2024 factors @desnz2024.], met,
  [Value range], [Published price gaps between EPC bands @decc2013 @nationwide2026 on the current value. Labelled indicative, not causal.], met,
  [AI explains], [A what-if reruns the whole assessment; the narrator only reads the results.], met,
  [Data, evaluation], [500 synthetic homes, 24 months of meter data with gaps, split by customer (343, 72, 85), tested against simple baselines below.], met,
)

#v(2pt)
#rows(columns: (2.1fr, 0.8fr, 0.8fr, 2.2fr),
  [Test split, 85 homes], [Package], [Baseline], [Baseline used],
  [Improvement potential, rank correlation @spearman1904], [0.77], [0.25], [Average train label per EPC band],
  [Top 20% of homes found], [0.65], [0.41], [Same],
  [Electricity package saving, mean error], [1,111 kWh], [4,632 kWh], [Median train saving share × meter use],
  [Gas package saving, mean error], [173 kWh], [188 kWh], [Same],
  [Feasible retrofits, F1], [0.995], [0.71], [All five headline retrofits for every home],
  [Value range contains the label], [87%], [18%], [Fixed 2 to 5% (brief example)],
)

Labels come from a simulator that knows each home's hidden true state, such as its real wall insulation. The package sees only the recorded fields and meter readings available at prediction time. The validation split gives similar results (rank correlation 0.83). Portfolio median use (gas 12,300 kWh, electricity 3,000 kWh a year) sits a little above the national medians in NEED @need2025 (10,100 and 2,600), as expected for a set weighted to older homes. Our value ranges are wider than the baseline (4.5 against 3 percentage points), which explains part of their higher coverage.

We did not use the suggested machine learning methods. The core rule asks for documented models, and physics plus written rules give numbers that can be traced and checked. A model trained on synthetic labels would mostly learn back our own generator. The suggested public datasets do not join at property level, so the portfolio is synthetic and its generation rules are documented.

= Results for buildings

Eight sample buildings are modelled, including Vindhya Bhavan at IIIT Hyderabad (93 named rooms from the campus floor plans), a HITEC City office, a Gachibowli apartment block and a London terrace. Every one lands inside its published benchmark range. Energy for one building runs in 0.2 s or less.

#grid(columns: (1.2fr, 0.8fr), gutter: 10pt,
  rows(columns: (1.5fr, 0.9fr, 1.6fr),
    [Building], [kWh per m² a year], [Benchmark range],
    [Vindhya Bhavan, labs], [182 to 231], [CBECS lab 150 to 400],
    [Himalaya, teaching], [110 to 140], [CBECS education 95 to 240],
    [HITEC City office], [130 to 166], [BEE office 110 to 230],
    [Gachibowli flats], [35 to 45], [Eco Niwas 25 to 80],
    [London terrace], [125 to 159], [CIBSE TM46 dwelling],
  ),
  rows(columns: (2.3fr, 1.6fr),
    [Site accuracy check], [Result],
    [Sun position against the NREL test case], [within 0.00001°],
    [Open roof against the weather file], [Hyderabad −0.7%, London −0.1%],
    [Street canyon sky view against theory], [within 0.03],
    [Ray tracer against brute force], [same on 2,000 rays],
    [Who shades whom, in kWh], [balances exactly],
  ),
)

*Built but not yet in the app.* The real site and daylight engine passes 34 tests, summarised above. The real hourly energy and code steps are tested too. The studio still shows the plain Preview model for all seven steps, and the real design search is not built. Daylight has not yet been compared with Radiance, so the share of floor with enough daylight (sDA) is labelled simplified.

*Checks.* The Lean specification has 83 named theorems and is audited on every build for gaps or added assumptions; none exists. The checker caught all 34 errors we planted in results, and a second checker in TypeScript agrees with it on 52 cases. Given 60 hostile notes, the narrator wrote no number of its own, and 500 replayed sessions never offered a measure the owner had ruled out. The code base has about 980 automated tests; the calculation package adds 8 more.

= Responsible use and next steps

*Privacy:* everything runs on the user's machine and results stay there. *Explainability:* every number opens to its inputs, method and source, and every unknown is a range. *No invented numbers:* the narrator and the agent cannot write their own, and hidden instructions in notes are caught. *Human oversight:* Ibasho proposes and the person decides; a measure they rule out never returns, and "forget" deletes for real.

Next, we will move the Homes screens onto the package, swap the real site, energy and code steps into the studio and build the real design search, bring the Homes figures under the Lean checker, compare daylight with Radiance, and test the package on real EPC records and meter data.

#block(fill: tint, inset: 6pt, radius: 3pt, width: 100%)[
  #set text(9pt)
  *Limits.* The evaluation shows agreement with our own simulator, not accuracy on real homes. Lean proves the bookkeeping, not the physics. Daylight and energy are modelled, not measured. Code results are pre-checks, not certificates. Savings and value are estimates, not guarantees.
]

#v(2pt)
#[
  #set text(7pt)
  #set par(justify: false, leading: 0.4em, spacing: 0.4em)
  #show heading.where(level: 1): it => {
    set text(font: "Inter", size: 9pt, weight: "bold", fill: accent)
    block(above: 0.5em, below: 0.4em, it.body)
  }
  = References
  // Fixed height balances the two columns (the list is about 360pt tall in one column).
  #block(height: 200pt, columns(2, gutter: 12pt)[
    #bibliography("refs.yml", title: none, style: "ieee")
  ])
]

#pagebreak()

// ───────────────────────── Appendix ─────────────────────────
#text(font: "Inter", 8pt, fill: muted, weight: "medium", tracking: 0.3pt)[APPENDIX]
= Screenshot gallery

All shots are from the current build. Figures marked Preview in the product are from the plain model.

#let shot(path, cap) = figure(
  box(stroke: 0.4pt + rule-c, image("final/img/" + path, width: 100%)),
  caption: text(8pt, cap),
  supplement: none,
  numbering: none,
  gap: 3pt,
)
#let pair(a, b) = grid(columns: (1fr, 1fr), gutter: 8pt, a, b)

#pair(
  shot("landing-day.jpg")[Landing page by day.],
  shot("landing-night.jpg")[Landing page by night: only the modelled building glows.],
)
#pair(
  shot("homes-portfolio-1280.jpg")[Homes: ranked by improvement potential, electricity and gas shown apart, poor homes flagged.],
  shot("homes-home-P10001-1280.jpg")[Home P10001: score 38, Poor, why this score, and retrofits in order.],
)
#pair(
  shot("places.jpg")[Your places: what changed since the last visit, old and new side by side.],
  shot("new-find.jpg")[New place: find a building by name, here the Lloyds office in Hyderabad.],
)
#pair(
  shot("new-type.jpg")[Pick one of eight building types, each with its own daily schedule.],
  shot("new-place.jpg")[Place it among its mapped neighbours.],
)
#pair(
  shot("look-day.jpg")[Radiation on Vindhya Bhavan by day, with legend, method and range.],
  shot("look-night.jpg")[The same view by night.],
)
#pair(
  shot("daylight.jpg")[A floor slides out to show daylight room by room.],
  shot("editor.jpg")[The plan editor beside the 3D view.],
)
#pair(
  shot("compare.jpg")[Compare the building as it is with a what-if; results arrive in stages.],
  shot("prove.jpg")[Codes and ratings on one savings ladder, each a pre-check.],
)
#pair(
  shot("tell.jpg")[Tell: the result in plain words, and what Ibasho will remember.],
  shot("settings.jpg")[Rates and assumptions, each with its source and what it changes.],
)
#pair(
  shot("design-place.jpg")[Design before you build: place a new building on a real plot.],
  shot("design-compare.jpg")[Two or three plots or orientations side by side.],
)
#pair(
  shot("search.jpg")[Find any floor or room by name, such as "Vindhya floor 2".],
  shot("city-sunhours.jpg")[Sun hours on the site, on a tablet.],
)
#pair(
  shot("city-day.jpg")[The campus at 10:30 on 21 March.],
  shot("city-night.jpg")[The same building at night as a lantern, brighter for higher energy use.],
)
#pair(
  shot("city-floor.jpg")[Floor view: rooms labelled by function.],
  shot("landing-codes-night.jpg")[Landing page, codes and ratings section, by night.],
)
#grid(columns: (1fr, 1fr, 1fr), gutter: 8pt,
  shot("phone.jpg")[Studio on a phone.],
  shot("landing-phone.jpg")[Landing page on a phone.],
  shot("tablet.jpg")[Studio on a tablet.],
)
#pair(
  shot("poster-daylight.jpg")[Still: daylight on a floor.],
  shot("poster-radiation.jpg")[Still: radiation and the radiation rose over the roof.],
)
#pair(
  shot("poster-design-night.jpg")[Still: the traced plan of Vindhya Bhavan by night.],
  shot("poster-compare-night.jpg")[Still: three variants side by side.],
)
#shot("poster-hero.jpg")[Still: Gachibowli at night, with Vindhya Bhavan lit.]

= Full feature list

#set text(9.4pt)
#set par(justify: false)
#let area(t, body) = block(breakable: true, below: 0.6em)[
  #text(font: "Inter", weight: "semibold", size: 8.6pt, fill: accent)[#t]
  #v(-0.3em)
  #body
]

#columns(2, gutter: 14pt)[
#area[Place and city][
- Hyderabad: the IIIT campus and two kilometres of Gachibowli, 1,036 mapped buildings and 68 trees in 72 KB, rebuilt byte for byte from OpenStreetMap.
- London: a street around the 1905 terrace, and open plots at King's Cross.
- Every height has a source and a range; most are unknown and drawn as ranges.
- A penumbra of estimated heights; typing a real height closes it.
- Find a campus, building, block, floor or room by name, nickname or a near miss.
- Zoom from city to site, building, floor and room.
]
#area[Buildings and editor][
- A building document in whole millimetres: storeys, rooms, walls, windows, shades.
- Draw rooms as rectangles or polygons; split, merge, paint functions.
- Windows by share of wall; shading presets: chajja, deep overhang, fins, jaali.
- Stack and repeat storeys; trace over an image of a plan.
- Snapping, sizes in metres or feet and inches, live window and shading meters.
- Overlaps and untyped rooms drawn on the plan; keyboard and touch; undo and redo.
- Exact areas, shared walls, facades by true orientation, automatic zoning.
- Eight building types with crests and daily schedules.
- Eight sample buildings with their sources and unknowns listed.
]
#area[Sun, shade and daylight][
- Sun position from the NREL Solar Position Algorithm.
- Sun hours, shadow hours and sky view on every surface.
- Monthly radiation from an all weather sky, with and without neighbours.
- A shading ledger that closes exactly: who takes whose sun, in kWh.
- Daylight per room: sDA (simplified), ASE and useful daylight share; views.
- Sweep a day and a year; 21 March and 21 May presets.
- Whose winter sun you take when you add floors.
]
#area[Energy, bills and carbon][
- Every room simulated hour by hour through a typical year.
- Cooling, heating, lighting, equipment, fans, pumps, hot water and solar.
- Energy per square metre as a range against a published benchmark.
- Fan first comfort for Indian homes, using the Indian adaptive comfort model.
- Bills on Telangana tariffs (slabs, demand charge, time of day, the 200 unit cliff) or the UK price cap.
- Carbon per fuel and month.
]
#area[Codes and ratings][
- India: ECSBC 2024 and ECBC 2017, Eco Niwas Samhita, NBC openings, Telangana scope.
- England: Part L 2021, Future Homes Standard, overheating, London Plan.
- Everywhere: ASHRAE 90.1 Appendix G baseline.
- One savings ladder for GHMC stars, LEED, IGBC, GRIHA, EDGE and BEE stars.
- Each line is met, not met or unknown, with its clause and source.
]
#area[Comparing and choosing][
- The building as it is beside up to three what-ifs; each lever recomputes the whole variant.
- Search over design levers: a front of best options, a named better option for each one left out, and three picks.
- Goals such as net zero ready, LEED Gold, ECSBC Super or lowest running cost.
- Design before you build: brief, massing, plot, orientation, overlaps, side by side plots, save.
]
#area[Homes (the brief's questions)][
- Studio screens: 40 homes, P10001 to P10040, on a simpler local model, ranked by improvement potential.
- Calculation package: 500 synthetic homes, split by customer, with a held out evaluation.
- Electricity and gas apart; "unavailable" when meter readings are missing.
- Poor and Very poor homes flagged with key issues.
- Green Home Score with the brief's seven weights and five bands, and a "why this score" table.
- Retrofits in order with High, Medium or Low suitability, a reason and per fuel savings; a rise shows as negative.
- Package total, carbon from UK Government 2024 factors, and an indicative value range.
- A what-if reruns every figure; the narrator only explains.
]
#area[Home retrofit (London terrace)][
- Three futures: least upfront, best return, lowest running carbon.
- Sixteen measures with plain guidance: days of work, rooms, who to call, what to ask.
- Planning and Building Regulations rules in plain sentences, each with source and test.
- Heat pump noise decided exactly; unknown blocks become "possible after a check".
- What gets worse beside what gets better, and an "if nothing is done" line.
- Paybacks, net present value, grants and a 0% loan check.
- Green Home Score in four groups and an estimated EPC band with its spread.
]
#area[Trust and proof][
- Every number opens its evidence: inputs, method, source.
- Preview stamps, "Modelled, not measured", and "pre-check, not a certificate".
- Lean 4 specification: 83 named theorems, no gaps or extra axioms.
- A checker proved sound in Lean, plus a TypeScript mirror that agrees with it.
- Settings show where a value came from and how many numbers it changes.
]
#area[AI, memory and agents][
- A narrator that tells the story from templates; numbers only as evidence.
- Optional local model through Ollama, with eight grounding rules.
- Notes from previous owners quarantined; hostile instructions caught.
- Memory of what you said; a ruled out measure never returns; forgetting is real.
- Agent link for Claude Code: 19 tools, local only, with a pairing code.
]
#area[Experience][
- Day (ink on paper) and night (lantern) themes.
- Phone, tablet and desktop layouts.
- A staged progress bar with rough, refined and final results, time left and cancel.
- A plain drawing when 3D is not available; a text outline for screen readers.
- Local first: no account; results stay on your device.
- A landing page whose sections appear only when the feature exists.
]
]
