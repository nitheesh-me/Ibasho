# Product QA: platform V-P (Agent A), building science and data review

Reviewer: product QA lead (building science, data). Date: 2026-10-11. Scope: WP-00, WP-13, WP-14, WP-17 as handed off by Agent A. Method: read code and data, ran small Node and Python scripts against the fixtures, the place index and the preview providers (no browser, CPU capped). No code was edited.

## Verdict: NOT YET

The plumbing is good: contracts are typed, every preview output carries `impl: 'preview'` and seal `preview`, providers emit rough, refined and final, cancel answers in under 10 ms, and recompute equals fixture. The data and the numbers are not yet fit to show to someone from IIIT Hyderabad. The flagship building GB1 does not match its own OSM outline (courtyards mirrored, 30% too small), its rooms are wing codes so a search for "auditorium" or "seminar hall" finds nothing, the HT tariff is the industrial rate, the ECSBC check fails the code's own reference design, and a stale job can hijack the live one.

Minimum fixes to reach SHIP: B1, B2, B3, M1, M2, M3, M4, M5, M6 below. The rest can follow.

## Findings

Severity: blocker (wrong in a way a user will see and believe), major (wrong or misleading, visible with some effort), minor (polish, robustness).

### Blockers

**B1. GB1 footprint does not match the OSM outline: courtyards mirrored, plan about 30% too small.** Area: GB1 fidelity. Owner: WP-14.
- What: transformed into the place frame, the GB1 first floor (6,432 m2) covers only 55% of the OSM Vindhya polygon (9,167 m2 net of courts); IoU 0.48. In the GB1 building frame the OSM inner rings are: two 41 x 11 m courts at y from -25 to -12 (A side) and two 47 x 15 m courts at y from +1 to +18 (C side). The generator puts the large courts on the A side (y -18.5 to -4.5) and the small ones on the C side (y 8.5 to 18.5). Rotating 220 instead of 40 raises IoU to 0.52, which confirms the mirror. The model is 136 x 63 m; RB measures about 145 x 72 m built edge and OSM is 165 x 82 m. On the C side the OSM spine between the courts is about 3 m wide; GB1 models a 14 m wide "B4 spine" lab running the full depth.
- Why: the scene shows the golden building over or beside its own context shell; sun, ASE and ledger results per wing depend on which row faces SW. This is the first thing a campus user will notice.
- Fix: rebuild the GB1 grid from the OSM rings in the building frame (rows and courts at the measured y bands, 145 m long), keep A row at bearing 220 and put the large courts on the C side; replace "B4 spine" with a 4.6 m corridor plus the B4 pavilion (1,316 sq ft). Add a test: IoU of the above grade footprint with `osm_r2829427` at least 0.8.

**B2. GB1 rooms are wing codes, not rooms; real functions on the drawings are lost.** Area: GB1 fidelity, search. Owner: WP-14.
- What: 77 "rooms" = one rectangle per wing per floor named A1, B3, C7 and so on. The plan text names (not people) such as IIIT Library, Data Centre, SBI Bank and ATM, C-STAR, CIE, EERC (shake tables), Seminar Hall I (170 seats, C7 L3), Seminar Hall II (C1 L2), Auditorium (C1 L3), Teaching Labs 1 and 2, Centre for IT in Building Science, Advanced Lighting Lab, Robotics Lab, Audio Recording Studio, Cafeteria are not present anywhere. RB 3.2 already lists them per wing and floor.
- Why: room search, the editor tree, the narrator and per room results all speak in wing codes nobody on campus uses. Searches for "seminar hall", "auditorium", "robotics lab", "CIE", "SBI bank", "server room", "building science" return nothing (section Search below).
- Fix: name each wing room by its main function from RB 3.2 ("A5 IIIT Library", "C1 Auditorium"), and add an `aliases` list per room for the other functions in that wing. Where a wing holds two distinct uses with different loads (C1 L3 auditorium plus ISWOC lab; A1 L1 data centre plus UPS room), split it into two rooms. Keep the no personal names rule.

**B3. ECSBC EPI check fails the code's own reference design.** Area: preview codes. Owner: WP-13.
- What: `ECSBC.EPI` compares the design EUI with fixed tier limits (education 115, office 130 kWh/m2 yr) but the preview's own standard design baseline for GB1 is 174 to 193 and for GB3 119 to 131. So a building built exactly to the reference would fail (GB1 margin -94.4). The clause text says "performance method, EPI ratio" while the code uses an absolute limit. The EPI ratio is already computed (`baselines[0].ratio` 0.96 to 1.32 for GB1).
- Why: a confident "fails ECSBC by 94 kWh/m2" is the kind of number people screenshot.
- Fix: status from the ratio band: pass if ratio hi at most 1, fail if ratio lo above 1, else `unknown` with "range straddles the limit". Show the margin as a ratio. Drop the absolute tier table until WP-19 has real numbers.

### Majors

**M1. HT tariff uses the industrial rate, billed per kWh.** Area: preview money. Owner: WP-13.
- What: `money.tariff.elec.rate` 7.65 Rs and demand 475 Rs/kVA. The project's own brief (building-types-eui 7.1) gives HT-II(A) Others at 11 kV as 8.80 Rs/kVAh and 500 Rs/kVA/month, with a ToD surcharge of 1.50 Rs (06 to 10, 18 to 22) and a 0.50 rebate (10 to 18); 7.65 is the HT-I(A) industry rate. Billing is per kVAh, not kWh. The tariff id says `ht-ii`.
- Why: GB1's "3.3 crore a year" is the right order but for the wrong reasons: energy is understated about 15%, demand is overstated (see M2). Any retrofit payback built on it is off.
- Fix: 8.80 Rs/kVAh and 500 Rs/kVA in the setting defaults with the schedule cited; convert kWh to kVAh with a stated power factor (0.95 assumed); apply ToD from the monthly profile or say it is excluded; minimum charge 25 kVAh per kVA.

**M2. Peak demand rule overstates kVA for 24 h loads.** Area: preview money. Owner: WP-13.
- What: `peakKw = monthly Wh / (days x 10 h) x 1.5`. For GB1 this gives 1,656 kVA. A bottom up check (LPD 10 W/m2 over 20,000 m2, plug 15 W/m2, cooling about 70 W/m2 thermal on 15,500 m2 at COP 3.4, data centre 82 kW IT) gives roughly 900 to 1,100 kW. The rule treats 24 h data centre energy as if it ran 10 h.
- Fix: peak = sum over zones of (LPD + EPD) x area x diversity + cooling thermal peak / COP; or at least split 24 h loads out of the 10 h divisor. Show demand as a range.

**M3. Stale generation hijacks the live job (H9).** Area: preview run. Owner: WP-13.
- What: in `createPreviewStudio.runJob`, `live.set` runs even when the incoming generation is older than the live one. Test: start gen 5 then gen 4 for GB1: all 8 events from gen 5 are dropped, gen 4's events are delivered, both end `done`, gen 5 is not marked superseded.
- Why: out of order messages from the UI worker (common with Comlink and debounced edits) will show results for an older document.
- Fix: if `prev.generation > req.generation`, return immediately with `status: 'superseded'` and do not touch `live`. Add the reversed order case to the H9 test.

**M4. Place search has no campus or place entities; "IIIT" finds an ATM.** Area: search. Owner: WP-14 (index), WP-00 (PlaceHit kind).
- What: `buildPlaceIndex` indexes OSM buildings and building docs, never `places.json`. "IIIT", "IIIT Hyderabad", "IIITH" all return only "SBI ATM, IIIT Hyderabad Main Gate"; "campus" and "IIIT library" return nothing. Himalaya's blocks (Vrithi, Shodh, Bodh) exist only as room names ("Bodh core", "Shodh east wing"), so "Shodh" returns four identical floor rooms.
- Fix: index places (kind `place`, or `building` with a place flag) with curated aliases (IIIT, IIITH, IIIT Hyderabad, Gachibowli campus); add a block level (or room group) for Himalaya blocks; add "IIIT" as an alias on Vindhya's library rooms.

**M5. Unknown neighbour heights are used as real shade; context radius ignored.** Area: preview site, city data. Owner: WP-13, WP-17.
- What: 1,010 of 1,036 city buildings have `source: unknown`, with `likely` guessed from footprint size (7 m to 21 m, hi up to 53 m). `siteModel` shades with `height.likely` for all of them, without a flag. RB 5 says unknown heights must be ghosts excluded from shadow results with an "unknown neighbour" flag. Separately, `siteModel` is called with its default `radiusM = 120` while the result stamp says `contextRadiusM: 300` (standard) or 500 (fine).
- Fix: exclude `unknown` blockers from shading (or run lo and hi and widen the range), list them in the ledger as `unknown`; pass `resolution.contextRadiusM` into `siteModel`.

**M6. Hero replacement by bounding box drops real neighbours; GB2 collides with Kohli Research Block.** Area: preview site, GB2 placement. Owner: WP-13, WP-14.
- What: `siteModel` removes any context building whose centroid lies in the golden building's axis aligned box. GB2's rotated box (140 x 124 m) contains Kohli Research Block's centroid, so KRB (5 levels, 19.5 m) silently stops shading GB2. Also GB2's blocks overlap KRB by about 550 m2 in plan, so the scene will draw them through each other. GB2 origin is the midpoint of two OSM centroids with blocks laid in a row, which RB does not support.
- Fix: replace only `HERO_CONTEXT_IDS` (already exported by the pack). Place GB2 blocks on their own OSM ways where mapped (Academic Block, D Block) and fit the rest so no block overlaps any context building; add a test that golden buildings overlap no non hero context building.

**M7. Apartment end use split: hot water 44% (GB4).** Area: preview energy. Owner: WP-13.
- What: GB4 annual: hot water 35.7 MWh (44%), cooling 27%, lighting 19%, equipment only 7% (294 kWh per flat a year, less than one fridge). Hot water uses 110 L per person a day, 25% heated by 25 K, all year, electric. Offices and campuses also get 25 L per person a day heated (GB2 hot water 9.7%). In Hyderabad, domestic water heating is mostly winter, often solar, and small; in non residential buildings it is near zero.
- Fix: residential DHW about 40 to 50 L per person a day hot share, seasonal (Nov to Feb about 2x), solar share setting; non residential near zero except hostels, hospitals, hotels. Equipment for flats at least 600 to 900 kWh per flat a year (fridge, TV, washing machine, kitchen appliances). Recheck GB4 cliff months: today all 12 months exceed 200 units, which is unlikely in Dec and Jan.

**M8. Domestic slabs do not model the category switch (the cliff).** Area: preview money. Owner: WP-13.
- What: `SLABS` is one telescopic ladder. The brief (7.1) says crossing 100 or 200 units reprices every unit (200 units: Rs 820; 201 units: Rs 1,027.70). Gruha Jyothi (200 free units) is absent. `cliffMonths` is flagged but the bill does not show the jump.
- Fix: model LT-I(A) and LT-I(B) sub categories by monthly total; add the Gruha Jyothi switch as a setting (default off for a rental, labelled).

**M9. Residential code checks are formulas, not the code.** Area: preview codes. Owner: WP-13.
- What: `ENS.RETV` is `10 + 0.35 x WWR`, with no U values, SHGC or orientation, but it is labelled "Part 1, RETV at most 15 W/m2" and shows a pass or fail with a margin. `ENS.OPENABLE` uses window to wall ratio; ENS 2018 uses openable window to floor area ratio. `ECBC.ENV.WWR` and `ECBC.LTG.LPD` use one limit (9.9 W/m2) for every type.
- Fix: compute RETV with the ENS formula (coefficients a, b, c for composite; facade orientation factors) from the compiled facades and the assumed U and SHGC, or mark it `unknown` until the inputs are known. Openable area over floor area. LPD limit per type from the ECBC table.

**M10. Daylight: ECBC share copies sDA; sDA reported for stairs, corridors, plant and the data centre.** Area: preview daylight. Owner: WP-13.
- What: in every room `ecbcShare` equals `sda` exactly. ECBC 4.2.3 is a UDI 100 to 2000 lux share, a different metric. sDA and ASE are given for stairs, toilet cores, corridors, AHU rooms and the data centre; AHU rooms get the highest sDA in GB1 (18 to 34%).
- Fix: compute `ecbcShare` separately (or `unknown` at T0); restrict sDA, ASE and the building averages to regularly occupied space types; no windows on data centre and plant rooms by default.

**M11. MOP 2026 rating "applies" by 11 m2 on a geometry that is 30% off.** Area: preview codes. Owner: WP-13.
- What: GB1 GFA 20,011 m2 against a 20,000 m2 draft threshold: status true, margin 11 m2. After B1 the GFA will move by thousands of m2.
- Fix: when the margin is inside the geometry uncertainty (status `measured` within 10%), report `unknown` with "near the threshold"; rerun after B1.

### Minors

**m1. EUI denominator unstated.** GB1 EUI 176 to 243 is per conditioned m2 (15,517), not gross (20,011, giving about 162). BEE uses built up area. Label the denominator in the result and evidence, and offer both. Owner: WP-13.

**m2. Comfort AC hours ignore the set point.** `acHours` are identical at 24 and 26 C (90 to 100% of occupied hours). Either compute them or drop the second set point. Owner: WP-13.

**m3. Rating ladders reuse one savings number.** GHMC, LEED, IGBC and EDGE all use savings versus the ECSBC reference; LEED is versus ASHRAE 90.1 by cost. Labels say "not a certificate", which is honest, but say "against the ECSBC reference" next to each. Owner: WP-13.

**m4. Progress events carry `tier: 'final'` before the final output.** Between 60% and 100% the progress events say `final`. UI B may badge it as final early. Use the last delivered tier, or add `pendingTier`. Owner: WP-13 (WP-00 if the contract changes).

**m5. Preview delays are synthetic.** Real compute for GB1 is under 0.5 s in total (optimise 0.4 s, others under 20 ms); the replay waits about 19 s at standard. Fine for rehearsing the real pipeline, but the UI should not imply the wait is computation. Expose `deviceFactor` 0 in a dev setting. Owner: WP-13.

**m6. GB1 wing areas.** Against the first floor labels: B3 modelled 169 m2 (label 3,669 sq ft = 341 m2), B5 169 m2 (411 m2), B4 518 m2 (122 m2), C3 and C5 533 m2 each (788 and 769 m2). The cellar is two rooms of 182 and 533 m2 (RB: about 9,900 sq ft over three zones) and is fully below grade, although the cellar sheet shows windows and ventilators (sloping site, one face exposed). Cores are empty (4 lifts and the stairs are only rooms). Fix with B1. Owner: WP-14.

**m7. GB1 "Ground floor" query fails.** The entry level is the "First floor" sheet; "Vindhya ground floor" returns nothing. Add "entry level", "entrance floor" and "ground floor" aliases to the entry storey with a note. Owner: WP-14.

**m8. Search ranking noise.** "C-STAR" ranks the AIMSCS institute first (one letter "c" prefix plus "star" fuzzy to "stair") and then C2 stairs; "KCIS" lists "HITEC City office" second; "floor 2" lists GB4 bedrooms; "dlf cyber city" finds nothing (OSM name is "dlf"). Typos score 48 ("vindya", "himalya", "nilgri"), close to the 30 floor: fine for ranking, but B must not gate on a score of 50. Ignore one letter tokens for prefix matching unless the query is one token; add curated aliases (DLF Cyber City, C-STAR, CIE). Owner: WP-14.

**m9. Duplicate room names across floors.** "A3" returns three hits with the same name; `PlaceHit` has `storeyId` but not the storey name, so B must look it up for every row. Add `storeyName` to `PlaceHit`. Owner: WP-00.

**m10. GB3 is a generic plate aliased as a real tower.** "WeWork" and "Krishe Emerald" resolve to "HITEC City office", a 59 x 37 m generic plate at (0, 0) with no city context. Either model Krishe Emerald from OSM way 776432080 (not in the pack: it lies outside the 2.5 km box) with a context tile, or drop the brand aliases. With no neighbours, GB3 sun and ASE ignore the dense HITEC context. Owner: WP-14, WP-17.

**m11. `pl_gachibowli` has the campus lat and lon.** GB4 sits 520 m W and 760 m S of the pack origin on a spot chosen only for being empty, while the place says 17.4453, 78.349. A locator will fly to IIIT. Set the place lat and lon to GB4's real position and mark the site as illustrative. Owner: WP-14.

**m12. City pack coverage and heights.** 79 of 1,036 buildings are named; Himalaya's other blocks, the athletic stadium name, KCIS and the large offices east of campus have no names. DLF Cyber City (30,982 m2 site polygon) is a single 21 m block (RB: towers about 60 m); PSR Prime Towers 19 m likely. Heights by footprint size make large low sheds tall and towers short. Add Open Buildings 2.5D or tagged heights for the dozen tallest neighbours; add `name` from OSM `name:en` and `alt_name` where present. Owner: WP-17.

**m13. GB2 coarse uses.** Shodh is all `office` (it holds an auditorium, dining and labs), Bodh is all `classroom` including its core, the basement is all `office`. Fine for a coarse fixture but say so in notes and split Bodh halls (12 lecture halls, 230 seat halls) as `assembly`. Owner: WP-14.

## Evidence

### Search, 70 queries (summary)

Good: Vindhya (and vindya, vindhiya, VINDH), Himalaya (himalya), Nilgiri (nilgri), Parijaat and parijat, KCIS, Kohli, Bakul, Bakul Mess, Palash, OBH, Kadamba, NBH, JC, PSR, "Vindhya floor 2", "vindhya 2nd floor", "vindhya third floor", "vindhya cellar", "Himalaya basement", "Himalaya floor 6", data centre and data center, library (A5 rooms), classroom, A3, C7, WeWork, Gachibowli, "gachibowli stadium", GH1, London.

Misses: IIIT, IIIT Hyderabad, IIITH (only the ATM), campus, "IIIT library", "Vindhya ground floor", "server room", "SBI bank", seminar hall, auditorium, "robotics lab", CIE, "building science", "CBS lab", "lecture hall", "dlf cyber city".

Bad ranking: C-STAR (AIMSCS first), KCIS (second hit GB3), "floor 2" (GB4 bedrooms), "Block D" versus "D block" go to different buildings (acceptable but inconsistent), Shodh, Bodh, Vrithi (room rows, no block).

### Preview numbers, all buildings (standard resolution)

| | GB1 Vindhya | GB2 Himalaya | GB3 HITEC office | GB4 apartments | GH1 London |
|---|---|---|---|---|---|
| Conditioned m2 | 15,517 | 22,506 | 32,745 | 1,680 | 84 |
| Site EUI kWh/m2 yr | 176 to 243 | 103 to 142 | 140 to 193 | 41 to 56 | 127 to 176 |
| Largest end uses | cooling 34%, equipment 35% (data centre 0.72 GWh) | cooling 43% | cooling 47% | hot water 44% (M7) | heating 79% |
| Bill a year | Rs 3.33 crore, 1,656 kVA | Rs 2.83 crore | Rs 5.59 crore | Rs 4.4 lakh (20 flats) | GBP 1,602 |
| Carbon t a year | 2,326 (716 g/kWh) | 1,977 | 3,901 | 58 | 2.4 |

Plausibility: GB1 is credible once the data centre is set aside (about 145 kWh/m2 without it, high but possible for a partly chilled academic block); GB3 sits in BEE's composite 1 to 2 star band for a fully AC office, reasonable for 65% WWR single clear glass, but a Grade A tower more likely has double glazed low e glass; GB2 cooling implies about 2,900 equivalent full load hours on the 400 TR plant, on the high side for a daytime campus (typical 1,500 to 2,200). Sun hours on GB1's SW facade (6.4 h in January, 2.4 h in July) and vertical SW irradiance (about 940 kWh/m2 yr) are plausible for 17.45 N. sDA 15 to 31% for 13 m deep wings at 14% WWR is plausible; GB3 perimeter ASE 52 to 62% with no shading is plausible.

Labelling: every stage output has `stamp.impl = 'preview'`, providers `impl: 'preview'`, evidence nodes seal `preview` and provenance kind `preview`, tariff ids end in `.preview`. Good.

Progress: each stage yields fraction 0, progress every 250 ms, rough partial at 25%, refined at 60%, final at 100% (verified on energy). Cancel during radiation answered in 7 ms. Stale generation bug: M3.

### Contract notes for B (UI) and C (scene)

- C: GB1 and GB2 do not sit on their OSM shells (B1, M6); hide by `HERO_CONTEXT_IDS`, not by box. Unknown height buildings need a ghost style (M5); `height.source` is there to drive it.
- C: `Storey.cores` is empty for all buildings; lifts and stairs are rooms. Do not rely on cores for vertical circulation yet.
- B: room names are wing codes until B2; show `spaceTypeId` label next to the name. `PlaceHit` lacks storey name (m9). Place level hits do not exist (M4).
- B: progress `tier` is not the delivered tier (m4). Bills are bigint micro paise strings on the wire (1 rupee = 1e8); EUI denominator is conditioned area (m1).
- B: GB4 `cliffMonths` is all twelve months today (M7, M8); do not design the cliff UI around that output.

## Minimum fixes for SHIP

1. B1 and m6: GB1 grid refit to OSM, courts on the right side, IoU test at least 0.8.
2. B2: room names and aliases from RB 3.2 (functions, no people).
3. B3 and M11: ECSBC by EPI ratio; near threshold results are `unknown`.
4. M1 and M2: HT-II(A) rate per kVAh, demand from a load sum.
5. M3: stale generation guard and test.
6. M4: place entities and campus aliases in search.
7. M5 and M6: unknown heights excluded or ranged, real context radius, hero replacement by id, GB2 off KRB.

Then regenerate `gen:buildings` and `gen:preview` and rerun the package tests.

## Round 2 (re-review after Agent A's QA round 1 fixes)

Date: 2026-10-11. Checks rerun by script, not by reading the handoff: footprint overlap by rasterising at 1 m, rooms against the plan labels, regenerated preview fixtures, the stale generation case with real timers, 63 search queries with `places.json` passed, the site blocker ledger, and the app wiring in `apps/web`. No code edited; package tests not rerun (Agent A reports plan 17, preview 26 passing).

### Verdict: SHIP (for the V-P prototype)

Every blocker and major is fixed in the data and the code, and since the first draft of this round Agent B has wired the search and replacement fixes into the app. What is left is minor and listed below.

### Blockers and majors, verified

| Id | Status | Evidence |
|---|---|---|
| B1 GB1 footprint | Fixed | Above grade footprint IoU with `osm_r2829427` is 0.964 (was 0.48); 98% of the model lies inside the outline; rotation 41.7 matches the OSM edge bearings; no overlap with any other context building. GFA is now 28,325 m2 (9,127 m2 a floor plus a 944 m2 cellar). |
| B2 GB1 rooms | Fixed | 93 rooms named by function, with aliases. Against the first floor sq ft labels: B3 345 m2 (label 341), B4 115 (122), B5 414 (411), B6 435 (431), C3 705 (788), C5 688 (769), A3 498 (621), A5 486 (538). Cellar zones 255, 331, 357 m2 against RB's about 280, 316, 325, NE face exposed. No personal names in the fixtures. |
| B3 ECSBC | Fixed | `ECSBC.EPI-RATIO` uses the ratio to the reference design: GB1 0.97 to 1.34, so `unknown`; GB2 1.06 to 1.46 fails; GB3 1.13 to 1.56 fails. |
| M1 tariff | Fixed | `tgspdcl.ht-ii-a.preview`, 8.80 Rs/kVAh, 500 Rs/kVA, time of day, power factor setting. GB1 bill Rs 3.26 crore a year, consistent with a hand check. |
| M2 demand | Fixed | GB1 1,246 kVA (was 1,656), inside the range of a hand load sum. |
| M3 stale generation | Fixed | Gen 5 then gen 4: gen 5 delivers all 8 events and ends `done`, gen 4 ends `superseded` with no events. Gen 7 then gen 8: gen 7 `superseded`, gen 8 `done`. The app store numbers generations itself and drops events from any generation but the current one. |
| M4 search places | Fixed | IIIT, IIIT Hyderabad, IIITH and campus return `pl_iiit` first; Shodh, Bodh and Vrithi return block parts (`gb2#shodh` and so on). The app now passes `places` to `buildPlaceIndex`. |
| M5 unknown heights, radius | Fixed | Unknown height neighbours are filtered out before shading; the GB1 ledger lists 9 blockers. `contextRadiusM` (300 at standard) is passed through. |
| M6 hero replacement, GB2 | Fixed | Replacement by `replacedIds` (the app store passes `contextIdsFor(id)`), with a footprint triangle test as fallback. GB2 overlaps no context building; Bodh and Block D sit on their OSM ways, Shodh and Vrithi at spots marked as assumed. |
| M7 apartment split | Fixed | GB4: cooling 29%, equipment 26% (about 750 kWh per flat a year), lighting 23%, hot water 19% and seasonal (102 kWh per flat in January, 12 in June). Non residential hot water is zero. |
| M8 slabs | Fixed | Hand check: January 223 units costs Rs 1,199 (200 x 5.10 plus 23 x 7.70); September 184 units costs Rs 743 (100 x 3.40 plus 84 x 4.80). Gruha Jyothi is a setting. |
| M9 ENS and LPD | Fixed | RETV uses the ENS formula with assumed U and SHGC ranges and reads `unknown` when the range straddles 15; openable area is openable window to floor area (GB4 9.6%, fails 12.5%); LPD limits per type. |
| M10 daylight | Fixed | GB1 daylight has 47 rows, only regularly occupied rooms; `ecbcShare` removed. |
| M11 threshold | Fixed | Area thresholds read `unknown` within the 10% geometry uncertainty. GB1 clears the 20,000 m2 MOP threshold by 8,325 m2, so `true` is fair. |

### Search, round 2 (63 queries)

Now good: IIIT, IIITH, campus, IIIT library, Vindhya ground floor (goes to the entry level), server room, SBI, SBI bank, ATM, seminar hall, seminar hall 1, auditorium, robotics lab, CIE, C-STAR (now first), building science, CBS lab, lighting lab, EERC, shake table, CR-1, data centre, Shodh, Bodh, Vrithi, lecture hall (Bodh), dlf cyber city, makers lab, cog sci, "vindhya auditorium", "himalaya lecture hall". Storey hits show the storey name.

Still weak (see R2-m3): "A3" and other wing codes return nothing (a regression: staff and plans use wing codes); "cafeteria" returns nothing; "classroom" ranks the CIE part and Bodh zones above Classroom CR-1; "himalya" ranks the Block D part above Himalaya; "CR-1" brings London addresses at 74. "WeWork" and "Krishe Emerald" return nothing, as intended after m10.

### Open items after round 2 (all minor)

**R2-m0 (WP-08, Agent B): no test for a late older generation in the app store.** The guard in `apps/web/src/studio/state/studio.ts` drops events whose generation is not the current one, which is correct, but `apps/web/test/studio.test.ts` has no case for it. Add one mirroring the preview test (start gen N, start gen N+1, deliver gen N events late, expect no change).

**R2-m1 (WP-13): the result does not say which neighbours were left out.** Unknown height neighbours are dropped silently. RB 5 asks for a visible "unknown neighbour" flag. Add a count or id list of excluded neighbours to `SiteResult` so the lens can say "12 neighbours of unknown height ignored; shade may be understated".

**R2-m2 (WP-13): AC hours still identical at 24 and 26 C.** m2 is listed as done, but every building's comfort rows show the same hours for both set points (GB1 2,574 to 2,860 at both).

**R2-m3 (WP-14): search gaps above.** Add wing codes (A3, C7) and room numbers as aliases; add Cafeteria to the third floor room that holds it; boost exact room function matches over block parts for generic words like "classroom".

**R2-m4 (WP-13): GH1 gets an ECSBC 2024 baseline.** A London terrace should not carry an Indian code baseline; use none, or the UK reference when it exists.

**R2-m5 (WP-13): GB2 cooling stays high.** 1,195 MWh of cooling electricity at COP 3.4 is about 2,900 equivalent full load hours on the 400 TR plant; daytime Indian campuses usually run 1,500 to 2,200. Review the ventilation term (1.5 air changes on the full volume) and classroom occupied hours.

**R2-m6 (WP-14): over-sized end wings in GB1.** C1 (EERC, 376 m2 against a 2,047 sq ft label of 190 m2) and C7 (SBI, 408 m2 against 2,145 sq ft of 199 m2) are about twice their labels; Seminar Hall I (2,088 sq ft, 194 m2) is modelled at 408 m2. Recheck when the plan underlay arrives.

**Carried over, accepted:** m5 (synthetic replay delay; `deviceFactor` 0 exists), m11 (sample places keep the pack origin so frames match; search centres hits on buildings), m12 (city heights and names wait for Open Buildings at V-2).
