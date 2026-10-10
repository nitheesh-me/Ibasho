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
  [Milestone], [State], [Notes],
  [Research and plan], state("done"), [Eight research briefs, the plan of record, three independent reviews. M1 and M2 reports in `report/`.],
  [G0 · Scaffold], state("done"), [Monorepo, shared contracts, layer and ownership rules, CI.],
  [M-0 · Walking skeleton], state("done"), [The reference home runs through every layer: physics, rules, search and money, Lean checker, narrator, scene, agent link and the first app screen.],
  [M-A · First light], state("active"), [Full-strength physics and validation data, more of the design system, onboarding and the reveal with the 3D house.],
  [M-B · Three futures], state("active"), [Full UK rules, score and EPC band, payback, the "If nothing is done" line and negatives on every result.],
  [M-C · Sealed], state("active"), [Checker now also covers bills, score and completed measures. Proofs page still to build.],
  [M-D · Story], state("todo"), [Five chapters, calibration from bills, custom what-if requests, welcome back.],
  [M-E · Release], state("todo"), [Landing posters, accessibility and performance passes. Testing stays light until then.],
)

= What Ibasho is

Ibasho is a digital twin of a home that you can edit. Change the house and the model recomputes it, using a documented reduced-order heat balance @iso-52016 @sap-10-2. It searches the retrofit packages you can actually build and shows the best few. Lean 4 @lean4 proves the bookkeeping. An AI narrator explains results but cannot change a number. The visual language takes cues from architectural storytelling @dami-lee.

= Features

#table(columns: (1fr, auto),
  fill: (_, y) => if y == 0 { tint },
  [Feature], [State],
  [G0 scaffold: a 28-package monorepo with enforced layers and ownership. The kernel holds every contract plus exact fixed-point money, exact fractions for the score, SHA-256 hashing @fips-180-4, a seeded generator @xoshiro and Latin hypercube sampling @mckay-lhs, all tested. Both apps boot in Chromium and Firefox.], state("done"),
  [Andon UI kit, first slice: day and night colour tokens checked for contrast and colour blindness @ottosson-oklab @machado-cvd, three self-hosted font families, seal kanji baked from Yuji Syuku @yuji-syuku, and the number chip, check seal and proved claim seal.], state("done"),
  [Andon UI kit, futures and studio parts: a sliding paper sheet with snap points, the narrator strip, the score with four groups (a band while facts are missing, never a letter), the estimated EPC chip with its spread, the three futures folding screen with what gets worse on every card and an "If nothing is done" line, measure cards, per-fuel diverging bars, a lattice slider, a twelve-month ring, the why-not list and the "possible after a check" lane with source grades. Every chart has a table, and every number opens its evidence.], state("done"),
  [Physics, walking-skeleton slice: GH1, a 1905 London terrace, runs through a steady monthly heat balance @sap-10-2 @rdsap-10. It models fabric and ventilation losses, solar and internal gains, hot water, boiler efficiency and a fixed heat pump COP, all on London climate data @nasa-power. Three measures (loft, draught-proofing, heat pump) patch the twin, and a package is always recomputed whole. Maths is deterministic, ported from fdlibm @fdlibm. Energy is rounded to whole watt hours exactly once. The fast path for heating changes matches a full rerun bit for bit.], state("active"),
  [Hero assets: four Poly Haven skies @polyhaven, four material sets and 38 pieces of Kenney @kenney-furniture and Quaternius @quaternius-interior furniture for the GH1 terrace, all CC0. Skies ship as compact gain maps @adobe-gainmap, models in metres with meshopt. Every file is listed with its licence and checksum, and the credits page is generated from that list. 5.8 MB of the 8 MB budget.], state("done"),
  [Rules, walking-skeleton slice: rule conditions are data, evaluated in three-valued logic @kleene-1952, so an unknown fact is never read as "no". A package blocked only by something we do not know goes to "possible after a check", never to the front. Two rules run on GH1: the budget, which does nothing until a budget is set, and a heat pump on a possibly shared electricity supply, which waits for the network operator to approve. A randomised test checks that an unknown block is never feasible.], state("active"),
  [Rules for the three futures: the full English rule set for the hero home, read as plain sentences. Permitted development for heat pumps, solar panels and wall insulation @gpdo-2015 @si-2025-560 gives a planning application, never a hard no, and the heat pump noise limit of 37.0 dB(A) @mcs-020a is decided with exact fractions that bracket every logarithm, so the answer is yes or no only when every rounding agrees. Building Regulations @ad-l-2021 @ad-f-2021 add what a measure obliges: walls to 0.30 when more than half is renovated (0.70 is the trigger, not the target), emitters for 55 C, ventilation by the AD F table, and a costed moisture check before inside wall insulation on solid brick. Grid export follows G98 and G99 @ena-g98-g99, landlords see the rental rules @prs-regs-2015, and measures that cannot apply (a cylinder jacket on a combi) are ruled out. Every rule has a source, a grade and its own test; old rules retire on their date.], state("done"),
  [Search and finance, walking-skeleton slice: GH1's 8 packages (loft, draught-proofing, heat pump) are enumerated in full and costed. Bills are exact at the October 2026 price cap @ofgem-cap-2026q4, with standing charges. Carbon is counted per fuel and month with SAP 10.2 factors @sap-10-2. Grants include the Boiler Upgrade Scheme @boiler-upgrade-scheme. Upfront cost and NPV at the Green Book 3.5% @green-book-discounting are in whole micro-pence with named rounding. The best options form a front, every other option has a named witness that beats it, and the three picks follow the stated tie-breaks. The search runs in a worker, reports progress and stops on cancel. It emits the certificate input for the Lean checker, and the same request always gives the same hash. A property-value table @nationwide-epc-2026 is ready but not yet shown.], state("active"),
  [Search and finance, first M-B pass: every package shown now lists what gets worse beside what gets better (a fuel or bill that rises, a negative return, more carbon, a lower score or band, a moisture or noise risk), each backed by evidence. Paybacks, a rate of return reported only when it is unique, and a 0% loan with a "cash positive from month 1" check @green-book-discounting. The Green Home Score is computed in exact fractions from the Lean constants, with four groups; it shows a range until comfort hours land. The estimated EPC band uses the rating run at RdSAP 10 prices @rdsap-10 @sap-10-2 and always shows one band either side. Flip points find every price or discount rate where a pick changes. "If nothing is done" ages the home with documented decay models, year by year, with costs and carbon.], state("active"),
  [Lean checker and verify, walking-skeleton slice: a checker in Lean 4 @lean4 re-derives every saving, carbon figure, upfront cost, NPV, rule status, front, witness and pick of a certificate from the physics and pack data, and a machine-checked theorem says that passing every check means the claims hold. The constants the app uses, the certificate types and the claim seals with each theorem's statement are generated from Lean, with a SHA-256 spec hash @fips-180-4, and CI fails if they drift. A TypeScript mirror gives the same verdicts. On GH1 both checkers pass the real certificate and both catch three planted errors: a flipped saving, a rejected measure on the front, and a heat pump with an unknown supply marked feasible.], state("done"),
  [Lean checker, gaps closed: the checker now also re-derives every annual bill from the tariff, recomputes the Green Home Score of every package on show in exact fractions, and treats a measure you marked done like one you ruled out, so it never comes back. The proof that passing every check means the claims hold covers all three. On GH1 both checkers pass the real and a scored certificate and catch a done measure on the front, a wrong score total and an unscored pick.], state("done"),
  [Words and landing page: plain guidance for all 16 home measures (how many days of work, which rooms, whether you can stay in, who to call, which accreditation to look for, and three questions to ask before you sign) @est-advice @historic-england-retrofit @trustmark-pas2035 @mcs-installers, a glossary of about 50 terms, and a voice checker that rejects "guaranteed" and "save up to". The landing page paints as static HTML in five chapters, and a chapter appears only once the feature it describes exists.], state("done"),
  [Lean spec, first slice: the bookkeeping rules are written once in Lean 4 @lean4 and proved for every input. Exact rounding to the nearest even unit, discounting, per fuel and per month savings and carbon, the score (weights add to one, always 0 to 100, never lower for a better home), three-valued rule logic @kleene-1952 (an unknown is never read as a pass), the heat pump noise test of MCS 020 a) @mcs-020a decided only when rounding cannot change it, the Pareto front (nothing better is hidden), the three picks, and memory (a measure you ruled out never comes back). The build fails if any proof is missing or uses an extra axiom.], state("active"),
  [Agent link, first slice: an AI agent such as Claude Code can explore a home through 19 MCP tools @mcp-spec, headless or live in the open app. It reads numbers only as evidence with their ids, changes a home only with typed operations, and records memory only in the person's own words. A raw number in its narration is refused, following proof-carrying numbers @proof-carrying-numbers. The live link is local-only, with a per-launch token and a one-time pairing code. It installs into Claude Code as a plugin @claude-code-plugins, or as a skill, subagent and hook, and uninstalls without a trace. Headless numbers now come from the real engine: a search through the agent link gives the same result, hash for hash, as the app's engine on the reference home.], state("active"),
  [Grounded narration and memory: the story of a home is told from a template that is the same byte for byte on every run, with numbers only as evidence chips. A local model on your computer (Ollama @ollama-api) may polish the words, but every sentence is checked by eight grounding rules and falls back to the template if it writes a number, misreads a sign, recommends something you ruled out or copies a note. Notes from previous owners are read by a quarantine that keeps only typed facts; text sent to a model is datamarked @hines-spotlighting and logged in an outbound ledger. 60 injection notes plant 0 numbers and 0 memories. The memory of what you told us replays 500 random sessions without ever offering a ruled-out measure, and forgetting deletes for real after 30 days. An optional companion @hono on your machine adds the Lean checker and an Ollama bridge @private-network-access.], state("active"),
  [The app, walking-skeleton slice: the sample home opens at `/app/home/gh1`. The engine works in the background while the house is drawn in pencil; then it is inked, and three futures appear: least upfront, best return and lowest running carbon. Every figure can be tapped to see how we know it. A second checker redoes the sums and the page shows a Checked seal only when it agrees, next to the proved promise that anything you rule out never comes back. Results are kept on your device only.], state("active"),
  [The app, first light: a new visitor is asked five quick questions (where, which home type, a few pictures, who lives there, then the reveal) in about two minutes, with no money question until the futures appear. Nothing is looked up online. Anything not answered stays an estimate and is marked as one. The reveal opens the home on the 3D stage, drawn on paper by day or lantern-lit at night, with the roof lifting once the sums are done; without 3D the house is drawn in pencil and then inked. Unanswered values come from RdSAP defaults @rdsap-10.], state("active"),
  [Credits: one acknowledgements file names every library, ported algorithm, data source, asset and idea Ibasho builds on, with its licence. Every agent adds to it.], state("done"),
  [Bad outcomes, contracts: a home can now be shown getting worse. Packs describe how a home ages when maintenance is ignored (a boiler losing efficiency, draught-proofing wearing out, a boiler replacement falling due), each with its sources, its grade and a low to high range. The engine contract has room for an "If nothing is done" line beside the three futures, and every package lists what gets worse beside what gets better. Fuel price scenarios and a confirmed boiler replacement are now part of the owner's inputs.], state("active"),
  [The living drawing, first light: your home is built from its survey as a cutaway miniature on paper, roof lifted, in the manner of the fukinuki yatai picture scrolls @genji-emaki. It renders with three.js @threejs through React Three Fiber @r3f, by day (Washi) or by lamplight (Yoru), with sun from SunCalc @suncalc. It redraws only when something changes. Heat leaving the house is shown as drifting motes, a lens shows modelled surface warmth and the living area is tinted by temperature. A plain drawing takes over without WebGL. Every part of the house can be picked, and a text outline lists the same parts for screen readers. Each retrofit measure has its crest and fold, and each kind of home its thumbnail.], state("active"),
)

= Walkthrough

Written once the app runs end to end.

#bibliography("refs.yml", title: "References", style: "ieee")
