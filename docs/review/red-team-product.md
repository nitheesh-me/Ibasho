# Red team: product and homeowner advocate

Date: 2026-10-10. Scope: `docs/*.md`, `docs/research/*.md`. Fixes are in priority order.

## Verdict

The honesty core is new and useful: ranges, bills that correct the model, "why not?" for every exclusion, no LLM digits. The aesthetic is distinctive. Three problems a homeowner would feel in five minutes:

1. **Some hero visuals claim things the physics cannot compute**, breaking the plan's own rule "every mark is a measurement".
2. **The demo is not constrained.** T1 holds 9 story chapters, a studio, 12 measure groups, ~25 rules, Monte Carlo, a karesansui garden, snapshots, 4 LLM providers, 5 render styles, sound and a 10 chapter landing page.
3. **It answers the modeller's questions better than the owner's.** Disruption, "is my quote fair?", "who do I call?" and "my boiler just died" are missing.

## Prioritised fixes

### P1. Delete or earn every visual the engine cannot back (blocker)
- The engine is a monthly, whole house, two zone model (BP §3.7). It has no room temperatures. Yet the GH1 win moment is "back bedroom shifts from ai to kuchiba" (SPEC §2) and chapter 3 says "Winter sun on the back bedroom".
- Thermal bridging enters as a whole house `y` adder. The "lintel glows as a hot line" beat and gold seams "on the lintel" have no lintel-specific number behind them. AC-K1 would pass on a count while the location is invented.
- T-lite comfort hours (monthly mean plus assumed sinusoid) are the weakest output yet carry the strongest emotional promise.
- **Fix:** either add a minimal per-room split for GH1 plus explicit ψ junctions for the 3 to 4 bridges the cutaway draws, or reword to whole house claims. New AC: every highlighted room or element has its own evidence node, not a shared aggregate.

### P2. Rewrite the 90 second hero so it shows the best ideas, not avoids them
- Signature moment 3 (heat pump drag; flow temperature drives running cost) is the most useful insight in the research (PA §2.4, O6), yet Margaret rules out the heat pump at 0:45 and it never appears.
- The coda "Your street could do this too" aggregates *imagined neighbours*: a big claim on invented data.
- **Fix:** 0:00 house opens and breathes. 0:20 bills correct us. 0:35 drag radiators bigger, then add loft insulation: flow temperature, efficiency and the bill move together. 0:55 three futures. 1:10 "Why not internal insulation?" and a remembered "no". 1:20 one meaningful seal (P3). Move Machi to T3. Keep Ravi as the second act.

### P3. Make the proof moment mean something to an owner
- "Savings = before minus after. Proved." is trivial to a homeowner, and a vermilion hanko on it reads as "savings guaranteed", the misreading VISION §6 forbids.
- **Fix:** lead with the two certificates a customer cares about. **"Nothing better is hidden: no option you can build beats this on cost, return and carbon at once."** (Pareto front plus feasibility certificate.) **"What you ruled out never came back."** (memory theorem). Bookkeeping theorems live on `/app/proofs`. Every seal says in one line what is *not* proved. Hallway test: 5 people explain the seal; none may say "guaranteed".

### P4. One headline, one letter scale
- An Ibasho band A to G *and* a likely EPC band A to G share thresholds (SF §3.1), plus 7 sub-score seals. People will confuse the letters and wonder why the score ignores their bills (R3).
- **Fix:** letters belong to the EPC estimate only. The Ibasho score is a number (0 to 100), never a letter. First glance shows 4 groups (cost, carbon, comfort, health); 7 on tap. One line by the score: "Scored for a typical household, so your bills do not change it."

### P5. Plain English first, Japanese as grammar
- Users meet genkan, engawa, tokonoma, michi, byōbu, fuda, kumiko, sekki, okaeri, hanko. Fine as internal names; as labels they are the costume the plan forbids.
- The futures named Gentle, **Wise**, Bold judge the owner. Choosing "not Wise" feels foolish, and "Bold" frames low carbon as risky.
- **Fix:** English labels, Japanese glyph decorative. Futures: "Least upfront", "Best return", "Lowest carbon"; poetic name as subtitle at most. Cut each card from ~10 figures to 4 (cost, yearly saving, carbon, comfort), rest behind "More". Use 12 months, not 24 sekki: the data is monthly.

### P6. Answer the owner's real questions
None of these appear in SPEC:
- **Disruption** per measure: days of work, rooms out of use, can you stay in.
- **"Check my quote":** enter a quote and see it against the cost range, with the line items that usually differ.
- **"My boiler just broke":** a 60 second trigger point flow, like for like gas vs heat pump with BUS, on the saved twin. Most heat pump decisions happen here (PA §3.8).
- **Next step:** installer type and accreditation per measure, plus three questions to ask.

### P7. Cut T1 to what the 90 seconds needs, then polish it to perfection
- **Keep:** onboarding, cutaway, calibration, what-if with flow temperature, futures with why not, evidence drawer, a plain "Things you told us" list, revisit, persistence, 5 chapter landing.
- **Defer:** karesansui garden (later, as a skin over the list), sound, Sumi, Netsu and Shita-e styles, snapshots, WebLLM and Chrome AI (keep template plus one provider), compare mode, robustness LHS (keep exact flip points).
- Story is 9 chapters at up to 60 s, about 9 minutes. Cap it at 5 chapters and 3 minutes.
- **Anti-overfit gate:** three random, untuned "stranger homes" must render, compute and read sensibly before M-D.

### P8. Make onboarding and bills match what people actually have
- People know their monthly direct debit, not annual kWh, and a direct debit is smoothing, not consumption. The EPC register pre-fills most of Tune, yet it is an optional plugin.
- **Fix:** accept kWh, £ per bill, direct debit (flagged weak, wide band) or meter CSV; weight the fit by data quality. Online with consent, EPC lookup is the default first step. Ask budget *after* first futures so it does not anchor. Ship a fixture where bills exceed the model, so calibration is not always flattering.

## Housekeeping
- Personas disagree (Margaret: Leeds £8k in UX, London £15k in SPEC). Pick one canon.
- "Losing this much right now" needs live weather; say "on a typical January night".
- "4,096 ways" means nothing to an owner; lead with "three stand out".
