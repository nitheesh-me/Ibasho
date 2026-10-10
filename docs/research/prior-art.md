# Ibasho: prior art, critique and demo scope

Research and critic brief. Date: 2026-10-10. Input: `report/M1.typ`.

## 0. Verdict in one screen

- The market is full of **retrofit estimators** (EPC style questionnaires, lender widgets, installer quoting tools). Almost all of them give one point estimate, from a model the user cannot see, against a baseline that is not checked against the user's real bills.
- Research says the three biggest errors in retrofit advice are **not** arithmetic. They are (1) the baseline is wrong (the prebound effect), (2) savings decay or are taken back as comfort, and (3) heat pump performance depends on the installation, not on the catalogue.
- So Ibasho's originality should not be "we prove the arithmetic". It should be: **"we show you how sure we are, we correct ourselves against your bills, and we prove that what we show is exactly what we computed."** Lean then guards the honesty layer (intervals, Pareto correctness, constraint memory), not just the weights.
- Demo scope: one UK home, five moments (Section 6). Everything else is a plugin for later.

## 1. Landscape of existing tools

| Tool | Audience | What it does well | What it does badly | Lesson for Ibasho |
|---|---|---|---|---|
| Parity Projects / Ecofurb (Cotality) Plan Builder, Pathways, Portfolio | Homeowners, councils, landlords | Whole house plans with cost, disruption, bills, carbon and EPC. National one stop shop. Used a photo and scan "digital twin" for remote quotes: installers replaced 2 hour visits with 20 minute calls. | Relies on estimated, not actual, bills. Market demand small: 30% enquiry to paid plan, 71% intent, but volumes far below forecast. Finance interest 23%, uptake 4%. Customers confused why a plan was needed over an EPC. | Accuracy is not the bottleneck; motivation and trust are. The plan must explain itself and feel worth having. |
| Kamma Retrofit Explorer / Green Home Optimiser | Lenders, brokers, borrowers | Transparent cost and return view embedded in a lender journey (Octopus Real Estate). | Lender framed, address level estimates, single scenario. | Finance hooks matter, but a normal customer needs comfort and certainty, not only ROI. |
| Furbnow Home Energy Plan | Homeowners (paid survey) | Assessor visit, cavity cameras, scans, sequencing, project management. | Paid and slow; reviews mention report errors needing correction. Static PDF. | A plan that recomputes when the owner changes their mind is valuable. |
| Domna (formerly Hestia), Ara | Housing associations | Postcode first remote screening at portfolio scale. | Portfolio, not person. | Postcode prefill is a good onboarding trick. |
| Energy Saving Trust Home Energy Check (white labelled by Barclays, Nationwide, Santander, Danske) | Everyone | 6 minute questionnaire; EPC like rating, bills, CO2, measure costs. States honestly that atypical homes get worse estimates. | Point estimates. No calibration. No interaction between measures visible. Generic. | Six minutes is the onboarding bar to beat. Copy its honesty sentence, then make the uncertainty visible. |
| EPC recommendations (RdSAP) | Statutory | Universal, cheap, standard. | Assessor variability (Gledhill et al.); 66% average error on pre-1945 homes in one study; 57% of industry respondents have little or no trust in EPC ratings. Reform to four headline metrics (fabric, heating system, smart readiness, energy cost) slipped to 2027. | Align with the four metric future, not the single band past. Be a better EPC, not another one. |
| Home Energy Model (HEM), DESNZ | Regulators, software vendors | Open source, modular Python, will replace SAP. | Hard to understand unless you read Python; CIBSE complained about missing documentation. Core via ECaaS for accredited schemes only. | Use HEM as a validation oracle for Ibasho's reduced order model. Be the readable layer HEM lacks. |
| Octopus heat pump quote (Cosy) | Homeowners | Instant online quote, BUS grant built in, SCOP shown at 50 and 65 C flow. | Users complain quotes give little more than a radiator table; designs at 50 C even when buyers ask for lower. | Flow temperature and emitters are the hidden variable that decides heat pump running cost. Make it visible and draggable. |
| Heat Punk, HeatLoss.js (OpenEnergyMonitor), Spruce | Installers, enthusiasts | Room by room heat loss (BS EN 12831). | Default air change rates overestimate heat loss in older homes. Expert only. | Room level geometry is the right grain for the 3D twin. Calibrate air leakage, do not assume it. |
| HeatpumpMonitor.org | Enthusiasts, researchers | Public, metered real world SPF. Top MID metered air source systems show SPF about 4.0. | Self selected, enthusiast biased. | Use as the "good installation" end of a real SPF range. |
| Electrification of Heat (ESC, DESNZ) | Policy | 742 monitored heat pumps; median ASHP SPF about 2.8 in interim data; high variation. | Not a tool. | Use as the "typical installation" end of the range. |
| BEopt / OpenStudio / ResStock (NREL) | Engineers, US stock analysis | Sequential search for least cost curve to zero energy; about 1000 options; EnergyPlus; HPXML. | Expert UI, US only, slow per run. | Proven idea: cost vs savings curve with near optimal alternatives. Ibasho's Pareto front is the consumer version. |
| PHPP / EnerPHit Retrofit Plan | Passivhaus designers | Step by step retrofit plan with investment and energy cost per step; calibrates well once actual use and climate are entered. | Spreadsheet, expert only. | Staged plans (step 1, step 2) and calibration with actual use are best practice. Neither is in M1. |
| CREST Demand Model (Loughborough) | Researchers | Open, 1 minute stochastic thermal electrical model with occupancy. | Excel VBA, network focus. | Occupancy diversity is a cheap way to show "people like you vary this much". |
| Google Solar API (Project Sunroof lineage) | Installers | 3D roof geometry, shade, flux rasters; UK in high quality tier; free monthly quota. | Solar only; API key. | Optional plugin for roof truth. The visual of sun on a roof is a proven wow. |
| Rewiring America calculators and APIs | US homeowners | Open source embeddable calculator; incentives API; bill and emissions model. | US only. | Good model of an open, embeddable, plugin friendly calculator. |
| Kuppa with Perenna; Santander, Barclays, Nationwide tools | Mortgage customers | Retrofit costs and savings inside a bank journey; 0.20% rate discount for heat pump or solar. | Thin, marketing led. | Banks want this. A clean, provable core is a credible white label engine later. |
| "Retrofit Navigator" (Magora) | Installers | Grant eligibility (ECO4, Warm Homes Local Grant, LA Flex). | Not consumer facing. | Grant eligibility is a feasibility plugin, not core. |

## 2. Research threads that matter

### 2.1 Pareto retrofit optimisation
- Systematic review of GA based retrofit optimisation: 57 studies; GAs are slow and often need hybrids; qualitative objectives (heritage) rarely handled (Carrapiço et al. 2020).
- NSGA-II case studies show fronts of 100 plus solutions. That is research output, not consumer output.
- BEopt uses sequential search and shows near optimal alternatives, because users want choice among equivalents.
- **Implication.** With a small discrete catalogue, exhaustive enumeration beats GAs and gives an exact front that can be **certified**. Show 3 named picks, but let the user scrub the whole front.

### 2.2 Reduced order physics
- EN ISO 52016-1 hourly (5R1C family) still lacks extensive validation; solar and external convection assumptions cause non negligible error vs EnergyPlus (De Luca et al. 2021).
- **Implication.** Claim ranking fidelity, not absolute accuracy. Validate rank order against HEM or EnergyPlus on archetypes.

### 2.3 The performance gap, prebound and rebound
- Prebound: older, less efficient homes use much less energy than their rating predicts (Sunikka-Blank and Galvin 2012, 3,400 German homes). One study of about 1,170 buildings found about minus 23% gap before retrofit and about plus 2% after. Consequence: savings and payback are overestimated for exactly the homes advice targets.
- Decay: cavity wall insulation in 55,000 English homes gave about 7% gas savings in year 1, 2.7% in year 2, negligible by year 4 (Peñasco and Anadon 2023). The authors later clarified that savings shrink rather than vanish; loft savings remain 4 to 5% after five years.
- Comfort take-back is real but saturates near 21 C indoor (Newcastle high rise study). Warm Front raised mean indoor temperature from 17.1 C to 19.0 C.
- **Implication.** The single most useful, least offered feature is **calibration against real bills plus an honest savings range**.

### 2.4 Heat pumps in the field
- Field median SPF about 2.8 (EoH interim), well designed metered systems about 4.0 (HeatpumpMonitor.org). That gap is larger than most measure to measure differences.
- Fabric first vs heat pump first is unresolved and building specific (Eyre et al., Oxford ECI: "understanding first").
- **Implication.** Do not fix COP. Make SPF a function of flow temperature, which is a function of emitters and fabric. This is the most important interaction effect to visualise.

### 2.5 LLMs and numeric advice
- Seven LLMs on 400 ResStock homes: top 1 retrofit match at most 54.5%, low agreement between models, weaker on payback than on CO2 (Shu and Zhao 2025).
- PAL: models decompose well but slip on arithmetic; delegate computation to an interpreter (Gao et al. 2023).
- **Implication.** M1's "LLM narrates only" is correct and supported by evidence. Go further: the narrator emits **references to computed values**, never literal numbers; the renderer substitutes them. Grounding then holds by construction.

### 2.6 Proof carrying code and Lean
- Proof carrying code: the consumer checks a proof shipped with the artifact instead of trusting the producer (Necula 1997).
- AWS Cedar: executable Lean model, proofs on the model, Rust in production, about 100 million nightly differential random tests between them. Proofs found 4 bugs; differential and property tests found 21 more.
- Lean `Float` is untrusted; verified work uses rationals, software floats, or conservative interval arithmetic (girving/interval, LeanCert).
- **Implication.** Copy Cedar's pattern exactly: Lean executable spec over rationals, TypeScript engine in the app, differential tests in CI. Ship **certificates** with each result (Pareto dominance witnesses, feasibility witnesses) that a small checker validates.

### 2.7 Digital twins of homes
- Reviews focus on commercial and existing building operation; residential, homeowner facing twins are a stated gap.
- Parity's pilot used a photo and scan twin for remote quoting with clear time savings.
- Apple RoomPlan produces parametric rooms (walls, windows, doors) as USDZ.
- **Implication.** A parametric, room level, editable twin for a homeowner is still open territory. Keep scanning as a future import plugin.

### 2.8 Explanation, storytelling and choice
- Explorable explanations: readers should be able to test the author's model by dragging (Bret Victor 2011). Reactive documents force the model into the open.
- Dami Lee (DamiLee channel, Nollistudio): human framing beats technical perfection; architecture told as story.
- Highlighting the best few options increased measure installs (17 vs 9) in a small Xcel field trial; choice overload meta analysis is mixed.
- Citizens Advice: only 2 in 5 homeowners interested; lack of personalised advice matters more than money. Santander: 64% do not know their EPC rating.
- **Implication.** Three named futures plus an explorable model, told as the story of one house, is the right shape.

## 3. What everyone does badly (synthesis)

1. **Point estimates.** Nobody shows a credible range or what it depends on.
2. **Uncalibrated baselines.** Bills are asked for, then ignored, or not asked for at all.
3. **Fixed heat pump efficiency.** Flow temperature and emitters are hidden.
4. **Static output.** A PDF or a results page. Change one assumption and you start again.
5. **No memory.** Rejected measures come back; owner constraints are re asked.
6. **Unexplained exclusions.** Users never see why an option is missing.
7. **Black box models.** Even the open one (HEM) is unreadable to the public.
8. **No sequencing over time.** Real retrofits happen in stages, often at trigger points (boiler failure, re roof, new tenancy).
9. **No tenure logic.** Landlord pays, tenant saves; MEES EPC C by October 2030 with a £10,000 cap is a hard constraint for landlords.
10. **Ugly or generic.** Retrofit tools look like tax forms. None tell the story of a house.

## 4. Where Ibasho can be genuinely original

| # | Idea | Why it is new | Lean role |
|---|---|---|---|
| O1 | **Calibrated twin.** Enter last year's bills (or drop a smart meter CSV). The model fits two or three parameters (internal temperature, air leakage, hot water) and shows the prebound correction. | Consumer tools ignore bills; PHPP does this only for experts. | Prove the calibration step preserves the energy balance identity. |
| O2 | **Honest intervals.** "Unknown is not zero" becomes interval inputs. Every output is a range. Defaulted inputs are visibly marked. | No consumer tool propagates input uncertainty. | Prove interval enclosure: for the linear heat balance, the computed range contains the result for every input in the declared box. This is a meaningful theorem, not bookkeeping. |
| O3 | **Certified Pareto front.** Each returned package carries a feasibility witness; each excluded package carries a dominating witness or the constraint it broke. | Optimisers show fronts; none prove them. | Prove: no returned package is dominated; every feasible excluded package is dominated by a returned one; checker is sound. |
| O4 | **Decision robustness.** Sweep prices, carbon factors, SPF and take-back. Show "this recommendation holds in 83% of futures" and the flip point ("best return changes if gas exceeds 10.5p/kWh"). | Tools show one future; decision under uncertainty is absent. | Prove monotonicity of savings in price for fixed energy deltas, so flip points are exact. |
| O5 | **Why not?** Tap any missing option to see what excluded it (budget, tenure, roof rights, moisture risk, the owner said no). | No tool explains exclusions. | Prove memory consistency: a rejected measure never appears in any later front. |
| O6 | **Flow temperature as a first class lever.** Drag radiator size or fabric and watch flow temperature, SPF and bills move together. | Hidden in installer quotes. | None needed; covered by property tests. |
| O7 | **Staged pathway.** Step 1 now, step 2 at boiler end of life, step 3 at re roof. | Only PHPP EnerPHit plans do this. | Prove each stage is feasible given the previous stage's state. |
| O8 | **Number receipts.** Every number is a link to its derivation: inputs with provenance (measured, stated, default), formula, version, proof badge. | M1 promised it; no market tool does it. | The badge points to the Lean theorem that covers the quantity. |
| O9 | **Narrator by reference.** The LLM writes text with slots like `{saving.gas.kwh}`; the renderer fills them. Literal numbers in LLM output are rejected. | Grounding by construction, not by after the fact matching. | Not Lean; enforced by a type in the TS core and a schema check. |
| O10 | **Storytelling twin.** A Dami Lee style isometric cutaway that narrates the house: where heat leaks, who pays, what each future looks like. | Retrofit tools are forms. | None. |

## 5. Ten M1 assumptions that might be wrong

| # | Assumption in M1 | Why it might be wrong | How to test | Pass condition |
|---|---|---|---|---|
| A1 | A documented reduced order model is good enough to recommend. | 52016 class models carry non negligible solar and convection errors. Absolute kWh may be off by tens of percent. | Run 12 UK archetypes through Ibasho and HEM (or EnergyPlus). Compare package **rank order** (Kendall tau) and absolute kWh. | Tau at least 0.8 on top 5 packages; absolute error reported, not hidden. |
| A2 | The modelled baseline is the home's real baseline. | Prebound: older homes use much less than predicted, so savings and payback are overstated. | Compare modelled baselines with NEED medians by age and type; run calibration on synthetic bills with known truth. | Calibrated savings move toward truth; UI shows the correction. |
| A3 | Savings equal before minus after, permanently. | Savings decay and comfort take-back (Peñasco and Anadon; Newcastle). | Add a take-back parameter tied to pre retrofit indoor temperature; show year 1 and year 5 ranges. | Recommendation stable or flip clearly explained. |
| A4 | Heat pump efficiency can be a constant. | Field SPF ranges about 2.8 to 4.0, driven by flow temperature. | Sweep SPF and flow temperature; check whether the "best return" pick flips. | Flip points surfaced in UI; SPF tied to emitters. |
| A5 | One Green Home Score with seven fixed weights helps a normal customer. | EPC reform moves to four headline metrics because one number hides trade offs. Weights are a value judgement; Lean proves they sum to 1, not that they are right. | Show score and its four metric breakdown in a 5 person hallway test; ask "what would you do next?". Sensitivity test the weights. | Users act on the breakdown; ranking stable under plausible weight changes. |
| A6 | "A better home never scores worse" is well defined. | "Better" needs a partial order. A heat pump can raise electricity cost under some tariffs while cutting carbon. | Define the order explicitly in Lean (componentwise on normalised sub scores). Property test random pairs. | Theorem stated over the explicit order; no counterexamples. |
| A7 | Six discrete measures, enumerated once, cover the decision. | Real choices include thickness, emitter upgrades, ventilation, tariffs, PV and battery, and timing. Interactions (ventilation with airtightness) matter. | Expand to about 12 measures with variants; check enumeration time and whether the front changes. Use pruning or branch and bound beyond 2^12. | Front stable or explained; under 200 ms in browser. |
| A8 | Feasibility is budget plus ownership. | Moisture risk (solid wall IWI is the highest risk measure), conservation areas, cylinder space, electrical supply, MEES £10,000 cap, installer availability. | Seed 10 edge homes (listed, solid wall, flat with no roof rights, landlord under MEES). | Each infeasible package names its constraint; no risky IWI without a moisture flag. |
| A9 | Fixed prices and carbon factors are fine. | Price cap changes quarterly (Oct 2026: 26.32p elec without VAT, 7.97p gas); time of use tariffs change heat pump economics; grid decarbonises over the measure's life. | Make tariffs and carbon trajectories plugins; compute lifetime carbon with a declining grid factor. | Lifetime figures cite the scenario; changing scenario recomputes in under 100 ms. |
| A10 | LLM grounding can be judged by matching numbers to results. | Numbers can be right while framing misleads (omitting a fuel increase, cherry picking the best year). Small local models drift more. | Narrator by reference (O9); add claim checks for sign, unit, comparison direction and omissions of any increased fuel. Red team with injected "claim 70% savings" notes. | Zero literal numbers from the LLM; every increased fuel mentioned; injection ignored. |

Two more worth watching: **cost is not the main barrier** (Citizens Advice; Parity finance uptake 4%), so design for trust and motivation first; and **Lean proofs over rationals do not cover the TypeScript Float64 engine**, so differential testing is mandatory, not optional.

## 6. Recommended demo: constrained but extraordinary

**Constraint.** One UK home (1930s semi detached, solid or unfilled cavity walls, gas boiler, owner occupier, with a landlord toggle). One climate (UK, with a regional weather file). Twelve measures. Templated narrator by default; WebLLM, Ollama and Claude as opt in adapters. Hyderabad cooling becomes a later climate plugin (India's Eco Niwas Samhita RETV gives a ready envelope metric).

### The five moments

| # | Moment | What the user sees | Why it is useful | What makes it "wow" |
|---|---|---|---|---|
| M1 | **The house opens** | Postcode prefill, 6 questions, then an isometric cutaway of their home assembles room by room. Heat leaves as warm light through each element, thickness proportional to watts. Unknowns shimmer. | They see where heat goes in under 2 minutes. Beats the 6 minute EST benchmark. | Dami Lee style cutaway, live physics, not an illustration. |
| M2 | **Your bills correct us** | "Add last year's bills." The model re fits; a ghost of the old estimate fades; a caption says "We over estimated your heating by 22%. Your savings are smaller than most tools would tell you." | Fixes the biggest known error (prebound). Builds trust by admitting it. | A tool that corrects itself in front of you is rare and memorable. |
| M3 | **Three futures** | The house splits into three: Cheapest, Best return, Lowest carbon. Each shows per fuel arrows (gas down, electricity up), a range, not a point. A scrubber walks the full Pareto front; the house morphs as you scrub. Staged pathway toggle shows step 1, 2, 3 over years. | Real choice without overload; interactions visible. | Morphing 3D futures on a scrubbable front. |
| M4 | **What if** | Drag radiators bigger: flow temperature drops, SPF rises, bills fall. Toggle "I rent" or "never internal wall insulation": front recomputes; rejected measure is remembered across visits. Price dial shows the flip point. Robustness meter: "holds in 83% of futures". | Answers the questions people actually ask installers. | Instant recompute with visible cause and effect. |
| M5 | **Pull any thread** | Tap any number: a receipt unfolds (inputs with provenance, formula, model version, Lean badge). Tap a missing option: "Why not? Breaks your £8,000 budget" or "Moisture risk on solid walls". Narrator speaks in plain words, numbers filled from the engine. | Every claim is checkable. Exclusions are explained. | Proof seals on numbers; the "why not" view. |

### Cut list (not in the demo)
- LiDAR or RoomPlan scanning (import plugin later).
- Live smart meter APIs (CSV drop is enough; n3rgy and Bright exist for later).
- Property value beyond an evidence banded note (Nationwide finds A/B premium of only about 1.6% to 2.8% vs D; showing a precise uplift would mislead).
- Grant eligibility engine (plugin later; schemes change often).
- Default WebLLM model download on first run (hundreds of MB or more; make it opt in).

### Demo success criteria
- First cutaway in under 2 minutes from cold start, offline.
- Any what if recomputes and re renders in under 150 ms.
- 100% of displayed numbers have a receipt.
- Pareto certificate checker passes on every result; differential tests (Lean spec vs TS engine) run in CI.
- A non expert can say, unprompted, what they would do first and why.

## 7. Notes for other specialists

- **Architecture.** Engine core is pure TS, deterministic, rational or interval aware. Plugins: climate, measure catalogue, tariff, carbon trajectory, feasibility rule, narrator, importer. Every plugin declares units and provenance.
- **Building science.** Room level heat balance, monthly or hourly 52016 style; SPF curve vs flow temperature; calibration of 2 to 3 parameters; take-back parameter; moisture risk flag for IWI.
- **AI.** Narrator by reference with slot schema; templated fallback is first class; memory stores constraints as typed facts, not chat text.
- **Optimisation.** Exhaustive enumeration with dominance pruning up to about 4,096 combinations; emit dominance and feasibility certificates.
- **Lean.** Theorems: weights sum to 1; score in [0, 100]; monotonicity over an explicit partial order; savings identity per fuel; interval enclosure for the linear balance; Pareto certificate soundness; memory consistency. Executable spec plus differential tests, Cedar style.
- **Design.** Isometric, narrative, warm. Unknowns rendered differently from knowns. Ranges as soft bands, not error bars.
- **Testing.** Mutation tests from M1 Section 4, plus archetype rank tests against HEM, calibration recovery on synthetic bills, and grounding red team.

## 8. Sources

Tools and market
- Parity Projects Empower OSS pilot case study (GHFA, Oct 2025): https://assets.publishing.service.gov.uk/media/690b3b01c22e4ed8b05184d2/Parity_Projects_Empower_OSS_GHFA_Pilot_Case_Study.pdf
- Haringey retrofit guide (Ecofurb with Parity): https://www.haringey.gov.uk/environment/climate/retrofit-design-guide/3-how-to-decide-right-measures
- Charlbury Home Comforts report (estimated vs actual bills): https://charlbury-tc.gov.uk/wp-content/uploads/2023/09/Home-Comforts-Report-accessible_AM.pdf
- Cotality Pathways: https://www.cotality.com/products/pathways
- Kamma Retrofit Explorer with Octopus Real Estate: https://www.mortgagesolutions.co.uk/news/2024/04/26/octopus-real-estate-implements-kammas-retrofit-tool/
- Kamma Green Home Optimiser GHFA discovery report: https://assets.publishing.service.gov.uk/media/689b6389f0202b0e033f5ea5/Kamma_Green_Home_Optimiser_GHFA_Discovery_Report.pdf
- Kamma Retrofit Explorer for lenders: https://www.kammadata.com/news/mortgage-lenders/2024/05/the-best-home-retrofit-planning-tool-for-mortgage-lenders-retrofit-explorer/
- Furbnow via Surrey CC one stop shop: https://www.surreycc.gov.uk/community/climate-change/residents/home-energy/one-stop-shop
- Furbnow reviews: https://nl-be.trustpilot.com/review/furbnow.com
- Domna (formerly Hestia): https://netzerocompare.com/software/domna-retrofit-software and https://sifted.eu/articles/domna-raises-70m
- Energy Saving Trust tool via Barclays: https://barclays.co.uk/sustainability/greener-homes/home-energy-tool
- EST tool via Nationwide: https://nationwide.co.uk/about-us/greener-homes/home-energy-efficiency-tool
- Snugg Pro: https://snuggpro.com/ and https://www.franklinenergy.com/technology/snugg-pro
- Octopus Cosy heat pump: https://octopus.energy/cosy-heat-pump/
- Octopus quote experiences (flow temperature complaints): https://community.openenergymonitor.org/t/octo-confused-ensuring-right-size-heatpump-long-term-effeciency/30017
- Nesta heat pump cost estimator: https://www.nesta.org.uk/project-updates/a-calculator-to-estimate-the-cost-of-a-heat-pump/
- Retrofit Navigator (Magora): https://magora-systems.com/grant-eligibility-platform/
- Perenna and Kuppa tool: https://ifamagazine.com/perenna-teams-up-with-kuppa-to-bring-transparency-to-retrofitting/
- Rewiring America APIs: https://www.rewiringamerica.org/newsroom/press-releases/API and https://github.com/rewiringamerica/api.rewiringamerica.org
- Google Solar API overview: https://developers.google.com/maps/documentation/solar/overview
- Google Solar API release notes: https://developers.google.com/maps/documentation/solar/release-notes
- Heat pump calculators (OpenEnergyMonitor, HeatLoss.js): https://docs.openenergymonitor.org/heatpumps/tools.html
- Room by room heat loss notes: https://trystanlea.org.uk/roombyroomheatloss
- Spruce estimates: https://spruce.eco/estimates

Models and standards
- BEopt: https://beopt.nrel.gov and ACEEE 2006 paper https://www.aceee.org/files/proceedings/2006/data/papers/SS06_Panel2_Paper03.pdf
- ResStock architecture: https://resstock.readthedocs.io/en/latest/basic_tutorial/architecture.html
- PHPP and EnerPHit Retrofit Plan: https://passipedia.org/planning/refurbishment_with_passive_house_components/overall_retrofit_plan_for_step-by-step_retrofits_to_enerphit_standard
- CREST Demand Model: https://repository.lboro.ac.uk/articles/dataset/CREST_Demand_Model_v2_0/2001129
- Home Energy Model (CIBSE Journal): https://www.cibsejournal.com/?p=32374
- HEM consultation response (Elmhurst): https://www.elmhurstenergy.co.uk/blog/2025/10/02/desnz-release-home-energy-model-consultation-response/
- HEM methodology for existing dwellings and new EPC metrics: https://www.gov.uk/government/consultations/home-energy-model-energy-performance-certificates/home-energy-model-hem-methodology-for-assessing-existing-dwellings-and-producing-new-energy-performance-certificates-metrics-accessible-webpage
- EPC reform partial government response: https://gov.uk/government/consultations/reforms-to-the-energy-performance-of-buildings-regime/outcome/reforms-to-the-energy-performance-of-buildings-regime-partial-government-response
- EPC open data: https://mhclgdigital.blog.gov.uk/2024/01/29/changes-to-the-energy-performance-certificates-open-data-service
- EN ISO 52016-1 validation (De Luca et al. 2021): https://ideas.repec.org/a/gam/jeners/v14y2021i20p6841-d659870.html
- Eco Niwas Samhita 2024: https://www.beeindia.gov.in/sites/default/files/BEE_ENS_2024.pdf
- MEES EPC C by 2030: https://www.elmhurstenergy.co.uk/blog/2026/01/22/domestic-private-rented-properties-required-to-meet-epc-band-c-by-october-2030/
- Ofgem price cap Oct to Dec 2026: https://ofgem.gov.uk/news/changes-energy-price-cap-between-1-october-and-31-december-2026
- Carbon Intensity API: https://carbonintensity.org.uk/

Evidence on performance
- EPC assessor variability (Gledhill et al.): https://emerald.com/insight/content/doi/10.1108/IJBPA-10-2022-0167/full/html
- EPC accuracy on old buildings: https://theconversation.com/how-we-measure-energy-efficiency-in-homes-isnt-working-162565
- National Retrofit Hub, Future of EPCs: https://nationalretrofithub.org.uk/wp-content/uploads/2026/06/NRH-The-Future-of-EPCs.pdf
- Prebound effect: https://www.cam.ac.uk/research/news/the-prebound-effect
- Calculated vs measured consumption (eceee 2017): https://proceedings.eceee.org/docs/2017/8-185-17_Hoerner.pdf
- Peñasco and Anadon, savings decay: https://www.energy.cam.ac.uk/node/6381 and clarification https://ideas.repec.org/a/eee/eneeco/v139y2024ics0140988324006546.html
- Temperature take-back, Newcastle high rise: https://pureportal.coventry.ac.uk/en/publications/effects-of-fabric-retrofit-insulation-in-a-uk-high-rise-social-ho/
- DESNZ comfort taking evidence review annex: https://assets.publishing.service.gov.uk/media/69b1421458d4ef5adaf0e42d/comfort-taking-evidence-review-analytical-annex.pdf
- Electrification of Heat results: https://es.catapult.org.uk/news/heat-pumps-shown-to-be-three-times-more-efficient-than-gas-boilers/
- HeatpumpMonitor.org: https://docs.openenergymonitor.org/heatpumpmonitor/introduction.html
- Fabric first debate (Oxford ECI): https://www.eci.ox.ac.uk/news/think-first-fabric-first
- DEEP synthesis report (solid wall risk, PAS 2035 origin): https://assets.publishing.service.gov.uk/media/671f61e4ae0462c448fc4074/1._DEEP_Synthesis_Report.pdf
- Nationwide EPC price premium: https://old.landlordtoday.co.uk/breaking-news/2024/8/only-small-premiums-for-homes-with-better-epcs-finds-nationwide
- Retrofit optimisation review (Carrapiço et al.): https://discovery-pp.ucl.ac.uk/10088815/1/SystematicReview_Manuscript_Revised_Production.pdf
- Digital twins for thermal comfort and energy (review, 2024): https://doaj.org/article/6ac414ed73b24a558b508308caa4cf37

People, behaviour and trust
- Citizens Advice, demand for net zero: https://www.citizensadvice.org.uk/Global/CitizensAdvice/Energy/Demand_%20Net%20Zero.pdf
- Santander report on retrofit awareness: https://todaysconveyancer.co.uk/santander-report-urges-government-action-home-retrofitting-tackle-climate-crisis/
- Highlighting best options field trial (ACEEE 2014): https://www.aceee.org/files/proceedings/2014/data/papers/7-716.pdf
- Choice overload meta analysis (Scheibehenne et al. 2010): https://abcwest.cogs.indiana.edu/pmwiki/pdf/scheibehenne.options.2010.pdf
- Explorable Explanations (Bret Victor): https://worrydream.com/ExplorableExplanations/
- Dami Lee on storytelling (AIA25): https://www.aia.org/article/dami-lee-encouraged-architects-harness-power-storytelling-aia25
- Dami Lee interview: https://madamearchitect.org/interviews/2023/8/24/dami-lee

AI, verification and runtime
- LLMs for retrofit decisions (Shu and Zhao): https://arxiv.org/abs/2509.06307v1
- PAL, program aided language models: https://arxiv.org/abs/2211.10435v2
- WebLLM: https://arxiv.org/abs/2412.15803
- Proof carrying code (Necula 1997): https://courses.grainger.illinois.edu/cs421/fa2010/papers/necula-pcc.pdf
- Cedar verification guided development: https://arxiv.org/pdf/2407.01688 and https://lean-lang.org/use-cases/cedar/
- Conservative interval arithmetic in Lean: https://reservoir.lean-lang.org/@girving/interval
- Flean (IEEE 754 in Lean 4): https://reservoir.lean-lang.org/@josephmckinsey/flean
- Apple RoomPlan: https://developer.apple.com/augmented-reality/roomplan
- Smart meter data access (Bright): https://apps.apple.com/app/id1369989022
