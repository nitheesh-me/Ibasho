# Building types, loads, EUI, tariffs and carbon (v3 brief)

Specialist brief for the v3 direction: eight building types, Hyderabad first, global second. Everything here is meant to become data in plugin packs, with a source id on every number and a range rather than a point where the evidence is soft. Date of research: October 2026.

Status labels used below:
- **V** verified this session against the primary document (or a primary table via a reliable mirror).
- **S** from a secondary source found this session; check against the primary before shipping as "official".
- **M** from the author's knowledge of the standard; plausible and widely quoted, but not re-read this session. Ship as a typical value with a range, never as a code limit, until checked.

---

## 1. What to build (proposal in one page)

Three new data packs, plus extensions to two existing ones. All plain data plus small pure functions; engine reads them through `@ibasho/core` contracts.

| Pack | Contents | Shape |
|---|---|---|
| `packs/types-global` | Space types (ASHRAE 62.1 categories), building type profiles (mix of space types), schedules, LPD/EPD/occupancy/ventilation/set point/DHW defaults with low, typical, high | `BuildingTypeProfile`, `SpaceTypeProfile`, `Schedule24x3` (weekday, Saturday, Sunday or holiday) |
| `packs/types-in` | Indian overrides: NBC 2016 occupancy and water demand, ECBC 2017 / ECSBC 2024 schedules and LPD, IMAC adaptive comfort, Indian HVAC system archetypes, BEE bands | same types, `region: "IN"`, overrides keyed by id |
| `packs/benchmarks` | EUI benchmarks: ENERGY STAR US medians, CIBSE TM46, BEE star bands, Indian study ranges, end-use split priors | `EuiBenchmark { typeId, source, basis: site|source, unit, value | bands[] }` |
| `packs/money-in` (extend) | TGSPDCL tariff FY 2026-27 (LT-I, LT-II, HT-II, ToD), Gruha Jyothi rule, HMWSSB water slabs and free 20 kL rule, LPG and diesel price points | `Tariff { slabs[], fixed[], tod[], cliffs[] , validFrom, validTo }` |
| `packs/carbon` (new, or inside `money-in`) | CEA grid factors (weighted average, OM, BM, CM per FY), fuel factors (IPCC 2006), water energy intensity estimate, UK, US, world grid factors | `EmissionFactor { carrier, region, year, value, unit, method }` |

Design rules that follow from Ibasho principles:
- Every default is a **range with a source**, displayed as "typical for a Hyderabad office, from NBC 2016 and ECBC 2017". The engine uses the typical value; the narrator can say "between X and Y".
- **Unknown is not zero**: if a type has no DHW data, DHW is `unknown`, not 0, and EUI is reported as partial.
- **Version everything by validity date**: tariffs change every April; BEE office star bands were revised in 2022 and the whole BEE building star labelling programme has been "under revision, no applications accepted" since 25 September 2025 (BEE page, S). The pack must carry `validFrom/validTo` and a `status: current | superseded | under-revision`.

---

## 2. Location defaults: Hyderabad

| Item | Value | Status | Source |
|---|---|---|---|
| Climate zone (NBC 2016, ECBC 2017, ECSBC 2024) | Composite | M | ECBC 2017 Appendix B city table; NBC 2016 Part 11 |
| Heating need | Negligible (HDD18 near 0); winter lows about 13 to 15 C, so heating end use is near zero but **DHW is not** | M | ISHRAE weather data |
| Cooling need | High: CDD18 roughly 3,300 to 3,700 per year; dry heat March to May, humid monsoon June to September | M | ISHRAE / TMY |
| Rooftop PV yield | About 1,450 to 1,600 kWh per kWp per year | M | Global Solar Atlas, PVWatts (cross check with site radiation stage) |
| Grid | TGSPDCL (south Telangana, covers GHMC) | V | tgsouthernpower.org |
| Water utility | HMWSSB | S | hmwssb.gov.in |

---

## 3. Space type library (global base, ASHRAE 62.1-2022 Table 6-1 style)

Ventilation: Rp (L/s per person), Ra (L/s per m2), default occupant density (people per 100 m2). ASHRAE 62.1 values are **M** (well known; check against 62.1-2022 Table 6-1 before labelling as code). LPD and EPD are typical in-use values for modelling, not code limits.

| Space type id | Rp | Ra | Density /100 m2 | LPD typical W/m2 (LED era) | EPD typical W/m2 | Notes |
|---|---|---|---|---|---|---|
| office.open | 2.5 | 0.3 | 5 (NBC: 10 m2 per person, i.e. 10) | 6 to 9 | 8 to 12 (IT/BPO 15 to 25) | Indian IT floors are denser: 7 to 9 m2 per desk |
| office.meeting | 2.5 | 0.3 | 50 | 8 to 10 | 3 to 6 | |
| corridor | 0 | 0.3 | 0 | 3 to 5 | 0 | |
| lobby | 3.8 | 0.3 | 30 | 6 to 10 | 1 to 2 | |
| hotel.guestroom | 2.5 | 0.3 | 10 (2 per room) | 5 to 7 | 4 to 8 | Plus bathroom exhaust 25 L/s |
| hotel.kitchen | 3.8 | 0.6 | 20 | 10 to 12 | 50 to 300 (gas or electric) | LPG/PNG dominant in India |
| classroom.9plus | 3.8 | 0.6 | 35 | 7 to 10 | 4 to 8 | Indian classrooms: 1.0 to 1.5 m2 per pupil (NBC) |
| lecture.hall | 3.8 | 0.3 | 65 | 8 to 10 | 2 to 5 | |
| hostel.room | 2.5 | 0.3 | 10 to 20 | 4 to 6 | 3 to 6 | Ceiling fan plus optional split AC |
| lab.science | 5.0 | 0.9 | 25 | 10 to 14 | 20 to 50 | Fume hoods dominate: 6 to 12 ACH once through (Labs21) |
| hospital.patientroom | ASHRAE 170: 2 ACH OA, 4 ACH total | | 1 to 2 beds | 6 to 9 | 5 to 10 | 24/7 |
| hospital.OT | ASHRAE 170: 4 ACH OA, 20 ACH total; NBC/NABH also 20+ | | | 20 to 25 | 20 to 40 | 100% OA or high OA, HEPA, positive pressure |
| hospital.ICU | 2 ACH OA, 6 ACH total | | | 10 to 15 | 15 to 25 | |
| dwelling.living / bedroom | ASHRAE 62.2: Q = 0.15 L/s per m2 floor + 3.5 L/s x (bedrooms + 1) | | 2 per bedroom | 3 to 5 | 3 to 6 | Kitchen exhaust 50 L/s intermittent |
| retail | 3.8 | 0.6 | 15 | 10 to 14 | 2 to 5 | for mixed-use ground floors |
| parking.basement | 0 | 3.7 (exhaust) | | 1.5 to 2 | 0 | Jet fans; big hidden load in Hyderabad towers |

Indian ventilation (NBC 2016 Part 8 Section 3, M): NBC gives fresh air by occupancy and air changes per hour per space type; ECBC 2017 and ECSBC 2024 require ASHRAE 62.1 or NBC, whichever is higher in practice. Proposal: carry both, default India to "max(NBC, 62.1)".

---

## 4. Building type profiles

### 4.1 Mix, density and system archetype

| Type id | Space mix (typical share of floor) | Occupancy | Typical HVAC India | Typical HVAC global | DHW |
|---|---|---|---|---|---|
| office | 70 office.open, 8 meeting, 12 corridor/core, 5 lobby, 5 service | 8 to 10 m2 per person (NBC 10) | Small: split AC (ISEER star 3 to 5). Mid: VRF. Large/IT park: water-cooled chillers, AHUs, cooling towers, often 24/7 IT wings | VAV with gas boiler (UK/US), heat pumps | Minimal, 1 to 2 L per person per day |
| hotel | 60 guestroom, 10 lobby/restaurant, 5 kitchen, 5 laundry, 20 back of house | 1.5 to 2 guests per occupied room, occupancy 60 to 75% | Chilled water + FCU, heat recovery chillers or heat pumps for DHW, LPG/diesel boilers in older stock | Same; four-pipe FCU | 100 to 150 L hot water per occupied room per day (M, ASHRAE HVAC Applications ch. Service Water Heating) |
| education.school | 60 classroom, 10 lab, 10 hall, 20 circulation | 1.0 to 1.5 m2 per pupil | Ceiling fans, natural ventilation, increasingly split AC; mostly non-AC | Gas heating, natural or mechanical vent | Near zero |
| education.university (academic) | 40 lecture/class, 25 office, 15 lab, 20 circulation | varies | Split/VRF or campus chilled water (IIIT Hyderabad style blocks) | Campus district heat/chilled water | Low |
| education.hostel | 75 rooms, 10 common/mess, 15 circulation | 1 to 3 per room | Fans + optional split AC; solar water heaters plus electric backup | Gas or heat pump DHW | 30 to 50 L per person per day (M) |
| hospital | 35 patient rooms, 10 OT/ICU, 20 diagnostic, 15 office/OPD, 20 service | 70 to 100 m2 gross per bed | Water-cooled chillers, 100% OA for OT/ICU, steam or heat pumps for DHW and sterilisation, DG backup 24/7 | Same; gas boilers | 50 to 100 L hot water per bed per day (M); NBC total water 340 to 450 L per bed per day |
| lab | 40 lab, 30 office, 30 support | | 100% OA once-through, variable air volume fume hoods, chillers | Same plus heat recovery | Process only |
| apartments | 85 dwelling, 15 common (lifts, corridors, parking lighting, pumps) | 3.5 to 4 people per dwelling (Indian household) | Ceiling fans (3 to 5 per flat) + split ACs in bedrooms; common area pumps and lifts | Gas boiler or heat pump | 20 to 40 L at 45 C per person per day (geyser, 15 to 25 L, 2 kW); solar water heaters on roof |
| rental | Same as apartments or single family, plus tenancy split | | Same | Same | Same |
| single_family | 100 dwelling | 4 to 5 people | Fans + 1 to 3 split ACs, inverter fridge, geyser; increasingly rooftop PV | Gas boiler or heat pump | as apartments |

Rental is a **tenure overlay, not a geometry type**: split who pays (landlord pays capex, tenant pays bills) and who decides. Proposal: `tenure: owner | landlord | tenant` on the project, used by optimisation to show split-incentive bundles (for example tenant-side fans and set points versus landlord-side roof insulation and solar water heater).

### 4.2 Set points and comfort

| Context | Cooling | Heating | Status | Source |
|---|---|---|---|---|
| India conditioned (ECBC 2017 / ECSBC 2024 modelling) | 24 C (range 23 to 26) | 21 C (rarely needed in Hyderabad) | M | ECBC 2017 Appendix C; NBC 2016 Part 8 |
| India room AC default | 24 C mandatory factory default since 2020 | | M | BEE notification on AC default temperature |
| India mixed mode (IMAC) | Neutral T = 0.28 x T_rm30 + 17.9 C, 90% band about plus or minus 3.5 C | | M | Manu et al. 2016, IMAC (CEPT), adopted by NBC 2016 |
| India naturally ventilated (IMAC) | Neutral T = 0.54 x T_rm30 + 12.83 C, 90% band about plus or minus 2.4 C | | M | same |
| Ceiling fan uplift | 0.8 to 1.2 m/s air speed raises acceptable operative temperature by about 2 to 3 C | | M | ASHRAE 55 elevated air speed; CEPT studies |
| Global offices | 24 C cooling, 21 C heating, setbacks 27 / 15 unoccupied | | M | ASHRAE 90.1 Appendix G |
| Hospitals | 21 to 24 C, RH 30 to 60%; OT 18 to 24 C | | M | ASHRAE 170 |

T_rm30 is the 30-day running mean outdoor temperature. These two IMAC lines are the "untapped value" for Hyderabad homes: a fan-first, AC-second comfort model that shows how many hours a home is comfortable with fans alone. Make it a lever, not a footnote.

### 4.3 Schedules (weekday, 24 hourly fractions)

Shapes simplified from the US DOE commercial prototype buildings (ASHRAE 90.1 User's Manual schedules) and ECBC 2017 Appendix C, shifted for Indian working hours (M). Pack format: three arrays (weekday, Saturday, Sunday/holiday) per channel (occupancy, lighting, equipment, HVAC on/off, DHW).

| Type | Occupancy weekday (hour 0 to 23) | Saturday | Sunday |
|---|---|---|---|
| office (India 9:30 to 18:30) | 0,0,0,0,0,0,0,0.05,0.2,0.7,0.95,0.95,0.95,0.6,0.95,0.95,0.95,0.9,0.5,0.2,0.1,0.05,0,0 | 0.3 x weekday | 0.05 |
| office.it_24x7 | 0.3 at night, 0.95 day, 0.6 evening | 0.6 | 0.4 |
| hotel guestrooms | 0.9 (0 to 7), 0.5 (8 to 9), 0.3 (10 to 16), 0.6 (17 to 19), 0.9 (20 to 23) x seasonal occupancy | same | same |
| school (8:00 to 15:30) | 0 to 7: 0; 8 to 14: 0.95 (lunch 0.5 at 12); 15: 0.5; rest 0.05 | 0.1 | 0 |
| university academic | 9 to 17: 0.7, 18 to 21: 0.3 | 0.2 | 0.1 |
| hostel | inverse of academic: 0.9 night, 0.3 day | 0.7 | 0.8 |
| hospital wards | 0.9 flat | same | same |
| hospital OPD | 9 to 17: 0.9 | 0.5 | 0.1 |
| lab | 8 to 19: 0.8; HVAC 24/7 at reduced flow at night | 0.3 | 0.1 |
| apartments / single family | 0 to 6: 1.0; 7 to 9: 0.8; 10 to 16: 0.4; 17 to 23: 0.9 | 0.7 day | 0.7 day |

DHW profile (residential India): peaks 6 to 9 (bathing), small evening peak; winter months (November to February) about 2x summer use.

---

## 5. EUI benchmarks

### 5.1 US: ENERGY STAR Portfolio Manager national medians (V)

Source: ENERGY STAR "US National Median Table" (based on CBECS 2018 and industry surveys), downloaded to `sources/eui/es_median.pdf`. https://portfoliomanager.energystar.gov/pdf/reference/US%20National%20Median%20Table.pdf

Conversion: 1 kBtu/ft2 = 3.1546 kWh/m2.

| Ibasho type | ENERGY STAR type | Site EUI kBtu/ft2 | Site kWh/m2 | Source EUI kBtu/ft2 | Source kWh/m2 |
|---|---|---|---|---|---|
| office | Office | 52.9 | 167 | 116.4 | 367 |
| hotel | Hotel | 63.0 | 199 | 146.7 | 463 |
| education.school | K-12 School | 48.5 | 153 | 104.4 | 329 |
| education.university | College/University | 84.3 | 266 | 180.6 | 570 |
| education.hostel | Residence Hall/Dormitory | 57.9 | 183 | 107.5 | 339 |
| hospital | Hospital (General Medical and Surgical) | 234.3 | 739 | 426.9 | 1,347 |
| (clinic) | Medical Office | 97.7 | 308 | 232.8 | 734 |
| lab | Laboratory | 115.3 | 364 | 318.2 | 1,004 |
| apartments, rental | Multifamily Housing | 59.6 | 188 | 118.1 | 373 |

Caution: US medians include large space heating (gas) loads. Do not compare a Hyderabad building to them without saying so; use them for the "global" code profile.

### 5.2 UK: CIBSE TM46 (2008) typical benchmarks (M, office row S)

Per m2 gross internal area per year. Office row confirmed by a secondary reproduction (95 electricity, 120 fossil); other rows from memory of TM46 Table 1, to verify. https://www.cibse.org/knowledge-research/knowledge-portal/tm46-energy-benchmarks

| TM46 category | Electricity | Fossil thermal | Ibasho type |
|---|---|---|---|
| General office | 95 | 120 | office |
| Hotel | 105 | 330 | hotel |
| Schools and seasonal public buildings | 40 | 150 | education.school |
| University campus | 80 | 240 | education.university |
| Hospital: clinical and research | 90 | 420 | hospital |
| Laboratory or operating theatre | 160 | 160 | lab |
| Long-term residential | 65 | 420 | education.hostel |

A Dublin study of 52 college buildings found the 240 university thermal benchmark about 46% too high and suggested 130 (S, https://www.sustainabilityexchange.ac.uk/files/160413_ahr-eauc_he_energy_-_david_h.pdf). Treat TM46 as "old UK stock".

### 5.3 India: BEE star rating bands

Programme status: BEE commercial building star labelling covers offices, BPOs, hospitals, shopping malls (hotels planned); office and BPO bands revised from January 2022 as linear equations in the percentage of air-conditioned area; the programme has accepted no new applications since 25 September 2025 because it is under revision (S, https://beeindia.gov.in/en/node/39597).

**Office, day use (original 2009 scheme bands, kWh/m2/year, M; widely reproduced).** Hyderabad = composite.

| AC share | Zone | 1 star | 2 star | 3 star | 4 star | 5 star |
|---|---|---|---|---|---|---|
| more than 50% AC | Warm humid | 200 to 175 | 175 to 150 | 150 to 125 | 125 to 100 | below 100 |
| more than 50% AC | **Composite** | 190 to 165 | 165 to 140 | 140 to 115 | 115 to 90 | **below 90** |
| more than 50% AC | Hot dry | 180 to 155 | 155 to 130 | 130 to 105 | 105 to 80 | below 80 |
| less than 50% AC | Warm humid | 85 to 75 | 75 to 65 | 65 to 55 | 55 to 45 | below 45 |
| less than 50% AC | **Composite** | 80 to 70 | 70 to 60 | 60 to 50 | 50 to 40 | **below 40** |
| less than 50% AC | Hot dry | 75 to 65 | 65 to 55 | 55 to 45 | 45 to 35 | below 35 |

**2022 revision (S):** each band limit is a line in AC percentage. Worked example from the BEE schedule, composite, 75% AC: 1 star upper limit 0.95 x 75 + 60 = 131.25; lower limit 0.9 x 75 + 50 = 117.5 kWh/m2 (https://beeindia.gov.in/sites/default/files/Schedule%20for%20Office%20Building%20July%202023%20(1).pdf). Proposal: store bands as `{ slope, intercept }` per star per zone so both old and new schemes are the same data shape; fill remaining coefficients when the PDF is retrievable (beeindia.gov.in blocks scripted download; fetch manually).

**Hospital (V):** not fixed EPI bands. A regression model gives a benchmark EPI from beds, area, zone and services; the ratio measured / benchmark is ranked against the national sample (rank 1 = top 1%). Stars by performance rank: 5 star at most 4; 4 star 4 to 12; 3 star 12 to 24; 2 star 24 to 40; 1 star 40 to 60; no star above 60. Applies to hospitals with more than 50% conditioned area; 5 climate zones. Source: `sources/eui/bee_hosp.pdf`, https://beeindia.gov.in/sites/default/files/Scheme%20for%20Hospital%20Building%20Star%20Rating.pdf . Ibasho cannot reproduce the regression without coefficients; show the rank-to-star mapping and ask for the BEE ECObench tool output, or show "benchmark: unknown" (not zero).

**Indian ranges (S and M):**

| Type | Typical India EUI kWh/m2/year | Efficient | Source |
|---|---|---|---|
| Commercial (all) | 200 to 400 | 100 to 150 | ESMAP/BEE roadmap (S) https://www.esmap.org/sites/default/files/esmap-files/1272009111005_BEEC_Roadmap%20for%20Enhancing%20Energy%20Efficiency%20in%20New%20Building.pdf |
| National benchmark (ECBC context) | about 180 | ECBC compliant about 110 | REHVA/ISHRAE/BEE seminar (S) https://rehva.eu/fileadmin/user_upload/REHVA-ISHRAE_EC_BEE_seminar_S_Kumar_Deepa_.pdf |
| Typical commercial, TERI | about 200; ECBC saves 27 to 40% | | TERI (S) https://teriin.org/project/high-performance-commercial-buildings-india |
| Office day use, composite, AC | 120 to 190 | below 90 (5 star) | BEE bands above |
| Office IT/BPO 24x7 | 250 to 450 | 150 to 200 | M (BEE BPO scheme, ECO-III) |
| Hotel 4 to 5 star | 250 to 450 (electricity plus fuel) | 150 to 200 | M (ECO-III hotel benchmarking) |
| Hospital, private multi-specialty | 250 to 450 | 150 to 200 | M (ECO-III, BEE hospital programme) |
| School, non-AC | 15 to 40 | | M |
| Apartments, Hyderabad | 30 to 80 (fans, 1 to 2 ACs); premium gated 80 to 150 | | M; CEEW India Residential Energy Survey 2020; Prayas residential studies |

Proposal: the UI shows the **BEE star band for the user's AC share and zone** as the first-class India target (people understand stars from appliances), and ENERGY STAR / TM46 only in the "global" profile.

---

## 6. End-use breakdown priors

Shares of site energy (electricity plus fuel) for a typical building of that type in a Hyderabad-like composite climate. Use as **priors** for the end-use chart before simulation, and as sanity bands after (flag a result more than 1.5x outside the band). M unless noted. Heating near zero in Hyderabad; PV is a negative bar, not a share.

| Type | Cooling | Heating | Lighting | Equipment / plug | Fans (AHU, ceiling) | Pumps | DHW | Other (lifts, kitchen, process) |
|---|---|---|---|---|---|---|---|---|
| office (AC, day) | 40 to 50 | 0 | 12 to 20 | 20 to 30 | 8 to 12 | 3 to 5 | 0 to 1 | 2 to 5 |
| office IT 24x7 | 35 to 45 | 0 | 8 to 12 | 35 to 45 (servers, UPS losses) | 6 to 10 | 3 to 5 | 0 | 2 to 4 |
| hotel | 40 to 50 | 0 to 2 | 8 to 12 | 8 to 12 | 6 to 10 | 4 to 6 | 10 to 15 | 10 to 15 (kitchen, laundry) |
| school, non-AC | 0 to 10 | 0 | 30 to 40 | 15 to 25 | 25 to 35 (ceiling fans) | 5 (water) | 0 | 5 |
| university academic | 35 to 45 | 0 | 15 to 20 | 20 to 30 | 8 to 12 | 3 to 5 | 0 to 2 | 2 to 5 |
| hostel | 15 to 30 | 0 | 10 to 15 | 15 to 20 | 15 to 25 | 5 | 15 to 25 | 5 (mess kitchen, LPG) |
| hospital | 40 to 50 | 0 to 2 | 10 to 12 | 15 to 20 (medical, imaging) | 10 to 15 (high OA) | 4 to 6 | 5 to 10 | 5 (sterilisation, laundry) |
| lab | 40 to 55 (OA conditioning) | 0 to 2 | 5 to 8 | 15 to 25 | 15 to 25 (exhaust) | 3 to 5 | 1 | 2 |
| apartments (with ACs) | 25 to 40 | 0 | 8 to 12 | 25 to 35 (fridge, TV, cooking appliances, laptops) | 12 to 20 (ceiling fans) | 3 to 6 (lift water pumping, common) | 5 to 12 | 3 to 6 (lifts, common lights) |
| single family (Hyderabad) | 20 to 35 | 0 | 8 to 12 | 25 to 35 | 15 to 25 | 2 to 5 (sump to overhead tank) | 5 to 12 | 2 |

US reference (S): CBECS 2018 end-use tables are the global prior; https://www.eia.gov/consumption/commercial/data/2018/ (tables E1 to E11).

---

## 7. Tariffs: Hyderabad

### 7.1 Electricity: TGSPDCL, FY 2026-27 (valid 1 April 2026 to 31 March 2027)

TGERC issued the FY 2026-27 retail supply tariff order on 30 March 2026 and kept LT and HT energy rates the same as FY 2025-26 (S, Mercom https://mercomindia.com/telangana-hikes-open-access-charges-retains-existing-retail-power-tariff ; schedule https://www.tgsouthernpower.org/resources/PDF/Tariffs/69tarifffile.pdf , blocks scripted download). Average domestic cost of supply in TGSPDCL areas about Rs 5.56 per unit (S, SolarQuarter).

**LT-I Domestic** (telescopic; category decided by monthly consumption). Fixed charges per kW per month.

| Sub-category | Slab (units per month) | Energy Rs/kWh | Fixed Rs/kW/month | Status |
|---|---|---|---|---|
| LT-I(A) up to 100 units | 0 to 50 | 1.95 | 10 | S |
| | 51 to 100 | 3.10 | 10 | S |
| LT-I(B)(i) 101 to 200 units | 0 to 100 | 3.40 | 10 | S |
| | 101 to 200 | 4.80 | 10 | M |
| LT-I(B)(ii) above 200 units | 0 to 200 | 5.10 | 10 | M |
| | 201 to 300 | 7.70 | 10 | M |
| | 301 to 400 | 9.00 | 20 to 30 | M |
| | 401 to 800 | 9.50 | 30 to 50 | M |
| | above 800 | 10.00 | 50 | S |

**LT-II Non-domestic / commercial** (offices, hotels, private hospitals, private schools and coaching, shops).

| Sub-category | Slab | Energy Rs/kWh | Fixed Rs/kW/month | Status |
|---|---|---|---|---|
| LT-II(A) up to 50 units | 0 to 50 | 7.00 | 30 | S |
| LT-II(B) above 50 units | 0 to 100 | 8.50 | 70 | S |
| | 101 to 300 | 9.90 | 70 | S |
| | 301 to 500 | 10.40 | 100 | S |
| | above 500 | 11.00 | 100 | S |

**HT-II(A) Others (commercial HT: large offices, hotels, hospitals, campuses)**, billed in kVAh:

| Voltage | Energy Rs/kVAh | Demand Rs/kVA/month | Status |
|---|---|---|---|
| 11 kV | 8.80 | 500 | S |
| 33 kV | 8.00 | 500 | S |
| 132 kV and above | 7.80 | 500 | S |

Minimum charge 25 kVAh per kVA of billing demand per month (FY 2024-25 schedule, S). For comparison HT-I(A) industry: 7.65 / 7.15 / 6.65 per kWh, 500 per kVA (S).

**Time of day (HT, FY 2026-27 schedule, S):** surcharge Rs 1.50/unit 06:00 to 10:00 and 18:00 to 22:00; rebate Rs 0.50/unit 10:00 to 18:00; normal 22:00 to 06:00. FY 2025-26 had +1.00 peak and a 1.50 night rebate instead. Applicability by category to be checked in the order.

**Gruha Jyothi (Telangana, since March 2024, M):** eligible domestic households get up to 200 units per month free (eligibility tied to past average consumption). Above the limit the household pays the normal bill.

**Slab cliffs (untapped value).** Because the domestic sub-category is set by the month's total, crossing a boundary reprices every unit:
- 100 units: 50 x 1.95 + 50 x 3.10 = Rs 252.50. 101 units: 100 x 3.40 + 1 x 4.80 = Rs 344.80. One extra unit costs about Rs 92.
- 200 units: 100 x 3.40 + 100 x 4.80 = Rs 820. 201 units: 200 x 5.10 + 1 x 7.70 = Rs 1,027.70. One extra unit costs about Rs 208.
- With Gruha Jyothi, 200 units may cost Rs 0 and 201 units the full bill.

So a monthly model, not an annual average, is required, and the optimiser should report "months over the cliff" and bundles that pull a home under it (fans plus 26 C set point, BLDC fans, PV sized to the cliff). Pack shape: `cliffs: [{ atUnits: 100 }, { atUnits: 200, scheme: "gruha-jyothi" }]`. Verify the M rows against schedule 69 before release.

### 7.2 Water: HMWSSB

| Item | Value | Status | Source |
|---|---|---|---|
| Free water | 20 kL per month per domestic connection, needs working meter and Aadhaar linked CAN; about 5 lakh consumers receive it | S | Telangana Today https://telanganatoday.com/hyderabad-pressure-mounts-on-hmwssb-to-extend-free-water-scheme-to-new-civic-bodies ; Siasat https://www.siasat.com/water-bills-to-rise-by-5-pc-annually-as-hmwssb-looks-to-recover-revenue-3543386/ |
| Domestic slabs (telescopic, Rs/kL) | 0 to 15: 10; 16 to 30: 12; 31 to 50: 22; 51 to 100: 27; 101 to 200: 35; above 200: 40; slum 0 to 15: 7 | S | 99acres guide https://www.99acres.com/articles/hyderabad-water-bill-payment.html ; billcalc https://billcalc.in/water/hmwssb-water-bill-calculator |
| Sewerage cess | 35% of water charge | S (old) | Deccan Chronicle 2017 |
| Non-domestic / commercial | Bulk industrial above 200 kL reported at Rs 120/kL (2017); commercial slabs about Rs 60 to 120/kL | S (old) | Deccan Chronicle https://deccanchronicle.com/amp/nation/current-affairs/200517/hyderabad-water-board-no-to-railways-proposal.html |
| Coming change | Reported plan of 5% annual increases (first rise in about 15 years) | S | Siasat (2026) |
| Tanker water (reality for many) | Rs 500 to 1,500 per 5 kL private tanker in summer | M | news reports; model as a user-entered rate |

Water also has a 20 kL cliff; same treatment as electricity.

### 7.3 Other carriers (indicative, user editable)

| Carrier | Price point | Status |
|---|---|---|
| Domestic LPG 14.2 kg cylinder, Hyderabad | about Rs 900 to 910 | M |
| Commercial LPG 19 kg | about Rs 1,900 to 2,100 | M |
| Diesel (DG sets) | about Rs 95 to 98 per litre; DG yields 3.0 to 3.5 kWh per litre, so Rs 28 to 33 per kWh | M |
| PNG (Bhagyanagar Gas) | per SCM, user entered | to fetch |
| Rooftop PV subsidy (PM Surya Ghar) | Rs 30,000 per kW for first 2 kW, Rs 18,000 for 3rd kW, cap Rs 78,000 | M |

Settings page: every rate above is a row the user can override, with the source and date shown beside it.

---

## 8. Carbon factors

### 8.1 India grid (CEA CO2 Baseline Database)

| FY | Weighted average (tCO2/MWh) | Build margin | Combined margin | Version | Status |
|---|---|---|---|---|---|
| 2016-17 | 0.82 | | | v13 | S |
| 2022-23 | 0.716 | | | v19 | S (BigMint) |
| 2023-24 | **0.727** (RE adjusted) | 0.552 | 0.757 | v20, December 2024 | S (Climatiq mirror, procurement summary) |
| 2024-25 | in v21 (November 2025) | | | v21 | not retrieved |
| revisions | v22 (August/September 2026) retroactively revised 2022-23 and 2023-24 with actual captive data | | | v22 | S |

Sources: CEA user guides https://cea.nic.in/wp-content/uploads/2021/03/User_Guide_Version_20.0.pdf , https://cea.nic.in/wp-content/uploads/baseline/2026/09/User_Guide__Version_22.0.pdf ; Climatiq https://www.climatiq.io/data/source/government-of-india-_-central-electricity-authority . The CEA site served a login page to scripted fetches; download v22 manually and fill 2024-25 and 2025-26.

Proposal (default): **location-based inventory uses the weighted average** (GHG Protocol Scope 2). **Savings from a retrofit use the combined margin** (CDM practice), shown as a second, labelled number. Losses: add T and D losses (Telangana about 10 to 15%, M) only if the user picks "at the meter plus losses".

### 8.2 Other factors

| Item | Value | Status | Source |
|---|---|---|---|
| UK grid 2025 | about 0.177 kgCO2e/kWh (2024: 0.207) | M | DESNZ GHG conversion factors |
| US grid (eGRID2022 national) | about 0.37 kgCO2/kWh | M | EPA eGRID |
| World average | about 0.46 kgCO2/kWh | M | IEA |
| LPG | 63.1 tCO2/TJ; about 2.98 kgCO2 per kg | M | IPCC 2006 Vol 2 Table 1.4 |
| Natural gas / PNG | 56.1 tCO2/TJ; about 0.202 kgCO2/kWh (NCV) | M | IPCC 2006 |
| Diesel | 74.1 tCO2/TJ; about 2.68 kgCO2 per litre | M | IPCC 2006 |
| Water supply, Hyderabad | estimate by physics: E = 9.81 x H / (3600 x eta) kWh per kL; for lift H = 400 to 550 m, eta 0.7: about 1.6 to 2.1 kWh/kL, plus treatment 0.1 to 0.3 | estimate | Krishna and Godavari schemes lift water a long way to Hyderabad; label as an estimate with the formula shown |

The water line is genuinely missing elsewhere: a litre saved in Hyderabad is electricity and carbon saved upstream. Show "your water's hidden electricity" with the formula, never a made-up number.

---

## 9. HVAC and DHW system archetypes (for the engine)

| Archetype id | Where | Efficiency defaults | Notes |
|---|---|---|---|
| split.fixed | Homes, small shops (older) | EER 2.7 to 3.1 | being phased out |
| split.inverter | Homes, small offices | ISEER 3.5 (1 star) to 5.0+ (5 star), 2024 table (M) | BEE star label; default 24 C |
| vrf | Mid offices, hotels, hostels | IEER 5 to 7 (M) | part-load strength |
| chiller.aircooled | Mid buildings | COP 2.8 to 3.2 | |
| chiller.watercooled | Large offices, hospitals, campuses | COP 5.5 to 6.5; plant 0.9 to 1.1 kW/TR all-in (M) | cooling towers add water use: about 7 to 8 L per TR-hour (M) |
| fan.ceiling.induction | Everywhere in India | 70 to 75 W at 1200 mm | |
| fan.ceiling.bldc | | 28 to 35 W | BEE star; cheap high-return lever |
| evap.cooler | Dry season homes | | useful March to May only |
| dhw.geyser | Homes | electric storage 15 to 25 L, 2 kW, standing loss 1 kWh/day (M) | |
| dhw.swh | Roofs | flat plate or ETC, 100 L per day per 2 m2, solar fraction 60 to 80% in Hyderabad (M) | |
| dhw.heatpump | Hotels, hospitals, hostels | COP 3 to 4 | heat recovery from chillers |
| dg.backup | Hospitals, offices | 3.0 to 3.5 kWh per litre | carbon and cost matter in outage-prone areas |

---

## 10. LEED tie-in (for the end-use and points panel)

| LEED v4.1 BD+C credit | Points | What Ibasho supplies | Status |
|---|---|---|---|
| EA Optimize Energy Performance | up to 18 | % improvement vs ASHRAE 90.1 Appendix G baseline on cost and GHG (v4.1 averages both) | M |
| EA Renewable Energy | up to 5 | PV share | M |
| WE Indoor Water Use Reduction | up to 6 | fixture flows vs baseline | M |
| WE Outdoor Water Use | up to 2 | landscape | M |
| WE Cooling Tower Water Use | up to 2 | chiller archetype | M |

LEED v5 (2025) reorganises around decarbonisation; another brief covers rating systems in depth. This brief supplies the end uses, carriers, tariffs and carbon factors those credits need.

---

## 11. Data contract sketch

```ts
interface Sourced<T> { value: T; low?: T; high?: T; source: SourceId; status: "verified" | "secondary" | "typical"; }
interface SpaceTypeProfile {
  id: string; label: string;
  rp_Ls_person: Sourced<number>; ra_Ls_m2: Sourced<number>;
  density_per100m2: Sourced<number>;
  lpd_Wm2: Sourced<number>; epd_Wm2: Sourced<number>;
  coolSet_C: Sourced<number>; heatSet_C: Sourced<number>;
  dhw_L_per_person_day: Sourced<number> | "unknown";
  schedules: { occupancy: Schedule24x3; lighting: Schedule24x3; equipment: Schedule24x3; hvac: Schedule24x3; dhw?: Schedule24x3 };
}
interface BuildingTypeProfile { id: string; region: "GLOBAL" | "IN" | "UK"; spaceMix: { spaceTypeId: string; share: number }[]; systemArchetypes: string[]; benchmarks: string[]; endUsePriors: Record<EndUse, [number, number]>; tenure?: "owner" | "landlord" | "tenant"; }
interface Tariff { id: string; utility: string; category: string; validFrom: string; validTo: string; slabs: { upTo: number | null; rate: Sourced<number> }[]; fixed: { upTo: number | null; perKW: number }[]; tod?: { from: number; to: number; delta: number }[]; cliffs?: { atUnits: number; scheme?: string }[]; telescopic: boolean; categoryBy: "monthly-total" | "connected-load"; }
```

Money is fixed point after `quantise` (paise as bigint), as the engine already does.

---

## 12. Sources

- ENERGY STAR US National Median Table: https://portfoliomanager.energystar.gov/pdf/reference/US%20National%20Median%20Table.pdf
- ENERGY STAR technical reference: https://www.energystar.gov/buildings/tools-and-resources/portfolio-manager-technical-reference-us-national-energy-use
- CBECS 2018: https://www.eia.gov/consumption/commercial/data/2018/
- CIBSE TM46: https://www.cibse.org/knowledge-research/knowledge-portal/tm46-energy-benchmarks
- BEE commercial buildings: https://beeindia.gov.in/en/node/39597
- BEE office schedule (2023): https://beeindia.gov.in/sites/default/files/Schedule%20for%20Office%20Building%20July%202023%20(1).pdf
- BEE BPO schedule: https://beeindia.gov.in/sites/default/files/Schedule%20for%20BPO%20Building%20Star%20Rating.pdf
- BEE hospital scheme: https://beeindia.gov.in/sites/default/files/Scheme%20for%20Hospital%20Building%20Star%20Rating.pdf
- BEE shopping mall: https://www.beeindia.gov.in/sites/default/files/BEE%20Star%20Rating%20-%20Shopping%20Mall.pdf
- ESMAP/BEE roadmap: https://www.esmap.org/sites/default/files/esmap-files/1272009111005_BEEC_Roadmap%20for%20Enhancing%20Energy%20Efficiency%20in%20New%20Building.pdf
- REHVA/ISHRAE/BEE seminar: https://rehva.eu/fileadmin/user_upload/REHVA-ISHRAE_EC_BEE_seminar_S_Kumar_Deepa_.pdf
- TERI high performance buildings: https://teriin.org/project/high-performance-commercial-buildings-india
- TGSPDCL tariff schedules: https://www.tgsouthernpower.org/resources/PDF/Tariffs/69tarifffile.pdf (FY 2026-27), https://tgsouthernpower.org/resources/PDF/Tariffs/63tarifffile.pdf
- Mercom on FY 2026-27 order: https://mercomindia.com/telangana-hikes-open-access-charges-retains-existing-retail-power-tariff
- SolarQuarter on FY 2026-27 order: https://solarquarter.com/2026/04/13/telangana-electricity-regulatory-commission-tariff-order-fy27-balancing-discom-finances-consumer-tariffs-and-power-supply-stability/
- HMWSSB slabs (secondary): https://www.99acres.com/articles/hyderabad-water-bill-payment.html , https://billcalc.in/water/hmwssb-water-bill-calculator
- HMWSSB free water: https://telanganatoday.com/hyderabad-pressure-mounts-on-hmwssb-to-extend-free-water-scheme-to-new-civic-bodies
- HMWSSB increase: https://www.siasat.com/water-bills-to-rise-by-5-pc-annually-as-hmwssb-looks-to-recover-revenue-3543386/
- World Bank, Hyderabad water cost recovery: https://documents1.worldbank.org/curated/en/369651468267910841/pdf/699740v60WP00P0Cost0Recovery0Report.pdf
- CEA CO2 baseline user guides: https://cea.nic.in/wp-content/uploads/2021/03/User_Guide_Version_20.0.pdf , https://cea.nic.in/wp-content/uploads/baseline/2026/09/User_Guide__Version_22.0.pdf
- Climatiq CEA mirror: https://www.climatiq.io/data/source/government-of-india-_-central-electricity-authority
- FY 2022-23 grid factor report: https://bigmint.co/insights/detail/indias-power-sector-co2-emissions-rise-to-over-1-1-billion-tonnes-in-fy23-govt-data-571893
- To read next (M items): ASHRAE 62.1-2022 Table 6-1, ASHRAE 62.2, ASHRAE 170, ASHRAE 90.1-2022 Appendix G and Table 9.5.1, ECBC 2017 Appendix C, ECSBC 2024, NBC 2016 Parts 8, 9 and 11, IMAC (Manu et al., Building and Environment, 2016), IPCC 2006 Vol 2, DESNZ 2025 factors, EPA eGRID, CEEW IRES 2020, Prayas residential studies, Labs21.

Local copies: `docs/research/v3/sources/eui/` (es_median.pdf, bee_hosp.pdf).
