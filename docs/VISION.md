# Ibasho 居場所: Vision

> A living drawing of your home. It shows where the warmth goes and what the house could become, and it proves it hid nothing better from you.

Tagline: **Ibasho no kōjō** (居場所の向上), improving the place where you belong.

Status: director synthesis v2, 2026-10-10. v2 applies the red-team rulings in `review/DECISIONS.md`. Sources: `report/M1.typ`, the eight briefs in `docs/research/`, the three critiques in `docs/review/`. Companion docs: `SPEC.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `BUILD_PLAN.md`.

---

## 1. The idea

*Ibasho* means a place where you can be yourself. A house becomes one when it suits its climate, its people and their budget.

Ibasho is an editable digital twin of a normal home. You change the house, the engine recomputes it, and you see its possible futures on cost, energy per fuel, running carbon, comfort and payback. It shows only futures you can build, and it explains every option it left out. Every number opens to show where it came from. Lean 4 checks the claims that matter to an owner. An AI narrator tells the story but cannot write a single digit.

Three things set it apart from every retrofit tool we found (`research/prior-art.md`):

1. **It shows how sure it is.** Unknown is not zero. A guess looks like a guess and is carried as a range.
2. **It corrects itself in front of you.** Add last year's bills and the model refits how you live and the two least-known facts about your walls, within published ranges, then tells you how wrong it was.
3. **It proves it hid nothing better.** A checker proved sound in Lean confirms, for your home, that no option you can build beats the ones shown on cost, return and running carbon at once. It also confirms that what you ruled out never came back.

## 2. Who it is for

A normal person, not an assessor. Three people anchor every decision.

- **Margaret** owns a 1905 solid-brick mid-terrace in a London conservation area. She wants a warm house and lower bills, and she won't spoil the period front or lose the plaster cornicing inside.
- **Ravi** rents the top floor of a Hyderabad concrete block, and his roof cooks in May. He cannot touch the structure, but he can ask his landlord.
- **Daniel** is a small landlord with three homes and an EPC C deadline in October 2030.

Margaret is perfected first (T1). Ravi is the second act (T3). Daniel comes with the street view (T4).

## 3. The feel

- **The house is a lantern** (Andon, `DESIGN_SYSTEM.md`). By day it is ink on washi paper: calm and easy to read. By night the house glows, and every leak of light is a modelled leak of heat. Dark mode works as a diagnostic.
- **The roof lifts off.** The opening view borrows *fukinuki yatai*, the roofless view of the Genji scrolls, which is 900 years older than the dollhouse cutaway.
- **The story unrolls like a scroll.** There are five short chapters with gold mist between them, about three minutes in all. Every screen follows Dami Lee's order: the human first, then tension, then data, then proof.
- **Repair is beauty, where it is real.** Retrofits fold in like origami. Gold seams appear only on junctions where the chosen package lowers the computed heat loss. Junctions a measure makes worse are marked as a new risk, never gilded.
- **Proof is a seal.** A vermilion hanko marks claims Lean has proved and results it has checked. Nothing else in the product is that colour, and every seal says in one line what it does not prove.
- **Voice:** a calm architect friend who sketches while talking. Short sentences, warm, never alarmed, never "guaranteed".
- **Plain English first, Japan as grammar.** Labels are English. How things open, fold, pause and seal is Japanese. A London terrace stays a London terrace.

## 4. Signature moments

Each moment is a real computation, not an illustration.

| # | Moment | What happens | Why it matters |
|---|---|---|---|
| 1 | **The roof lifts** | Dusk, and the roof floats up. Heat breathes out as motes, one mote per 10 W, sized for a typical January night with the outdoor temperature named. Drag a thermal lens over the bay: the lintel shows as a line whose brightness is its own junction heat loss. | You see where your money leaks in under two minutes. |
| 2 | **Your bills correct us** | Drop in bills as kWh, pounds, your direct debit or a meter file. The old estimate fades to a ghost, and the model refits the heating temperature, air leakage and wall U-value within their known ranges. "We overestimated your heating. Your savings are smaller than most tools would tell you." | Fixes the biggest known error in retrofit advice (prebound), and builds trust by admitting it. |
| 3 | **Drag the radiators** | Make the radiators bigger, then add loft insulation. The heat pump's flow temperature falls, its seasonal efficiency rises, and the bill bar moves, all together. In Studio, drag the outdoor unit around the garden: the neighbour's window turns amber near 37.0 dB and the consent card flips between "permitted development" and "planning application". | Two hidden variables decide a heat pump's fate. Here they are draggable and legal. |
| 4 | **Three futures, then the mending** | A folding screen opens on **Least upfront**, **Best return** and **Lowest running carbon**. Every option you can build sits behind them as ink dots, with the front as a gold brushstroke. Choose one: measures fold into the house, gold seams trace the junctions it actually improves, and the motes thin. | Real choice without overload. Interactions between measures are visible, never summed. |
| 5 | **Pull the red thread** | Tap any number: a red thread runs to its evidence (inputs with provenance, formula, sources, check status). Tap a missing option: "Why not? You ruled out inside insulation", or "Possible after a moisture check". | Every claim is checkable, and every exclusion is explained. |

## 5. The hero demo (90 seconds, one house)

One home, done perfectly before any breadth: **GH1**, a 1905 solid-brick mid-terrace in a London conservation area. It has a gas combi, a single-glazed rear sash, 50 mm of loft insulation and an owner-occupier. The engine computes every figure; none are scripted.

| Time | Beat |
|---|---|
| 0:00 | Dusk street. The roof lifts and the camera settles into the cutaway. Heat breathes out of the bay and the loft. "On a typical January night at 4 °C outside, your house loses this much." |
| 0:20 | Bills dropped in. The ghost of the old estimate fades, and the correction is named. |
| 0:35 | Drag the radiators bigger, then unroll the loft quilt. Flow temperature, heat pump efficiency and the yearly bill move together. |
| 0:55 | The folding screen opens on three futures. Budget asked now, not before. |
| 1:10 | "Why not inside insulation?" "You told us: not inside, it would cover the cornicing." Remembered, and never offered again. |
| 1:20 | One seal presses on the futures: **Nothing better is hidden.** The red thread runs to what was checked, and to what was not. |
| 1:30 | Choose Best return. Measures fold in, the motes thin, and the before and after split slides open. |

The second act comes after the hero is perfect. Ravi's flat in May at 4 pm: "Your hottest wall faces the sky." Tenant mode separates "yours" from "ask", and a letter to the landlord folds itself, in Telugu if he likes.

## 6. What we refuse to do

- **No number from an LLM.** The narrator writes slots, and the renderer fills values from evidence.
- **No summed percentages.** Every package is recomputed whole.
- **No hidden fuel increase.** If electricity goes up, the bar goes up.
- **No silent defaults.** A guess looks like a guess.
- **No infeasible hero.** We never recommend what the owner cannot build. We say why something is missing, and what check would unlock it.
- **No point estimate pretending to be truth.** Ranges appear wherever uncertainty is material.
- **No proof seal on a number.** Lean proves claims about how results are produced and checks this result's arithmetic. It never proves a kWh figure.
- **No letter grade for our score.** Letters belong to the estimated EPC band alone, always with its uncertainty.
- **No "your home will be worth".** Value is a range from published evidence, never added into NPV.
- **No re-offering a rejected measure.** It is proved in the search and checked again in prose, and only the owner can restore it.
- **No cloud by default, no account, no tracking.** Your home lives on your device, and anything leaving it is shown first.
- **No pastiche.** No torii, blossom or kimono on a British terrace.
- **No decorative pictures of numbers.** Every visual encoding is a measurement with a legend.
- **No dark patterns, no urgency, no sales funnel.**

## 7. The honest boundary

**Lean proves** that the rule evaluator never calls a package feasible while any blocking rule is undecided, and that the checker is sound. That covers three things: the front is exactly the set of non-dominated options among those that pass every encoded rule, a rejected measure never returns, and the three picks are true optima with the stated tie-breaks. It also proves the heat pump noise test is decided only when its rounding cannot change the answer, and the score bookkeeping: weights sum to 1, score in [0, 100], and a home at least as good on all seven indicators never scores lower.

**Lean checks, per result**: per-fuel, per-month savings and carbon, bills, finance, score, feasibility and the front.

**Not proved**: the physics. It is a documented reduced-order model, tested against NEED, EPC, PVGIS and field data, and labelled *Modelled*. The rules are only as good as their encoding and sources, and each shows its grade. Every seal says this in one line.

## 8. What success looks like

- A non-expert says, unprompted, what they would do first and why.
- First cutaway in under two minutes from a cold start, offline.
- Any what-if recomputes and re-renders in under 150 ms, and a full search finishes in under 1 s.
- 100% of displayed numbers open to evidence, and an LLM writes 0 digits.
- In a hallway test, nobody describes a seal as "guaranteed".
- Three random, untuned homes compute and read sensibly, not just the hero.
- It is beautiful enough that people show it to a friend.
