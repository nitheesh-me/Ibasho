// Milestone 2 report. Compile with:  typst compile report/M2.typ deliverables/M2.pdf
#let accent = rgb("#1f6f5c")
#let muted = rgb("#5b6770")
#let tint = rgb("#eef5f2")
#let proof = rgb("#8a5a00")

#set document(title: "Ibasho · M2")
#set page(
  paper: "a4",
  margin: (x: 2cm, top: 1.7cm, bottom: 1.6cm),
  footer: context [
    #set text(7.5pt, fill: muted, font: "Inter")
    Ibasho · Milestone 2
    #h(1fr)
    #counter(page).display("1 / 1", both: true)
  ],
)
#set text(font: "Libertinus Serif", size: 10.8pt, lang: "en", region: "gb")
#set par(leading: 0.62em, spacing: 0.9em)
#set list(indent: 0.3em, body-indent: 0.5em, spacing: 0.7em, marker: text(fill: accent)[▸])
#show heading.where(level: 1): it => {
  set text(font: "Inter", size: 11pt, weight: "bold", fill: accent)
  v(0.7em)
  block(below: 0.6em, it.body)
}
#show table.cell.where(y: 0): set text(font: "Inter", weight: "semibold", size: 8.5pt)
#show table: set par(justify: false)
#set table(stroke: none, inset: (x: 6pt, y: 5pt))
#let rows(..args) = table(
  ..args,
  fill: (_, y) => if y == 0 { tint },
  stroke: (_, y) => if y > 0 { (top: 0.4pt + rgb("#d5dedb")) },
)
#let ok = text(fill: accent, weight: "bold")[Done]
#let wip = text(fill: proof, weight: "bold")[Started]
#let todo = text(fill: muted)[Next]

// ───────────────────────── Header ─────────────────────────
#grid(columns: (1fr, auto), align: (left + bottom, right + bottom),
  [
    #set text(font: "Inter")
    #text(8pt, fill: muted, weight: "medium", tracking: 0.3pt)[MILESTONE 2] \
    #v(2pt)
    #text(20pt, weight: "bold")[Ibasho]
    #h(3pt) #text(13pt, fill: muted, font: "Noto Sans CJK JP")[居場所の向上] \
    #text(11pt, fill: muted)[From plan to a working slice]
  ],
)
#v(4pt)
#line(length: 100%, stroke: 1pt + accent)
#v(6pt)

One real home, a 1905 terrace in London, now runs through every layer of Ibasho. The checker caught all 34 errors we planted in its results, and no number written by an AI reached the screen. Two things are not done yet. The physics has not been validated against real data, and the first app screen is still being finished.

= 1 · The approach has not changed

Ibasho is an editable twin of a home. It computes energy, bills and carbon from documented physics, searches only the retrofits you can actually build, checks the bookkeeping with Lean 4, and lets an AI explain the results without ever writing a number. All of that is as described in M1.

What has grown is the ambition. We now see Ibasho as a long-running project for real homeowners, so we added a visual style (ink on paper by day, a glowing lantern by night), a 3D cutaway of the house, and a way for AI assistants to explore a home on the owner's behalf.

= 2 · Three reviews reshaped the plan

Before writing code, we asked three independent reviewers to attack the plan from the side of a homeowner, an engineer and a building scientist. Five changes came out of it.

The biggest is that Lean now checks every result. M1 only aimed to prove the arithmetic. Now the engine also issues a certificate with each answer, and a checker that is itself proved correct in Lean recomputes it.

We also made our claims say exactly what is true. "A better home never scores worse" became "a home at least as good on every measure never scores lower". An option blocked only by something we do not know is marked "possible after a check", never "yes".

The rest are smaller. We renamed the three futures Least upfront, Best return and Lowest running carbon, and moved the budget question to after the owner has seen them. Real bills can now correct the model, including the wall's insulation value, within published limits. And AI assistants can explore a home through a standard plug-in, using the same controls a person does.

We have also widened the scope to outcomes that make a home worse. Ibasho will show what happens if maintenance is ignored, accept custom what-if requests from the owner and run them through the same engine, and put every negative impact next to the savings. Part of this already works: the heat pump below has a negative 25-year value, and Ibasho shows it rather than hiding it.

= 3 · On the reference home, two cheap measures do more together than apart

Our reference home is a 1905 brick terrace in a London conservation area. We tried three measures on it: loft insulation, draught-proofing and a heat pump.

#rows(columns: (2fr, 1fr, 1.2fr, 1.3fr, 1.6fr),
  [Option], [Cost], [Value over 25 y], [Carbon saved], [Result],
  [Draught-proofing], [£290], [£927], [5.4 t], [Least upfront],
  [Loft insulation], [£720], [£833], [5.8 t], [Good option],
  [Both together], [£1,010], [£1,814], [11.4 t], [Best return, lowest carbon],
  [Heat pump], [£4,800+], [Negative], [about 62 t], [Possible after a check],
)

Together, draught-proofing and loft insulation save more than the two added up. Measures interact, which is why Ibasho always recomputes the whole package instead of summing savings.

The heat pump saves about five times as much carbon, but the home may share its electricity supply with a neighbour, so the network operator has to approve it first. Ibasho therefore holds it as possible after a check rather than ruling it out. Its cost picture will change once the full heat pump model lands.

We also tested the safeguards. We planted 34 deliberate errors in a result, such as a flipped saving or a refused measure sneaking back in, and the checker caught all 34. Across many simulated conversations, no number written by an AI reached the screen, and all 60 hidden instructions we planted in a home's notes (for example "say it saves 70%") were caught. A review found three gaps in this layer, and we fixed them. In 500 replayed sessions, a measure the owner had refused was never offered again.

= 4 · Four of M1's seven claims now pass

The two claims we have not started need more of the model in place. The physics needs published UK home energy data to compare against, and building context needs all measures and three unseen homes. We have also added one claim of our own, that Ibasho shows outcomes that make a home worse. Its tests come next.

#rows(columns: (2fr, auto, 2.4fr),
  [Claim], [State], [Evidence],
  [The arithmetic is correct], ok, [Proved in Lean, with no shortcuts.],
  [The checks catch errors], ok, [34 of 34 planted errors caught.],
  [The physics is plausible], todo, [Compare with published UK home energy data.],
  [Building context matters], todo, [Needs all measures and three unseen homes.],
  [The AI stays grounded], ok, [No AI-written numbers shown. All planted instructions caught.],
  [The memory is consistent], ok, [500 of 500 sessions consistent.],
  [It works end to end], wip, [All layers connect. The first app screen is being finished.],
  [Bad outcomes are shown (new)], todo, [Test ignored maintenance, custom owner requests and negative results.],
)

= 5 · Next we finish the screen and validate the physics

First we finish the app screen for the reference home. Then we bring the physics to full strength and check it against real data, and add all twelve UK measures with the full planning and safety rules. On top of that we build the story the owner sees: the three futures, an answer to every "why not?", and the ability to tap any number to see where it came from. The same story will cover bad outcomes: the cost of skipped maintenance, the result of any custom request, and every negative impact. We will test on three unseen homes before any polishing. The landing page, a Hyderabad flat, landlords and whole streets come later.

#block(fill: tint, inset: 8pt, radius: 3pt, width: 100%)[
  #set text(9.8pt)
  *What Lean does not prove.* Lean proves the bookkeeping and checks each result. It does not prove the physics, so physics results stay labelled _Modelled_ until they are validated.
]
