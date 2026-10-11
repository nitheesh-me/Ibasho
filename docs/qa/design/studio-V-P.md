# Design, QA and copy review: integrated studio, V-P

Reviewers: senior product designer, product QA lead, content editor. Date: 2026-10-11. Scope: `apps/web` studio (home, the five flows, settings ledger, search, errors), `packages/ui` v3 kit, `packages/editor`, `packages/store`, and `packages/scene` city stage as the studio uses it. Judged against PLAN-V3 sections 5 and 6, the owner direction, DESIGN_SYSTEM 13 and the two earlier reviews (`city-V-P.md`, `platform-V-P.md`). Screenshots: `docs/qa/ux/V-P/studio/round2/` (37 shots, 360 to 1600 px, day and night). One guarded headless Chromium, software GL. A machine reset interrupted the pass; the missing shots were retaken at a lower CPU cap.

## Verdict: NOT YET

The studio is now one product, not a kit. Home, the New wizard, the settings ledger, the revisit card and search all read as Andon: ink on washi, serif headings, quiet chips, honest Preview stamps, and a staged progress bar that names every stage and offers Cancel. The Look and Make pages no longer crash (the CityScene `useCallback` fault is gone in every shot). Revisit on the home page (`44`) is the best screen in the product: what changed, the source of each change, the old and new bill side by side, one next action.

It is not yet the polished, seamless studio the owner asked for. Five things break the promise on screen:

1. The night city inverts its own rule: neighbours glow and the hero is a dark slab (`22`, `23`).
2. Results arrive so slowly on this hardware that most panels say "on its way" for the whole visit, and once the main thread froze outright (`08`, the next shot timed out after 30 s). The owner direction says "no frozen screens".
3. The settings ledger, whose whole point is "changes N numbers", says "changes 0 numbers" on every row, and the impact box says "This changes 0 numbers" above a bill that moves (`15`, `16`).
4. Selected lever chips render as solid black blocks with no readable label (`29`), so the what-if flow cannot be read.
5. Phone and tablet still overflow: sideways scroll at 360 px on settings and the studio (`17`, `38`, `41`), and a colliding top bar plus a side sheet over the header at 768 px (`36`).

Fix the blockers below and the majors marked "before SHIP" and this is a SHIP for V-P.

## Known issues, verified

| Issue | Status | Evidence |
|---|---|---|
| Look and Make crashed (CityScene `useCallback`) | Fixed. Every Look, Make, Choose, Prove and Tell shot renders. One console warning remains (B-m9) | `21`, `26`, `33` |
| Night lanterns leave the hero dark while neighbours glow | Still broken, worse at Building level | `22`, `23` (S-B1) |
| Penumbra hatching busy across the whole city | Still busy at Site and City, by day and night | `12`, `24`, `07` (S-M1) |
| Daylight drawer cropped | No longer cropped at 1280, but it slides into neighbouring blocks and draws over them | `27` (S-M2) |
| Design levers through a PLACEHOLDER stand-in | Confirmed (`apps/web/src/studio/preview/levers.ts`). Numbers carry the Preview stamp, but nothing tells the person a lever is approximated rather than recomputed, while the card says "Each one recomputes the whole variant" | `29`, `30` (B-M8) |
| Phone in-page panel never screenshotted | Now shot: the panel follows DS 13.7 broadly, but the page scrolls sideways and tabs look like lenses | `38`, `39`, `41` (B-M4) |

## Minimum set for SHIP

Blockers B-B1 to B-B4 and S-B1, then majors B-M1 to B-M4, S-M1 and A-M1. Everything else is polish to land before V-H.

## Findings

Severity: blocker (do not ship), major (fix before the hero demo), minor (polish). Owner: B is agent B (`apps/web`, `packages/ui`, `packages/editor`, `packages/store`), C is agent C (`packages/scene`), A is agent A (data, fixtures, Preview stages, city packs). Ids: B-, S- (scene) and A- prefixes.

### Blockers

**B-B1. Selected chips lose their label (lever and choice chips).** Owner B. Area visual, accessibility. Shot `29`.
- What is wrong. In Choose, the active "Shading on sunny facades" chip (Chajja) and the active Glazing chip render as solid ink blocks with no visible text. The chip fill and the label colour are the same token in this state. The person cannot see which lever value is on, which is the whole what-if flow.
- Fix. In `packages/ui` chip styles, give `[aria-pressed=true]` and `[aria-checked=true]` the DS active treatment from the city review B3: `--paper-sunk` fill, `--ink` text, a 2 px `--ink` underline bead; in Yoru the `--tomoshibi` glow. Add a kit story with every chip state in both themes and a contrast test (text to fill at least 4.5:1).

**B-B2. Stages run on the main thread and the screen freezes.** Owner B (scheduling), with A-M2 for stage speed. Area performance, product. Shots `08`, `12`, `27`, `28`, `31`.
- What is wrong. After "See the first results" the next screenshot timed out after 30 s waiting for a frame: the page did not paint. Across the studio, 9 to 15 s after opening, the bar is still on stage 1 or 2, and Energy, Prove and Tell panels show only "on its way". The owner direction asks for no frozen screens and rough results first.
- Fix. Move the Preview runner (`apps/web/src/studio/preview/runner.ts`) into the existing worker (`apps/web/src/worker`), posting stage events; keep the main thread for paint and input. Yield between rough and refined passes. Order stages so the panel in view runs first (Energy for Look at Building, Codes for Prove), and show cached last results with the Stale hatch while the new run goes. Budget: first rough number in the visible panel under 1.5 s on this laptop, no long task over 200 ms.

**B-B3. The settings ledger says "changes 0 numbers" everywhere.** Owner B. Area product, content. Shots `15`, `16`.
- What is wrong. The count is computed from jobs held in memory (`SettingsPage.tsx`, `present`). After a reload or a direct visit there are none, so every row says 0, and the impact box says "This changes 0 numbers and may reorder your picks" directly above a bill that moves from 2,62,70,000 to 2,64,00,000. The ledger's promise ("settings with consequences", PLAN 7.8) reads as false.
- Fix. Count from the stage manifest's declared output quantities for the person's buildings (static, known without running), not from live jobs. While the impact is computing say "Working out what this changes", never 0. Copy: "Changes 14 numbers in Vindhya Bhavan and Himalaya. Your picks may change order."

**B-B4. Phone and tablet overflow and collide.** Owner B (C for anything inside the stage). Area responsiveness. Shots `17`, `36`, `38`, `41`, `11`.
- What is wrong. At 360 px settings, Look and Make scroll sideways; the settings H1 "Rates, levels and assumptions" and its lede are clipped. The New step list runs off the right edge. At 768 px the top bar text collides ("Vindhya BhavanAs it is"), the Choose tab is cut by the side sheet, and the side sheet covers the top bar and the time strip.
- Fix. Fluid H1 (`clamp(2rem, 8vw, 4.5rem)`, `overflow-wrap: anywhere` as a backstop). At tablet, the Shoji sheet starts below the 56 px top bar and above the engawa; breadcrumb selectors shrink to the building name with an ellipsis and a 44 px menu. New steps on phone become "Step 5 of 6: Place it" with a thin progress line, not a scrolling row. Add a layout test at 360, 768, 1280 and 1600 that fails on `scrollWidth > innerWidth` and on overlapping control rectangles.

**S-B1. Night inverts the lantern rule: neighbours glow, the hero is dark.** Owner C. Area visual, product. Shots `22`, `23`.
- What is wrong. At Building level in Yoru, the context blocks to the west are lit cream as if they were lanterns, while Vindhya is a dark brown slab with bright window strips. At City level the hero is a small dim block, two or three neighbours glow brighter, and everything else is dotted noise. DS 13.1: unmodelled buildings never glow; the hero (the only fully modelled building) should be the brightest lantern. Also the studio keeps the Radiation lens chip active at night, so lens paint and lantern light fight.
- Fix. Context at night: walls `#15120F`, tops `--paper-raised` Yoru, a dashed `--ink-3` outline at 45%, zero emissive, whatever lens is on. Hero: warm body emissive (0.08 to 0.10 of `--glow`), window bands at full lamplight, the end use pool on the ground, a halo sprite at tier 0, and the 1.5 px outline in `--ink-3` Yoru. Preview lanterns for other buildings capped below the hero's EUI brightness unless their EUI is truly higher, and then the legend says so. When the theme turns to Yoru at City or Site, the studio switches the lens to Lanterns (B passes `lens="lanterns"`); turning back restores the previous lens.

### Majors

**B-M1. The Welcome back plate covers the stage on every studio page.** Owner B. Area interaction, content. Shots `20`, `26`, `30`.
- What is wrong. A wide plate sits over the top third of the Niwa in Look, Make (over the tool rail and plan) and Choose (over the compare headers). Copy lowercases proper names ("ht commercial", "hyderabad city pack") and ends "Results below are recomputed, never silently", which is awkward.
- Fix. Show the change list once, on home (it is excellent there, `44`). In the studio, a single line in the engawa narrator: "Since your last visit: new tariff, ECSBC tiers, new weather file and city heights. What changed". Copy uses the labels from the home card (sentence case, proper nouns kept). Dismiss is remembered per place.

**B-M2. Panels promise a lens the stage does not show.** Owner B with C. Area product, visual. Shots `21`, `08`.
- What is wrong. Radiation is the active lens and the panel shows a rough legend and numbers, yet the hero is unpainted paper. The eye and the panel disagree.
- Fix. Paint the rough result as soon as the panel shows it (coarse cells, soft edges, DS 13.3 Rough). If the stage cannot paint yet, the legend says "Painting the model" with the hatch, and the numbers wait too.

**B-M3. Analysis legend layout breaks.** Owner B. Area visual, typography. Shots `21`, `22`, `24`.
- What is wrong. The three facts under the legend run together ("1,500 to 1,900 kWh980 to 1,200 kWh/m670 to 810 kWh/m²"). The roof range (up to 1,900) exceeds the legend maximum (1,700). Four loose colour blocks under the legend repeat the ramp and mean nothing.
- Fix. Facts as a three row definition list (label left, value right, tabular figures). Legend domain covers every value shown, or the out of range end gets an arrow cap and "above 1,700". Remove the swatch row or make it the Shiro greyscale key with values.

**B-M4. Phone panel: tabs look like lenses, labels truncate.** Owner B. Area responsiveness, hierarchy. Shots `38`, `39`, `41`.
- What is wrong. The mode tabs (Look, Choose, Tell, More) and the lens chips are the same chip style in two stacked rows. The stage bar text truncates to "Add...". The "Drawing a building needs a bigger screen" note sits over the plan.
- Fix. Mode tabs as a segmented `ModeTabs` bar with an ink underline, pinned at the top of the sheet; lens chips one scrolling row below with ramp swatches. On phone the stage bar shows the beads plus the current stage name only, and the sentence moves into the sheet header. The bigger screen note goes in the sheet, not over the plan.

**B-M5. Make: plan and 3D disagree, labels spill.** Owner B (plan), C (3D labels), A (names, see A-M1). Area visual, product. Shots `26`, `33`, `41`.
- What is wrong. In the 1600 split the plan is drawn east west and the 3D is rotated about 80 degrees, so synced selection cannot be read. The plan names rooms from the drawings ("CIE Startup Cabins") while the 3D names the same rooms by function ("Open office"). Long names spill over walls ("Structural Engineering Research Lab", "West stair and AHU"), area labels are about 6 px, and the 3D labels pile up ("Corridor", "Cor", "Toi 180"). An unexplained grey raster smudge sits over the north wing of the plan. The plan is clipped under the tool rail. A storey row has an unlabelled stepper reading "1". The facade row says "WWR 8% within 40%" while its slider reads 10%.
- Fix. One orientation for both views (true north up, or both at the building's own axis, with the north arrow in each). One label rule everywhere: function mon plus function name, the person's name for the room when they set one. Labels fit or collapse to the mon with the full name on hover and selection; minimum 11 px. 3D labels at Floor level only for rooms larger than 40 px on screen, with collision culling. Remove or explain the smudge (if it is the underlay, give it a label and an opacity control). Fit the plan inside the free area right of the rail. Label the stepper ("Copies of this floor"). Facade chip and slider read the same value.

**S-M3. Building framing crops the hero.** Owner C (framing), B (safe area). Area visual. Shot `08`.
- What is wrong. The new 15 storey office fills the Niwa and its roof is cut by the top edge; the first sight of the person's own building is a crop.
- Fix. Frame Building level on the bounding box of the whole building, including height, inside the chrome safe area with 12% margin.

**B-M7. Type specific copy leaks across types.** Owner B. Area content. Shots `08`, `39`.
- What is wrong. An office shows "Classroom hours comfortable with fans alone". "Fan-first (IMAC adaptive)" is an orphan caption with jargon.
- Fix. Comfort label from the building type: "Hours comfortable with fans alone" (generic), "Classroom hours..." only for education. Caption: "Using the Indian adaptive comfort model" with a link to the method.

**B-M8. Levers run through a stand-in but the card says they recompute.** Owner B, with A. Area honesty, content. Shots `29`, `30`.
- What is wrong. `levers.ts` `adjustEnergy` scales energy by factors (PLACEHOLDER), while the card says "Each one recomputes the whole variant".
- Fix. Until `@ibasho/preview` reads design parameters, the card says "Preview: lever effects are estimated from typical savings, not recomputed for this building", with a PreviewStamp. Swap the copy back when the stage is real.

**B-M9. Choose compare tiles.** Owner B. Area visual, layout. Shots `28`, `29`, `30`.
- What is wrong. Tiles crop the plan top and bottom; in the 1 plus 2 layout the "EUI computing" captions overlap the small tiles' drawings; the two big tiles look identical because the shading change is invisible at this scale; "As it is" still computes after the what-if has numbers (`30`); "In front" and "Bring to front" are unclear labels; the kicker "WHAT IF" wraps.
- Fix. Fit the whole building in each tile; captions below the drawing, never over it; draw the difference (new chajjas as `--ink` dashes, cool roof as a hatch, a Kotai diverging paint when results land); run the baseline first; rename to "Main view" and "Show large".

**S-M1. Penumbra hatch everywhere.** Owner C. Area visual. Shots `07`, `11`, `12`, `24`.
- What is wrong. Almost every context building carries the hatch at Site and City, so the city reads as grey static and the one story (these heights are guesses) is lost. It also dominates the first view of New ("Place it", `07`).
- Fix. Hatch the shadow band only for the 6 to 10 buildings whose penumbra reaches the hero's site, plus whatever is selected or hovered. Elsewhere, estimated heights show a dashed top edge only. At City level no hatch at all; a legend line says "Dashed tops: estimated heights".

**S-M2. Daylight drawer slides into the neighbours.** Owner C. Area visual. Shot `27`.
- What is wrong. The drawer moves west over the context blocks and is drawn on top of them; the lifted building fills the other half.
- Fix. Slide toward free space (computed from the safe area and neighbour footprints), fade context under the drawer to 30%, and fade the lifted building to 30% as the city review B5 asked.

**A-M1. Room names from the drawings.** Owner A. Area data, content. Shots `26`, `33`.
- What is wrong. `gb1.building.json` names rooms "C-STAR Incubator", "CIE Startup Cabins", "TTO and Makers Lab", "IIIT Library". PLAN 8 says fixtures use room functions only, never names from the drawings.
- Fix. Name by function ("Incubator offices", "Startup cabins", "Makers lab", "Library"); keep the drawing names out of shipped fixtures.

**A-M2. Preview stages are slow on this laptop.** Owner A. Area performance. Shots `12`, `27`, `28`.
- What is wrong. The Preview compute for sun and radiation takes several seconds each at standard resolution, which, with B-B2, leaves Energy and Codes unseen for most of a visit.
- Fix. Preview stages return the recorded rough result immediately (they are fixtures), then refine; target under 300 ms per rough stage.

**A-M3. The bill for the same building differs across screens.** Owner A with B. Area data, consistency. Shots `16`, `30`, `44`.
- What is wrong. Vindhya's yearly bill reads 2,62,70,000 before a change on Settings, 2,46,00,000 to 2,55,10,000 on the revisit card, and 2,39,90,000 for a what-if; the platform review's hand check was 3.26 crore. The person cannot tell which is current.
- Fix. One headline bill per building and scenario from one function; the revisit card's "after" equals the Settings "before"; a test that reads all three screens' sources and compares.

**A-M4. More Hyderabad offices (owner request).** Owner A. Area data, product.
- What. The owner asks for the Qualcomm and Vanguard offices in Hyderabad as well. Today the only office examples are a template ("HITEC City office"); neither is in the city pack, search or the New place list.
- Fix. Add both as office type sample buildings in the Hyderabad pack, placed on their OSM footprints with height ranges and sources, findable by search ("Qualcomm", "Vanguard"), and offered in New as "Start from a known building". Generic massing and room functions only; no logos or brand styling. Labelled Preview until real stages run.

### Minors

- **B-m1. Duplicate "HITEC City office".** Home shows a seeded place and a static sample tile with the same name (`01`). Keep one; name the template tile "Office template". B.
- **B-m2. Unknown URLs show the home page.** `/app/no/such/page` renders Your places (`19`). Add a Not found page in the Andon error style: "There is nothing at this address. Back to your places." B.
- **B-m3. Missing place page is bare.** `18` is one line and a button in a 1280 px void. Add a heading and a hint ("It may have been deleted on another device, or the link is from a branch you removed"). B.
- **B-m4. Stage bar labels truncate.** "Sun and shad..." at every width (`08`, `21`); "Options" should be "Optimising" to match DS 13.5; the sentence repeats time ("rough now, final in about 3 s 33%, about 3 s left"). Two line labels or short names (Geometry, Sun, Radiation, Daylight, Energy, Codes, Search) and one time phrase. B.
- **B-m5. The "[ ]" mark under the ladder** has no visible meaning (`21`). Use a fit icon with the label "Fit". B.
- **B-m6. Breadcrumb truncation.** "IIIT Hyderabad cam..." and "Vindhya B..." in the ladder at 1280 (`27`). Prefer truncating the place, never the building; ladder captions wrap to two lines. B.
- **B-m7. Memory copy capitalises values mid sentence** ("shading on sunny facades Chajja, roof finish Cool roof", `32`). Lower case the values except proper nouns, and write it as a sentence: "Shaded and cool adds chajjas on the sunny facades, a cool roof and low-e double glazing." B.
- **B-m8. Preview stamp accessible text** reads ". PREVIEW DATA: RECORDED TO SHOW..." (leading full stop, all capitals). Visually hidden text in sentence case without the stray stop. B.
- **B-m9. Console warning** "Attempted to synchronously unmount a root while React was already rendering" when moving between Make and Look. Defer the unmount (`queueMicrotask` or an effect cleanup). B.
- **B-m10. Search lists twelve zone rows** for "himalaya block d" ("Block D core zone", "Block D perimeter 0") and no Block D itself (`34`). Group rooms under their storey, cap at three per group with "more", add block parts as their own hits, and hide engineering zone ids. B with A.
- **B-m11. Home cards.** Thumbnails mix plan drawings and mons; Delete floats alone at the bottom right; the Branch and Add links are the link blue while everything else is ink (`01`). Use plan thumbnails for every real place and the mon only for templates; put Delete in a "More" menu. B.
- **B-m12. Fonts sometimes fall back.** `13` shows a system sans and serif after a branch, while `01` shows the Andon faces. Preload the two UI faces and use `font-display: optional` for headings so screens never swap mid view. B.
- **B-m13. Sun scrubber in Choose and Prove** takes 56 px but changes nothing there (`28`, `31`). Hide it outside Look and Make. B.
- **S-m1. Lens chips at night.** The chip row keeps Radiation selected in Yoru (`22`); see S-B1. C with B.

## What works (keep it)

- Home revisit card (`44`): before and after, sources, one action, Not now. This is the tone for every flow.
- New wizard (`03` to `07`): clear steps, honest "estimate" tags on every guessed value, find your building in step 1, and the hero CTA in gold only at the end.
- Staged progress bar: named stages, beads, Cancel, Preview stamp, rough then refined captions.
- Settings rows: source, grade, scope and reset on every value; the pending impact preview before Apply.
- Search palette (`34`): fast, keyboard first, grouped.
- Prove copy: "Pre-checks, not certificates" and the honest Seals card.

## Evidence

Shots in `docs/qa/ux/V-P/studio/round2/`: 01 to 08, 10 to 24, 26 to 34, 36, 38, 39, 41, 44. Numbers 09 (timed out, see B-B2), 25, 35, 37, 40, 42 and 43 were dropped after the machine reset to keep the load low; 21, 22 and 23 cover the night city and 20 the studio revisit. The working notes below were written during the pass.

### Working notes (pass 1: home, New, Restart, Settings, errors)

- 01, 02: home day and night read as Andon; two cards named "HITEC City office" (a seeded place and a static sample tile); thumbnails mix plan drawings and mons.
- 08: New ends in the studio with a clear staged bar, but a 15 storey office is framed so tight the roof is cropped; "Classroom hours comfortable with fans alone" shows for an office; stage labels truncate ("Sun and shad..."). The screenshot 9 s later timed out after 30 s: the main thread froze while stages ran.
- 12: after Branch, 9 s later the bar is still on stage 2; penumbra hatch covers almost every context building; branched place name truncates in the breadcrumb.
- 11: phone step list cut off at the right edge.
- 15, 16: every ledger row says "changes 0 numbers"; the impact box says "This changes 0 numbers" while it shows the bill moving.
- 17: settings at 360 px scrolls sideways; the H1 and lede are clipped.
- 19: an unknown URL shows the home page, no "not found".

### Working notes (pass 2: studio Look and Choose, 1600 and 1280)

- 20, 21: a "Welcome back" plate covers the top third of the Niwa on first open; copy lowercases proper names ("ht commercial", "hyderabad city pack"); "recomputed, never silently" is awkward.
- 21: Radiation lens on and a rough result in the panel, yet the hero is unpainted paper. Legend facts collide ("1,500 to 1,900 kWh980 to 1,200 kWh/m670"); roof range exceeds the legend max (1,700); four loose swatch blocks under the legend repeat the ramp.
- 22: Night at Building level: neighbours glow cream like lanterns, the hero is a dark brown slab. Inverts DS 13.1 (unmodelled never glow; hero brightest).
- 23: Night at City: hero barely visible, a few neighbours lit, context as dotted noise. Lens chips still say Radiation at night.
- 24: City by day: penumbra hatch on nearly every building, a grey static.
- 27: Floor daylight drawer slides left into neighbouring blocks and is drawn over them; the lifted building ghost fills the right half; panel still "on its way".
- 28, 29: Choose compare tiles crop the plan; "EUI computing" captions overlap the small tiles; the active lever chip renders as a solid black block with no readable label (Shading, Glazing); WWR Range shows 5% with a thumb jammed left; kicker "WHAT IF" wraps.
- Pipeline speed: after 9 s the bar is still on stage 1 or 2 in 12, 27, 28, 29.

### Working notes (pass 3: Choose done, Prove, Tell, Make, search at 1280)

- 30: after 15 s the what-if has EUI and bill, "As it is" still says computing; the Welcome back plate covers the compare header.
- 31, 32: Prove and Tell show only "on its way" cards after 12 s; the hero shows nothing about codes or story on the stage.
- 32: memory copy capitalises values mid sentence ("shading on sunny facades Chajja, roof finish Cool roof").
- 33: Make plan clipped under the tool rail on the left; long room names spill over walls ("Structural Engineering Research Lab", "West stair and AHU"); 6 px area labels; an unexplained grey raster smudge over the north wing; storey row has an unlabelled stepper "1"; room names such as "C-STAR Incubator", "CIE Startup Cabins", "IIIT Library" come from the drawings.
- 34: search for "himalaya block d" lists the building then twelve zone rows ("Block D core zone", "Block D perimeter 0"); no Block D entry; internal zone names leak.

### Working notes (pass 4: Make split 1600, tablet 768, phone 360)

- 26: plan and 3D are not in the same orientation (plan east west, 3D rotated about 80 degrees), so "synced selection" cannot read; the plan names rooms from the drawings ("CIE Startup Cabins") while the 3D names the same rooms by function ("Open office"); 3D room labels pile up ("Corridor", "Cor", "Toi 180"); facade row says "WWR 8% within 40%" while its slider reads 10%; the Welcome plate and tool rail cover the plan.
- 36: tablet top bar collides ("Vindhya BhavanAs it is"), the side sheet covers the top bar and the time strip, a kumiko grid ghosts through the sheet header, and the sheet cards are cramped with wide inner padding.
- 38, 39, 41: phone layout follows DS 13.7 broadly but scrolls sideways; mode tabs and lens chips use the same chip style in two stacked rows; the stage bar label truncates to "Add..."; the "Drawing a building needs a bigger screen" note sits over the plan; "Fan-first (IMAC adaptive)" is an orphan caption.
- Accessible text of every PreviewStamp reads ". PREVIEW DATA: RECORDED TO SHOW..." (leading full stop, all capitals).
- Console: "Attempted to synchronously unmount a root while React was already rendering" when moving between Make and Look.

## Round 3

Reviewers: senior product designer, product QA lead, content editor. Date: 2026-10-11. Scope: the studio after the agent B, A and C round 2 handoffs, plus the new Design before you build flow (SPEC 27). Shots: `docs/qa/ux/V-P/studio/round4/` (one guarded headless Chromium, software GL, CPU capped; a machine reset interrupted the pass after shot 09, and the rest was retaken). Scene items that match agent C's open list are marked "in progress with C".

### Verdict: at the end of this section

### Working notes (pass 1: home, not found, New at 1280)

- 01, 03: home by day and night is calm and on token. The revisit card is still the best screen. "Plan progress: one what-if in progress." reads like a status log. The EUI row shows "130 to 180 → 130 to 180", a change that is no change. Tracking on the gold button splits "St art a new place".
- 01: the template tile reads "London terrace, The 1905 home from v2": "v2" is a development artefact.
- 01: there is no way into Design before you build. The top bar has Places, New, Settings and London home; `/app/design` exists but nothing links to it (the round 2 handoff says the top bar has a Design link; it does not).
- 02: unknown address now shows "Nothing here" with one action. Fixed (B-m2).
- 04: New, step 1: "Qualcomm" finds nothing ("Nothing called "Qualcomm" in the places loaded here"). The place cards list HITEC City but not the three offices of interest. A-M4 is not reachable by a customer.
- 05: Lab card says "Profile still to be sourced." This is a note to ourselves, not customer copy.
- 07: Place it reads "Neighbours with estimated heights are hatched; their shadows carry a penumbra out to the plausible height." Jargon, and now untrue: agent C moved to dashed tops with hatch only near the hero. No drag to place in New (only the turn stepper), unlike the Design flow.
- 08, 09: after "See the first results" the screenshot call itself took 4.3 s and 5.7 s to get a frame: the page still stalls for seconds while stages start. Better than round 2 (no 30 s freeze) but not "no frozen screens".
- 09: Radiation is the active lens with numbers in the panel, yet the facades are unpainted paper (B-M2 still open; agent B flagged it to C). Roof reads "1,700 to 1,700 kWh/m²", a range of zero width. The rough roof value at 1 s (1,500 to 1,900) still exceeds the legend top (1,700).
- 09: a building created seconds ago gets the engawa line "Since your last visit: new tariff, ECSBC tiers, new weather file, city ...", truncated with an ellipsis. It is not a revisit.

### Working notes (pass 2: studio at 1600, after a second reset)

- 10: Radiation on Vindhya Bhavan. The panel has numbers and a colour bar, but every facade and the roof are unpainted paper (B-M2 still open; in progress with C). "Most on a facade (SE) 1,100 to 1,100 kWh/m²" is again a zero-width range. The screenshot took 10.5 s to get a frame, so the page still stalls while stages run. The Energy card says "on its way" while the top bar already shows an EUI.
- 10: a fresh browser with no history gets "Since your last visit: new tariff, ECSBC tiers, new weather file, city heights." This is a first visit, not a revisit, and "ECSBC tiers" is jargon.
- 11 (major): Floor, Daylight. The first floor plate is drawn to the right of the building, not inside it: the ghost of Vindhya Bhavan sits at the left and the dark floor plate floats beside it. No cells are painted; the panel says "The daylight result is on its way" for over 8 s.
- 12 (major): Make, split view. The plan on the left is turned about 45° from the 3D view on the right, although both claim north up (the plan shows a north arrow). The room layouts do not visibly match (plan has Data, Lab+, Library; the 3D view does not). A designer cannot trust that the two halves show the same floor.
- 12: plan labels "Corr", "Lab+" and "Open" are abbreviations a customer must guess.
- 15: Choose at 1280. The screenshot call took 24 s: the worst stall in this pass. The two thumbnails are tight crops of the roof and look identical, so the what-if (chajjas, cool roof, glazing) cannot be seen. "Below baseline −34 to 3.2%" mixes a sign and a direction: a range that runs from 34% above to 3.2% below reads as nonsense. The search chart has "less energy" and "more upfront" but no axis numbers.
- 17 (blocker): Prove at 1280 rendered a blank white page with no text and no console error after 6 s. Rechecked separately below.
- 18: Tell is calm. "The story is on its way." is fine while stages run. The memory list reads well.
- 17 recheck: opened directly, Prove renders after 12 s. Opened from the Prove tab after Look (17b), the page is blank white with no text and no console error 6 s after the click. So the blank page is real and comes from switching mode while the search stage runs (the footer shows "Trying bundles of changes 87%"). Blocker: a customer sees a white screen.
- 17: the ratings card has a yellow dashed box laid over all five rating rows, like a debug highlight. GHMC star labels overlap ("One starTwo starsThree s..."), and LEED "All points" spills past the card edge. "Three gates, one pass" says nothing to a customer. The codes line "Our estimate until a source is found." is a note to ourselves.
- 21, 22: search finds rooms and floors well ("lab" lists every lab with floor and building; "floor 2" finds floors and rooms). It finds nothing for "Qualcomm", "Lloyds" or "Vanguard": the offices of interest are still not reachable by a customer, from search or from New.
- 21 (major): reopening search with Ctrl K keeps the previous text, and Escape did not clear it, so typed queries run together ("LloydsQualcommVindhya floor 2"). Typing in the studio also logs React duplicate key errors four times.
- 22: the results list touches the right edge of the window with no gutter, and "Hyderabad" in every row repeats what the building already says.
- 23: Settings is the clearest page in the app: each value has a source, a status and how many numbers it changes. Two notes: the row status line "Our estimate until a source is found." (read by screen readers on every Estimate chip) is a note to ourselves; and the Plain and Pro toggle defaults to Pro.

### Working notes (pass 3: Design before you build, 1280)

- 26: the brief page is handsome: type cards with a day profile strip, name, area, storeys, budget and goals, and a clear step rail. Copy fixes: "Start from a office template" (an office); "Goals (each becomes a typed target)" is our word, not the customer's; Lab still says "Profile still to be sourced."; "Net zero ready (UK standard) (UK)" says UK twice.
- 27: after "Start from a office template" the window lands scrolled to the bottom, so the plan is half off screen and the tool rail is cut ("Undo" label clipped). The office template is a ring of four Lobby rooms around a 622.6 m² Corridor: that is not an office plan a designer would start from.
- 28: Place it on the map works and says "No overlap with mapped buildings." The camera is far and low, so the new building is a small box among many. "More cities arrive as city packs land." is a note to ourselves.
- 29: "Add this plot to compare" gives no feedback: the page text does not change and nothing counts the plots. It did add the plot (Compare shows two).
- 30 (major): Compare, Hyderabad plot against London plot. The London stage is black with "Sun below the horizon" at 21 Mar 10:30: London is drawn on Hyderabad time. Plot 1 says "Overlaps 1" although Place said "No overlap with mapped buildings". The London bill is "₹30,000 a year" for a 2,400 m² office: wrong currency and about 60 times too low next to Hyderabad's ₹19,00,000. "Below code baseline −150 to −77%" means 77 to 150% worse than code, said backwards. Both cards are "turned 0°" yet the plans are drawn at 45°, and the two thumbnails are near identical crops. The lens strip is cut at the right edge.
- 31 (major): Shape to goals uses plot 2 (London) without the customer choosing it, so "ECSBC Super: Not applicable, does not apply in the UK" for a brief that picked an Indian goal. "Lowest running cost" and "Lowest energy" are the same bundle. ₹4,00,000 for roof PV, insulated walls and low-e glass on 2,400 m² is far too low. "Source: Ibasho optimiser: the lowest running cost option on the front" is our jargon.
- 31b: the Commit summary is clear and honest ("Every number is a Preview estimate until it is calculated for this building").
- 32 (major): the saved London design opens in the studio with "Typical weather year for Hyderabad", sunrise 11:31 and sunset 23:45, and "From 10 May to 2 August the noon sun stands in the north here", all Hyderabad facts on a London building. Good news: radiation is painted on the facades here (south band warm), so the paint works on a new building but not on Vindhya Bhavan. The breadcrumb reads "My new building ... > My new building". An unexplained four point mark sits on the roof.

### Working notes (pass 4: city, phone)

- 14 (blocker): City level at night, 1600: blank white page with no text and no console error after 8 s. By day (14b) the page's text grows and then shrinks again (787, 1,466, 703 characters at 4, 10 and 18 s), and at 18 s the stages are back at "Tracing the sun past the neighbours". So the stages restart, and the page can go fully white while they run. This is the same white screen as Prove (17, 17b): three sightings in this pass.
- 14b: "City" shows the campus at site scale; nothing says which city or shows more than a few blocks. Radiation is selected although the address asked for none, and the panel waits with "The radiation result is on its way."
- 34: phone, 360 wide. The studio stacks well: level tabs on top, scene, day picker, then the mode tabs and lenses. No sideways scroll. The progress footer squeezes to "Day..." and the Cancel button.
- 37: Design at 360 is clean; type cards stack one per row. The step rail is hidden on the phone, so there is no sense of the six steps.

### Verdict

Not ready to show customers. Better than round 2: unknown addresses are handled, Settings is excellent, search finds rooms, the phone layout holds, Tell and the revisit card are calm, and a new design can go from brief to a saved building with painted radiation in one sitting.

Blockers
1. White page: Prove opened from its tab, and City at night, render as an empty white page for 6 s or more with no error (17b, 14). The stages also restart on their own (14b).
2. The offices of interest (Qualcomm, Lloyds, Vanguard) cannot be found, from search or from New (04, 21).

Major
3. Design flow mixes cities: London is drawn on Hyderabad time (night at 10:30, sunrise 11:31), with Hyderabad weather and the Hyderabad north sun note, and a London bill in rupees about 60 times too low (30, 32).
4. Shape to goals uses the last plot without asking, so the brief's Indian goal shows "Not applicable" (31). "Lowest running cost" and "Lowest energy" are the same bundle; upfront costs look far too low.
5. Floor view draws the floor plate beside the building, not inside it (11).
6. Make split view: plan and 3D are turned about 45° from each other and show different rooms (12).
7. Radiation is still unpainted on Vindhya Bhavan while it paints on a new design (10 against 32): in progress with C.
8. Long stalls: frames took 10 to 24 s to arrive during stage work (10, 15).
9. Search keeps the old query when reopened and logs duplicate key errors (21).
10. No link to Design before you build anywhere in the top bar (01).

Copy and polish (content editor)
- Remove notes to ourselves: "v2" on the template tile, "Profile still to be sourced.", "Our estimate until a source is found.", "More cities arrive as city packs land.", "the option on the front", "each becomes a typed target", "Three gates, one pass".
- Ranges of zero width ("1,100 to 1,100") should show one number; ranges across zero ("−34 to 3.2%" below baseline) need plain words ("between 3% better and 34% worse than code").
- "Since your last visit" shows on a first visit and on a building made seconds ago.
- "a office", "(UK standard) (UK)", plan abbreviations "Corr" and "Lab+".
- Prove: yellow dashed box over the ratings, overlapping star labels, LEED label past the card edge.

Shots: `docs/qa/ux/V-P/studio/round4/` (01 to 37; 13, 16, 19, 20, 24, 25, 33, 35, 36 and 38 were not retaken after the resets). Page text and console errors for each shot: `pass-log.txt` in the same folder.
