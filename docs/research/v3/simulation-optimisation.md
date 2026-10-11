# Simulation and optimisation for multi-zone buildings (v3 brief)

Status: research brief, 2026-10-11. Author: simulation and optimisation specialist. Cite as **SO §n**.
Scope: how Ibasho computes hourly and monthly loads and end uses for offices, hotels, schools, hospitals, labs and apartments in the browser; how it validates against EnergyPlus; how it searches and certifies bundles; India cost, tariff, carbon and LEED inputs. Hyderabad first.

Grades used below follow SPEC: **read** (read from the primary source in this session), **estimate** (secondary source or my own arithmetic, must be read before it carries a Checked seal), **unknown** (stays unknown, never zero).

---

## 1. The short answer

1. Keep the existing 5R1C kernel (`packages/engine/src/thermal/five-r1c.ts`, ISO 13790 Annex C, Crank-Nicolson) and generalise it from two domestic zones to **N thermal zones with cooling, latent load and per-facade solar**. That is the ISO 52016-1 family at the fidelity a browser can run in milliseconds. Do not attempt full ISO 52016-1 node-per-layer in v3; it is a later plugin.
2. Run **three rungs**: (a) monthly quasi-steady (ISO 52016-1 monthly method, microseconds) inside the search, (b) hourly 5R1C per zone for the front and the picks, (c) EnergyPlus through the companion as an optional reference rung. Each rung keeps its own seal: Modelled for (a) and (b), Modelled plus "reference agrees within x %" for (c).
3. End uses come from **simple, documented system models** fed by the hourly zone loads: VRF, split, chiller plant, DOAS, fans, pumps, lighting with daylight dimming, plug loads, DHW, PV. Each is a curve or a factor from a named source (ECSBC 2024 baseline tables, ASHRAE 90.1 Appendix G, EnergyPlus default curves).
4. EnergyPlus in WebAssembly is **not available** as a working, maintained build (only an open question on Unmet Hours, Aug 2024). Run it natively through the companion server at `127.0.0.1:7357` instead.
5. Optimisation keeps Ibasho's **factorised exhaustive search plus Lean-checked Pareto certificate**. Above the completeness cap, NSGA-II explores and the certificate states "front correct relative to listed candidates" (already R9). Surrogates rank and screen only; **every displayed number comes from a physics rung**, never from a surrogate or an LLM.
6. Codes: ECSBC 2024 whole building method (MEPI, PES) for India, ASHRAE 90.1 Appendix G for global, LEED v5 EAc3 points from the same baseline and proposed runs.

---

## 2. Thermal kernel: what to compute, per zone, per hour

### 2.1 Options compared

| Method | What it gives | Cost per zone-year (JS, est.) | Fit for Ibasho |
|---|---|---|---|
| ISO 13790 / 52016-1 monthly quasi-steady | Monthly heating and cooling needs with utilisation factors | about 1 µs | Inside the exhaustive search (rung a) |
| 5R1C hourly (ISO 13790 Annex C, already in repo) | Hourly air and mass temperature, sensible load, unmet hours | about 0.1 to 0.3 ms (8,760 Crank-Nicolson steps) | Front, picks, comfort and peak (rung b) |
| ISO 52016-1 hourly, node per layer and surface | Surface temperatures, radiant split, better for heavy mass | about 10 to 50x 5R1C | T5 plugin; useful for operative temperature and radiant cooling |
| ASHRAE RTS (Handbook Fundamentals ch. 18) | Design-day peak cooling load per zone | under 1 ms per design day | Peak sizing (VRF, chiller TR, DOAS airflow); not annual energy |
| EnergyPlus (CTF, heat balance) | Everything, reference grade | seconds to minutes, native | Reference rung (c), companion only |

Open implementations to borrow from (credit in ACKNOWLEDGEMENTS):

| Project | What | URL |
|---|---|---|
| RC_BuildingSimulator (ETH Zurich, MIT) | 5R1C in Python, with lighting and simple HVAC; a good test oracle | https://github.com/architecture-building-systems/RC_BuildingSimulator , https://pypi.org/project/rcbsim |
| pyBuildingEnergy (EURAC) | ISO 52016-1:2017 hourly in Python; oracle for the node model | https://build-up.ec.europa.eu/en/resources-and-tools/tools/pybuildingenergy |
| EPB Center ISO 52016-1 spreadsheets and notes | Normative reference implementation and how it compares to dynamic tools | https://epb.center/support/documents/iso-52016-1 |
| ASHRAE Standard 140 (BESTEST cases 600, 900, 600FF, 900FF) | Inter-model test cases with published ranges | https://www.ashrae.org/technical-resources/standards-and-guidelines (Std 140) |

### 2.2 Proposed N-zone 5R1C (extends WP-01 kernel)

Zone = one room or a group of rooms with the same function, orientation band and HVAC system (standard core plus four perimeter zones, 4.5 m deep, per ASHRAE 90.1 G3.1 and ECSBC chapter 12 baseline zoning).

Per zone and hour:

- **Conductances**: H_tr,w from glazing U and area per facade; H_tr,op from opaque layers; H_ve from infiltration plus outdoor air (ventilation per occupant and per m2 from NBC 2016 Part 8 or ASHRAE 62.1); inter-zone coupling H_iz between adjacent zones (added as a conductance between air nodes, solved by Gauss-Seidel over zones each hour, two sweeps are enough because coupling is weak).
- **Solar**: per window, incident irradiance from the EPW (Perez sky, already needed for site work, see `site-daylight.md`), times g-value, times the hourly **shading fraction from the 3D city scene** (overhangs, fins, neighbours). This is the hook that makes "place it in a 3D city" change the energy numbers, not just the pictures.
- **Internal gains**: occupancy, lighting and equipment from schedules (ECSBC 2024 Tables 12-x schedules by building type; ASHRAE 90.1 User's Manual schedules as fallback), sensible fraction to air and mass per ISO 13790 C.2.
- **Cooling and heating**: ideal load to set-point band (24 to 26 °C cooling for India offices, IMAC adaptive band as an option for mixed-mode), with capacity limit from the sized system, so unmet hours are real.
- **Latent**: moisture balance on the air node, outdoor air humidity ratio from the EPW, occupant latent gains. Hyderabad monsoon (June to September) makes latent a large share of fresh-air load; a sensible-only model under-reports chiller and DOAS energy there.

Hyderabad check from the TMYx file already in `sources/epw-hyd` (my arithmetic, **estimate**): mean dry bulb 26.8 °C, max 43.0 °C, annual GHI about 1,903 kWh/m2, cooling degree hours above 24 °C about 31,300 Kh, monthly means 22.2 °C (Dec) to 32.3 °C (May). CDD10 is roughly 6,100, so ASHRAE 169 zone 0 (confirm A or B from the precipitation rule). ECSBC places Hyderabad in **Composite** (read, ECSBC 2024 Appendix climate list; ECBC 2017 line 7648 agrees).

Cost: 20 zones x 8,760 h x 2 sweeps is about 0.35 M zone-steps, roughly 5 to 15 ms in a worker. Fine for picks and the front; too slow for 10^5 heavy candidates, which is why rung (a) exists.

### 2.3 Monthly rung for search

ISO 52016-1 monthly method (or ISO 13790 monthly, which the UK pack already mirrors via SAP): monthly gains and losses with gain utilisation factor for heating and loss utilisation factor for cooling, time constant from C_m. **Calibrate the monthly rung against the hourly rung per building** (fit the utilisation parameters a_0 and tau_0 to the hourly result of the baseline and three anchor variants). The certificate then records the calibration and its residual; the search ranks on monthly numbers and the front is re-run hourly. If the hourly re-run changes the front membership, the front is recomputed on hourly numbers for the affected candidates (it is small), and the certificate says so.

---

## 3. Systems and end uses

End-use list the owner asked for: cooling, heating, lighting, equipment, fans, pumps, hot water, PV. Every row is a documented model. "Curve" means a quadratic or biquadratic from EnergyPlus or ASHRAE defaults, written as exact rational coefficients so it can run in `@ibasho/dmath`.

| End use | Model | Inputs | Source |
|---|---|---|---|
| Cooling, VRF | Capacity and EIR as biquadratic of indoor wet bulb and outdoor dry bulb, times part-load curve; piping length correction | Zone hourly sensible plus latent load, rated COP or IEER | EnergyPlus `AirConditioner:VariableRefrigerantFlow` default curves; ECSBC 2024 ch. 6 minimum efficiencies |
| Cooling, split / room AC | Same form, single speed or inverter, ISEER rating | ISEER from BEE star label | BEE star labelling; EnergyPlus `Coil:Cooling:DX` |
| Cooling, chiller plant | Chiller EIR(T_chw, T_cw) x EIR(PLR); cooling tower approach; plant kW/TR including pumps and tower; TSE (total system efficiency) per ECSBC Table 6-25 | Building load, chiller type and count per ECSBC Table 12.6 baseline | ECSBC 2024 §3.2.3(d) and ch. 12 (read); ASHRAE 90.1 G3.1.3 |
| Heating | Heat pump COP curve or electric resistance; mostly zero in Hyderabad but hotels and hospitals reheat | Zone heating load, reheat for dehumidification | EnergyPlus defaults |
| DOAS and fresh air | Outdoor air sensible plus latent load, energy recovery wheel effectiveness (sensible and latent) | OA flow, EPW humidity ratio | ASHRAE 62.1, ECSBC energy recovery clause |
| Fans | Specific fan power, W per m3/s, times hourly airflow; VAV with part-load fan curve (ASHRAE 90.1 G3.1.3.15) | Airflow from load and supply delta T | ASHRAE 90.1 Appendix G; ECSBC baseline fan power |
| Pumps | W per kW of cooling (chilled and condenser water), variable speed curve | Plant load | ASHRAE 90.1 G3.1.3.5 and G3.1.3.10 |
| Lighting | LPD (W/m2) per space type x schedule x (1 minus daylight savings fraction x daylit area share) x occupancy sensor factor | LPD from ECSBC 2024 space-by-space tables (for example "Banking Activity Area 12.6" in the LPD table, read), sDA per zone | ECSBC 2024 ch. 7; daylight from `site-daylight.md` |
| Daylight dimming | Hourly: interior illuminance at the zone's control point = daylight coefficients x sky (precomputed per zone by the daylight engine); dimming fraction = clamp(1 minus E_day / E_set, min power fraction). Annual short-cut: savings fraction from sDA300/50% | Daylight coefficients, set-point 300 to 500 lux | Reinhart, daylight coefficient method; ECSBC daylighting clause |
| Equipment / plug | EPD (W/m2) x schedule; lab and hospital process loads as named overrides | Space type | ECSBC schedules; ASHRAE 90.1 User's Manual |
| Hot water | Daily draw per person or per bed or per room (hotel, hospital, hostel), cold water temp from EPW ground temperature, heater efficiency or heat pump COP, solar thermal fraction | Occupancy, fixture flows | NBC 2016 Part 9; ECSBC solar water heating requirement |
| PV | Plane-of-array irradiance from EPW (Perez), times hourly unshaded fraction from the 3D city scene, cell temperature (NOCT or Faiman), inverter efficiency curve, soiling and degradation | kWp, tilt, azimuth, shading | PVWatts v8 method (NREL) https://pvwatts.nrel.gov/downloads/pvwattsv8.pdf ; cross-check PVGIS https://re.jrc.ec.europa.eu/pvg_tools/en/ |
| DG and outage | Diesel litres per kWh at part load, outage hours as an input, never zero by default (unknown) | Outage profile | `business-impact.md` |

Sanity anchor for PV (estimate): with about 1,900 kWh/m2 GHI and a 0.78 to 0.80 performance ratio, a south-facing 15 to 18° array in Hyderabad yields roughly 1,400 to 1,550 kWh/kWp/yr. Read PVGIS for the site before sealing.

**Peak sizing.** System capacities come from a design-day run using the .ddy file (`sources/epw-hyd/*.ddy`), either RTS or the 5R1C on the design day with a 3-day warm-up. A sized system lets unmet hours show up honestly, which feeds the comfort objective.

**Untapped value (what people miss).** Most quick tools ignore: (1) latent fresh-air load in monsoon, (2) neighbour shading on PV and on solar gains, (3) DG hours in operating cost and carbon, (4) part-load VRF efficiency at the 30 to 50 % loads where Indian offices spend most hours, (5) tariff demand charges (kVA) which make peak shaving matter. Ibasho can do all five cheaply.

---

## 4. Validation: EnergyPlus as the reference rung

### 4.1 Can EnergyPlus run in WebAssembly?

| Question | Finding | Grade |
|---|---|---|
| Is there a public, working EnergyPlus WASM build? | No. An Unmet Hours question (Aug 2024) asks if anyone has done it with Emscripten; no confirmed answer found. https://unmethours.com/question/99813/energyplus-in-webassembly | read (absence of evidence, not proof) |
| Is it technically possible? | EnergyPlus is C++ since 8.x with CMake; dependencies (Kiva, SQLite, fmt, Python plugin API, threads) would need Emscripten ports; the Python EMS plugin would be dropped. Expect a binary in the tens of MB and long cold start. | estimate |
| Recommendation | Do not spend v3 time on it. Use the companion (native binary). Revisit as a T5 spike if someone publishes a build. | decision proposal |

Current releases: EnergyPlus 25.1.0 (March 2025, docs moved to ReadTheDocs); NREL ships twice a year (March and September), so check https://github.com/NREL/EnergyPlus/releases for the latest before pinning. OpenStudio SDK wraps it and has a CLI (`openstudio run`). Sources: https://www.bdcnetwork.com/codes-and-standards/news/55162127/new-versions-of-does-energyplus-engine-and-the-openstudio-software-development-kit-released

### 4.2 Companion integration

```
browser (twin JSON) -> companion 127.0.0.1:7357 /sim/energyplus
  1. translate twin -> epJSON (zones, surfaces from the building editor, constructions, schedules,
     HVAC from a small template set: VRF+DOAS, chiller+VAV, split, PTAC for hotels)
  2. energyplus -w hyd.epw -d out/ -r in.epJSON     (native, user-installed, path in settings)
  3. parse eplusout.csv / SQL -> monthly end uses per fuel, hourly zone loads, unmet hours
  4. return a comparison table; the UI shows "Reference agrees within x %" per end use
```

- Use **epJSON** (EnergyPlus native JSON input since 9.x) so no IDF string building is needed.
- Templates: borrow geometry and HVAC conventions from the **DOE / PNNL prototype buildings** (office, hotel, hospital, school, mid-rise apartment) https://www.energycodes.gov/prototype-building-models
- Run under the CPU cap on this laptop (`cap.sh`), one simulation at a time, killed on cancel.
- Seal: the reference rung never upgrades a number to Checked. It adds an evidence row: "EnergyPlus 25.x, same geometry, monthly cooling within 7 %".

### 4.3 Acceptance metrics

| Comparison | Metric | Threshold | Source |
|---|---|---|---|
| 5R1C vs BESTEST 600/900 | Annual heating, cooling, peak, free-float min/max | Inside ASHRAE 140 reference range | ASHRAE 140 |
| Monthly rung vs hourly rung | Monthly NMBE, CV(RMSE) | NMBE ≤ 5 %, CV(RMSE) ≤ 15 % | ASHRAE Guideline 14 (monthly calibration criteria) |
| Hourly rung vs EnergyPlus | Hourly cooling load | NMBE ≤ 10 %, CV(RMSE) ≤ 30 % | ASHRAE Guideline 14 (hourly) |
| End uses vs EnergyPlus | Annual per end use | within 15 % for cooling, fans, lighting; report others | proposal |
| Whole building vs BEE benchmarks | EUI per type and climate | Inside BEE indicative band (for example office composite, over 50 % AC: about 179 kWh/m2/yr, estimate from the BEE flyer in `sources/`) | BEE benchmark flyer |

The IIIT Hyderabad reference buildings (Vindhya, Himalaya, see `reference-buildings.md`) are the natural calibration cases if metered data exists; IIIT's own Centre for IT in Building Science (Vishal Garg's group, which co-authored ECBC 2017) is the right local partner.

---

## 5. Codes and targets from the same runs

### 5.1 India: ECSBC 2024 whole building (ICM) method (read)

- **MEPI** = total annual energy (kWh/yr) / net built-up area (m2), excluding unconditioned basement, unconditioned refuge and stilt parking; rounded to 2 decimals per IS 2:1960.
- **PES** = (MEPI_baseline minus MEPI_proposed) / MEPI_baseline x 100.
- ECSBC: MEPI_proposed ≤ MEPI_baseline. ECSBC+ and Super ECSBC: proposed below baseline and PES ≥ Table 12.7 to 12.11.
- Composite climate minimum PES (Table 12.7, read):

| Building type | ECSBC+ | Super ECSBC |
|---|---|---|
| Hotel (no star and star) | 9 % | 19 % |
| Resort | 12 % | 24 % |
| Hospital | 15 % | 23 % |
| Outpatient | 15 % | 25 % |
| Assembly | 14 % | 23 % |
| Office (regular use) | 14 % | 22 % |
| Office (24 hours) | 12 % | 24 % |
| Schools and university | 23 % | 34 % |
| Shopping mall | 14 % | 26 % |
| Supermarket | 19 % | 30 % |

Source: https://beeindia.gov.in/sites/default/files/BEE_ECSBC_2024.pdf (local text in `sources/ecsbc2024r.txt`).

Implementation: a `rules-in` plugin builds the **ECSBC baseline twin** (same geometry, baseline envelope, LPD, HVAC per chapter 12 and Table 12.6) and runs it through the same kernel. Lean checks the bookkeeping (MEPI division, rounding rule, PES comparison against the table carried in the certificate), not the physics. Note that ECSBC requires an approved simulation tool for formal compliance; Ibasho reports "ECSBC-style estimate", never "compliant".

Residential: Eco Niwas Samhita 2024 (ENS) uses RETV and envelope metrics, not simulation; local text in `sources/ens2024r.txt`. It is a rules check, cheap and Checked.

### 5.2 Global: ASHRAE 90.1 Appendix G

Performance Cost Index and Building Performance Factor. Same baseline-twin pattern as ECSBC. LEED v5 reuses it (below).

### 5.3 LEED v5 BD+C points estimate (read, November 2025 reference guide)

| Credit | Points (NC) | How Ibasho estimates |
|---|---|---|
| EAc1 Electrification | 5 | Share of end uses on electricity; gas or diesel for DHW and kitchens reduces it |
| EAc2 Reduce Peak Thermal Loads | 5 | Peak load per m2 vs baseline, from design-day runs |
| EAc3 Enhanced Energy Efficiency, Option 2 simulation | 1 to 10 | Future source energy, electric site-to-source factor 2.0 (a lower national value allowed outside the US). PI_t = (BBUE + BPF x BBRE) / BBP. Points: 3 % below PI_t per point excluding renewables (30 % = 10), or 10 % per point including renewables (100 % = 10). BPF office 0A 0.62, 0B 0.63; hotel 0.72 / 0.71; hospital 0.72 |
| EAc4 Renewable Energy | 5 | PV kWh share |
| WEc2 Enhanced Water Efficiency | 8 | Fixture flow reductions vs baseline (Table 2), cooling tower cycles (Table 9), outdoor water |

Local text: `sources/leedv5bdc.txt` lines 4308 to 4560. Many Indian projects still register under v4.1, where EA Optimize Energy uses energy cost and GHG tables; ship both as rule packs, version in the certificate. Natural gas: in v5 it enters through source energy and electrification; in v4.1 through cost and GHG. Always label "LEED points estimate, not a submission".

### 5.4 Carbon and cost factors (India)

| Item | Value | Grade | Source |
|---|---|---|---|
| Grid weighted average emission factor, FY 2023-24 | 0.727 tCO2/MWh (CEA v20); v22 (Aug 2026) restates 2022-23 and 2023-24 captive data, so read v22 before sealing | estimate | https://cea.nic.in/wp-content/uploads/baseline/2026/09/User_Guide__Version_22.0.pdf |
| T&D loss adjustment | per SPEC R6 | rule | SPEC R6 |
| TGSPDCL LT-II(B) commercial, 0 to 100 kW | Rs 8.50/kWh, slabs rising to Rs 11.00/kWh above 500 kW, FY 2025-26 (no change proposed for FY 2026-27) | read via search snippet; confirm in PDF | https://tgsouthernpower.org/resources/PDF/Tariffs/63tarifffile.pdf |
| HT-II commercial energy and demand charge | unknown in this brief; read from `sources/tgspdcl-tariff-69.pdf` | unknown | same site |
| Telangana APPC 2025-26 | Rs 5.33/kWh (for net metering export valuation) | estimate | https://solarquarter.com/2026/09/03/tgerc-fixes-telangana-appc-at-inr-5-330-kwh-for-2025-26/ |
| Diesel DG | litres per kWh by load factor, diesel price, CO2 2.68 kg/l (IPCC default) | estimate | IPCC 2006 Vol 2 |

Operating cost must model **slabs, fixed or demand charge per kVA, ToD surcharges and DG**, not a flat rate. Money stays bigint fixed point (R-rules).

---

## 6. Capital cost data for India

Hierarchy: (1) **CPWD Delhi Schedule of Rates (DSR) 2023** and **Plinth Area Rates**, with a Hyderabad cost index (CPWD publishes location cost indices); (2) state SoR (Telangana R&B SSR); (3) public tender BoQs; (4) market quotes. Each price row carries its source and date and grade; no price defaults to zero.

| Measure | Indicative installed cost | Grade | Source / note |
|---|---|---|---|
| Rooftop PV, commercial 100 to 500 kW | about Rs 36,000/kWp (2020 MNRE benchmark, now lower module prices but higher BOS); market 2025 Rs 35,000 to 55,000/kWp | estimate | https://www.dgll.nic.in/sites/default/files/2023-06/MNRE%20Bench%20Mark%20for%20Grid%20connected%20solar%20plants%20for%202020-21.pdf |
| VRF outdoor unit, supply only | 24 HP at Rs 5,00,000 (about Rs 26,000 to 30,000 per TR); 4 TR cassette Rs 48,000 | estimate (tender) | SBI HVAC price bid, Jan 2025: https://sbi.co.in/webfiles/uploads/files_2425/230120251756-REVISED%20PRICE%20BID%20FOR%20HVAC%20WORKS.pdf |
| VRF installed (piping, controls, labour, GST) | roughly 2 to 3x supply of outdoor unit per TR | estimate, needs a full BoQ | proposal |
| Double glazed unit, aluminium frame | read from DSR 2023 item; InfraLens gives indicative rate analysis | unknown until read | https://infralens.in/rate-analysis/aluminium-sliding-window |
| Roof insulation (XPS or PUF), overdeck | read from DSR 2023 | unknown until read | CPWD DSR 2023 |
| External shading (overhang, fins) | per m run, steel or RCC, DSR | unknown until read | CPWD DSR 2023 |
| LED retrofit, occupancy and daylight sensors | market, per fitting and per sensor | unknown until read | EESL and market |

Action: a WP that owns `packs/money-in` should transcribe the needed DSR 2023 items (item number, unit, rate) into a cost table with a `source` field, as `money-uk` already does.

---

## 7. Parametric modelling and optimisation

### 7.1 Design space for a non-residential building (example, office)

| Group | Variables | Levels | Heavy or light |
|---|---|---|---|
| Envelope | WWR per facade (4), glazing type, wall U, roof U, roof albedo | 4^4 x 5 x 4 x 4 x 3 | heavy |
| Shading | overhang depth per facade, fins, external louvres | 4^4 | heavy |
| Massing (phototropic option) | orientation, setbacks, terracing per floor | 6 x 4 | heavy, very expensive (changes geometry and shading) |
| Internal | LPD level, daylight controls, EPD policy | 3 x 2 x 2 | light-ish (gains change loads; cheap to recompute on cached solar) |
| HVAC | VRF / chiller+VAV / split / DOAS with ERV; efficiency tier; set-point | 5 x 3 x 3 | light (runs on cached hourly loads) |
| Supply | PV kWp, battery kWh, DG strategy, tariff category | 6 x 4 x 3 x 2 | light |

Naive product: about 10^9. Not exhaustively searchable. So:

### 7.2 Tiered strategy that keeps the certificate honest

1. **Screen** (design of experiments). Morris elementary effects, r = 20 trajectories over the heavy variables, on the monthly rung (a few thousand runs, under a second). Variables whose effect is below a threshold on every objective are fixed at their cheapest level. The certificate records the screening table; pruning is a **Modelled** decision, shown as such ("we fixed fin depth because it moved energy by under 0.5 %").
2. **Factorise** as R9 does today: heavy groups produce cached hourly zone loads; light groups (HVAC, PV, battery, tariff, controls) are evaluated exhaustively on the cache. Exact within the cached loads.
3. **Exhaustive** when the reduced heavy space is under the cap (1,024 heavy, 65,536 total, R9). The Lean certificate proves "nothing better is hidden" among all packages.
4. **NSGA-II** when above the cap. Population 64 to 128, 40 to 100 generations, on the monthly rung, with the light groups solved exactly inside each evaluation (a bilevel trick: each heavy candidate's best light completion is exact). The certificate states "front correct relative to the N listed candidates" and reports hypervolume and generations. Deb et al. 2002, https://doi.org/10.1109/4235.996017 . JS options are thin (an MIT TypeScript port exists, `Aiei/nsga2`; `win-nsga` on npm is 0.0.x); write a small deterministic one on the core PRNG (about 300 lines) so runs are byte-reproducible (AC-D1).
5. **Surrogates** (optional): a Gaussian process or small gradient-boosted tree on the monthly rung's outputs to pre-rank NSGA-II offspring. The surrogate only decides **what to simulate next**; it never supplies a displayed number. Also usable for live "slider" previews, labelled as a preview and replaced by the physics value within one slice.
6. **Re-run the front hourly**, then offer the EnergyPlus rung for the three picks.

Parametric "bundles": each Pareto point is a bundle; show the three picks (lowest capex meeting code, best NPV, lowest carbon) plus a parallel-coordinates view of the front. Sensitivity strips (tariff growth, grid factor path, discount rate) reuse R9's Latin hypercube uncertainty after first paint.

### 7.3 Objectives (generalise R8)

| Objective | Unit | Direction | Note |
|---|---|---|---|
| Capex | Rs, bigint | min | from cost table, with unknowns propagated (unknown capex excludes a package from the front, R-rule "needs check") |
| Annual energy / EUI | kWh, kWh/m2 | min | site and source both stored |
| Operating cost | Rs/yr | min | tariff slabs, demand, DG |
| Lifetime carbon | tCO2e | min | CEA path, operational only (R6) |
| Comfort | unmet or exceedance hours | min | hourly rung only; monthly rung uses a proxy flag |
| Daylight | sDA300/50 % up, ASE1000,250 down | max / min | from the daylight engine, independent of thermal search except through WWR and shading |
| NPV | Rs | max | as today |

Lean: `Outcome` today has exactly three fields (R8). Proposal: generalise to a vector of integers with a per-axis direction flag; dominance, witness and front checks are the same proofs over `List Int`, so the soundness theorem carries over with little work. Users choose 2 to 4 axes; the certificate lists which. This needs a SPEC change (R8) and a BLOCKER entry by the owning WP.

### 7.4 Performance budget (estimate)

| Step | Count | Time per | Total |
|---|---|---|---|
| Morris screening, monthly | 2,000 | 5 µs | 10 ms |
| Heavy exhaustive, monthly, 20 zones | 1,024 | 50 µs | 50 ms |
| Light exhaustive on cache | 65,536 | 2 µs | 130 ms |
| NSGA-II, monthly, bilevel | 100 x 100 | 100 µs | 1 s |
| Hourly front re-run | 30 | 10 ms | 300 ms |
| EnergyPlus reference, native | 3 | 20 to 120 s | minutes, background, companion |

All in the existing worker with slicing (AC-W4 ≤ 50 ms slices).

---

## 8. AI fit (short)

- The narrator explains the front and the picks; it never computes. Recommendations come from the search (see `ai-recommendation.md`).
- "Dynamic update": when the user edits a room in the building editor, only the touched zones' heavy cache is invalidated; light groups recompute on the cache, so the front updates in under 300 ms for small edits.
- Memory stores user priorities (axes chosen, ruled-out measures) as constraints for the next search (AC-P1 pattern).

---

## 9. Proposed work items

| # | Item | Owner WP (proposal) | Size |
|---|---|---|---|
| 1 | N-zone 5R1C with cooling, latent, capacity limit, inter-zone coupling; BESTEST 600/900 tests | engine thermal (WP-01) | M |
| 2 | Monthly ISO 52016-1 rung calibrated to hourly; certificate row for the calibration | engine (WP-01), verify | M |
| 3 | System models: VRF, split, chiller plant + TSE, DOAS + ERV, fans, pumps, DHW, PV with 3D shading fractions | engine physics plus `packs/home-in` systems | L |
| 4 | Lighting with daylight dimming from daylight coefficients | engine, site-daylight | M |
| 5 | ECSBC 2024 baseline twin, MEPI and PES; ENS 2024 checks; LEED v5 EAc1 to EAc4 and WEc2 estimates | `packs/rules-in`, new `packs/rules-leed` | M |
| 6 | India cost table from DSR 2023 with source rows; TGSPDCL tariff with slabs, kVA and ToD; CEA factors | `packs/money-in` | M |
| 7 | Morris screening, bilevel NSGA-II on the core PRNG, generalised N-axis Pareto with Lean proofs | engine search (WP-02?), proofs (WP-04) | L |
| 8 | Companion EnergyPlus runner (epJSON writer, CSV and SQL reader, comparison evidence rows) | apps/companion | M |

---

## 10. Sources

- ECSBC 2024 (BEE): https://beeindia.gov.in/sites/default/files/BEE_ECSBC_2024.pdf
- ECBC 2017 climate list and history: local `sources/ecbc2017.txt`
- BEE commercial benchmarks flyer: https://www.beeindia.gov.in/sites/default/files/Flyer_22nd%20Jan.pdf
- LEED v5 BD+C Reference Guide, November 2025: local `sources/leedv5bdc.txt`; overview https://leeduser.buildinggreen.com/
- CEA CO2 Baseline Database user guides v20 and v22: https://cea.nic.in/wp-content/uploads/2021/03/User_Guide_Version_20.0.pdf , https://cea.nic.in/wp-content/uploads/baseline/2026/09/User_Guide__Version_22.0.pdf
- TGSPDCL tariffs: https://tgsouthernpower.org/resources/PDF/Tariffs/63tarifffile.pdf , https://www.tgsouthernpower.org/resources/PDF/Tariffs/69tarifffile.pdf
- Telangana APPC: https://solarquarter.com/2026/09/03/tgerc-fixes-telangana-appc-at-inr-5-330-kwh-for-2025-26/
- MNRE rooftop benchmark 2020-21: https://www.dgll.nic.in/sites/default/files/2023-06/MNRE%20Bench%20Mark%20for%20Grid%20connected%20solar%20plants%20for%202020-21.pdf ; PV market context https://pv-tech.org/indias_mnre_cannot_subsidise_every_rooftop_solar_scheme_under_40gw_target
- SBI HVAC price bid (VRF supply rates): https://sbi.co.in/webfiles/uploads/files_2425/230120251756-REVISED%20PRICE%20BID%20FOR%20HVAC%20WORKS.pdf
- VRF vs chiller in India: https://www.securedengineers.com/insights/vrf-vs-chiller-which-for-indian-buildings/
- InfraLens rate analyses (indicative): https://infralens.in/rate-analysis/aluminium-sliding-window
- EnergyPlus in WebAssembly question: https://unmethours.com/question/99813/energyplus-in-webassembly
- EnergyPlus and OpenStudio releases: https://github.com/NREL/EnergyPlus/releases , https://www.bdcnetwork.com/codes-and-standards/news/55162127/new-versions-of-does-energyplus-engine-and-the-openstudio-software-development-kit-released
- DOE / PNNL prototype buildings: https://www.energycodes.gov/prototype-building-models
- ISO 52016-1 resources: https://epb.center/support/documents/iso-52016-1 ; relation to dynamic tools https://epb.center/epb-question/how-does-the-hourly-calculation-method-in-en-iso-52016-1-to-calculate-indoor-temperatures-and-heating-and-cooling-loads-and-needs-relate-to-dynamic-building-simulation-tools-4/
- pyBuildingEnergy: https://build-up.ec.europa.eu/en/resources-and-tools/tools/pybuildingenergy
- RC_BuildingSimulator / rcbsim: https://github.com/architecture-building-systems/RC_BuildingSimulator , https://pypi.org/project/rcbsim ; 5R1C discussion https://unmethours.com/question/23027/simplified-hourly-calculation-5r1c-method
- PVWatts v8 technical reference: https://pvwatts.nrel.gov/downloads/pvwattsv8.pdf ; PVGIS: https://re.jrc.ec.europa.eu/pvg_tools/en/
- NSGA-II: Deb, Pratap, Agarwal, Meyarivan (2002), https://doi.org/10.1109/4235.996017 ; JS ports: https://gitblind.noratr.app/Aiei/nsga2 , https://www.npmjs.com/package/win-nsga
- Weather: Hyderabad Begumpet TMYx 2011 to 2025 (climate.onebuilding.org), local `sources/epw-hyd/`
