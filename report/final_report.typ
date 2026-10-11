// Final report. Compile from the repo root:
//   typst compile --root . report/final_report.typ deliverables/final_report.pdf
// Main body: pages 1 to 3. Appendix (gallery and feature list) starts on page 4.
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
#set text(font: "Libertinus Serif", size: 10pt, lang: "en", region: "gb")
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

= 1 · The brief, and why we widened it

Lloyds asked for a Green Home Score for a home, a way to spot poor homes, feasible retrofits ranked in order, energy savings for electricity and gas separately, carbon, and an indicative property value range. One rule binds it all: every number comes from a documented model, and the AI only explains.

We kept that rule and widened the subject. A home's energy depends on more than the home. A flat on a top floor in Hyderabad cooks in May; the same flat beside a taller block does not. On the same floor plate, a lab uses about 1.6 times the energy of an office. A terrace in London and a block in Gachibowli need different physics, codes and tariffs. Sustainability starts at a desk and grows: desk, room, floor, building, community, area and city. A score for one house, cut off from its street, misses most of that.

= 2 · What we deliver, and why this focus

Ibasho is a local design and analysis studio. You pick a place, pick or draw a building, set it among its real neighbours, and see its sun and shade, daylight, energy by end use, bills, carbon, code standing and green rating path, then compare changes. It serves both sides of sustainability: *reactive*, for a building that exists and needs to improve (the brief's retrofit question), and *proactive*, for a building still on paper, where a change costs almost nothing. It covers eight building types (office, hotel, school, hospital, lab, apartments, rental and single family home) in a real city.

We chose this focus for four reasons. A homeowner, an architect, a campus estates team and a business all ask the same question at different scales. A real city with real neighbours makes context visible. Documented models make every number traceable. And it all runs on the user's own machine, with no account and no data leaving the device.

= 3 · Approach

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
      node((1, 0), t[Building drawing\ storeys, rooms, windows], name: <b>)
      node((2, 0), t[Seven stages\ geometry, sun, radiation,\ daylight, energy, codes, search], name: <s>)
      node((3, 0), t[Results with evidence\ ranges, sources, method], name: <r>)
      node((4, -0.55), t[Lean checker\ re-derives the sums], name: <l>, stroke: 0.6pt + proof)
      node((4, 0.55), t[Narrator and agent\ explain, never compute], name: <n>)
      edge(<p>, <b>, "-|>")
      edge(<b>, <s>, "-|>")
      edge(<s>, <r>, "-|>")
      edge(<r>, <l>, "-|>")
      edge(<r>, <n>, "-|>")
    },
  ),
)

A building is a document of storeys, rooms, walls, windows and shades in whole millimetres. A plan kernel turns it into exact areas, shared walls and facades by true orientation. Seven stages then run in order, each giving a rough result in under a second, then a refined and a final one, and each can be cancelled. Unknown facts, such as a neighbour's height or a wall's insulation, travel as ranges and are never filled with a guess. A change reruns only the stages it touches, and a package of measures is always recomputed whole, never summed.

Every number carries its source, method and a stamp. *Preview* means a plain model; *Modelled* means documented physics, not yet measured. A checker written and proved in Lean 4 re-derives the bookkeeping of each result: savings, carbon, bills, the score, the ranking and the rule that a measure the owner ruled out never returns. The narrator and the AI agent link receive numbers only as evidence. A sentence that writes a number of its own is rejected.

= 4 · How we meet the brief

#rows(columns: (1.15fr, 3.2fr, auto),
  [Brief asks for], [Where Ibasho does it], [State],
  [Green Home Score with fixed weights and bands],
  [A 0 to 100 score from seven indicators with fixed weights, computed in exact fractions. Lean proves the weights sum to one, the score stays in 0 to 100, and a home at least as good on every measure never scores lower. Every component's contribution is shown in four groups. *But our indicators and weights differ from the brief*: fabric 20, carbon 20, energy intensity 15, running cost 15, heating 10, renewables and smart controls 10, comfort 10. The brief fixes energy rating 25, consumption intensity 20, insulation 15, heating 15, glazing 10, renewables 10, smart controls 5, with five bands. The fix is a second score plugin with the brief's weights and bands; the same Lean proofs rerun on the new constants. We have not built it.],
  differs,
  [Identify poor homes and improvement potential],
  [Energy is judged per square metre against published bands (BEE, CBECS, CIBSE TM46, Eco Niwas Samhita), so a large building is not called poor for its size. Each result lists what is weak and what gets worse if nothing is done. We do not yet rank a portfolio by percentage improvement potential.],
  part,
  [Feasible, prioritised retrofits],
  [Rules decide feasibility in three valued logic: a measure blocked only by an unknown fact becomes "possible after a check", never "yes". Out of every package, the best form a front on cost, return and carbon, each other package names one that beats it, and three picks follow stated tie breaks. Every measure ruled out has a plain reason.],
  met,
  [Savings per fuel, with interactions],
  [kWh per fuel and per month against one baseline; a rise shows as a negative saving. Packages are recomputed whole: in the London terrace, draught proofing and loft insulation together are worth more than the two apart.],
  met,
  [Carbon from documented factors],
  [Per fuel and per month: SAP 10.2 factors in the UK, the Central Electricity Authority average in India (marked as an estimate).],
  met,
  [Property value as a range],
  [A low, central and high uplift per rating step from the Nationwide 2026 house price study sits in the engine and the checked result. It is not yet shown on screen, and it would be labelled indicative.],
  part,
  [The AI only explains; what-ifs rerun the models],
  [A what-if is a typed change to the building; the engine reruns, then the narrator explains. A local model (Ollama) may polish wording, but eight grounding rules reject any sentence that writes a number, flips a sign or recommends a ruled out measure.],
  met,
)

We did not train regression models. The brief suggests them, but there is no property level energy and sales data for the Hyderabad buildings we model, and a model trained on synthetic labels would only learn our own assumptions. We used documented physics and checked it against published benchmarks and analytic cases instead. A held out evaluation in the brief's sense is therefore not part of this submission.

= 5 · Features

- *City:* the IIIT Hyderabad campus and two kilometres of Gachibowli as 1,036 mapped buildings and 68 trees, plus a London street. Estimated heights cast a solid shadow and a hatched band; typing a real height closes it.
- *Buildings:* a plan editor with rooms, windows by share of wall, chajja, fins and jaali, stacked storeys and undo. Eight building types with their own schedules.
- *Analysis:* sun hours, radiation, a shading ledger of who takes whose sun, daylight per room, energy by end use, bills to the paisa on Telangana tariffs or at the UK price cap, carbon, and code and rating pre-checks on one ladder.
- *Flows:* start a new place, come back to what changed, start over or branch, compare up to three what-ifs, edit and watch only touched stages rerun, and design a new building on a real plot.
- *Trust:* every number opens to its evidence; Preview is stamped; codes say "pre-check, not a certificate"; Lean checks the sums. Everything works on phone, tablet and desktop, by day and by night.

= 6 · Results

Eight sample buildings are modelled. Vindhya Bhavan at IIIT Hyderabad is rebuilt from the campus floor plans as 93 named rooms over a cellar and three floors. Beside it are Himalaya, a HITEC City office, a Gachibowli apartment block and the London terrace. The towers that house the Lloyds Technology Centre, Qualcomm and Vanguard are drawn from mapped outlines and public facts, with floors marked as estimates.

*Real and Preview.* Geometry is exact. Real sun, radiation, daylight, hourly energy and code stages are built and tested as separate parts. The studio still serves all seven stages from the Preview model, and the real search is not built. Swapping each stage is one line, and is the next step.

#grid(columns: (1fr, 1fr), gutter: 10pt,
  rows(columns: (2.2fr, 1fr, 1.4fr),
    [Building (real energy)], [EUI kWh/m²·yr], [Benchmark band],
    [Vindhya Bhavan, labs], [182 to 231], [CBECS lab 150 to 400],
    [Himalaya, teaching], [110 to 140], [CBECS education 95 to 240],
    [HITEC City office], [130 to 166], [BEE office 110 to 230],
    [Gachibowli flats], [35 to 45], [Eco Niwas 25 to 80],
    [London terrace], [125 to 159], [CIBSE TM46 dwelling],
  ),
  rows(columns: (2.3fr, 1.6fr),
    [Accuracy check (site)], [Result],
    [Sun position against the NREL test case], [within 0.00001°],
    [Open roof against weather file], [Hyderabad −0.7%, London −0.1%],
    [Street canyon sky view against theory], [within 0.03],
    [Ray tracer against brute force], [same on 2,000 rays],
    [Shading ledger], [closes exactly],
  ),
)

Every sample building lands inside its benchmark band. Each building's energy runs in 0.2 s or less and the first site result in under 0.6 s. On the code check, Vindhya's energy is 0.82 to 1.04 times its reference design, so Ibasho reports "unknown" rather than pass or fail; envelope lines stay unknown until U-values are entered. Daylight has not yet been compared with Radiance, so sDA is labelled simplified.

*Checks.* The Lean specification has 83 named theorems and 1,752 declarations, audited on every build for any gap or extra axiom; none exists. The checker caught all 34 errors we planted in results, and a second checker in TypeScript agrees with it on 52 cases. The narrator planted 0 numbers from 60 hostile notes, and 500 replayed sessions never offered a measure the owner had ruled out. The code base has about 970 automated tests in 115 files.

#block(fill: tint, inset: 6pt, radius: 3pt, width: 100%)[
  #set text(8.8pt)
  *Limits.* Lean proves the bookkeeping, not the physics. Daylight and energy are modelled, not measured. Code results are pre-checks, never compliance. The score uses our weights, not the brief's, until the second score plugin is built.
]

#pagebreak()

// ───────────────────────── Appendix ─────────────────────────
#text(font: "Inter", 8pt, fill: muted, weight: "medium", tracking: 0.3pt)[APPENDIX]
= A · Screenshot gallery

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
  shot("places.jpg")[Your places: what changed since the last visit, old and new side by side.],
  shot("new-find.jpg")[New place: find a building by name, here the Qualcomm office.],
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
#grid(columns: (1fr, 1fr, 1fr), gutter: 8pt,
  shot("phone.jpg")[Studio on a phone.],
  shot("landing-phone.jpg")[Landing page on a phone.],
  shot("tablet.jpg")[Studio on a tablet.],
)
#pair(
  shot("poster-sun.jpg")[Still: the sun sweeps the campus.],
  shot("poster-lanterns.jpg")[Still: the city of lanterns. Only modelled buildings glow.],
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

= B · Full feature list

#set text(9.4pt)
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
