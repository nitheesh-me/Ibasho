# Score and Finance Brief

Owner: Finance and Scoring specialist. Status: research brief v1, 10 October 2026.
Scope: the Green Home Score, the EPC band mapping, the indicative property value range, payback, NPV, IRR, grants and finance, and the landlord view.
Parent plan: `report/M1.typ`.

Every policy figure below was checked against a source dated 2024 to 2026. Policy changes fast, so every figure lives in a versioned data pack with a `validFrom`, a `validTo` and a source URL. Nothing is hard coded in logic.

---

## 1. Decisions at a glance

| # | Decision | Why |
|---|---|---|
| D1 | Seven indicators, fixed rational weights, sum exactly 1 | Lean proves it with `norm_num` over ℚ |
| D2 | Weights are global. Anchors (best/worst values) are per climate pack | One score meaning; UK terrace and Hyderabad flat use their own physics ranges |
| D3 | Each indicator is a clamped linear map to [0, 100] | Bounds and monotonicity follow from two lemmas |
| D4 | Two bands shown: "Ibasho band" from the score, "Estimated EPC band" from a SAP-style cost proxy | The score is not SAP. Lenders and MEES use SAP. Mixing them would mislead |
| D5 | Property value is a range from a published evidence table, never a point | Studies disagree by 10x. Honest spread beats false precision |
| D6 | Value uplift is never added to NPV by default | It partly capitalises the same bill savings. Adding both double counts |
| D7 | "Best return" on the Pareto front means highest NPV, not IRR | IRR misranks packages of different size |
| D8 | Real terms, default 3.5% real discount rate, user can set their own | Matches current Green Book; review proposes 3.0%, kept as a data pack switch |
| D9 | Grants are plugins with eligibility, stacking and expiry rules | Schemes open and close every year; GBIS already closed |
| D10 | India gets no value range | No credible hedonic evidence found. We say so on screen |

---

## 2. The Green Home Score

### 2.1 Indicators and weights

| Key | Indicator | Physical input (from the twin) | Direction | Weight |
|---|---|---|---|---|
| `F` | Fabric quality | Heat loss parameter HLP = HTC / floor area (W/m²K) | lower is better | 1/5 (0.20) |
| `C` | Carbon intensity | Operational kgCO₂e per m² per year, all fuels | lower is better | 1/5 (0.20) |
| `E` | Energy intensity | Delivered kWh per m² per year, all fuels, net of on-site use | lower is better | 3/20 (0.15) |
| `A` | Running-cost affordability | Net annual energy cost as share of household income (or £/m² fallback) | lower is better | 3/20 (0.15) |
| `H` | Heating system | Heat delivery primary efficiency η_pe = seasonal efficiency / primary energy factor of its fuel | higher is better | 1/10 (0.10) |
| `R` | Renewables and flexibility | On-site renewable fraction plus smart readiness points | higher is better | 1/10 (0.10) |
| `T` | Thermal comfort and resilience | Modelled overheating hours and cold hours | lower is better | 1/10 (0.10) |

Sum: 4/20 + 4/20 + 3/20 + 3/20 + 2/20 + 2/20 + 2/20 = 20/20 = 1.

Why these seven:

- The UK EPC reform will lead domestic EPCs with four headline metrics: **fabric performance, heating system, smart readiness, energy cost**, with energy use and carbon as secondary ([Mayer Brown, May 2026](https://www.mayerbrown.com/insights/publications/2026/05/reforming-the-energy-performance-of-buildings-regime---new-uk-government-proposals); [GOV.UK partial response](https://gov.uk/government/consultations/reforms-to-the-energy-performance-of-buildings-regime/outcome/reforms-to-the-energy-performance-of-buildings-regime-partial-government-response)). Our F, H, R and A map directly onto those four. That makes the score future-aligned rather than a copy of SAP 2012.
- Fabric and carbon carry the most weight. Fabric is the slowest, most durable asset and the proposed MEES route is "fabric first" ([Strutt and Parker](https://rural.struttandparker.com/article/in-the-know-understanding-the-proposed-domestic-epc-and-mees-reforms/)). Carbon is the purpose of the whole exercise.
- Energy intensity is deliberately lighter. It correlates with carbon and cost, so a high weight would triple count the same kWh.
- Comfort is in the score because the Hyderabad top-floor flat problem is heat gain, not heat loss. A score that ignores overheating would reward airtight, glazed homes that cook in May.
- Water and flood resilience were considered and rejected as a weighted indicator. The data is rarely available for a normal home. They ship as an **unweighted side indicator plugin** so the seven weights stay fixed.

### 2.2 Normalisation

For a lower-is-better indicator x with climate-pack anchors `best < worst`:

```
s(x) = 100 * clamp( (worst - x) / (worst - best), 0, 1 )
```

For higher-is-better, swap the roles: `s(x) = 100 * clamp((x - worst) / (best - worst), 0, 1)` with `worst < best`.

Composite score:

```
S = Σ_i w_i * s_i        w = (F 1/5, C 1/5, E 3/20, A 3/20, H 1/10, R 1/10, T 1/10)
```

Composite sub-indicators (R and T) are built from the same clamp so the same lemmas apply:

- `R = 100 * clamp( 0.75 * min(1, f_ren / f_target) + 0.25 * k_smart / 4, 0, 1 )`
  where `f_ren` = annual on-site renewable generation / annual delivered demand, and `k_smart` ∈ {0..4} counts: smart meter, time-of-use tariff, battery, controllable heat or EV load.
- `T = 100 * clamp( 1 - 0.6 * h_hot / H_hot - 0.4 * h_cold / H_cold, 0, 1 )`
  `h_hot`: occupied hours above the CIBSE TM59 style threshold (bedrooms above 26 °C at night, living rooms above the adaptive limit). `h_cold`: occupied hours below 18 °C, the WHO minimum indoor temperature recommendation.
- `A`: if income is known, burden `b = net cost / net income`. If not, cost per m². The mode is fixed per home, so all packages for one home use the same mode. The monotonicity theorem is stated for a fixed mode.

### 2.3 Anchors by climate pack (v1 defaults, editable)

| Indicator | UK pack best | UK pack worst | India (warm-humid / composite) best | worst |
|---|---|---|---|---|
| F: HLP (W/m²K) | 0.8 | 4.0 | 0.6 | 3.0 (roof and glazing gain dominate; use cooling-weighted UA) |
| C: kgCO₂e/m²·yr | 0 | 80 | 0 | 60 |
| E: kWh/m²·yr delivered | 40 | 400 | 10 | 120 |
| A: cost burden | 2% | 12% | 2% | 12% |
| A fallback: £ or ₹ per m²·yr | £6 | £40 | ₹40 | ₹400 |
| H: η_pe | 2.5 | 0.4 | 2.5 | 0.4 |
| R: f_target | 0.5 | n/a | 0.8 (sunnier) | n/a |
| T: H_hot / H_cold (h) | 300 / 1000 | | 600 / 200 | |

Anchor reasoning, UK:

- A typical UK home uses about £1,723 of energy a year at the October 2026 cap ([Uswitch](https://www.uswitch.com/gas-electricity/news/october-energy-price-cap-to-increase-by-four-percent/)), around £19/m² on 90 m². That lands mid-scale on the fallback A anchors.
- The 12% worst burden echoes the old 10% fuel poverty definition with headroom. The 2% best is a well-insulated, heat pump plus PV home.
- η_pe examples: gas condensing boiler 0.88/1.13 ≈ 0.78; direct electric 1.0/1.5 ≈ 0.67; heat pump SCOP 3.0/1.5 = 2.0. This makes the H indicator honest about resistive heating, which SAP treats unkindly for cost reasons and our C indicator treats kindly as the grid decarbonises. Primary energy factors and carbon factors come from the current DESNZ conversion factors in the data pack, with an optional grid trajectory plugin for lifetime carbon.

### 2.4 What Lean proves about the score

Let `I` be the indicator vector. Define dominance `I' ⪰ I` when every lower-is-better input is ≤ and every higher-is-better input is ≥.

| Theorem | Statement | Proof shape |
|---|---|---|
| `weights_sum_one` | Σ w_i = 1 over ℚ | `norm_num` |
| `weights_nonneg` | ∀ i, 0 ≤ w_i | `decide` / `norm_num` |
| `clamp_bounds` | 0 ≤ clamp01 y ≤ 1 | `min`/`max` lemmas |
| `subscore_bounds` | 0 ≤ s_i ≤ 100 | from clamp |
| `score_bounds` | 0 ≤ S ≤ 100 | convex combination of bounded terms |
| `subscore_antitone` | best < worst → x ≤ x' → s(x') ≤ s(x) | clamp is monotone, division by positive |
| `score_monotone` | I' ⪰ I → S(I) ≤ S(I') | sum of monotone terms with nonneg weights |
| `band_monotone` | S ≤ S' → band S ≤ band S' | band is a step function over sorted thresholds |
| `anchors_valid` | every shipped climate pack has best ≠ worst with correct orientation | `decide` on the data pack, generated from JSON |

Honest boundary: Lean proves "a home that is better on every indicator never scores worse". It does not prove that a heat pump improves every indicator. A heat pump can raise electricity cost while cutting carbon. The score can then go either way, and the UI shows which sub-scores moved and why.

---

## 3. Mapping to A to G

### 3.1 Two bands, clearly labelled

Current EPC bands use the SAP rating thresholds: A 92+, B 81 to 91, C 69 to 80, D 55 to 68, E 39 to 54, F 21 to 38, G 1 to 20. The English Housing Survey tables confirm B to G and group A/B at 81 to 100 ([UK Housing Review](https://www.ukhousingreview.org.uk/ukhr24/tables-figures/pdf/24-024.pdf)); the 92 threshold for A is from the EPC graphic itself.

| Output | Computed from | Label in UI | Used for |
|---|---|---|---|
| Ibasho band | Green Home Score S mapped onto the same thresholds | "Ibasho band B" | Story, comparison, the hero number |
| Estimated EPC band | SAP 2012 style cost rating from modelled costs at SAP standard fuel prices | "Likely EPC: C (could be B or D)" | MEES compliance, lender offers, value range |

The SAP-style proxy follows the published SAP 2012 form:

```
ECF = 0.42 * total_cost_at_SAP_prices / (TFA + 45)
SAP = 117 - 121 * log10(ECF)    if ECF >= 3.5
SAP = 100 - 13.95 * ECF         if ECF <  3.5
```

It is a proxy, not an EPC. Every display shows ±1 band uncertainty when the SAP proxy lies within 3 points of a threshold. SAP is due to be replaced by the Home Energy Model ([gov.scot stock model research](https://www.gov.scot/publications/energy-performance-buildings-scotland-regulations-2025-stock-model-research/)), so the proxy is a plugin (`epc-proxy/sap2012`) with a slot for `epc-proxy/hem` and for the reformed four-metric EPC.

### 3.2 India

There is no EPC. The BEE residential star label uses an Energy Performance Index with climate-zone thresholds; for composite climate, 1 star is 52 < EPI ≤ 60 and 5 star is EPI ≤ 29 ([BEE schedule](https://www.beeindia.gov.in/sites/default/files/Schedule%20-%20Residential%20building%20labelling.pdf)). That schedule ran to 31 December 2024 and we found no confirmed successor. India pack shows the Ibasho band plus an "indicative BEE star" plugin, marked as based on an expired schedule.

---

## 4. Property value: an honest range

### 4.1 The evidence disagrees, and that is the finding

| Source | Method | Headline |
|---|---|---|
| Nationwide, June 2026 ([release](https://www.nationwide.co.uk/media/hpi/reports/energy-efficiency-ratings-have-limited-impact-on-owner-occupied-house-prices-despite-increased-interest-in-going-green)) | Hedonic, England, controls for property traits | A/B +1.6% vs D (≈ £4,500); C, D, E little difference; F/G −1.4%. Buy-to-let A/B +12.2% |
| Nationwide, Aug 2024 ([Landlord Today](https://old.landlordtoday.co.uk/breaking-news/2024/8/only-small-premiums-for-homes-with-better-epcs-finds-nationwide)) | Hedonic | A/B +2.8% vs D; F/G −4.2% |
| Rightmove Greener Homes 2023 ([Mortgage Solutions](https://www.mortgagesolutions.co.uk/mortgage-news/2023/07/28/upgrading-homes-to-epc-c-could-attract-price-premium-of-nearly-56000-rightmove/)) | Repeat sales, ~300k homes, asking prices | D→C +3%, E→C +7%, F→C +15% (£55,786) |
| Rightmove 2021 ([Rightmove hub](https://hub.rightmove.co.uk/green-upgrades-help-sellers-pocket-up-to-16-more-for-their-home/)) | Repeat sales, 200k homes, price per sq ft | F→C +16%, E→C +8%, D→C +4% |
| Knight Frank 2022 ([Knight Frank](https://knightfrank.com/skireport/2022-10-11-improving-your-epc-rating-could-increase-your-homes-value-by-up-to-20)) | Repeat sales | D→C +3%, E→C +8.8%, F/G→C up to 20% |
| DECC / Cambridge 2013 ([GOV.UK](https://www.gov.uk/government/news/energy-saving-measures-boost-house-prices); [Cambridge](https://www.enterprise.cam.ac.uk/news/the-link-between-energy-efficiency-and-property-values/)) | Repeat sales, 325k dwellings, 1995 to 2011 | vs G: E/F +6%, D +8%, C +10%, A/B +14%. Regions 7% to 38% |
| Wales study ([Cambridge repository](https://www.repository.cam.ac.uk/handle/1810/283349)) | Hedonic | A/B +12.8%, C +3.5% vs D |
| MoneySuperMarket 2018 ([Ideal Home](https://www.idealhome.co.uk/news/epc-boost-property-value-211735)) | Press summary, method unclear | D→A/B up to £24k; G→A/B +14% |
| Savills 2022 ([Savills](https://www.savills.co.uk/insight-and-opinion/savills-news/327804-0/buyers-paying-significantly-more-for-homes-with-low-carbon-technology--as-energy-prices-rise)) | Regional average comparison | Heat pump homes 59% above regional average: confounded by size and type, **not used** |
| McCord et al. 2024, rents ([J. Property Research](https://ideas.repec.org/a/taf/jpropr/v41y2024i3p251-275.html)) | Hedonic, rents | B +8.2%, C +2.4%; E/F/G −3.9% to −5.5% |

Why they disagree. Repeat-sales studies capture homes that improved their EPC, and those homes were often renovated in other ways at the same time (kitchen, extension, loft). That inflates the apparent green premium. Hedonic studies with rich controls (Nationwide) find small effects. The newest, best-controlled estimate is the smallest. We lean low.

### 4.2 Ibasho evidence table v1 (owner-occupier, England and Wales)

Value index relative to band D, in percent:

| Band | Low | Central | High |
|---|---|---|---|
| A/B | +1.6 | +3.5 | +10.0 |
| C | 0.0 | +1.0 | +3.5 |
| D | 0 | 0 | 0 |
| E | 0.0 | −1.0 | −4.0 |
| F | −1.4 | −3.0 | −12.0 |
| G | −1.4 | −5.0 | −15.0 |

Low tracks Nationwide 2026. High tracks Rightmove/Knight Frank repeat sales and the Wales study. Central sits near Nationwide 2024 and DECC 2013 rebased to D.

Uplift for a move from band b0 to b1 with current value V:

```
uplift_k = V * ( (1 + P_k(b1)) / (1 + P_k(b0)) - 1 )      k ∈ {low, central, high}
```

Example: £280,000 home, estimated EPC F → C. Low +£3,976, central +£11,546, high +£49,318. Displayed as "about £4k to £49k, most likely near £12k".

Invariant ("steeper column"): for every adjacent band step, the ratio (1+P(b+1))/(1+P(b)) satisfies low ≤ central ≤ high. We checked this by hand for v1, and Lean checks it by `decide` on the generated table. From it, Lean proves `uplift_low ≤ uplift_central ≤ uplift_high` for every upward move. A data edit that breaks the ordering fails the build.

Separate columns ship for buy-to-let value (Nationwide 2026: A/B +12.2%) and for rent (McCord 2024). Scotland and Northern Ireland use the same table with a "less evidence" flag.

### 4.3 Rules for showing value

1. Value is driven by the **estimated EPC band**, not the Ibasho score, because buyers see EPCs.
2. If the band does not change, show "no measurable value effect expected". Do not invent a within-band premium.
3. Always a range, always the phrase "homes like this have sold for", never "your home will be worth".
4. V comes from the owner. If unknown, use a regional average and say so.
5. India: no range. The UI says "No reliable Indian evidence on green home prices yet." Context only: a 2024 survey of Tier-1 buyers reports stated willingness to pay 5% to 10% ([Xynteo Build Ahead](https://xynteo.com/sites/default/files/download/2024/04/Consumer%20Survey%20-%20Build%20Ahead%20-%20March%202024.pdf)). Stated intent is not a sale price.

---

## 5. Per-package financial outputs

### 5.1 Inputs per package

| Symbol | Meaning | Source |
|---|---|---|
| `C0 = (lo, mid, hi)` | Gross installed cost incl. VAT | measure cost plugin, scaled by twin geometry |
| `G` | Grants and cashbacks that pass eligibility and stacking | grant plugins (section 6) |
| `ΔE_f` | Signed annual delivered energy saving per fuel f (kWh) | physics engine, recomputed for the whole package |
| `p_f` | Unit price per fuel | tariff plugin (UK cap Oct to Dec 2026: electricity 26.32p/kWh, gas 7.97p/kWh) |
| `ΔSC` | Standing charge change | e.g. disconnecting gas saves 29.68p/day ≈ £108/yr |
| `X` | Export income = exported kWh × export rate | export plugin (SEG fixed rates 1p to 16p/kWh, Outgoing Octopus 12p from March 2026) |
| `ΔO&M` | Change in maintenance | measure plugin |
| `A_cf` | Avoided counterfactual replacement (e.g. boiler at end of life) | asked of owner: "Is your boiler over 12 years old?" |
| `T_m` | Measure lifetime | measure plugin (Ofgem ECO lifetimes where available) |
| `g_f` | Real price escalation per fuel | scenario: −1%, 0% (central), +2% |
| `d` | PV degradation | 0.5%/yr default |
| `r` | Real discount rate | default 3.5%, user editable |
| `H` | Analysis horizon | 25 years |
| Loan | principal L, APR, term n | finance plugin |

Prices come from the [Ofgem cap as reported for October 2026](https://www.uswitch.com/gas-electricity/news/october-energy-price-cap-to-increase-by-four-percent/) and export rates from [Which?](https://www.which.co.uk/reviews/solar-panels/article/smart-export-guarantee-explained-at2wh8b519s2) and [Solar Energy UK](https://solarenergyuk.org/resource/smart-export-guarantee/).

### 5.2 Output definitions

| Output | Definition | Edge cases |
|---|---|---|
| Net upfront cost | `N0 = max(0, C0 − G − A_cf)` | A_cf only when owner confirms replacement is due |
| Year-t net saving | `B_t = Σ_f ΔE_f,t · p_f · (1+g_f)^t + ΔSC + X_t − ΔO&M` | Can be negative per fuel. Shown signed |
| Simple payback | `N0 / B_1` | "Never" if B_1 ≤ 0. "Immediate" if N0 = 0 |
| Discounted payback | least t with `Σ_{k≤t} B_k/(1+r)^k ≥ N0` | "Not within horizon" |
| NPV | `−N0 + Σ_{t=1..H} B_t/(1+r)^t − Σ replacements_t/(1+r)^t + RV/(1+r)^H` | RV = linear residual value of measures with T_m > H |
| IRR | r* with NPV(r*) = 0, bisection on (−0.99, 1.0) | Reported only if cash flows change sign exactly once (then unique). Otherwise "n/a" |
| Lifetime carbon saved | `Σ_t Σ_f ΔE_f,t · EF_f,t` (tCO₂e) | EF_f,t from grid trajectory plugin |
| Cost of carbon abated | `−NPV / lifetime tCO₂e` when NPV < 0 | Negative means it pays for itself |
| Monthly cash view | loan repayment `M = L·i / (1 − (1+i)^−n)` vs `B_1/12` | "Cash positive from month 1" flag |
| Score delta | ΔS and each Δs_i | Lean: savings = before − after |
| Band delta | Ibasho band and estimated EPC band, before and after | ±1 band uncertainty flag |
| Value range | section 4 | Separate from NPV |
| Comfort delta | Δh_hot, Δh_cold | Physics model hours, labelled modelled |
| Uncertainty | low / central / high for N0, B_1, NPV | Interval pass plus 2,000-sample Monte Carlo |

The "cash positive from month 1" flag revives the Green Deal Golden Rule (savings ≥ repayments) as a plain-language test. It is the single most persuasive number for a normal customer.

### 5.3 Pareto front definitions

| Pick | Objective | Tie break |
|---|---|---|
| Cheapest | min N0 among packages that reach the owner's target (band or ΔS) | higher NPV |
| Best return | max NPV at the owner's r | lower N0 |
| Lowest carbon | max lifetime tCO₂e saved | higher NPV |

IRR is shown but never used to rank. A £400 loft top-up can have an IRR of 60% and an NPV smaller than a £12,000 package with an IRR of 6%.

### 5.4 Discount rate

- Default: **3.5% real**, the current Green Book Social Time Preference Rate for years 0 to 30 ([Green Book discounting guidance](https://assets.publishing.service.gov.uk/media/698488ab2df808759a7bd70f/Green_Book_supplementary_guidance_-_discounting.pdf)).
- The 2026 Green Book discount rate review recommends a 3.0% real rate for standard projects (2% risk-free plus 1% systematic risk) ([Findings and Recommendations](https://assets.publishing.service.gov.uk/media/6a43915e7ac6fd9c6a94abbe/Findings_and_Recommendations_-_Green_Book_Discount_Rate_Review.pdf)). Not yet adopted as guidance in our sources, so it ships as a switch, not the default.
- A household is not HM Treasury. Settings offer "Society view 3.5%", "My savings rate" and "My loan APR" (converted to real with the data pack inflation assumption). Sensitivity strip always shows NPV at 0%, 3.5% and 7%.

### 5.5 Known biases we correct for

- **Prebound effect.** Low-rated homes use far less energy than models predict, because occupants heat less ([Sunikka-Blank and Galvin 2012](https://doi.org/10.1080/09613218.2012.690952)). Modelled savings for F/G homes are then overstated. If the owner gives meter readings, the twin calibrates the baseline and the savings shrink to match. Without meters, the low case applies a prebound discount.
- **Performance gap.** Heat pump SCOP range 2.5 to 3.5 in the low/high cases.
- **Marginal tariffs.** Savings use marginal, not average, prices. This matters most in India (section 7).
- **VAT.** 0% VAT on energy-saving materials and solar until 31 March 2027. Costs after that date switch back to 20% automatically through `validTo`.

---

## 6. Grants and finance plugins (UK)

Each plugin implements `eligible(home, owner, package, date) → {amount, conditions, stacksWith, evidenceUrl, confidence}`.

| Plugin | Status Oct 2026 | Amount | Key rules | Source |
|---|---|---|---|---|
| Boiler Upgrade Scheme | Open, England and Wales | £7,500 ASHP/GSHP; £9,000 for off-gas-grid homes 21 Jul 2026 to 31 Mar 2027; £2,500 air-to-air (from 28 Apr 2026); £5,000 biomass | Valid EPC required. Insulation recommendations no longer block since 8 May 2024. Air-to-air cannot coexist with fossil heating, and MCS listed products were scarce mid 2026 | [Energy Saving Trust](https://www.energysavingtrust.org.uk/advice/boiler-upgrade-scheme/); [GOV.UK notice](https://www.gov.uk/government/publications/boiler-upgrade-scheme-regulations-approved-standards-grant-categories-and-grant-levels/notice-of-approved-grant-categories-and-values-for-the-boiler-upgrade-scheme); [MCS](https://mcscertified.com/changes-to-the-boiler-upgrade-scheme/); [Reonic](https://reonic.com/en-gb/blog/air-to-air-heat-pump-grant/) |
| Warm Homes: Local Grant | Open via councils, England | Up to £15,000 energy efficiency plus up to £15,000 low-carbon heating | Household income ≤ £36,000 gross or means-tested benefits or eligible postcode; EPC D to G; owner-occupiers 100%, landlord second property 50% (varies); no fossil boilers | [Greater Manchester CA](https://www.greatermanchester-ca.gov.uk/what-we-do/environment/homes-workplaces-and-public-buildings/warm-homes-local-grant-wh-lg-privately-rented-scheme/); [Worcestershire](https://cms.worcestershire.gov.uk/council-services/environment/sustainability/tackling-fuel-poverty/warm-homes-local-grant-whlg) |
| Warm Homes Plan loans | Announced, consumer launch expected late 2026 to 2027 | £2bn programme for low and zero-interest loans: solar, batteries, heat pumps | Terms not final. Modelled as user-selectable APR 0% or 3% with "terms not yet published" badge | [Carbon Brief](https://www.carbonbrief.org/qa-what-uks-warm-homes-plan-means-for-climate-change-and-energy-bills); [Which?](https://www.which.co.uk/news/article/the-warm-homes-plan-explained-loans-for-green-tech-and-free-insulation-ap3y34T36XPc) |
| ECO4 | Closed to new applications; completions to 31 Dec 2026 | n/a | Shown as "closed" with history | [Ofgem LA guidance v3.0](https://www.ofgem.gov.uk/sites/default/files/2026-03/eco4_local_authority_administration_Guidance_v3.0.pdf); [EDF](https://www.edfenergy.com/help-support/faq/what-eco-scheme) |
| Great British Insulation Scheme | Closed 31 Mar 2026 | n/a | Shown as "closed" | [Ofgem](https://www.ofgem.gov.uk/environmental-and-social-schemes/great-british-Insulation-scheme) |
| Halifax Green Living Reward | Open | £2,000 heat pump; £1,000 solar or battery; £500 other measures | New Halifax mortgage, further advance or switch after 31 Jul 2024; Halifax or Bank of Scotland current account; claim within 12 months; one reward per product; stacks with BUS | [Halifax](https://halifax.co.uk/mortgages/help-and-advice/green-living/green-living-reward.html) |
| Halifax EPC affordability | Live since 10 Dec 2024 | Small rise in max loan for A/B, small fall for F/G | Qualitative only; we show "may affect how much you can borrow" | [MPA Mag](https://mpamag.com/uk/news/general/halifax-to-factor-epc-ratings-into-mortgage-affordability-calculations/517081) |
| 0% VAT on ESMs | To 31 Mar 2027 | 20% of install cost avoided | Applied in cost plugin | [Warm Homes Plan explainers](https://www.which.co.uk/news/article/the-warm-homes-plan-explained-loans-for-green-tech-and-free-insulation-ap3y34T36XPc) |

Context. The Warm Homes Plan was published 21 January 2026, about £15bn in total (£13.2bn from the 2025 Spending Review), about £5bn for low-income households, £2.7bn for BUS rising from £295m in 2025/26 to £709m in 2029/30, and £2bn for consumer loans ([GOV.UK](https://www.gov.uk/government/publications/warm-homes-plan); [Carbon Brief](https://www.carbonbrief.org/qa-what-uks-warm-homes-plan-means-for-climate-change-and-energy-bills)). Note: we did not find a separate "Lloyds green mortgage" product in current sources. Lloyds Banking Group's offer runs through the Halifax brand.

Stacking rules (v1):

- BUS and WH:LG do not both fund the same heat pump. The engine picks the larger.
- Cashbacks stack with grants but cannot make N0 negative.
- A grant with `validTo` before the expected install date is excluded, and the UI says why.
- Every applied grant appears in the evidence drawer with its URL and the date it was last checked.

Lean: `grants_le_cost` (Σ applied grants ≤ C0), `net_cost_nonneg`, `expired_grant_excluded`.

---

## 7. India finance

| Item | Rule | Source |
|---|---|---|
| PM Surya Ghar central subsidy | ₹30,000/kW for the first 2 kW, ₹18,000 for the 3rd kW, capped at ₹78,000 (3 kW and above) | [PM India](https://www.pmindia.gov.in/en/news_updates/cabinet-approves-pm-surya-ghar-muft-bijli-yojana/); [india.gov.in](https://www.india.gov.in/spotlight/pm-surya-ghar-muft-bijli-yojana) |
| Collateral-free loans | About 7% for systems up to 3 kW | [Business Today, Jul 2026](https://www.businesstoday.in/india/story/high-power-bills-burning-pockets-claim-up-to-rs78000-under-pm-surya-ghar-scheme-545483-2026-07-28) |
| State top-ups, net metering | Vary by state | state plugins |
| Free-units schemes | e.g. Telangana Gruha Jyothi, up to 200 units/month free for eligible households | [The News Minute](https://www.thenewsminute.com/telangana/telangana-starts-implementing-gruha-jyothi-scheme) |

Challenge to a common assumption: in India, savings are not "kWh × average tariff". Tariffs are telescopic slabs. Solar removes the most expensive slab first, so true savings can be higher than average-price maths. Under a free-units scheme, cutting use below the threshold saves the household nothing, and crossing it can matter a lot. The tariff plugin computes the bill exactly before and after, never via an average rate. For the Hyderabad flat this can flip the ranking between solar and roof insulation.

---

## 8. Landlord and tenant

### 8.1 The rule

All privately rented homes in England and Wales must reach the equivalent of EPC C by **1 October 2030**. The cost cap is £10,000 per property (lower for homes valued below £100,000, about 10% of value). Fines up to £30,000 per property per breach are planned. Homes reaching C under the old metric before 1 October 2029 count as compliant until that EPC expires ([Elmhurst](https://www.elmhurstenergy.co.uk/blog/2026/01/22/domestic-private-rented-properties-required-to-meet-epc-band-c-by-october-2030/); [Osborne Clarke](https://www.osborneclarke.com/insights/government-reforms-energy-performance-buildings-regime-and-raises-minimum-energy); [Jones Day](https://www.jonesday.com/ja/insights/2026/03/epc-c-by-2030-what-real-estate-investors-need-to-know-about-the-uks-new-minimum-energy-efficiency-standards)). The reformed EPC metric for MEES is still being finalised. The rule is a plugin (`regulation/mees-ew-2030`) with fields for the metric, cap and dates.

### 8.2 The split incentive in numbers

The landlord pays; the tenant saves. Evidence: landlords' main route to recover cost is rent ([Cambridge](https://www.repository.cam.ac.uk/handle/1810/297335)); qualitative barriers include knowledge and missing direct reward ([Ambrose 2015](https://shura.shu.ac.uk/9866)); rent premia exist (B +8.2%, C +2.4%) ([McCord et al. 2024](https://ideas.repec.org/a/taf/jpropr/v41y2024i3p251-275.html)).

Landlord mode outputs, per package:

| Output | Definition |
|---|---|
| Compliance | Estimated EPC band ≥ C: "compliant", "borderline" (within 3 SAP points), "not compliant" |
| Exemption check | If the cheapest compliant package costs more than the cap, flag "likely exemption after spending £10,000 on the best sub-cap package" |
| Landlord NPV | `−N0 + Σ (rent premium + avoided void + avoided fine risk)/(1+r)^t + value uplift at sale` (value here is legitimate: landlord does not receive bill savings) |
| Tenant saving | B_1 per year and per month |
| Fair rent rise | The rent rise that leaves the tenant no worse off: ≤ B_1/12 per month. Shown as a talking point, not advice |
| Split ratio | share of total benefit going to landlord vs tenant |

Lean: `compliant_iff_band_ge_C`, `fair_rent_rise_le_saving`.

---

## 9. Plugin interfaces (finance side)

| Plugin kind | Contract | Example IDs |
|---|---|---|
| `score/indicator` | `compute(twin) → value`, anchors, direction | `F-hlp`, `T-tm59-lite` |
| `score/climate-pack` | anchor set, validated by Lean | `uk-temperate`, `in-warm-humid`, `in-composite` |
| `band/epc-proxy` | `sapProxy(costs, tfa) → number` | `sap2012`, `hem` (stub) |
| `tariff` | `bill(kwhByFuel, period) → cost` | `uk-cap-2026q4`, `uk-tou-heatpump`, `in-tsspdcl-slab` |
| `export` | `income(kwhExported) → £` | `seg-flat`, `outgoing-octopus` |
| `grant` | `eligible(...)` as section 6 | `bus-2026`, `whlg`, `pm-surya-ghar` |
| `finance` | loan schedule | `whp-loan-0pct`, `mortgage-further-advance` |
| `value-evidence` | band index table, low/central/high | `uk-oo-v1`, `uk-btl-v1`, `uk-rent-v1` |
| `regulation` | compliance check | `mees-ew-2030` |

Every plugin carries `version`, `validFrom`, `validTo`, `sources[]`, `lastChecked`. The evidence drawer renders these directly, so "click any number" works for money too.

---

## 10. Testing hooks for this module

| Test | Pass if |
|---|---|
| Lean suite (sections 2.4, 4.2, 6, 8) | all theorems check in CI |
| Property tests: random dominance pairs | S never decreases |
| Bug injection: weight 0.21, flipped anchor, expired grant applied, IRR on two-sign-change flows, value added into NPV | each caught |
| Golden homes: UK solid-wall terrace, cavity semi, Hyderabad top-floor flat | SAP proxy within one band of a published EPC for the terrace; NPV matches a hand spreadsheet to £1 |
| Narrator grounding | every £ or % in narration matches an output field |

---

## 11. Open questions

1. Final reformed EPC methodology and MEES metric (expected later 2026). Our F/H/R/A indicators are ready to be re-anchored.
2. Warm Homes loan terms (rate, cap, lenders). Plugin stub only.
3. Green Book adoption of 3.0%. Switch ready.
4. Whether to let owners override value evidence with a local agent's estimate. Proposed: yes, shown as "your estimate" beside ours.
5. A current BEE residential label schedule for India.
