# Design and QA review: city stage, V-P (WP-07, agent C)

Reviewer: design and product QA. Date: 2026-10-11. Scope: `packages/scene/src/city/` (`CityStage`, `CityScene`, `CityChrome`, `view.ts`, `materials.ts`, `model.ts`), the harness `dev/city.tsx`, the existing shots in `docs/qa/ux/V-P/city/` and one new capture pass in `docs/qa/ux/V-P/city/review/` (focus, floor, phone 360, tablet 768, desktop 1440, night city, Yoru model, shadows). Judged against PLAN-V3 section 6, DESIGN_SYSTEM sections 2, 3, 4, 10, 12 and 13, and premium references: Bruno Simon's portfolio (tactile, lit, every surface considered), Autodesk Forma (analysis legible at a glance, calm chrome), and a studio architectural model photographed on a light table (white card massing, crisp cut edges, one warm key light, soft contact shadows).

## Verdict: NOT YET

The engineering is solid: one demand rendered canvas, merged context, BVH picking, a real sun, honest stand in labels, a cumulative sun hours grid, reduced motion paths and a working SVG fallback. The day model at Building level already reads as a pleasant card model. But the product does not yet look or feel like the owner's bar. Three of the eight signature moments read wrong on screen (night lanterns, daylight drawer, shadows), the phone layout has overlapping controls, and the chrome is browser default boxes and blue sliders that no Andon screen should ship with. None of this needs a rewrite; it needs a finishing pass with the specific fixes below.

## Minimum set for SHIP

1. B1 Night lanterns rebuilt as a lit volume in a visible night city (time range, lantern hue split, bloom or halo, context legible, several modelled buildings).
2. B2 Phone and tablet chrome per DS 13.7, with no overlap and the hero never under a legend.
3. B3 Andon chrome: WP-06 `ScaleLadder`, `ChoiceChips` or `LensPanel`, `AnalysisLegend`, `PreviewStamp`, and an Andon time scrubber; no native range or select controls.
4. B4 Hero presence at City and Site: framing with chrome safe areas, a 1.5 px ink outline, a site plinth and a locator at City level.
5. B5 Daylight drawer legible: passing light distinct from failing paper, drawer fully framed, the share number matching what the eye sees.
6. M3 Find highlight visible and the neighbour x ray bug fixed.
7. M10 Shadows lens reads as shadow, not as a gold carpet.

Everything else below is major or minor polish that should land before V-H, ordered by impact.

## Findings

Severity: blocker (do not ship), major (ship blocker for the hero demo, fix next), minor (polish). Area tags: visual, interaction, responsiveness, accessibility, product, content.

### Blockers

**B1. Night lanterns: the hero is cyan fragments and the city vanishes.** Severity blocker. Area visual, product, content.
- What is wrong. In `lanterns.png`, `desk-night-city.png` and `desk-yoru-model.png` only the glass emits; walls and roof are `#2b2520` and `#2f2924` on a `#0d0b08` ground under a 0.7 hemisphere, so the body of the building disappears and the long east and west facades become floating slivers (two spikes top left in `desk-yoru-model.png`). The ink outline is switched off at night (`!yoru` guard in `CityScene.tsx`). The glow colour is `--deep` Yoru times 2.4, which clips to saturated cyan: it reads as a wireframe, not a lantern. Context buildings are dashed `--line` Yoru (#39332D) on #0D0B08, about 1.5:1, invisible at 1440 px. `defaultLanterns` lights only the hero, so the "city of lanterns" has one lantern. The time strip runs 05:00 to 20:00 (`min={300} max={1200}`), so the evening and the night cannot be scrubbed and "the city breathes with its cooling load" is impossible. Choosing Night at 10:30 shows a night city while the strip says "Sun 57° high in the south east" (`phone-night.png`).
- Why it matters. Moment 8 is the closing image of the hero demo (DS 11: Yoru is the story's opening and closing look). Right now it reads as a rendering failure.
- Fix.
  - Light the body. Walls take a warm bounce: emissive `--glow` Yoru at 0.06 to 0.10 times strength, roof at 0.04, so the mass reads as a dark lacquered box lit from inside. Keep the 1.5 px outline at night in `--ink-3` Yoru (#968A7D) at 60%.
  - Split the hue. Window light is always lamplight (`--glow` Yoru #FFB547 mixed 70% with `--ink` Yoru #F2E7D0 for a warm white), graded per floor by the hourly load. The dominant end use hue (`--deep`, `--glow`, `--ember`) goes to a ground light pool (an additive radial decal under the footprint, 1.6 times the footprint, 18% at the edge of the building falling to 0) and to a thin roof rim. This keeps DS 13.1's hue rule legible without making the building cold. Write it up as a DS 13.1 amendment for WP-06.
  - Bloom restricted to emissives (DS 10 allows it): `@react-three/postprocessing` `Bloom` with `mipmapBlur`, `luminanceThreshold 0.85`, intensity 0.6, at tier 1 and up. At tier 0 (SwiftShader), a baked radial halo sprite per lantern (one instanced quad, no post pass).
  - Night city. Ground `--paper-sunk` Yoru, context tops one step up (`--paper-raised` Yoru #1E1A16) with walls at #15120F so masses separate by value; dashed outline in `--ink-3` Yoru at 45%; roads as faint `--line` lines; a very low, cool sky fill (hemisphere top #2A3346, intensity 0.35) so silhouettes exist. Trees as darker silhouettes than the ground.
  - Data. Preview lanterns for at least the four Himalaya blocks and two or three campus buildings with different EUI and end uses, so the eye can compare brightness. Per building lantern colour via a vertex colour attribute on the merged lantern mesh (no extra draw calls), replacing the one shared mean colour.
  - Time. Scrubber covers 00:00 to 24:00. Selecting Lanterns eases the clock to 20:30 over `--t-season` (1200 ms) unless the person has already chosen a night hour; dusk is a crossfade of light, ground and UI tokens, not a cut (see M9).
  - Legend: an EUI glow bar 0 to 300 kWh/m²·yr drawn as three lantern discs of rising brightness, three hue swatches with words (cooling, lighting, equipment) and one dashed sample labelled "not modelled". Replace the paragraph.

**B2. Phone and tablet layouts overlap and bury the hero.** Severity blocker. Area responsiveness.
- What is wrong. At 360 px (`phone-site.png`, `phone-radiation.png`, `phone-night.png`) the lens chips wrap to two rows and the "Stand in city and building" label (fixed at `top: 116`) sits on top of the Daylight and Night chips. The ladder, two chip rows and a two row time strip take about 300 of 740 px; the radiation legend then covers the bottom third of the hero. At 768 px (`tablet-daylight.png`) the desktop column ladder and legend are used unchanged and the drawer runs under both. The `compact` switch is a single 640 px test, not the DS 13.7 breakpoints.
- Why it matters. V-P promises every flow on desktop, tablet and phone at full fidelity. Overlapping controls are a functional defect, not polish.
- Fix (DS 13.7).
  - Phone 360 to 767: Niwa is the top 45% with nothing over it except a 44 px compass button and the stand in stamp at its bottom left. Below it a bottom sheet (`Sheet` from `@ibasho/ui`, peek, half, full with buttons). In peek: one horizontally scrolling lens chip row (scroll snap, 8 px gutters, edge fade mask), then the time scrubber on one row (play button, a single combined day scrubber; the date opens a small sheet of presets). The ladder becomes a breadcrumb row inside the sheet header ("Campus / Vindhya / First floor"). The legend lives in the sheet at half, as a single line strip (ramp bar plus min, unit, max) in peek.
  - Tablet 768 to 1279: ladder as a breadcrumb chip row top left; lens chips top right in one row; the legend docks into a right Shoji sheet (peek 72 px); time strip full width under the Niwa, 56 px tall.
  - Everywhere: the camera frames inside the free rectangle (see B4), so no panel ever covers the hero.
  - Add a layout test at 360, 768, 1280 and 1600 that fails on overlapping control rects (extend the Shugi lint harness).

**B3. Chrome is a dev harness, not Andon.** Severity blocker. Area visual, product.
- What is wrong. Native `<input type="range">` in browser blue (visible in every shot), a native `<select>` for the storey, rectangular white plates with a 1 px CSS border and 2 px radius, solid black active chips, 12 px labels for primary controls, its own `PreviewStamp` and legend. WP-06 already ships `ScaleLadder`, `ChoiceChips`, `LensPanel`, `AnalysisLegend`, `PreviewStamp`, `Stale`, `TierCaption` and `StageBar` in `@ibasho/ui` v3, which the scene already depends on. The ladder width also jumps from 70 to 130 px when the storey select appears (`daylight.png`).
- Why it matters. The owner's first read was "dev harness". Duplicate components will also drift from the studio's.
- Fix.
  - Use the WP-06 components: `ScaleLadder` (vertical rule with a tick per level, the current level as an ink bead, labels in Zen Kaku Gothic New 500 at `--fs-ui` 14 px), `LensPanel` or `ChoiceChips` with a 6 by 14 px ramp swatch inside each lens chip, `AnalysisLegend` (it already carries resolution, tier and "Open method"), `PreviewStamp` from `@ibasho/ui`.
  - Active chip: not a black block. Use `--paper-sunk` fill, `--ink` text, a 2 px `--ink` underline bead, and in Yoru `--tomoshibi` glow. Inactive: `--paper-raised` at 84% with the Shoji blur (DS 4.4), so the model shows through.
  - Panels: radius 0 and `BrushFrame` edges, `--kage-1` by day, `--tomoshibi` by night.
  - Time scrubber, a new WP-06 component (request it on INTERFACES as `SunScrubber`, a continuous sibling of `Slider`): a 24 hour track drawn as a kumiko bar, night hours in `--paper-sunk` hatched, daylight band in `--paper-raised`, sunrise and sunset ticks with times in M PLUS 1 Code, the day's sun altitude drawn as a fine `--ember` arc above the track, solar noon as a short tick, and the thumb as a 14 px `--glow` disc with a 1 px `--ink` ring (a moon crescent at night). Keyboard: arrows 5 min, Page 1 h, Home and End sunrise and sunset. The year scrubber is a 12 notch month strip with presets for 21 Mar, 21 May, 21 Jun and 21 Dec as chips.
  - Storey picker: a vertical stack of storey chips beside the ladder (section view of the building, each storey a thin bar you can tap), not a native select.
  - Typography: controls at `--fs-ui` 14 px; every number (time, date, altitude, legend min and max) in M PLUS 1 Code with tabular numerals; units in `--text-2` one step smaller (DS 3).

**B4. The hero is small, flat and unmarked at Site and City.** Severity blocker. Area visual, product.
- What is wrong. Site framing is `halfH = (span + 260) / 2`, so the 165 m building fills about a fifth of the frame (`site.png`) and is centred on the full viewport, not on the free area between the ladder, chips and time strip. Its walls (#E2D6C2) are close in value to the context paper (#FAF6EF) and there is no 1.5 px ink outline (WebGL lines draw at 1 px), so it does not separate. At City level (`city.png`) it is a speck among 600 boxes with no marker. At Building level the legend covers its south corner (`radiation.png`).
- Why it matters. The product is "your building in its city". The eye must land on it in under a second at every level.
- Fix.
  - Framing: compute views inside a safe rectangle (insets: left ladder width plus 16, top chips plus 16, bottom time strip plus 16, right legend width plus 16 when a legend shows). `applyView` already takes a screen shift for the drawer; generalise it to a safe area offset. Site: `halfH = fit(span * 0.75 + 70)` so the hero takes about 40% of the free width; City: keep the extent but add the locator below.
  - Identity: fat lines (`Line2` or drei `<Line>`, 1.5 px, `--ink`) for the hero outline at every level (DS 13.1); walls in warm RCC render desaturated 15% to paper (oklch about 86% 0.03 75), window bands with a 0.4 m chajja shadow line, roof in `--paper-sunk` with a parapet cap line. Context stays uncoated `--paper-raised`.
  - Plinth: the hero's site sits on its own cut sheet of card, 0.6 m proud of the table, `--paper-raised` top with a 1 px `--ink-3` cut edge and a soft contact shadow, like a site board in a studio model. This alone makes it read as "the subject".
  - City locator: a thin `--ink` leader line from the hero up to a small plate with the building name in Zen Kaku Gothic New 500 at 12 px, plus a soft `--glow` Hiru 12% ground ring under it. It fades out at Site and below.

**B5. Daylight drawer: good light looks like failure, and the drawer is cropped.** Severity blocker. Area visual, content.
- What is wrong. The Akari top stop is `oklch(96% 0.035 86)` #FCF1D8, nearly the paper colour, while failing points "stay paper with a fine dot". On the drawer (`daylight.png`, `tablet-daylight.png`) most of the plate reads as dotted paper with a thin teal strip at the glass, yet the legend says "Floor share passing: 41%". The eye says 15%. The drawer slides toward the lower left, under the legend and the time strip, and the building body above it still shows its full roof, so the two overlap.
- Why it matters. Moment 4 is a pass or fail story against ECBC 40%. If passing reads as failing the picture contradicts the number, which breaks the honesty principle.
- Fix.
  - Paint the drawer as a light box: the slid out floor plate becomes a dark tray (`--ink` Hiru at 88% or the Yoru paper), so daylight reads as light spreading in from the windows: Akari runs from the dark tray through teal to warm cream exactly as designed. Failing points: the tray colour with a fine `--ink-3` dot grid at 30%; ASE: the `--warm` 45° hatch on top.
  - Draw a single crisp isoline at the 300 lux, 50% threshold in `--glow` so the pass boundary is visible; tally "41% of floor area passes, target 40%" beside a small bar with the 40% tick.
  - Slide the drawer toward the side of the screen with free space (away from the legend), frame the whole drawer inside the safe area (B4), and fade the remaining building to 30% opacity once the drawer is out.
  - Check `sdaShare` against the painted grid (same cells, same threshold). If the scene estimate gives 41%, the picture must show 41% coloured; add a test that compares the share with the painted pass mask.

### Majors

**M1. No finishing pass, so the model looks flat.** Area visual.
- What is wrong. No ambient occlusion, no ink edges, no paper multiply pass in the city (DS 10 and 13.8 call for N8AO, Sobel ink edges and the screen space paper pass; `postprocessing` and `n8ao` are already dependencies). Shadows are the only depth cue.
- Fix. On rest at tier 1 and up, bake one still frame: N8AO at half resolution (radius 4 m, intensity 2, distance falloff 1), a Sobel edge pass on normals and depth in `--ink` at 35% (1 px, thicker on silhouettes), then the washi fibre multiply. While moving, the live pass without AO. At tier 0 keep the current look. Budget 1.5 s on SwiftShader; if over, bake at 0.75 DPR and upscale.

**M2. Floor and room levels are blank grids, and the floors above simply vanish.** Area visual, product.
- What is wrong. `floor-l2.png` and `focus-floor.png` show a 165 m plan cropped top and bottom, rooms as identical paper rectangles with hairlines, no wall poché, no doors, no labels. The lift animation exists (`liftRefs`) but afterwards the floors above are removed, so the state never shows the "cutaway" idea. Room level (`focus-room.png`) zooms to one grey rectangle with no name, no area and no context.
- Fix. Floor framing `halfH = fit(span * 0.6 + 20)` inside the safe area, elevation 56° kept. Cut walls as solid `--ink` poché 0.25 m wide on the cut plane (DS 13.4), glass as the three line window symbol, doors as swing arcs. Room function as a small mon plus name and area in Zen Kaku Gothic New 500 at 12 px on a `--paper-raised` plate, shown at Floor level for rooms larger than 40 px on screen. Floors above stay lifted 16 m as `--paper-raised` sheets at 22% opacity with an `--ink-3` edge, so the person sees where the floor came from; a "Lower floors" button returns them. Room level frames the room plus a 6 m margin and shows its plate with use, area, glazing ratio and orientation.

**M3. Find: highlight is invisible, and a found neighbour turns into an x ray box.** Area visual, interaction.
- What is wrong. `focus-floor.png` is pixel identical in look to `floor-l2.png`: the storey highlight draws `--ink` outlines over existing `--ink` outlines. In `focus-neighbour.png` the neighbour is drawn with `depthTest: false` lines and a 10% fill, so back edges show through and the building looks hollow or missing. The ladder then says "Building" while the subject is a neighbour.
- Fix. Highlight uses the focus colour (`--deep`, DS 2.2): a 2 px `--deep` outline with `depthTest: true` (hidden edges as a 1 px dashed `--deep` line at 35%), the subject keeps its solid material, and everything else lerps 45% toward the ground colour plus 0.5 opacity on context lines (already done). For a storey, add a 0.15 m `--deep` band at the cut. Pin the provenance chip for a found neighbour (with its height entry, see M5), and show "Neighbour" in the breadcrumb instead of lighting Building on the ladder.

**M4. Navigation is too thin for an architectural model.** Area interaction, accessibility.
- What is wrong. Only horizontal drag rotates; there is no wheel or pinch zoom, no pan, no on screen rotate buttons (arrow keys only, and only when the stage itself has focus), and the WebGL view has no north arrow or scale bar (the SVG view has both). `touchAction: none` blocks native gestures without replacing them.
- Fix. Wheel and pinch zoom continuously between ladder frames (snapping to the nearest level label on release, `halfH` clamped), two finger pan within the city box, one finger drag to rotate with 45° snap. A compass control bottom right: a 44 px north arrow that rotates with the view, with 45° turn buttons on either side and a tap to reset north up. A scale bar in M PLUS 1 Code (10, 50, 100 m steps) bottom left. All gestures have these button equivalents (DS 12, WCAG 2.5.7).

**M5. Moment 2 cannot be performed in the stage.** Area product, interaction, visual.
- What is wrong. The honesty chip is hover only and `pointerEvents: none`, so on touch or keyboard there is no way to read it, and nowhere to type a real floor count; closing the band only works through the `close=` URL. When it closes (`closed.png`) the only change is a missing hatch: no crease, no message. The ground hatch pitch is 2.2 m in world space, which at Site zoom is about 2 px and moirés into horizontal scan lines (`site.png`), and the top band hatch on roofs reads as dirt.
- Fix. Click or tap a neighbour: the chip pins, with source, date, method, the range, and a `Stepper` "Floors: 3 to 6" plus "Enter a real count" (emits `onHeightEnter(id, mm)` so the studio stores it). The band closes with the `--t-ori` crease and a `Toast`: "Shadow fixed: 4 floors, 14 m. Two neighbours' sun hours updated." Hatch in screen space: 45°, 6 px pitch, 1 px `--ink-3` at 35% (DS 13.1), applied on the ground band only; the uncertain top band on walls uses the same hatch at 25%, and roofs of estimated buildings get a dashed `--ink-3` top edge instead of a fill hatch.

**M6. Moment 1 sweep lacks its story beats.** Area product, visual.
- What is wrong. The harness can sweep 21 March then 21 May, but the chrome's "Sweep the day" only sweeps the current date, does not turn on sun hour paint, shows no sun and no path, and never says "In May the noon sun stands in the north". The sun hour grid ends in a hard square (`sweep.png`) that exposes the compute domain, and the sun hour paint at mid sweep is a muddy brown carpet.
- Fix. A Sweep control with the two dates as a sequence ("21 Mar, then 21 May"), progress shown on the scrubber, pause and replay. During the sweep: the sun hours lens is on, the ground stays paper where no sun has fallen yet and fills toward `--glow` as hours build (so the roof "fills with gold"), a thin sun path arc over the site in `--ember` at 50% with the sun as a small `--glow` disc moving on it, and a large clock in M PLUS 1 Code at `--fs-h2` top centre. On 21 May at noon, a hand note plate: "Noon sun in the north, 10 May to 2 August". Fade the grid edge over its outer 12% with a radial falloff into paper, and size the grid to the Site frame.

**M7. Radiation saturates: a gold lid on dark walls.** Area visual, content.
- What is wrong. With Hinata over 200 to 2,000 kWh/m²·yr the whole roof is the top stop and all walls sit in the dark teal range (`radiation.png`): two colours, no story. No radiation rose (Moment 3) yet.
- Fix. At Building level set the domain to the 2nd and 98th percentile of visible surfaces and say so in the legend ("range of this view"); add ticks at round values. Paint the roof at 2 m resolution so parapet and neighbour shading show. Build the rose: 16 petals over the roof centre, petal length by annual kWh per facade orientation, filled from the Hinata ramp, drawn as paper petals with an `--ink` edge, rising with the wick.

**M8. Moment 6 reads as solar panels on a flat roof.** Area visual, product.
- What is wrong. `photo.png` shows rows of dark blue panels flat on the roof; no lean toward the sun, no fins on the WNW faces, no pivoted wings, no evaluated steps, no seal. There is no control to enter the variant.
- Fix. Canopy as one continuous folded sheet tilted toward the winter noon sun (south, about 17°) with its leading edge lifted, cells drawn as a fine `--ink` grid on a deep `#33414b` glass with a `--glow` sky glint; WNW fins as card blades in `--paper-raised` with cast shadows; a film strip of evaluated steps scrubbed by a slider, the EUI as a step chart beside it, and the `Seal` pressing at the end. Entry: a "Sun bent" chip in Choose, labelled Preview until the search runs.

**M9. Day to night is a hard cut.** Area visual, interaction.
- What is wrong. `theme` flips materials and UI tokens instantly when the lens or style changes (materials rebuilt in a `useMemo` on theme). DS 5 asks for `--t-season` of at least 1200 ms.
- Fix. Keep one material set and interpolate colours, light intensities and the sky fill over 1200 ms, and crossfade the UI tokens (CSS transition on the custom properties). Under reduced motion, a 150 ms crossfade.

**M10. Shadows lens reads as a gold carpet.** Area visual, content.
- What is wrong. Shadow hours use Hidamari reversed, so zero shadow hours (full sun) is saturated `#FEB43A` across the whole grid (`desk-shadows.png`); the shadow is the absence of gold. The square grid edge is visible, and the roof is painted from the ground grid.
- Fix. Show shadow as shadow: paper where there is no shadow, deepening through warm greys to `--ink` at 13 h (`oklch(95% 0.016 83)` to `oklch(25.5% 0.009 53)`, lightness monotone; register it as a ramp with WP-06 or use Hidamari forward on "sun hours" and keep this lens for shade). Fade the grid edge as in M6; paint roofs from their own receiver heights.

**M11. Accessibility gaps.** Area accessibility.
- What is wrong. Buttons rely on the browser focus ring, not `--focus` (2 px `--deep` plus 2 px paper gap). Ladder and lens chips are single choice but use `aria-pressed` toggles. The honesty chip and room plate are hover only. The polite live region announces every 5 minute step while scrubbing. Control labels are 12 px.
- Fix. `--focus` ring on every control; `role="radiogroup"` with roving tabindex and arrow keys for ladder and lenses; pinned chips on click and Enter; debounce the live region to 600 ms after the last change and send one sentence; 14 px labels; a keyboard path to cycle neighbours with estimated heights (Tab into the stage, then N and Shift N).

**M12. Missing moments 3 (rose) and 7 (the shadow you cast).** Area product.
- What is wrong. Both are listed in WP-07 Next and not built; the hero demo script (PLAN-V3 8) uses them at 0:40 and 2:20.
- Fix. Rose per M7. Moment 7: toggle "your new floors" (ghost floors in dashed `--ink`), neighbours' facades flash the difference for 700 ms in the Kotai diverging ramp, then settle into a ribbon plate: "Winter sun hours lost: Himalaya D, 1.2 h a day", each name a chip that flies to that facade.

**M13. Lantern and analysis legends are paragraphs.** Area content, visual.
- What is wrong. The Night legend is 40 words with no scale; method text runs four lines on every lens.
- Fix. `AnalysisLegend` with the ramp, min, unit, max, one line of method and "Open method" for the rest. Lantern legend per B1.

### Minors

- **m1. Trees** are flat shaded icosahedra that look low poly at Building level (`focus-neighbour.png`). Use studio model trees: a stack of three or four `--good-soft` card discs on a thin `--ink-3` stem, or a subdivided sphere with a soft normal, instanced. Visual.
- **m2. Washi fibre arcs** are long circular strokes that read as scratches at 1440 px. Shorter fibres (20 to 60 px), more of them, lower opacity (3%). Visual.
- **m3. Stand in label** floats as bare text on a paper patch. Make it a `PreviewStamp` chip bottom left beside the scale bar: "Stand in city and building". Visual, content.
- **m4. Lens names**: "Night" is a time, not a lens; call it "Lanterns". "Model" could be "Paper". Content.
- **m5. Roads** are bright white strips that cut the sun hour map (`sweep.png`). Deboss them: a value 3% below the ground with a 1 px light edge on the far side and a dark edge on the near side. Visual.
- **m6. Date label** is not tabular and not in M PLUS 1 Code; the sun line mixes fonts. Content, visual.
- **m7. SVG fallback** is north up while the 3D view is at 135°, so switching loses orientation. Rotate the SVG to the current azimuth, or show a north arrow change animation. Interaction.
- **m8. Radiation wick and penumbra crease** were not verifiable in stills; record a short video in the next capture pass (Playwright `recordVideo`, one browser) to review motion timing against `--t-wick` and `--t-ori`. QA.

## What great looks like, per signature moment

**1. The sun sweeps Gachibowli.** The camera rests at Site, the hero on its card plinth. A thin `--ember` arc of the sun's path hangs over the campus with a small glowing sun riding it. A large clock ticks in M PLUS 1 Code. Tower shadows swing like clock hands across uncoated card; where sun has fallen, the ground warms toward gold and the roof fills last and brightest. On 21 May the arc tips north of the zenith and a hand note says so. Twelve seconds, then stillness, then the rough map sharpens in place.

**2. The penumbra of not knowing.** Estimated neighbours carry a fine 45° pencil hatch band beyond their solid shadow, like a draughtsman's construction lines. Tap one: a chip pins with its source and a floor stepper. Enter 4: the band folds shut along a crease in 900 ms, the shadow snaps to a single crisp edge, and a quiet toast names who gained or lost sun.

**3. Radiation wicks up the facades.** Walls start as bare card. Colour rises from the ground like ink drawn up blotting paper, batch by batch, deep blue at the base of shaded courts to amber and gold on the open west faces. Above the roof, a rose of paper petals unfolds, longest toward the south west. The legend says what range it shows and why.

**4. The daylight drawer.** The first floor slides out like a drawer from a plan chest onto a dark tray. Light pours in from each window as luminous teal to cream; the 300 lux boundary is drawn as one gold line; failing areas stay dark with a dotted grid; glare spots carry a warm hatch. In the corner, a short bar fills to 41% and passes the 40% tick.

**5. Three gates, one pass.** (Rendered in the studio, not the stage.) One horizontal savings axis with GHMC stars, BEE, ECSBC tiers and the ratings stacked as rungs; dragging a bundle moves every ladder at once, each step marked likely, possible or unknown, and the building in the Niwa dims the measures not in the bundle.

**6. The building bends to the sun.** A film strip of real search steps under the Niwa. Scrub it: the roof folds into a tilted canopy that leans toward the winter sun, card fins grow on the west faces, the wings pivot a few degrees, and an EUI step chart climbs down beside it. The last frame lands and the seal presses with its "Not proved" line.

**7. The shadow you cast.** Toggle your new floors: they rise as dashed ink ghosts. Neighbour facades flash once in the diverging ramp, warm where they lose sun, then settle; a ribbon names each loss in hours and kWh, and each name flies to its facade.

**8. The city of lanterns.** Dusk falls over 1.2 s. The paper city becomes dark card, its edges still drawn in faint dashed pencil. Modelled buildings glow from within with warm lamplight, brighter for higher EUI, each standing in a soft pool of its end use colour: blue for cooling, amber for lighting, ember for equipment. Unmodelled buildings stay dark with a dashed outline. Scrub a May day and the lanterns swell in the afternoon cooling peak and settle by midnight.

## Evidence

- Existing: `docs/qa/ux/V-P/city/{site,city,radiation,sweep,daylight,lanterns,photo,closed,svg}.png` (960 by 600).
- New (one capture pass, tier 1, SwiftShader, one browser, dev server killed after): `docs/qa/ux/V-P/city/review/`
  - `focus-floor.png`, `floor-l2.png` (M2, M3), `focus-room.png` (M2), `focus-neighbour.png` (M3) at 1280 by 800.
  - `phone-site.png`, `phone-radiation.png`, `phone-night.png` at 360 by 740 (B1, B2, B4).
  - `tablet-daylight.png` at 768 by 1024 (B2, B5).
  - `desk-night-city.png`, `desk-yoru-model.png`, `desk-shadows.png` at 1440 by 900 (B1, M10).
- No horizontal scroll at any width (scrollWidth equals innerWidth). Draw calls 15 to 28, triangles 43k to 53k: well inside DS 13.8 budgets, so there is headroom for the fixes above (fat lines, halo sprites, the bake pass).
