// Milestone 1 report. Compile with:  typst compile report/M1.typ deliverables/M1.pdf
#import "@preview/fletcher:0.5.8" as fletcher: diagram, node, edge

#let accent = rgb("#1f6f5c")
#let muted = rgb("#5b6770")
#let tint = rgb("#eef5f2")
#let proof = rgb("#8a5a00")

#set document(title: "Team #124 · M1 · Ibasho")
#set page(
  paper: "a4",
  margin: (x: 2cm, top: 1.7cm, bottom: 1.6cm),
  footer: context [
    #set text(7.5pt, fill: muted, font: "Inter")
    Team \#124 · Megathon X · Lloyds B · M1
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
#set table(stroke: none, inset: (x: 6pt, y: 6pt))

// ───────────────────────── Header ─────────────────────────
#grid(columns: (1fr, auto), align: (left + bottom, right + bottom),
  [
    #set text(font: "Inter")
    #text(8pt, fill: muted, weight: "medium", tracking: 0.3pt)[MEGATHON X · LLOYDS B · MILESTONE 1] \
    #v(2pt)
    #text(20pt, weight: "bold")[Ibasho]
    #h(3pt) #text(13pt, fill: muted, font: "Noto Sans CJK JP")[居場所] \
    #text(11pt, fill: muted)[The proof-carrying building twin]
  ],
  box(fill: accent, inset: (x: 9pt, y: 6pt), radius: 3pt)[
    #text(font: "Inter", 11pt, weight: "bold", fill: white)[Team \#124]
  ],
)
#v(4pt)
#line(length: 100%, stroke: 1pt + accent)
#v(6pt)

#align(center, text(12pt, style: "italic")[
  Every home is a different physics problem.\
  We find its best _feasible_ future and prove every number.
])

= 1 · Problem

Lloyds asks for a *Green Home Score* (seven fixed weights), a way to spot poorly performing homes, and *retrofit recommendations* with per-fuel energy savings, carbon reduction and an indicative property-value range. Every number must come from a documented model, never from an LLM.

What makes it hard:

- *Same spreadsheet, different physics.* A shaded UK terrace and a west-facing top-floor flat in Hyderabad need opposite fixes: one loses heat, the other gains it.
- *Measures interact.* Insulation shrinks the heat pump you need, and a heat pump cuts gas but raises electricity. Percentages from a catalogue cannot simply be added.
- *The best plan may be impossible.* Budget, tenure and roof rights decide what can actually be built. The landlord may pay while the tenant saves.

= 2 · Idea

In Japanese, _ibasho_ (#text(font: "Noto Serif CJK JP", size: 0.95em)[居場所]) means a place where you truly belong. A house becomes one when it suits its climate, its people and their budget. Our project helps each home get there.

*Ibasho is a digital twin of a home that you can edit.* Change the house, and the model recomputes it. Compare its possible futures on cost, energy per fuel, carbon and payback, and pick the one that fits the owner's budget and rights.

Every number carries its evidence. *Lean 4* proves the bookkeeping. The *LLM explains* the results but cannot change a single number.

= 3 · Approach

#align(center, block(width: 100%, fill: tint, radius: 4pt, inset: (x: 4pt, y: 10pt))[
  #set text(font: "Inter", size: 7.6pt)
  #diagram(
    spacing: (11pt, 18pt),
    node-stroke: 0.6pt + accent,
    node-fill: white,
    node-corner-radius: 3pt,
    node-inset: 6pt,
    edge-stroke: 0.7pt + muted,
    node((0, 0), align(center)[*Home*\ geometry · climate\ · meters · budget], name: <a>),
    node((1, 0), align(center)[*Twin*\ typed state;\ unknown ≠ 0], name: <b>),
    node((2, 0), align(center)[*Physics*\ heat balance →\ kWh per fuel], name: <c>),
    node((3, 0), align(center)[*Search*\ feasible packages\ → Pareto front], name: <d>),
    node((4, 0), align(center)[*Prove*\ Lean 4 checks\ every result], name: <e>, stroke: 0.9pt + proof),
    node((5, 0), align(center)[*Explain*\ LLM reads the\ evidence only], name: <f>),
    edge(<a>, <b>, "-|>"), edge(<b>, <c>, "-|>"), edge(<c>, <d>, "-|>"),
    edge(<d>, <e>, "-|>"), edge(<e>, <f>, "-|>"),
    edge(<f>, <b>, "-|>", bend: 22deg, stroke: (paint: accent, dash: "dashed"),
      label: text(7pt, fill: accent)[*"what if…?" → recompute, never guess*], label-side: left),
  )
])

Five design rules:

- *Recompute, never add.* Each package is re-run as a whole through a documented reduced-order model, so the interactions between measures are captured.
- *Signed, per fuel.* We calculate $Delta E_f = E_(f,"base") - E_(f,"after")$ and $Delta C = sum_f Delta E_f dot "EF"_f$. If a package increases the use of a fuel, the report shows it.
- *Search only what can be built.* We enumerate every combination of six measures and remove the ones that break budget or ownership rules. Three options remain: the cheapest, the best return and the lowest carbon.
- *Proof-carrying.* Lean 4 proves that the weights sum to 1, the score lies in [0, 100], a better home never scores worse, savings equal the before/after difference, and every accepted package is feasible.
- *The LLM narrates.* It only reads computed results. It remembers the owner's constraints, such as a rejected measure, and never changes how anything is scored.

#block(fill: tint, inset: 8pt, radius: 3pt, width: 100%)[
  #set text(9.8pt)
  *Honest boundary.* Lean proves the arithmetic is right, but it cannot prove the physics is right. We therefore test the two separately.
]

= 4 · Testing

#table(
  columns: (3.3cm, 1fr, 4.2cm),
  fill: (_, y) => if y == 0 { tint },
  stroke: (_, y) => if y > 0 { (top: 0.4pt + rgb("#d5dedb")) },
  [Claim], [How we test it], [Pass if],
  [The arithmetic is correct], [Lean proofs, plus property tests on random homes], [All hold],
  [The checks catch errors], [Inject bugs: a wrong weight, a flipped sign, a missing carbon factor, an infeasible heat pump, savings made by adding percentages], [Each one is caught],
  [The physics is plausible], [Compare baselines with published UK ranges (NEED, EPC); sweep orientation, shading and size], [Results fall in range and move the right way],
  [Building context matters], [Compare against a metadata-only baseline on held-out scenarios], [Rankings change for explainable reasons],
  [The LLM stays grounded], [Match every number in an explanation to a computed result; plant "claim 70% savings" in property notes], [≥ 90% grounded, < 5% unsupported, numbers unchanged],
  [The memory is consistent], [Replay sessions where measures are rejected or completed], [A rejected measure is never offered again],
  [It works end to end], [Edit one UK terrace live, watch three futures recompute, and click any number to open its evidence], [Every figure can be traced to its source],
)
