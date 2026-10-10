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
  [Agent link: MCP server and Claude Code plugin, so an AI agent can explore a home headless or live in the app. One-command install.], state("todo"),
  [G0 scaffold: a 28-package monorepo with enforced layers and ownership. The kernel holds every contract plus exact fixed-point money, exact fractions for the score, SHA-256 hashing @fips-180-4, a seeded generator @xoshiro and Latin hypercube sampling @mckay-lhs, all tested. Both apps boot in Chromium and Firefox.], state("done"),
  [Andon UI kit, first slice: day and night colour tokens checked for contrast and colour blindness @ottosson-oklab @machado-cvd, three self-hosted font families, seal kanji baked from Yuji Syuku @yuji-syuku, and the number chip, check seal and proved claim seal.], state("done"),
  [Physics, walking-skeleton slice: GH1, a 1905 London terrace, runs through a steady monthly heat balance @sap-10-2 @rdsap-10. It models fabric and ventilation losses, solar and internal gains, hot water, boiler efficiency and a fixed heat pump COP, all on London climate data @nasa-power. Three measures (loft, draught-proofing, heat pump) patch the twin, and a package is always recomputed whole. Maths is deterministic, ported from fdlibm @fdlibm. Energy is rounded to whole watt hours exactly once. The fast path for heating changes matches a full rerun bit for bit.], state("active"),
  [Hero assets: four Poly Haven skies @polyhaven, four material sets and 38 pieces of Kenney @kenney-furniture and Quaternius @quaternius-interior furniture for the GH1 terrace, all CC0. Skies ship as compact gain maps @adobe-gainmap, models in metres with meshopt. Every file is listed with its licence and checksum, and the credits page is generated from that list. 5.8 MB of the 8 MB budget.], state("done"),
  [Rules, walking-skeleton slice: rule conditions are data, evaluated in three-valued logic @kleene-1952, so an unknown fact is never read as "no". A package blocked only by something we do not know goes to "possible after a check", never to the front. Two rules run on GH1: the budget, which does nothing until a budget is set, and a heat pump on a possibly shared electricity supply, which waits for the network operator to approve. A randomised test checks that an unknown block is never feasible.], state("active"),
  [Search and finance, walking-skeleton slice: GH1's 8 packages (loft, draught-proofing, heat pump) are enumerated in full and costed. Bills are exact at the October 2026 price cap @ofgem-cap-2026q4, with standing charges. Carbon is counted per fuel and month with SAP 10.2 factors @sap-10-2. Grants include the Boiler Upgrade Scheme @boiler-upgrade-scheme. Upfront cost and NPV at the Green Book 3.5% @green-book-discounting are in whole micro-pence with named rounding. The best options form a front, every other option has a named witness that beats it, and the three picks follow the stated tie-breaks. The search runs in a worker, reports progress and stops on cancel. It emits the certificate input for the Lean checker, and the same request always gives the same hash. A property-value table @nationwide-epc-2026 is ready but not yet shown.], state("active"),
  [Words and landing page: plain guidance for all 16 home measures (how many days of work, which rooms, whether you can stay in, who to call, which accreditation to look for, and three questions to ask before you sign) @est-advice @historic-england-retrofit @trustmark-pas2035 @mcs-installers, a glossary of about 50 terms, and a voice checker that rejects "guaranteed" and "save up to". The landing page paints as static HTML in five chapters, and a chapter appears only once the feature it describes exists.], state("done"),
  [Lean spec, first slice: the bookkeeping rules are written once in Lean 4 @lean4 and proved for every input. Exact rounding to the nearest even unit, discounting, per fuel and per month savings and carbon, the score (weights add to one, always 0 to 100, never lower for a better home), three-valued rule logic @kleene-1952 (an unknown is never read as a pass), the heat pump noise test of MCS 020 a) @mcs-020a decided only when rounding cannot change it, the Pareto front (nothing better is hidden), the three picks, and memory (a measure you ruled out never comes back). The build fails if any proof is missing or uses an extra axiom.], state("active"),
  [Agent link, first slice: an AI agent such as Claude Code can explore a home through 19 MCP tools @mcp-spec, headless or live in the open app. It reads numbers only as evidence with their ids, changes a home only with typed operations, and records memory only in the person's own words. A raw number in its narration is refused, following proof-carrying numbers @proof-carrying-numbers. The live link is local-only, with a per-launch token and a one-time pairing code. It installs into Claude Code as a plugin @claude-code-plugins, or as a skill, subagent and hook, and uninstalls without a trace. Headless numbers now come from the real engine: a search through the agent link gives the same result, hash for hash, as the app's engine on the reference home.], state("active"),
)

= Walkthrough

Written once the app runs end to end.

#bibliography("refs.yml", title: "References", style: "ieee")
