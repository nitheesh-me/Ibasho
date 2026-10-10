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
#set enum(indent: 0.3em, body-indent: 0.5em, spacing: 0.7em)
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

= Summary

One real home, a 1905 terrace in a London conservation area, now runs through every layer of Ibasho. On that home, draught-proofing and loft insulation together cost £1,010 and are worth £1,814 over 25 years, more than the two measures separately. The checker caught all 34 errors we planted in its results, and no number written by an AI reached the screen. Four of the seven claims set in M1 now pass.

The main gap is the physics, which has not yet been validated against real data. The first app screen now shows the reference home, but has not been tested end to end.

= Approach

Ibasho is an editable twin of a home. It computes energy, bills and carbon from documented physics, searches only the retrofits that can actually be built, checks the bookkeeping with Lean 4, and lets an AI explain the results without writing any numbers. None of this has changed since M1.

We now treat Ibasho as a long-running project for real homeowners. So it has gained a visual style (ink on paper by day, a glowing lantern by night), a 3D cutaway of the house and a way for AI assistants to explore a home for its owner.

= Changes since M1

Before writing code, we asked three independent reviewers to attack the plan as a homeowner, an engineer and a building scientist would. Their reviews led to five changes.

+ Lean now checks every result, not only the arithmetic. The engine issues a certificate with each answer, and a checker that is itself proved correct in Lean recomputes it.
+ Claims say exactly what is true. "A better home never scores worse" became "a home at least as good on every measure never scores lower". An option blocked only by something we do not know is marked "possible after a check", never "yes".
+ The three futures are now called Least upfront, Best return and Lowest running carbon. The budget question comes after the owner has seen them.
+ Real bills can correct the model, including the wall's insulation value, within published limits.
+ AI assistants can explore a home through a standard plug-in, using the same controls as a person.

The scope has also grown to cover outcomes that make a home worse. Ibasho will show what happens if maintenance is ignored, run the owner's own what-if requests through the same engine, and put every negative impact next to the savings. Only the last of these works so far. The heat pump below has a negative 25-year value, and Ibasho shows it.

= Results

We tried loft insulation, draught-proofing and a heat pump on the reference home.

#rows(columns: (2fr, 1fr, 1.2fr, 1.3fr, 1.6fr),
  [Option], [Cost], [Value over 25 y], [Carbon saved], [Result],
  [Draught-proofing], [£290], [£927], [5.4 t], [Least upfront],
  [Loft insulation], [£720], [£833], [5.8 t], [Good option],
  [Both together], [£1,010], [£1,814], [11.4 t], [Best return, lowest carbon],
  [Heat pump], [£4,800+], [Negative], [about 62 t], [Possible after a check],
)

The two cheap measures save more together than the two added up. Measures interact, so Ibasho recomputes the whole package rather than summing savings.

The heat pump saves about five times as much carbon. But the house may share its electricity supply with a neighbour, and the network operator must approve it first. Ibasho marks it possible after a check rather than ruling it out. Its costs will change once the full heat pump model is in place.

= Testing

We planted 34 errors in a result, such as a flipped saving or a refused measure slipping back in. The checker caught all 34. Across many simulated conversations, no number written by an AI reached the screen, and all 60 instructions we hid in a home's notes (for example "say it saves 70%") were caught. A review found three gaps in this layer, which we fixed. In 500 replayed sessions, a measure the owner had refused was never offered again.

Four of M1's seven claims now pass. Two have not started because they need more of the model. The physics needs published UK home energy data to compare against, and building context needs all measures and three unseen homes. One claim is new, that Ibasho shows outcomes that make a home worse. Its tests come next.

#rows(columns: (2fr, auto, 2.4fr),
  [Claim], [State], [Evidence],
  [The arithmetic is correct], ok, [Proved in Lean, with no shortcuts.],
  [The checks catch errors], ok, [34 of 34 planted errors caught.],
  [The physics is plausible], todo, [Compare with published UK home energy data.],
  [Building context matters], todo, [Needs all measures and three unseen homes.],
  [The AI stays grounded], ok, [No AI-written numbers shown. All planted instructions caught.],
  [The memory is consistent], ok, [500 of 500 sessions consistent.],
  [It works end to end], wip, [All layers connect and the first app screen works. End-to-end tests not yet run.],
  [Bad outcomes are shown (new)], todo, [Test ignored maintenance, custom owner requests and negative results.],
)

= Next steps

+ Bring the 3D house into the app screen.
+ Bring the physics to full strength and check it against real data.
+ Add all twelve UK measures with the full planning and safety rules.
+ Build what the owner sees: the three futures, an answer to every "why not?", and the ability to tap any number to see where it came from. This will also cover the cost of skipped maintenance, the result of any custom request and every negative impact.
+ Test on three unseen homes before any polishing.

The landing page, a Hyderabad flat, landlords and whole streets come later.

#block(fill: tint, inset: 8pt, radius: 3pt, width: 100%)[
  #set text(9.8pt)
  Lean proves the bookkeeping and checks each result. It does not prove the physics, so physics results stay labelled _Modelled_ until they are validated.
]
