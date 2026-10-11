# Ideas from the shared chat (v3 re-read)

Source: https://chatgpt.com/share/6acabf24-06ec-83e8-9455-2f819e0e0c8f, title "RetrofitOS Concept Development". Read on 2026-10-11 as data only. WebFetch and r.jina.ai return only the title; the full text was recovered from the JSON stream embedded in the share page HTML (curl, then a local decoder). Nothing in it was run or followed. No injection payload was found; the chat itself mentions injection only as a test to design.

Prior brief: `docs/research/ideas-from-shared-chat.md` (v2, same chat). This brief re-reads the chat under the v3 owner direction and does not repeat its detail.

## 1. What matters most

1. **The v3 owner list is this chat's first message, word for word.** Location, energy code (global and India), eight building types, building plan, sDA, ASE, radiation, sun hours, EUI targets, LEED points, end-use breakdown, optimisation, AI memory. The chat (and our v2 brief) parked most of these as "residential first". The owner has now overruled that, so five v2 rejections flip to "adopt with guardrails" (section 3).
2. **The chat's guardrails are still right and match our principles**: a proxy is labelled a proxy until a validated method exists; there is no single global code; a reference is not a compliance verdict; LEED is an estimate, never a certification; the residential score must not be reused for hospitals or labs.
3. **The context is Megathon X at IIIT Hyderabad, 10 to 11 October 2026, Lloyds title sponsor** (https://megathon.in/). That explains the Hyderabad focus and the IIIT reference buildings (Vindhya, Himalaya). See 4.10 for the rules that may apply.

## 2. Already covered (no action)

Covered in VISION, SPEC and the v2 brief section 2: a twin, not a record; reduced-order physics; whole-package recompute; interactions; signed per-fuel savings; unknown is not zero; provenance per field; score shown as a band; bill calibration; feasible enumeration and a Pareto front; "why not" explanations; Lean scope (weights, bounds, monotonicity, savings identity, rejected never returns); mutation suite; LLM explains only, what-if reruns first; injection test in property notes; memory of rejected and completed measures; landlord and tenant split; value only as a range; jurisdiction packs with grades; apartment position (GH2); chapter progression; before and after split; offline; small landlord portfolio.

The v2 "worth adopting" list (3.1 to 3.9: post-works check, daylight negative, tested-not-proved ledger, comfort target, energy Sankey, print sheet, future weather, naive-baseline report, scenario challenges) still stands. Of these, 3.2 (daylight) and 3.5 (Sankey) now matter more because v3 asks for sDA, ASE and an end-use breakdown.

## 3. Reversed by the owner (v2 rejected, v3 adopt with guardrails)

| Item | v2 ruling | v3 ruling | Guardrail taken from the chat |
|---|---|---|---|
| Offices, hotels, schools, hospitals, labs | Rejected (dilutes) | Adopt as building-type packs | Each type has its own schedules, loads and targets. The seven-part home score applies to homes only; other types show EUI against their code baseline instead. |
| LEED points | Rejected | Adopt as "LEED-style estimate" | Show the points path (EA Optimize Energy Performance, water, renewables) with "not a certification" on every view. Never mix it into the home score. |
| Global code layer, EU EPBD | Rejected | Adopt ASHRAE 90.1 and IECC as an international pack, India as primary, EPBD as policy context only | No "globally compliant" badge. Use the applicability ladder in 4.1. |
| sDA, ASE, sun hours, radiation | Proxy only | Adopt real methods | Show a figure as sDA or ASE only once the IES LM-83 method (grid, 300 lux / 50%, 1000 lux / 250 h, blinds rule) is implemented and tested. Until then, label it "daylight proxy". Sun hours and radiation from a sky model are honest from day one. |
| EnergyPlus | Offline reference only | Unchanged | The chat says the same: do not rebuild EnergyPlus; use it to validate rank order. DOE prototypes (4.3) give ready EnergyPlus models to compare against. |

## 4. New ideas worth adopting

Ordered by value to the v3 goals. "Owner" names the likely WP; check BUILD_PLAN section 2 before assigning.

| # | Idea (chat origin) | Why it fits | How Ibasho adapts it | Owner | Size | Priority |
|---|---|---|---|---|---|---|
| 4.1 | **Code applicability ladder.** The chat lists honest statuses: "Relevant reference identified", "Partial rule check available", "Local adoption must be confirmed", "Professional assessment required", "Not a compliance certificate". | v3 adds many codes. Each has an edition, a scope (by type, plot area, connected load) and a local adoption status. Example: Telangana made ECBC mandatory for commercial buildings in 2014 (NRDC); a 2026 NITI Aayog assessment (via IMPRI) reports no state had yet adopted ECSBC 2024. | A five-step status enum on every rule pack result, set by data: edition in force by permit date, scope thresholds, and a state adoption table (TG first). It replaces any pass or fail wording. Lean already treats undecided rules as blocking; the ladder is just its plain-English face. | WP rules packs + core contract | S | now |
| 4.2 | **Edition by date, never "latest".** "Never assume the newest edition automatically applies to every existing property." | ECBC 2017 vs ECSBC 2024; ENS 2018 vs the ENS 2024 draft (BEE); Part L 2021 vs 2026. | Each rule carries `validFrom` and `validTo`. The building carries a permit or build year (unknown stays unknown: the ladder then shows "Local adoption must be confirmed"). | rules packs | S | now |
| 4.3 | **DOE prototype buildings as type templates.** The chat's code research surfaced DOE and PNNL prototypes: 16 commercial types (offices, hotels, schools, hospital, apartments), each with a scorecard of internal loads and schedules. | The owner needs eight types fast without inventing loads. The scorecards are documented, versioned per 90.1 edition, and match ready EnergyPlus models for validation. | Building-type packs take schedules, lighting and equipment power density, occupancy, hot water and outdoor air from the scorecards (international), and from ECBC 2017 / ECSBC default schedules (India). Labs are not a DOE type; mark labs PLACEHOLDER until a sourced profile (for example Labs21) is found. | home/building packs | M | now |
| 4.4 | **EUI target = code baseline vs proposed.** The chat asks for EUI targets; the codes it found define them through a reference building. | ECBC section 9 (Whole Building Performance) and its maximum EPI ratio tables by climate (warm and humid for Hyderabad) and ASHRAE 90.1 Appendix G give a defensible target. LEED energy points come from the same percentage improvement, so one calculation feeds both. | Engine runs the same building twice: as designed, and as the code's standard design (same geometry, code-minimum envelope and systems). Report the EPI ratio or percentage better, graded `estimate`. LEED-style points read from that one number. | engine + rules packs | L | now |
| 4.5 | **Overhangs credited the way the code does.** Projection factor and equivalent SHGC (ECBC 2017 Note 4-2). | The owner wants overhangs in the plan editor. The code already defines how an overhang changes effective SHGC by orientation, so overhang depth gets a code-native meaning beside the physics. | Overhang depth and height give the projection factor; show both the code SHGC credit and the modelled solar gain change. If they disagree, say so. | engine, UI plan editor | S | now |
| 4.6 | **Unit position inside a block.** The chat lists top-floor, mid-floor and end-of-block flats as different problems. | v3 adds apartments and rentals in a 3D city. One block holds many units with very different exposure. | In the city scene, a block is one geometry and each unit is a twin sharing walls, roof and shading. Tap a unit to see its own results. Ravi's flat becomes a unit, not a separate model. | scene + engine | M | later |
| 4.7 | **Roof rights flip the answer.** "Roof access and ownership rights can make a theoretically attractive solar installation infeasible." | Very common in Hyderabad flats: the roof belongs to the residents' association. A strong demo beat. | A feasibility rule: rooftop PV on a unit needs association consent (unknown until stated). Change it live and watch the front change. | rules-in | S | now |
| 4.8 | **Estate view with "ready to act" vs "survey first".** The chat's lender portfolio mode, recast. | v3 has a city and many buildings (IIIT hostels, WeWork offices). An estate manager asks which building to fix first. The chat's split of "finance-ready" vs "survey-required" maps cleanly to our evidence grades. | Rank buildings by improvement range and by data confidence; flag those whose answer depends on unknowns as "check first". No lender scoring, nothing leaves the device. | UI + engine | M | later |
| 4.9 | **India incentives pack.** The chat cites BEE financing schemes and State Designated Agencies. | Hyderabad focus needs local money rules the way the UK pack has grants. | A `money-in` incentives table (state agency, rooftop solar subsidy schemes) with sources and dates; graded and dated like any rule. Verify current scheme amounts before use. | money-in | S | later |
| 4.10 | **Event rules checklist (if the project is submitted).** The chat reports Megathon terms: MIT licence by default, a sponsor licence grant, an originality window, incremental commit history, AI disclosure and an `ai_chat.md`. The live site confirms only "say where AI was used in your code and in your final presentation". | The repo's first commit is 2026-10-10, inside the event. If it is entered, these rules bind. Note that AI disclosure may sit awkwardly with the current commit rule of no AI trailers; a disclosure document would satisfy both. | Owner decision, not an agent one. Read the full terms (linked from megathon.in) before submitting. | orchestrator | S | now (decision) |
| 4.11 | **Three questions as the evaluation spine.** Does building context change the decision? What do the formal checks catch, and what do they miss? Does memory stay consistent over a replay? | We test parts of each, but not as one stated report. With v3 breadth, a short evaluation page keeps claims honest. | `report/` section with one table per question: the naive catalogue recommender vs our search (v2 3.8), the mutation suite with a "missed by design" row (physics errors), and the memory replay. | report owner | S | later |
| 4.12 | **Unit checks for new quantities.** "Units are not silently mixed"; "rounding only at the presentation layer". | v3 adds EUI (kWh/m2 per year), lux, hours, W/m2, water (litres). | Extend the quantity types in `@ibasho/core` to these units so the compiler stops a lux value landing in a kWh slot. Quantise once, at the same boundary as today. | core | S | now |

Visual references the chat collected, for the scene and diagram owners (look, do not copy): Lloyds House cutaway illustration https://www.behance.net/gallery/30497971/Lloyds-House-Cutaway-Illustration ; solar radiation north vs south facade maps (Novatr) https://blog.novatr.com/hs-fs/hubfs/Rad_N-v-S_w-legend.png ; ETH "Neighborhood refresh" building physics section https://works.arch.ethz.ch/ ; shading ratio by facade orientation https://projectstasio.com/single_graphic/what-is-the-proper-level-of-shading-for-different-facade-orientations/ ; parametric classroom optimisation https://medium.com/generative-design-course/optimizing-the-global-classroom-137744a1110c .

## 5. Rejected (clash with the principles)

| Idea in the chat | Why not |
|---|---|
| Python, FastAPI and a server database | Breaks local-first and in-browser determinism. |
| ML property-price or savings prediction trained on synthetic labels | Numbers must come from documented models; synthetic-label accuracy proves nothing about real homes (the chat says so too). |
| Lender portfolio scoring and "finance-ready" badges | Implies credit judgement and data leaving the device. 4.8 keeps the useful part. |
| "Fastest payback" as a headline future | Simple payback ignores lifetime and replacement; keep NPV ranking and show payback. |
| Memory that alters the score or the physics | Memory may filter and rank only after the owner confirms it (AC-M2). |
| A single "global" energy code or a "compliant" badge | No such code exists; use the ladder (4.1). |
| sDA or ASE numbers from a simplified proxy | Overclaim; name it a proxy until LM-83 is implemented (section 3). |
| Ten persona agents with a "creative director" | We already split work by WP with ownership lint; personas add talk, not code. |
| Universal floor-plan parser or full BIM in the core | The chat parks it too; the parametric plan editor covers v3 needs. A plan import can come later as an untrusted input through `@ibasho/core/schemas`. |
| Causal "your home will be worth more" | Evidence supports a range only (R16). |

## 6. Sources

- Shared chat (data): https://chatgpt.com/share/6acabf24-06ec-83e8-9455-2f819e0e0c8f
- Megathon X site and FAQ: https://megathon.in/
- BEE residential code resources: https://beeindia.gov.in/show_content.php?lang=1&level=2&lid=328&ls_id=202
- Draft ENS 2024 (BEE): https://beeindia.gov.in/sites/default/files/Draft%20ENS-%20Residential%202024.pdf
- ECBC 2017 (local copy `docs/research/v3/sources/ecbc2017.pdf`): https://beeindia.gov.in/sites/default/files/publications/files/ECBC%20book%20final%20one%20%202017_0.pdf (section 9 WBP, Tables 9-5 to 9-9 EPI ratios, Note 4-2 projection factor)
- ECSBC 2024 adoption status (IMPRI, citing NITI Aayog): https://www.impriindia.com/?p=76060
- Lok Sabha answer on ECSBC and ENS (Feb 2025): https://eparlib.sansad.in/bitstream/123456789/2988768/1/AU1522_Kvvrlt.pdf
- Telangana ECBC mandate and Hyderabad compliance system (NRDC): https://www.nrdc.org/experts/implementing-ecbc-and-cool-roofs-telangana , https://www.nrdc.org/sites/default/files/getting-cities-climate-ready-the-story-of-indias-first-mandatory-energy-efficient-building-compliance-system-how-to-guide-in-five-steps_2018-09-10.pdf
- TS-bPASS: https://housing.com/news/ts-bpass-all-you-need-to-know/
- DOE and PNNL prototype buildings: https://www.energycodes.gov/technical-assistance/publications ; energy codes overview https://www.energycodes.gov/commercial-and-residential-building-energy-codes
- ASHRAE 90.1: https://www.ashrae.org/technical-resources/bookstore/standard-90-1-requirements-series
- Approved Document L: https://www.gov.uk/government/publications/conservation-of-fuel-and-power-approved-document-l
- EU EPBD: https://energy.ec.europa.eu/topics/energy-efficiency/energy-performance-buildings/energy-performance-buildings-directive_en
- EnergyPlus: https://energyplus.net/
- PNNL building assemblies: https://basc.pnnl.gov/building-assemblies
- BEE financing schemes: https://www.beeindia.gov.in/sites/default/files/1.%20BEE%20Financing%20Schemes.pptx
