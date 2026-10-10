// Ibasho status for humans: progress, explainer, features, walkthrough.
// Compile:  typst compile docs/STATUS.typ deliverables/STATUS.pdf
// Agents: update "Progress" and "Features" when you finish a work package. Cite with @key; add keys to docs/refs.yml.
// Style: short sentences, precise claims, no em dashes or en dashes as punctuation.

#let accent = rgb("#1f6f5c")
#let muted = rgb("#5b6770")
#let tint = rgb("#eef5f2")

#set document(title: "Ibasho · Status")
#set page(paper: "a4", margin: (x: 2cm, y: 1.8cm),
  footer: context [#set text(7.5pt, fill: muted, font: "Inter"); Ibasho · status #h(1fr) #counter(page).display("1 / 1", both: true)])
#set text(font: "Libertinus Serif", size: 10.8pt, lang: "en", region: "gb")
#set par(leading: 0.62em, spacing: 0.9em)
#show heading.where(level: 1): it => { set text(font: "Inter", size: 12pt, weight: "bold", fill: accent); v(0.6em); block(below: 0.5em, it.body) }
#show heading.where(level: 2): it => { set text(font: "Inter", size: 10pt, weight: "semibold"); block(below: 0.4em, it.body) }
#set table(stroke: none, inset: (x: 6pt, y: 5pt))
#show table.cell.where(y: 0): set text(font: "Inter", weight: "semibold", size: 8.5pt)

#let state(s) = {
  let c = if s == "done" { accent } else if s == "active" { rgb("#8a5a00") } else { muted }
  box(fill: c.lighten(85%), inset: (x: 4pt, y: 1pt), radius: 2pt, text(7.5pt, font: "Inter", fill: c, weight: "bold", upper(s)))
}

#text(font: "Inter", 20pt, weight: "bold")[Ibasho] #h(3pt) #text(13pt, fill: muted, font: "Noto Sans CJK JP")[居場所の向上] \
#text(11pt, fill: muted)[Status, explainer and walkthrough]
#line(length: 100%, stroke: 1pt + accent)

= Progress

#table(columns: (1fr, auto, 2fr),
  fill: (_, y) => if y == 0 { tint },
  [Phase], [State], [Notes],
  [1 · Research and direction], state("done"), [Eight research briefs, plan v2 (VISION, SPEC, ARCHITECTURE, DESIGN_SYSTEM "Andon", BUILD_PLAN), three red-team reviews, rulings in `docs/review/DECISIONS.md`.],
  [2 · Scaffold and walking skeleton], state("active"), [G0 monorepo and contracts, then M-0: one thin real slice through every layer.],
  [3 · Parallel build], state("todo"), [Engine, proofs, AI, UI kit, 3D, app shell, assets, landing.],
  [4 · Integration and QA], state("todo"), [Tests, e2e, red-team, polish.],
)

= What Ibasho is

Ibasho is a digital twin of a home that you can edit. Change the house and the model recomputes it, using a documented reduced-order heat balance @iso-52016 @sap-10-2. It searches the retrofit packages you can actually build and shows the best few. Lean 4 @lean4 proves the bookkeeping. An AI narrator explains results but cannot change a number. The visual language takes cues from architectural storytelling @dami-lee.

= Features

#table(columns: (1fr, auto),
  fill: (_, y) => if y == 0 { tint },
  [Feature], [State],
  [Planned. Filled in as work packages land.], state("todo"),
)

= Walkthrough

Written once the app runs end to end.

#bibliography("refs.yml", title: "References", style: "ieee")
