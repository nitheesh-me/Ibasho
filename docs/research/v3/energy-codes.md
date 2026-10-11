# Energy codes and rating systems: brief (v3)

Owner of brief: energy codes specialist. Date: 2026-10-11. Scope: global (ASHRAE 90.1-2022 and Appendix G, IECC 2024, ISO 52000, EU EPBD, LEED v4.1 and v5, IFC EDGE) and India (ECBC 2017, ECSBC 2024, Eco Niwas Samhita, NBC 2016, Telangana and GHMC, GRIHA, IGBC, BEE star labels). Focus: Hyderabad.

Sources read this session are kept in `docs/research/v3/sources/energy-codes/`.

## 1. Headline findings

1. **India is about to make ratings mandatory for big buildings.** A Ministry of Power draft notification (June 2026) proposes that every new office, commercial **or residential** building or complex with built-up area of 20,000 m2 or more must get a rating: BEE Star (3 Star = ECSBC, 4 Star = ECSBC Plus, 5 Star = Super ECSBC), or GRIHA 3 Star, IGBC Gold, LEED Gold, or GEM-3. The rating must be displayed and quoted in adverts. It would supersede the ECBC Rules 2018. Source: [powermin draft](https://powermin.gov.in/static/uploads/2026/07/f981ac1fc7a15c1136606ec2cd1979ca.pdf) (grade: primary, status: draft). This is the single most useful hook for Ibasho in India: "which rating can this design reach, and what is the cheapest path to 3 Star / Gold".
2. **ECBC became ECSBC** after the 2022 amendment of the Energy Conservation Act. ECSBC 2024 keeps three tiers (ECSBC, ECSBC Plus, Super ECSBC), keeps the 100 kW connected load or 120 kVA contract demand trigger for commercial, and adds sustainability (water, materials, renewables). Renewable provision: ECSBC Plus at least 7.5 % of contract demand, Super ECSBC at least 15 %. Sources: [BEE draft ECSBC](https://beeindia.gov.in/sites/default/files/2024-01/Draft%20ECSBC%20-%20Commercial%20office%20buildings_0.pdf), [Mercom](https://mercomindia.com/bees-new-building-code-could-boost-solar-adoption-in-commercial-buildings) (grade: secondary).
3. **Residential now has a sustainability code too:** Eco Niwas Samhita 2024, titled "Energy Conservation and Sustainable Building Code, Residential 2024" (BEE, first print September 2024), merges ENS Part I (envelope) and Part II (electro mechanical and renewables) and adds sustainability chapters. State adoption examples apply it to plots of 500 m2 or more. Sources: [ENS 2024 PDF](https://beeindia.gov.in/sites/default/files/ENS%202024_Buildign%20Code%20for%20Residential%20Buildings.pdf), [HAREDA](https://hareda.gov.in/ecbc-and-ens-buildings/).
4. **Hyderabad is the original Indian ECBC city.** Telangana (then joint with Andhra Pradesh) made ECBC mandatory in 2014 (TSECBC, based on ECBC 2007) for commercial and other non residential buildings with **plot area over 1,000 m2 or built-up area over 2,000 m2**, checked online in GHMC's Development Permission Management System, with a Third Party Assessor (TPA) certificate at design and a compliance verification certificate before occupancy. GHMC added a **1 to 6 star scale**: 1 star for prescriptive compliance or up to 5 % savings in whole building performance, then 10, 15, 20, 25, 30 % savings for 2 to 6 stars. Source: [GHMC/NRDC FAQ, April 2017](https://www.ghmc.gov.in/Townplanning_Reports/TSECBCFAQs.pdf) (grade: primary for 2017; current status of ECBC 2017 / ECSBC adoption in Telangana: unknown, verify with TGREDCO).
5. **Appendix G is the global lingua franca.** LEED v4.1, LEED v5, IGBC and many Indian TPAs score "percent better than an ASHRAE 90.1 Appendix G baseline". Ibasho's engine already computes a monthly balance; generating a stable Appendix G style baseline twin from the user's own geometry gives one number that feeds LEED, IGBC, GHMC stars and ECSBC whole building performance at once.
6. **Two checks, two engines.** Prescriptive codes (U, SHGC, WWR, LPD, COP, RETV) are pure attribute rules and fit the existing Kleene `Rule`/`Expr` contract in `@ibasho/core/rules`. Performance paths need a proposed vs reference simulation and a ratio; they need a new `Metric` and `PerformanceCheck` contract (proposal in section 7).

Confidence policy: every threshold below carries a grade. `primary` = read in the official text this session; `secondary` = read in a reliable secondary source; `estimate` = from prior knowledge of the code, **must be verified against the clause before it ships**. Per the principle "unknown is not zero", a rule with grade `estimate` evaluates normally but the UI shows the seal "Unverified threshold".

## 2. Code landscape

### 2.1 Global

| Code | Status (Oct 2026) | Applies to | Paths | Use in Ibasho |
|---|---|---|---|---|
| ASHRAE 90.1-2022 | Current US commercial standard (all but low-rise residential) | Commercial, multifamily 4+ storeys | Prescriptive (5 to 10), Energy Cost Budget (11), Performance Rating Method (Appendix G) | Baseline generator; LEED and IGBC base. [ashrae.org](https://www.ashrae.org/technical-resources/bookstore/standard-90-1) |
| IECC 2024 | Model code, US | Residential (R) and commercial (C, can defer to 90.1-2022) | Prescriptive, total UA, performance, ERI (residential) | Optional pack; ERI is a nice residential score. [ICC](https://codes.iccsafe.org/content/IECC2024V1.0) |
| ISO 52000 family | International EPB framework | All | ISO 52000-1 overarching; ISO 52016-1 hourly or monthly heat balance; ISO 52010 climate; ISO 52003 indicators and classes | Our monthly engine should claim ISO 52016-1 monthly method alignment. [ISO 52000-1](https://www.iso.org/standard/65601.html) |
| EU EPBD recast (Directive (EU) 2024/1275) | In force May 2024, transposition by May 2026 | EU | Zero emission buildings: new public from 2028, all new from 2030; harmonised A to G certificates (A = zero emission); MEPS for worst non-residential (16 % by 2030, 26 % by 2033); solar on new buildings | Optional "EU lens"; A to G scale is a good UX metaphor. [EUR-Lex](https://eur-lex.europa.eu/eli/dir/2024/1275/oj) |
| LEED v4.1 BD+C | Still registrable, being phased out for v5 | Commercial, multifamily | EA prereq Minimum Energy Performance; EA credit Optimize Energy Performance (cost + GHG tables); WE prereqs and credits | Points estimator. [USGBC v4.1](https://www.usgbc.org/leed/v41) |
| LEED v5 BD+C | Launched April 2025 | Same | Decarbonisation focus: electrification, peak thermal load, efficiency, renewables; 90.1-2019/2022 baseline | Points estimator (newer). [USGBC LEED v5](https://www.usgbc.org/leed-v5), [IESVE summary](https://iesve.com/discoveries/view/53849/LEED-v5-raises-the-bar-on-building-performance) |
| IFC EDGE (v3) | Active, strong in India | Homes, offices, hotels, hospitals, retail, education, mixed | EDGE Certified: at least 20 % less operational energy, 20 % less water, 20 % less embodied carbon in materials vs local baseline; EDGE Advanced: 40 % energy; EDGE Zero Carbon | The easiest certification to model fully: three percentages vs local baseline. [edgebuildings.com](https://edgebuildings.com/certify/) |

### 2.2 India

| Code | Status | Trigger | Tiers / paths | Notes |
|---|---|---|---|---|
| ECBC 2017 (commercial) | Notified 2017; adopted by many states | Connected load 100 kW or more, or contract demand 120 kVA or more | ECBC, ECBC+, SuperECBC; prescriptive, building envelope trade-off, whole building performance (EPI ratio) | Five climate zones; Hyderabad = **composite** (NBC 2016 map) |
| ECSBC 2024 (commercial) | Published by BEE; binds only once a state notifies | Same 100 kW / 120 kVA | ECSBC, ECSBC Plus, Super ECSBC | Adds renewables share of contract demand, water and materials |
| Draft MoP rating rule 2026 | Draft (June 2026) | BUA 20,000 m2 or more, office, commercial or residential | BEE Star 3/4/5 or GRIHA 3, IGBC Gold, LEED Gold, GEM-3 | 10 year validity, fees INR 1,00,000 (commercial), INR 50,000 (residential) |
| Eco Niwas Samhita 2018 Part I (ECBC-R) | Notified 2018 | Residential (state sets size; often plot 500 m2) | RETV limit, roof U, openable area, VLT | Simple, fully computable from geometry |
| ENS 2024 (ECSBC Residential) | Published Sept 2024 | Same | Adds Part II (lighting, pumps, lifts, RE) and sustainability | Verify final tier names |
| NBC 2016 Part 11 | National Building Code, guidance | All | Approach to sustainability, references ECBC | Part 8 lighting and ventilation gives daylight and window area minimums |
| TSECBC (Telangana, 2014) | Mandatory via GHMC DPMS | Non residential, plot > 1,000 m2 or BUA > 2,000 m2 | Prescriptive or WBP; GHMC 1 to 6 stars | TPA at design and before occupancy |
| GRIHA v2019 | Voluntary (often mandated for government buildings) | All new buildings | 1 to 5 stars on 100 points; ECBC compliance is mandatory within GRIHA | [grihaindia.org](https://www.grihaindia.org/) |
| IGBC Green New Buildings | Voluntary | Commercial, residential, etc. | Certified, Silver, Gold, Platinum; energy credit by % savings vs ASHRAE 90.1 or ECBC baseline | [igbc.in](https://igbc.in/) |
| BEE star labels, existing buildings | Voluntary | Offices (day use), BPOs, hospitals, hotels, shopping malls | 1 to 5 stars on actual EPI (kWh/m2/yr) by climate zone and AC share | Ideal for the "how does my building compare" view using bills. [BEE buildings](https://beeindia.gov.in/en/programmes/energy-efficiency-in-buildings) |

## 3. Prescriptive requirements catalogue (India focus)

### 3.1 ECBC 2017 envelope, composite climate (Hyderabad)

| Item | ECBC | ECBC+ | SuperECBC | Grade |
|---|---|---|---|---|
| Roof U max (W/m2K), daytime use | 0.33 | 0.26 | 0.20 | estimate |
| Roof U max, 24 h use (hotels, hospitals) | 0.20 | 0.20 | 0.20 | estimate |
| Opaque wall U max, composite | 0.40 | 0.34 | 0.22 | estimate (0.40 confirmed in GRIHA slide "U-value of 0.4 W/m2K for walls" for composite) |
| Vertical fenestration U max | 3.00 | 2.20 | 2.20 | estimate |
| Vertical fenestration SHGC max (non north) | 0.27 | 0.25 | 0.25 | estimate |
| SHGC max on north facades, latitude 15 N or more | 0.50 | 0.50 | 0.50 | estimate (Hyderabad 17.4 N qualifies) |
| WWR max for prescriptive path | 40 % | 40 % | 40 % | estimate |
| Skylight roof ratio max | 5 % | 5 % | 5 % | estimate |
| Cool roof (slope under 20 deg): initial solar reflectance / emittance | 0.60 / 0.90 | same | same | estimate |
| Daylight: share of above grade floor area with UDI 100 to 2,000 lux for 90 % of potential daylit hours (business) | 40 % | 50 % | 60 % | estimate |
| Renewable energy zone on roof | 25 % of roof area reserved | RE generation required | higher | estimate |

Earlier ECBC 2007 composite values (U 3.3, SHGC 0.25 below 40 % WWR, 0.20 for 40 to 60 %) still appear on state sites ([HAREDA](https://hareda.gov.in/brief-summary-of-ecbc/)); TSECBC 2014 was based on ECBC 2007, so the GHMC check may still use these. Keep both as versions in the catalogue with `effectiveFrom`.

### 3.2 ECBC 2017 lighting power density (building area method, W/m2)

| Type | ECBC | ECBC+ | SuperECBC | Grade |
|---|---|---|---|---|
| Office | 9.5 | 7.6 | 5.0 | estimate |
| Hotel | 9.5 | 7.6 | 5.0 | estimate |
| Hospital | 9.7 | 7.8 | 4.9 | estimate |
| School / university | 11.2 | 9.0 | 6.0 | estimate |
| Retail (shopping) | 14.1 | 10.2 | 6.9 | estimate |

Mandatory controls (all tiers): occupancy sensors in enclosed spaces, daylight zone controls, exterior lighting automatic off. HVAC: minimum chiller COP / IPLV and unitary AC efficiency by tier (BEE star or ISEER), economiser above a capacity threshold, VFDs on large pumps and fans. Values: verify in ECBC 2017 chapter 5.

### 3.3 Eco Niwas Samhita Part I (residential), Hyderabad = composite

| Item | Limit | Grade |
|---|---|---|
| RETV (residential envelope transmittance value), all zones except cold | at most 15 W/m2 | estimate |
| Roof U (Uroof) | at most 1.2 W/m2K | estimate |
| Openable window to floor area ratio (WFRop), composite | at least 12.5 % (hot dry 10 %, warm humid 16.66 %, temperate 12.5 %, cold 8.33 %) | estimate |
| Visible light transmittance by WWR | WWR 0 to 0.30: VLT 0.27; 0.31 to 0.40: 0.20; 0.41 to 0.50: 0.16; 0.51 to 0.60: 0.13; 0.61 to 0.70: 0.11 | estimate |
| Cold climate envelope U (Uenvelope,cold) | at most 1.8 W/m2K | estimate |

RETV formula (ENS 2018, clause 3.1): RETV = (1 / A_envelope) x [ a x sum(A_opaque,i x U_opaque,i x theta_i) + b x sum(A_nonopaque,i x U_nonopaque,i x theta_i) + c x sum(A_nonopaque,i x SHGC_eq,i x omega_i) ], where A_envelope excludes roof and floor. Coefficients: composite a = 6.06, b = 1.85, c = 68.99; hot dry same; warm humid 5.15, 1.31, 65.21; temperate 3.38, 0.37, 63.69. Orientation factor omega, latitude below 23.5 N: N 0.659, NE 0.906, E 1.155, SE 1.125, S 0.966, SW 1.124, W 1.156, NW 0.908 (grade: estimate; verify ENS Table 3). SHGC_eq accounts for shading by overhangs and side fins via an external shading factor, so **overhang geometry from the floor plan editor feeds RETV directly**. This is a strong, untapped feature: live RETV as the user drags an overhang.

### 3.4 NBC 2016 (all building types)

| Rule | Value | Grade |
|---|---|---|
| Habitable room openings (windows plus ventilators) | at least 1/10 of floor area (Part 3 / Part 8) | estimate |
| No point in a habitable room further than 7.5 m from an opening (daylight) | 7.5 m | estimate |

### 3.5 BEE star label for existing offices (concept)

Stars from actual EPI = annual kWh / built-up area, banded by climate zone and percentage air conditioned. Example band shape for a fully air conditioned office, composite: 1 star roughly 190 to 165, each star a 25 kWh/m2/yr step, 5 stars below about 90 (grade: estimate). Load the official tables per type (offices, BPOs, hospitals, hotels, malls) as data.

## 4. Performance paths

### 4.1 ASHRAE 90.1-2022 Appendix G (Performance Rating Method)

- **Metric.** Performance Cost Index PCI = Proposed building performance (annual energy cost, PBP) / Baseline building performance (BBP).
- **Pass.** PCI at most PCIt, with PCIt = (BBUEC + BPF x BBREC) / BBP, where BBUEC = baseline unregulated energy cost, BBREC = baseline regulated energy cost, BPF = building performance factor from Table 4.2.1.1 by building type and ASHRAE climate zone.
- **Renewables.** On site renewables reduce PBP, capped (2019: credit limited to 5 % of BBP when used for code compliance; verify 2022 wording).
- **Baseline rules (Table G3.1).** Same geometry, orientation, schedules and unregulated loads as proposed; envelope at fixed 90.1-2004 era values (Tables G3.4 to G3.9) so the baseline never moves between editions; baseline WWR = proposed or Table G3.1.1-1 value by type if lower (e.g. small office 19 %, medium office 31 %, large office 40 %, hospital 27 %, small hotel 24 %, large hotel 34 %, primary school 22 %, secondary school 22 %, mid-rise apartment 20 %; grade: estimate); baseline HVAC system from Table G3.1.1-3 by type, floors, area and heating source (residential: system 1 or 2 PTAC/PTHP; small non residential: PSZ-AC/PSZ-HP; medium: packaged VAV; large: VAV with chillers). Climate zones 0 to 3A use electric heating baselines.
- **Hyderabad climate zone.** ASHRAE 169: zone 0B (extremely hot, dry; CDD10 above 5,000) by estimate from mean annual temperature near 27 C; verify for station 43128.
- **BPF examples (90.1-2019, zone 0B to 1B, grade: estimate):** office about 0.5, hotel about 0.5 to 0.6, hospital (healthcare) about 0.6, school about 0.4, multifamily about 0.7. Load real Table 4.2.1.1 values for 2019 and 2022 as data.

### 4.2 ECBC / ECSBC whole building performance

- Model proposed and "standard design" (prescriptive compliant) per ECBC chapter 9 / Appendix B, using the same weather file.
- **Metric.** EPI ratio = EPI_proposed / EPI_standard. ECBC compliant if ratio at most 1; ECBC+ and SuperECBC have type and climate specific maximum ratios (ECBC 2017 Table 9-x). Load as data, grade estimate until verified.
- **GHMC star mapping** (TSECBC, primary): savings s = 1 minus ratio. Stars: prescriptive pass or s up to 5 %: 1; s at least 10 %: 2; 15 %: 3; 20 %: 4; 25 %: 5; 30 %: 6.

### 4.3 LEED

**v4.1 EA Optimize Energy Performance (BD+C NC):** percent improvement of PCI below PCIt computed twice, once on cost and once on GHG; points from each table summed, capped at 18. Cost table starts at 1 point for 5 % and rises in 5 % steps to 10 points at 50 %; GHG table starts at 5 % for 1 point and reaches 10 points at 80 % ([LEEDuser](https://leeduser.buildinggreen.com/taxonomy/term/4929), grade: secondary). Prereq: Minimum Energy Performance (5 % for NC vs 90.1-2016 Appendix G; estimate).

**v5 BD+C:** prerequisites include Operational Carbon Projection and Decarbonisation Plan, Minimum Energy Efficiency, Fundamental Commissioning, Energy Metering and Reporting, Fundamental Refrigerant Management. Credits include Electrification, Reduce Peak Thermal Loads, Enhanced Energy Efficiency (up to 10 points, from 1 point at 3 % to 10 at 30 %, with a second path counting on site renewables), Renewable Energy, Enhanced Commissioning, Grid Interactive, Enhanced Refrigerant Management. Baseline moves to 90.1-2019/2022. Sources: [IESVE](https://iesve.com/discoveries/view/53849/LEED-v5-raises-the-bar-on-building-performance), [Arlington County v5 webinar](https://www.arlingtonva.us/files/sharedassets/public/v/1/departments/documents/aire/20260324_arlington-county-leedv5-update-webinar.pdf) (grade: secondary; verify exact tables).

**Water (v4.1):**

| Item | Rule | Grade |
|---|---|---|
| Indoor water use reduction, prereq | at least 20 % below baseline fixtures | estimate |
| Baseline fixtures | WC 6.0 lpf (1.6 gpf); urinal 3.8 lpf (1.0 gpf); public lavatory 1.9 l/min (0.5 gpm); private lavatory and kitchen sink 8.3 l/min (2.2 gpm); shower 9.5 l/min (2.5 gpm) | estimate |
| Indoor water credit | 25 % 1 pt, 30 % 2, 35 % 3, 40 % 4, 45 % 5, 50 % 6 | estimate |
| Outdoor water use reduction, prereq | at least 30 % below peak watering month baseline (or no irrigation) | estimate |
| Outdoor credit | 50 % 1 pt, 100 % 2 pts | estimate |

Water use = sum over fixtures (flow x uses per day x duration x occupants x days). This is pure arithmetic over room function and occupancy, so Ibasho can compute it from the floor plan with no simulation.

### 4.4 IFC EDGE

Pass if, against EDGE's local baseline for the type and city: energy savings at least 20 %, water savings at least 20 %, embodied carbon (materials) savings at least 20 % (EDGE Certified); 40 % energy for EDGE Advanced; Zero Carbon adds 100 % renewables or offsets. Baselines are city specific (Hyderabad available). Grade: secondary. [EDGE](https://edgebuildings.com/certify/)

## 5. Machine-checkable rule catalogue (first cut)

Fact ids follow the existing namespaces with a new `b.*` (building) and `z.*` (zone/room) family proposed in section 7. Conditions use the `Expr` grammar from `packages/core/src/rules.ts`. `effect` uses existing kinds where possible (`oblige max-u`, `warn`, `info`, `check`) plus a proposed `comply` kind for code checks that produce pass / fail / unknown with a margin.

| id | code | building types | when (condition) | metric | threshold | effect | source | grade |
|---|---|---|---|---|---|---|---|---|
| IN.ECBC17.APPLY | ECBC 2017 | office, hotel, education, hospital, lab, retail | b.use != residential AND (b.connectedLoadKw >= 100 OR b.contractDemandKva >= 120) | applicability | n/a | info: ECBC applies | BEE ECBC 2017 s1 | estimate |
| IN.TS.ECBC.APPLY | TSECBC 2014 | non residential | b.region = IN-TG AND b.use != residential AND (b.plotM2 > 1000 OR b.buaM2 > 2000) | applicability | n/a | consent: building-control (GHMC DPMS, TPA certificate) | GHMC FAQ Q4 | primary |
| IN.MOP26.RATING | MoP draft 2026 | office, commercial, residential | b.buaM2 >= 20000 | rating level | BEE 3 Star or GRIHA 3 or IGBC Gold or LEED Gold or GEM-3 | check: rating-required | powermin draft r3, r5 | primary (draft) |
| IN.ECBC17.ROOF.U | ECBC 2017 | daytime non residential | ECBC applies AND b.climateZone = composite | roof U | <= 0.33 / 0.26 / 0.20 by tier | oblige max-u roof | ECBC 2017 4.3.1 | estimate |
| IN.ECBC17.ROOF.U.24H | ECBC 2017 | hotel, hospital | as above AND b.use in {hotel, hospital} | roof U | <= 0.20 | oblige max-u roof | ECBC 2017 4.3.1 | estimate |
| IN.ECBC17.WALL.U | ECBC 2017 | non residential | composite | wall U | <= 0.40 / 0.34 / 0.22 | oblige max-u wall | ECBC 2017 4.3.2 | estimate |
| IN.ECBC17.WWR | ECBC 2017 | non residential | prescriptive path | WWR | <= 0.40 | comply (else force trade-off or WBP) | ECBC 2017 4.3.3 | estimate |
| IN.ECBC17.FEN.U | ECBC 2017 | non residential | composite | window U | <= 3.00 / 2.20 / 2.20 | oblige max-u window | ECBC 2017 4.3.3 | estimate |
| IN.ECBC17.FEN.SHGC | ECBC 2017 | non residential | facade orientation != N | SHGC (effective, with shading) | <= 0.27 / 0.25 / 0.25 | comply | ECBC 2017 4.3.3 | estimate |
| IN.ECBC17.FEN.SHGC.N | ECBC 2017 | non residential | facade = N AND b.latitude >= 15 | SHGC | <= 0.50 | comply | ECBC 2017 4.3.3 | estimate |
| IN.ECBC17.SRR | ECBC 2017 | non residential | skylights present | skylight roof ratio | <= 0.05 | comply | ECBC 2017 4.3.4 | estimate |
| IN.ECBC17.COOLROOF | ECBC 2017 | non residential | roof slope < 20 deg | solar reflectance, emittance | >= 0.60, >= 0.90 | comply | ECBC 2017 4.3.1.1 | estimate |
| IN.ECBC17.DAYLIGHT | ECBC 2017 | business, education | ECBC applies | share of floor area with UDI 100 to 2000 lux for 90 % of daylit hours | >= 40 / 50 / 60 % | comply | ECBC 2017 4.2.3 | estimate |
| IN.ECBC17.LPD.OFFICE | ECBC 2017 | office | ECBC applies | LPD W/m2 | <= 9.5 / 7.6 / 5.0 | comply | ECBC 2017 6.3 | estimate |
| IN.ECBC17.WBP | ECBC 2017 | non residential | performance path | EPI ratio | <= 1.0 (compliant); tier table for + and Super | comply | ECBC 2017 9 | estimate |
| IN.TS.GHMC.STARS | TSECBC | non residential | TSECBC applies | savings vs standard design | 5/10/15/20/25/30 % for 1 to 6 stars | info: star level | GHMC FAQ Q7 | primary |
| IN.ECSBC24.RE.PLUS | ECSBC 2024 | commercial | tier = Plus | RE capacity / contract demand | >= 0.075 | comply | BEE draft ECSBC; Mercom | secondary |
| IN.ECSBC24.RE.SUPER | ECSBC 2024 | commercial | tier = Super | RE capacity / contract demand | >= 0.15 | comply | as above | secondary |
| IN.ENS.RETV | ENS 2018 / 2024 | apartments, rental, single family | b.use = residential AND b.climateZone != cold | RETV W/m2 | <= 15 | comply | ENS 3.1 | estimate |
| IN.ENS.ROOF.U | ENS | residential | all | roof U | <= 1.2 | oblige max-u roof | ENS 3.3 | estimate |
| IN.ENS.WFROP | ENS | residential | composite | openable window / floor area per dwelling unit | >= 0.125 | comply | ENS 4.1 | estimate |
| IN.ENS.VLT | ENS | residential | WWR band | VLT | table 3.3 above | comply | ENS 4.2 | estimate |
| IN.NBC16.OPENINGS | NBC 2016 | all | room is habitable | opening area / room floor area | >= 0.10 | warn | NBC Part 3/8 | estimate |
| GL.A90.PRM | ASHRAE 90.1-2022 App G | all non low-rise residential | performance path | PCI vs PCIt | PCI <= PCIt | comply | 90.1-2022 4.2.1.1, G1.2 | estimate |
| GL.LEED41.EA | LEED v4.1 | all | LEED target | % below PCIt (cost), (GHG) | point tables | info: points | LEEDuser | secondary |
| GL.LEED5.EEE | LEED v5 | all | LEED target | % improvement vs baseline | 3 % = 1 pt ... 30 % = 10 pts | info: points | Arlington v5 deck | secondary |
| GL.LEED41.WE.IN | LEED v4.1 | all | always | indoor water reduction | >= 20 % prereq; 25 to 50 % for 1 to 6 pts | comply / info | LEED v4.1 WE | estimate |
| GL.LEED41.WE.OUT | LEED v4.1 | with landscape | site has irrigated area | outdoor water reduction | >= 30 % prereq; 50 % 1 pt, 100 % 2 pts | comply / info | LEED v4.1 WE | estimate |
| GL.EDGE.CERT | IFC EDGE v3 | all EDGE types | EDGE target | energy, water, embodied carbon savings vs local base | each >= 20 % (energy >= 40 % Advanced) | comply | edgebuildings.com | secondary |
| EU.EPBD.ZEB | EPBD 2024 | all | b.region in EU AND new AND (public AND year >= 2028 OR year >= 2030) | operational emissions | zero on site fossil, very low energy | info | Directive (EU) 2024/1275 art. 7 | primary (text known) |

Tiers are encoded as three rules sharing a stem (`.T1`, `.T2`, `.T3`) so the evaluator reports the highest tier passed. Each rule stores `versions[]` with `effectiveFrom`, so ECBC 2007 (TSECBC basis), ECBC 2017 and ECSBC 2024 coexist.

## 6. Building type mapping

| Ibasho type | ECBC / ECSBC class | 90.1 App G / BPF class | LEED | BEE star label | ENS |
|---|---|---|---|---|---|
| office | Business (daytime) | Office | BD+C NC/C&S | Office (day use) | no |
| hotel | Hospitality (no star / star, 24 h) | Hotel | BD+C Hospitality | Hotel | no |
| education | Educational (daytime) | School | BD+C Schools | none yet | no |
| hospital | Healthcare (24 h) | Healthcare / hospital | BD+C Healthcare | Hospital | no |
| lab | Business or "all others" (ventilation dominated; flag high plug and fan loads) | All others / laboratory | BD+C NC | none | no |
| apartments | Residential (ENS); common areas may trip ECSBC if 100 kW | Multifamily | BD+C Multifamily | none | yes |
| rental | as apartments; owner vs tenant split matters for billing | Multifamily | Multifamily | none | yes |
| single family home | Residential (ENS if plot over state threshold) | n/a (IECC R) | LEED Residential SF | none | yes |

IIIT Hyderabad Vindhya and Himalaya blocks are educational / office use: ECBC daytime business class, composite climate, GHMC TSECBC if BUA over 2,000 m2. WeWork towers in HITEC City are large office: ECBC 2017 and, under the 2026 draft, mandatory rating if BUA 20,000 m2 or more.

## 7. Proposals for Ibasho

1. **Rule pack split.** `packs/rules-in` gains `codes/ecbc2007.ts`, `ecbc2017.ts`, `ecsbc2024.ts`, `ens2018.ts`, `ens2024.ts`, `tsecbc.ts`, `nbc2016.ts`, `mop2026.ts`; a new `packs/rules-global` holds `ashrae901-2022`, `leed41`, `leed5`, `edge`, `epbd`, `iecc2024`. Each rule carries `source.grade` and the UI seal "Unverified threshold" for `estimate`.
2. **Contract additions (INTERFACES request to WP-00):**
   - `Effect` gains `{ kind: 'comply'; metric: MetricId; op: CmpOp; limit: number; tier?: 1|2|3 }`, evaluated three-valued: pass, fail, unknown (missing fact), with margin for the UI.
   - New `MetricId` registry: `u.roof`, `u.wall`, `u.window`, `shgc.eff`, `wwr`, `srr`, `lpd`, `retv`, `wfr.op`, `vlt`, `udi.share`, `epi`, `epi.ratio`, `pci`, `water.in.pct`, `re.share.cd`.
   - Facts `b.use`, `b.buaM2`, `b.plotM2`, `b.connectedLoadKw`, `b.contractDemandKva`, `b.climateZone` (ECBC), `b.ashraeZone`, `b.latitude`, `b.region`, `z.function`, `z.habitable`.
3. **Two baselines from one twin.** A `BaselineBuilder` (engine) that clones the proposed twin and applies (a) ECBC standard design rules and (b) Appendix G G3.1 rules. Both run through the same monthly engine, so ratios are consistent. The ratio, not the absolute kWh, is what the codes test, which is robust to a monthly model's bias.
4. **Lean.** Point tables and star mappings are monotone step functions: prove monotonicity (more savings never fewer points) and that tier outcomes are nested (Super implies Plus implies Compliant) in `proofs/`. Cheap, and it catches data entry errors in tables.
5. **One "rating ladder" view.** For a Hyderabad building show, on one axis of percent savings: GHMC stars, BEE 3/4/5 Star, LEED points (v4.1 and v5), IGBC level, EDGE 20/40 %. Users see that one retrofit bundle moves several ladders. Nobody shows this today.
6. **RETV live meter.** Residential floor plan editor computes RETV and WFRop per dwelling as walls, windows and overhangs change; ENS is fully geometric, so this needs no simulation.
7. **Optimisation targets.** The search objective can be "cheapest bundle that reaches BEE 3 Star / IGBC Gold / LEED Gold" (constraint) rather than raw kWh, which matches the 2026 draft rule.
8. **Verification task.** Before shipping, obtain the official ECBC 2017, ENS 2018/2024 and ECSBC 2024 PDFs (BEE site blocks scripted download; fetch manually) and upgrade every `estimate` row to `primary`. Also confirm Telangana's current notification (ECBC 2017 or ECSBC) with TGREDCO.

## 8. Open questions

- Has Telangana notified ECBC 2017 or ECSBC 2024, replacing TSECBC 2014 thresholds? Unknown.
- Final ECSBC 2024 tables (envelope and EPI ratios) versus ECBC 2017: assume equal until verified.
- LEED v5 exact Enhanced Energy Efficiency metric (cost, source energy or carbon) for international projects.
- Whether the 2026 MoP draft is finalised, and whether residential 20,000 m2 counts per building or per complex.

## 9. Sources

- Ministry of Power, Draft Notification on mandatory building rating, June 2026: https://powermin.gov.in/static/uploads/2026/07/f981ac1fc7a15c1136606ec2cd1979ca.pdf (local copy: `sources/energy-codes/powermin-2026-draft.pdf`)
- GHMC / NRDC, FAQs: Online compliance system for ECBC for Hyderabad, April 2017: https://www.ghmc.gov.in/Townplanning_Reports/TSECBCFAQs.pdf (local copy)
- BEE, Draft ECSBC, commercial office buildings, 2024: https://beeindia.gov.in/sites/default/files/2024-01/Draft%20ECSBC%20-%20Commercial%20office%20buildings_0.pdf
- BEE, Eco Niwas Samhita 2024: https://beeindia.gov.in/sites/default/files/ENS%202024_Buildign%20Code%20for%20Residential%20Buildings.pdf
- BEE, Invitation for feedback on draft ENS 2024: https://beeindia.gov.in/sites/default/files/2024-01/Invitation%20for%20Feedback%20on%20Draft%20ENS%202024%20%28ECSBC-Residential%29.pdf
- Mercom, ECSBC renewables: https://mercomindia.com/bees-new-building-code-could-boost-solar-adoption-in-commercial-buildings
- HAREDA, ECBC and ENS: https://hareda.gov.in/ecbc-and-ens-buildings/ and https://hareda.gov.in/brief-summary-of-ecbc/
- GRIHA, ECBC slides (2019): https://www.grihaindia.org/sites/default/files/pdf/ECBC-Code.pdf (local copy)
- NRDC, Implementing ECBC and cool roofs in Telangana: https://www.nrdc.org/experts/implementing-ecbc-and-cool-roofs-telangana
- Mercom, Telangana first ECBC compliant state: https://www.mercomindia.com/telangana-first-state-ecbc-compliant
- LEEDuser, v4.1 Optimize Energy Performance: https://leeduser.buildinggreen.com/taxonomy/term/4929
- IESVE, LEED v5 summary: https://iesve.com/discoveries/view/53849/LEED-v5-raises-the-bar-on-building-performance
- Arlington County, LEED v5 update webinar (2026): https://www.arlingtonva.us/files/sharedassets/public/v/1/departments/documents/aire/20260324_arlington-county-leedv5-update-webinar.pdf
- USGBC LEED v5: https://www.usgbc.org/leed-v5
- ASHRAE 90.1: https://www.ashrae.org/technical-resources/bookstore/standard-90-1
- ICC IECC 2024: https://codes.iccsafe.org/content/IECC2024V1.0
- ISO 52000-1: https://www.iso.org/standard/65601.html
- EPBD recast, Directive (EU) 2024/1275: https://eur-lex.europa.eu/eli/dir/2024/1275/oj
- IFC EDGE: https://edgebuildings.com/certify/
- BEE buildings programme: https://beeindia.gov.in/en/programmes/energy-efficiency-in-buildings
