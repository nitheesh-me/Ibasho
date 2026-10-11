# v3 brief: UX and visual fidelity (city, studio, many building types)

Status: research brief, 2026-10-11. Author: UX and visual fidelity lead. Scope: how Ibasho grows from one London terrace into a multi-building, multi-type studio placed in a 3D city (Hyderabad first), without losing the Andon language. Builds on `docs/DESIGN_SYSTEM.md` (Andon), `docs/VISION.md` and the current `packages/scene` (three 0.186, R3F 9, drei, postprocessing, three-mesh-bvh already installed).

Codes used below: **D** desktop (1280 px and up), **T** tablet (768 to 1279 px), **P** phone (360 to 767 px).

---

## 0. Summary of proposals

1. **Scale ladder, not page sprawl.** One studio, five semantic zoom levels: City, Site, Building, Floor, Room. Same three zones (Niwa, Engawa, Zashiki) at every level; the zoom level changes what the Zashiki shows.
2. **Andon at city scale is an architectural model.** Hiru renders the city as an uncoated paper massing model (the Bartlett, BIG and Foster model-shop look); only the person's buildings carry ink line and real material. Yoru lights only buildings with a modelled energy figure; context buildings stay dark with a dashed outline, because unknown is not zero.
3. **Analysis is a lens you lay on paper.** Every analysis (sun hours, radiation, sDA, ASE, views, shadows, temperatures) is a removable sheet of tinted washi with its own legend, ramp, resolution and "Modelled" stamp. Never more than one ramp on screen.
4. **Height uncertainty becomes visible shadow uncertainty.** Context heights in Hyderabad are mostly estimates (Overture, Open Buildings 2.5D). We draw the shadow of the likely height solid and the shadow of the plausible range as a hatched penumbra. No tool we found does this.
5. **Settings are a ledger of assumptions.** Each rate and level has a value, unit, range, source, scope (app, place, building, scenario) and a "what it changes" count. Changing one marks dependent numbers stale with a pencil hatch until recompute.
6. **Progressive analysis.** Coarse grid in under a second, then refinement passes, like a path tracer accumulating samples. The figure states its current resolution and confidence while it sharpens.
7. **Eight signature moments**, each a real computation (section 9), led by "the sun sweeps Gachibowli" and "the building bends to the sun".

---

## 1. Reference products and what to take

| Reference | What it does best | Take | Leave | URL |
|---|---|---|---|---|
| Autodesk Forma | Early-stage site analysis: sun hours (ray traced, every point checked every 6 min, default 21 June), daylight potential (VSC on facades), wind, noise, microclimate; proposals compared side by side; an Inspect tool (key I) | Analysis panel pattern (pick metric, pick date, run, inspect a point); analysis area choice (site or whole model); proposal compare; stating the method and its limit ("cloud cover not included") | Cloud-only compute; corporate blue chrome; results without provenance | https://www.autodesk.com/products/forma/environmental-impact-analysis , https://www.autodesk.com/learn/ondemand/module/evaluating-environmental-performance-in-early-design-with-forma/unit/3weR6WZhHz1uASgj4foXig |
| Shadowmap | Global sun and shadow on 3D buildings and terrain; time scrub; started as a TU Wien thesis at 60 fps in the browser | The scrubber feel: drag time, see shadows move instantly; terrain shadows; "sun hours at this point" | Unlabelled data quality of heights | https://www.shadowmap.org , https://repositum.tuwien.at/bitstream/20.500.12708/305/2/Molzer%20Georg%20-%202019%20-%20Interactive%20Web-based%203D%20Solar%20Shadow%20Map.pdf |
| Cesium and 3D Tiles | Streaming city-scale geometry with level of detail | 3D Tiles as an optional context format | The globe-first camera; Ibasho is a site tool, not a globe | https://cesium.com/why-cesium/3d-tiles/ |
| NASA-AMMOS 3DTilesRendererJS | three.js and R3F renderer for 3D Tiles, plugin architecture, Google Photorealistic Tiles example | Use it (fits our stack) for optional photo context | Depending on a cloud key for any number | https://github.com/NASA-AMMOS/3DTilesRendererJS |
| Google Photorealistic 3D Tiles | Photogrammetric mesh of whole cities, Hyderabad included | Opt-in "photo context" backdrop for recognition only, off by default, labelled "Google imagery, not used in analysis" | Using a textured blob mesh for analysis (no building identity, trees fused to roofs) | https://developers.google.com/maps/documentation/tile/3d-tiles |
| Mapbox Standard | Four light presets (dawn, day, dusk, night) with shadows and AO on extruded buildings; emissive strength per layer | The idea of a few named light states mapped to Hiru and Yoru; emissive strength as a measured quantity | Vendor tiles and token | https://docs.mapbox.com/map-styles/standard/guides |
| deck.gl | GPU layers for millions of features; SunLight from a timestamp | Its layering discipline (each layer one quantity); data-heavy City overview if R3F struggles | A second render engine in the Niwa | https://deck.gl/docs/developer-guide/using-effects |
| OSM Buildings, Overture, Open Buildings 2.5D | Open footprints and heights | Overture footprints plus Google Open Buildings 2.5D heights for India; OSM `height` and `building:levels` (about 3 m per level) where present | Pretending estimated heights are surveyed | https://overturemaps.org/resources/technical-spotlights , https://sites.research.google/gr/open-buildings/temporal , https://osmand.net/blog/3d-buildings |
| GlobalBuildingAtlas, 3D-GloBFP | Global LoD1 heights | Fallback height source, each graded | | https://gee-community-catalog.org/projects/gba/ |
| Ladybug Tools and Pollination | The professional grammar: radiation rose, sun path, sky domes, Radiance-backed daylight | Graphic vocabulary professionals trust (sun path diagram, radiation rose, legend bar with units) | Grasshopper-style visual noise | https://www.ladybug.tools/about.html , https://github.com/ladybug-tools/ladybug-web |
| TestFit, Giraffe | Live yield as you sketch; saved schemes compared by metrics | "Scheme strip": every change recalculates and the scheme card updates live; compare 2 to 4 schemes | Real-estate funnel tone | https://testfit.io/product/urban-planner |
| Bruno Simon (folio, WebGPU rebuild, TSL) | Delight; a world you drive through; open source | Physicality of interactions (things have weight, settle, cast contact shadows); TSL shaders for analysis paint | Game navigation as the main UI | https://www.awwwards.com/brunos-portfolio-case-study.html |
| Bartlett and BIG presentation | Exploded axonometrics, white massing models, one hero colour, diagrams that tell a story in panels ("Yes is More") | White paper context, one accent per sheet, the exploded floor stack, sequence diagrams that show a form evolving | Render-farm photorealism | https://big.dk , https://www.ucl.ac.uk/bartlett/architecture |
| April Li, Phototropic Housing | Units "grow" toward the sun; living rooms project, bedrooms recess; south and west modules tilt; radiation per orientation colour-coded; stepwise energy bars against ASHRAE 90.1 | Moment 8 (section 9): an optimiser that bends the massing toward the sun with stepwise energy bars | Pure competition rendering without uncertainty | https://www.aprilli.com/sustainability/phototropic-housing-gbbcb |

Daylight metric references: IES LM-83 (sDA300/50%, ASE1000,250) and LEED v4.1 thresholds (sDA 40, 55, 75% for 1, 2, 3 points; ASE over 10% needs a glare explanation): https://leeduser.buildinggreen.com/sites/default/files/credit_documentation/LEEDv4.1%20Daylighting%20Credit%20Report_Redacted.pdf , https://kalwall.com/daylight-modeling/daylighting-metrics . Check against the official LEED guide before encoding as rules.

---

## 2. Keeping Andon while scaling to a city

### 2.1 The model-shop principle

The city is not a map with buildings on it. It is a model on a table, lit by a real sun.

| Element | Hiru 昼 (day) | Yoru 夜 (night) |
|---|---|---|
| Ground | `--paper` washi, terrain as stacked contour sheets (1 m or 2 m steps, cut paper edges) | `--paper` sumi, contours as faint `--line` |
| Context buildings (not yours) | Uncoated paper massing, `--paper-raised`, soft AO, real sun shadows | Dark, `--line` dashed outline; no glow, because their energy is unknown |
| Context with estimated height | Pencil hatch on the top 1 m (the uncertain part) | Same hatch, dimmer |
| Your buildings | Ink outline (`--ink`, 1.5 px screen-space), real materials desaturated 15% to paper | Lit from within; window glow ∝ modelled lighting plus equipment W/m² per zone; leaks as today |
| Roads | Debossed paper, no colour | Absent, or faint |
| Trees | Paper cones or lollipop spheres in `--good-soft`, porosity per species stated | Silhouettes |
| Water (lakes, Hussain Sagar, Gandipet) | `--cold` at low chroma, flat | Reflects the sky colour only |
| Sky | Paper gradient by sun altitude | Dusk HDRI or sumi |

Rules carried over unchanged: seal vermilion only on seals; gold only on real repairs and the one hero action; every mark is a measurement with a legend; paper is cut, not rounded.

New rule: **the honesty outline.** Any geometry not supplied by the user carries a provenance chip on hover (source, date, height method, grade). Imagined neighbours are labelled "imagined" (already in DESIGN_SYSTEM 10).

### 2.2 Colour for analysis

One ramp on screen at a time. Each is lightness-monotone (greyscale-safe), passes the AC-14 deuteranopia test, and ships with a Shiro greyscale alternative.

| Quantity | Ramp (code name) | Stops (low to high) | Unit and default range |
|---|---|---|---|
| Temperature, heat flow | Netsu (exists) | Sumi, Ai, Bengara, Kuchiba, Yamabuki, hot paper | °C, W |
| Incident solar radiation | **Hinata 日向** | Ai deep, Hanada, Kinari, Kuchiba, Yamabuki | kWh/m²·yr (0 to 2000 for Hyderabad roofs) |
| Sun hours | **Hidamari 陽だまり** | Sumi, Aonibi, Kinari, Yamabuki | h/day on a chosen date, or h/yr |
| Illuminance, sDA | **Akari 明かり** | Sumi, Ai, Asagi, Kinari, hot paper | lux; sDA as pass/fail per point (hatch fail) |
| ASE (risk, not good) | Single-hue **Bengara** overlay on Akari | transparent to `--warm` with 45° hatch | hours above 1000 lux |
| Views, sky view factor | **Sora 空** | Sumi, Hanada, Asagi, paper | % of sky or view score |
| Differences (scheme B minus A) | Diverging **Kōtai 交代**: `--good` to paper to `--warm` | Always centred on zero; hatch on increases | same unit as source |

Legend component (`AnalysisLegend`, extends `TableAlt`): ramp bar, unit, min and max, resolution, date range, method one-liner, "Modelled, not measured", and an "Open method" thread.

### 2.3 Building type identity

Each building type gets a mon (kamon rules, DESIGN_SYSTEM 7) and a default schedule shown as a 24 h strip, so a person sees why a hospital and an office differ.

| Type | Mon motif | Schedule strip shows |
|---|---|---|
| Single-family home | Roof chevron over one square | Evening peak, night cooling |
| Apartments | Three stacked squares | Per-flat variation |
| Rental unit | Square with a key line | Tenant versus owner controls |
| Office | Four-pane grid | 9 to 7 weekdays |
| Hotel | Crescent over a bar | 24 h guest rooms, kitchen peaks |
| Education | Open book of two arcs | Term calendar, daytime only |
| Hospital | Cross of straight lines | 24/7, high fresh air |
| Lab | Flask of lines and an arc | Fume hoods, high air changes |

---

## 3. Information architecture

### 3.1 Objects

```
Studio (this device)
 └─ Place (a site or campus: location, climate file, code pack, money pack)
     ├─ Context (city tiles, terrain, trees: read-only, graded)
     └─ Building (type, code, storeys)            ← many per place
         ├─ Floor (level, height, plate)
         │   └─ Room (function, zone, schedule, loads)
         │        └─ Surface → Opening (window, door) → Shading (overhang, fin, chajja, jaali)
         ├─ Systems (HVAC, DHW, PV, lighting)
         └─ Scenario (a named set of changes)     ← many per building
              └─ Result (engine output + certificate + analyses)
```

Scenarios sit orthogonal to the geometry tree: geometry edits are themselves scenario changes, so "Baseline" and "Proposed" always differ by a diff list that the red thread can open.

### 3.2 Navigation: the scale ladder

A vertical ladder control (left edge on D, top breadcrumb on T and P): **City · Site · Building · Floor · Room**. Moving up or down is a camera move and a change of the Zashiki contents. Keyboard: `[` and `]`. Pinch on touch.

| Level | Niwa (3D) | Zashiki (data) | Default analysis |
|---|---|---|---|
| City | Paper city, 1 to 3 km radius, your places as lit pins | Places list; portfolio EUI chart; deadlines | Sun hours on the ground |
| Site | Your buildings plus 300 m of context | Site summary; shadows cast on neighbours; views | Radiation on facades |
| Building | Exploded or cutaway building | EUI, end uses, LEED points, carbon, code compliance | End-use bar, code check |
| Floor | Plan view (orthographic top), 3D tilt optional | Rooms table; sDA and ASE per floor | sDA floor map |
| Room | Room cutaway | Room loads, comfort hours, daylight, window and shade specs | Comfort hours |

### 3.3 Modes (top bar tabs, Noren)

| Mode | Purpose | Main tools |
|---|---|---|
| **Make** | Create and edit buildings, floors, rooms, openings, shading | Draw, extrude, split, room function, window band, overhang |
| **Look** | Analyses as lenses | Lens picker, time scrubber, resolution, inspect, compare |
| **Choose** | Search and optimisation; futures | Futures screen, parametric sweep, bundle list, why-not |
| **Prove** | Evidence, codes and certificates | Code checklist (ECBC, ASHRAE 90.1, Part L), LEED and GRIHA tallies, seals |
| **Tell** | Story, report, letter | Scroll story, PDF report, share pack |

Make, Look and Choose share the same stage; switching mode never reloads the scene. The narrator strip (Engawa) persists across modes.

### 3.4 Two depths of the same product

| Depth | Who | Shows | Hides |
|---|---|---|---|
| **Plain** (default for homes) | Margaret, Ravi | One insight per screen; "your hottest wall faces the sky"; three futures | Raw sDA grids, sky subdivision, discount-rate sensitivity |
| **Pro** (default for non-residential types) | Architects, students at IIIT, energy consultants | Full legends, numeric inspect, schedules, code clause numbers, CSV and IDF export | Nothing; plain sentences still appear as captions |

The depth switch lives in Settings and as a chip on every panel ("Show the working"). It never changes a number.

---

## 4. Layouts

### 4.1 Desktop (1280 px and up)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Ibasho  Place ▾  Building ▾  Scenario ▾      Make Look Choose Prove Tell │ top bar 56 px
├──┬──────────────────────────────────────────────┬────────────────────────┤
│L │                                              │ Zashiki (data)         │
│a │            Niwa (3D stage, ~62%)             │  Tokonoma insight      │
│d │                                              │  Panel for mode/level  │
│d │   [analysis legend, bottom left]             │  Evidence, tables      │
│e │   [view cube + north arrow, top right]       │                        │
│r │                                              │                        │
├──┴──────────────────────────────────────────────┤                        │
│ Time strip: day ◀━━━━━━●━━━━━━▶  month ring  ▶  │                        │
├─────────────────────────────────────────────────┴────────────────────────┤
│ Engawa: narrator sentence · stale/fresh state · job progress (Inkstone)  │ 44 px
└──────────────────────────────────────────────────────────────────────────┘
```

- Make mode adds a **tool rail** inside the Niwa left edge (draw, select, room, opening, shading, measure) and a **properties sheet** replacing the Zashiki panel.
- Floor level splits the Niwa into plan (left) and 3D (right) at 1600 px and up, synced selection.
- Compare in Look mode: up to four schemes as a 2 × 2 grid of small Niwa views with one shared time strip and one legend (Shūgi rule: stagger so no four corners meet; use a 1 + 3 layout).

### 4.2 Tablet (768 to 1279 px)

- Niwa full width; Zashiki becomes a right Shoji sheet (open, peek 72 px, closed). Portrait: bottom sheet instead.
- Ladder collapses to a breadcrumb chip row under the top bar.
- Make tools as a floating vertical rail with 48 px targets; Pencil and finger both supported (pointer events, pressure ignored for geometry, used for freehand notes only).
- Time strip floats above the sheet.

### 4.3 Phone (360 to 767 px)

- Phone is for **looking, choosing and telling**, plus light making (room functions, window sizes, shading toggles). Full massing from scratch is gated to T and D with a friendly line ("Drawing a building needs a bigger screen; you can still change rooms here").
- Niwa top 45%, sheet below with snap points (peek, half, full) and visible buttons for each (WCAG 2.5.7).
- One lens at a time, chosen from a horizontal chip row. Time scrub by horizontal drag on the Niwa with a two-finger rotate lock.
- **Sun compass (phone only):** optional DeviceOrientation and geolocation, both asked for in place. Hold the phone up on your balcony: the sun path for today and 21 March, June and December is drawn over the camera-less compass card, with the obstruction skyline from the model. This is Ravi's tool. No camera feed, nothing leaves the device.
- Gestures always have buttons: rotate, zoom, scrub.

### 4.4 Responsive rules

| Rule | Value |
|---|---|
| Breakpoints | 360, 768, 1280, 1600 |
| Jō cell | 48 (P), 64 (T), 72 (D) |
| Niwa minimum | 45% of viewport height (P), 55% width (T landscape), 58% width (D) |
| Hit targets | 44 px; 48 px for drawing tools |
| Text on 3D stage | Always on a `--paper-raised` plate, 7:1 |
| Performance tier by device | P defaults to Low render, Coarse analysis; D to High and Standard |

---

## 5. The editor (Make)

### 5.1 Creation flow (a building in under three minutes)

| Step | Action | Plain prompt | Pro extras |
|---|---|---|---|
| 1 | Place it | "Where is it?" Search, pin, or draw the plot on the paper city | Lat/long, true north offset, terrain datum |
| 2 | Choose a type | Eight type cards with mon and schedule strip | Mixed use by floor |
| 3 | Draw the footprint | Click corners; snaps to plot edges, 0.1 m grid, 15° angles, context edges | Import DXF, GeoJSON, IFC footprint |
| 4 | Stack floors | Drag the roof up; each floor snaps to its floor-to-floor height (type default, e.g. 3.0 m home, 3.6 m office, 4.2 m lab) | Per-floor plates, setbacks, podium and tower |
| 5 | Rooms | Auto-zone by type template (core and perimeter at 4.5 m depth for offices, ASHRAE 90.1 Appendix G style), or draw walls | Room function library with loads and schedules |
| 6 | Openings | Window-to-wall slider per facade, or place windows one by one | Sill, head, mullion, glazing U, SHGC, VLT |
| 7 | Shading | Overhang, fins, chajja, jaali, louvres, balconies per facade with a depth slider | Projection factor shown live (ECBC uses PF) |
| 8 | Systems | Pick from type defaults | Full HVAC, DHW, PV |

Every step shows live results in the Engawa ("EUI now 142 kWh/m²·yr, range 120 to 170, because walls are not set yet").

### 5.2 Tools and feel

- **Direct manipulation with numbers.** Every drag shows a dimension tag in M PLUS 1 Code; typing a number while dragging sets it (SketchUp's value control box).
- **Origami extrusion.** Floors rise with the `--t-ori` crease motion; a new floor unfolds from the one below.
- **Smart arrays.** "Same windows on every floor" is the default; break the link per floor.
- **Room function painter.** Pick a function (bedroom, office, classroom, ward, lab, corridor, toilet, kitchen, server room) and paint rooms. Colour is not used for function; a small mon and a hatch pattern are, so colour stays free for analysis.
- **Hyderabad vernacular shading presets:** chajja (horizontal sunshade over windows), jaali (perforated screen, porosity %), verandah, courtyard, deep balcony, terrace garden, cool roof. Each is a real geometric object the solar and daylight models see.
- **Undo is a scroll.** The history panel shows each edit as a small thumbnail with the EUI after it (a "film strip" of the design), so people can step back to the version that was better.
- **Snap to existing reference.** Import a PDF floor plan as an underlay (scaled with two clicks), useful for the IIIT Vindhya Bhavan and Himalaya drawings.

### 5.3 Validation, plainly

Errors are drawn on the model, not in a list: an unclosed room shows a torn paper edge; overlapping rooms a warm hatch; a window larger than its wall a dashed outline. The fix is one click where possible.

---

## 6. Analysis UX (Look)

### 6.1 Lens panel pattern

Every lens shares one panel structure, so learning one teaches all:

1. **What** (one sentence: "Hours of direct sun on each surface on 21 March").
2. **When** (date, period, time step).
3. **Where** (site, building, floor, selected surfaces).
4. **How fine** (resolution chip: Sketch, Standard, Fine, with grid and time step shown).
5. **Result** (legend, three key numbers, histogram of the grid, TableAlt).
6. **Inspect** (key I; click a point for its value, its sun path with obstructions, and its red thread).

### 6.2 Lenses and their models

| Lens | Model (documented) | Output | Plain sentence pattern |
|---|---|---|---|
| Shadows | Sun position (NREL SPA or suncalc), shadow map | Live shadows at time t; shadow-hours footprint for a day | "At 4 pm in May the tower to your west shades your roof." |
| Sun hours | Ray cast per grid point every 6, 15 or 60 min against BVH | h/day or h/yr | "Your south balcony gets 5 hours of sun on 21 December." |
| Radiation | Cumulative sky (Robinson and Stone) from EPW over Tregenza 145 or Reinhart 577 patches, BVH occlusion | kWh/m²·yr per facade point | "The west wall takes 30% more sun than the east." |
| sDA, ASE | Daylight coefficients (two-phase) over the floor grid at 0.75 m work plane; graded "simplified" until a Radiance cross-check exists | % floor area, maps | "55% of this floor is well daylit for most of the year." |
| Views and sky | Sky view factor and view rays to targets (lake, park, Charminar) | % sky, view score | "Bedroom 2 sees 18% sky." |
| Thermal | Existing 5R1C zones | °C, comfort hours | "This ward is above 28 °C for 410 hours." |
| Impact on neighbours | Difference of neighbour sun hours with and without your building | Δh on context facades | "Your new floor takes 40 minutes of winter sun from the flats to the north." |

Implementation note: three-mesh-bvh (already a dependency) in a Web Worker gives deterministic CPU ray casts; the GPU paints results through a vertex or texture attribute. Analyses are results with provenance, not shaders that invent numbers. Heavy runs are chunked and cancellable.

### 6.3 Comparisons

- **Swipe** (one stage, divider), **side by side** (2 or 4), **difference** (Kōtai ramp). Shared camera and time.
- The difference lens refuses to compare runs at different resolutions and says why.

---

## 7. Settings model: adjustable rates and levels

### 7.1 Structure

Every setting is one record:

```ts
// shape only; contracts live in @ibasho/core
type Setting = {
  id: 'money.tariff.elec' | 'carbon.grid.factor' | 'finance.discountRate' | ...;
  value: Quantity | Choice | Schedule;   // unit-bearing, bigint fixed point for money
  range?: { min, max, likely };          // unknown is a range, not zero
  default: { value, source: SourceRef, grade: 'primary'|'secondary'|'announced'|'estimate' };
  scope: 'app' | 'place' | 'building' | 'scenario';
  level: 'plain' | 'pro';
  affects: ResultKey[];                  // drives stale marking and the "changes N numbers" count
  editedBy?: 'user' | 'pack';
};
```

Resolution order: scenario over building over place over app over pack default. Each value shows a small origin chip ("Your value", "TGSPDCL 2025 tariff", "Pack default").

### 7.2 Groups

| Group | Settings (examples) | Plain control | Pro control |
|---|---|---|---|
| **Money** | Electricity tariff (slabs, time of day, fixed charge), gas or LPG price, water tariff, PV export rate, inflation, discount rate, analysis period, capital cost index | Pick a tariff card (e.g. TGSPDCL domestic or LT commercial) | Edit slabs, ToD windows, escalation |
| **Carbon** | Grid factor (CEA CO2 Baseline Database for India; UK grid for UK), marginal versus average, gas and LPG factors, embodied carbon on or off | "Use India's official grid figure" | Year path, marginal factor, custom |
| **Comfort** | Comfort model (adaptive per IMAC India or ASHRAE 55 adaptive, or fixed band), setpoints, humidity limit, fan air speed credit | "Cooler", "Typical", "Warmer tolerance" | Band edges, model, occupancy override |
| **Codes and targets** | Energy code (ECBC 2017, ECBC-R or Eco Niwas Samhita, ASHRAE 90.1, Part L), compliance path, EUI target source, LEED version, GRIHA | Pick "India" or "Global" | Clause-level choices |
| **Weather** | EPW source (ISHRAE, OneBuilding), year type (typical, a hot year, a future year), sky model | "Typical year" | File, morphing |
| **Analysis resolution** | Grid spacing (0.5, 1, 2 m), time step (6, 15, 60 min), sky patches (145, 577), daylight method, context radius (100, 300, 1000 m), height source preference | Sketch, Standard, Fine | Each parameter |
| **Render quality** | DPR cap, shadows (off, hard, soft accumulated), AO, bloom, texture size, context detail (LoD1 boxes, roof shapes, photo tiles), frame cap | Auto, Battery saver, Beautiful | Each parameter; live FPS and draw-call readout |
| **Display** | Hiru, Yoru, follow the sun; Plain or Pro depth; units (SI, IP for 90.1 users); currency; reduced motion; Shiro ramp; language | Toggles | Same |
| **Privacy and data** | Photo tiles (cloud, off), LLM narrator (local Ollama, off), export | Toggles with what leaves the device | Same |

### 7.3 Behaviour

- **Preview impact before commit.** Changing the discount rate shows "This changes 37 numbers and may reorder your futures" with a Before and After mini table; Apply or Cancel.
- **Stale is visible.** Numbers that depend on a changed setting take the pencil hatch and the word "updating"; they never show the old value as if current.
- **Sensitivity in one tap.** Next to any rate: "How much does this matter?" runs a small tornado chart (±range) from the engine.
- **Presets as packs.** "Hyderabad 2026 defaults", "UK 2026 defaults"; a user preset can be exported as JSON.
- **Render quality is never a number change.** Analysis resolution can change numbers, so it lives with Analysis and stamps every result with its resolution.

---

## 8. Loading, progress and empty states

| Situation | What people see | Motion | Copy |
|---|---|---|---|
| Cold start | Shita-e pencil underdrawing of the last place, then ink fills | `--t-sumi` | "Opening your places." |
| City tiles streaming | Blocks rise from flat paper footprints to height as data arrives, nearest first | Extrude 400 ms each, staggered | "Laying out the neighbourhood (1.2 km)." |
| Height unknown | Block stays at a pencil height with hatch | Breathing 5 s | Tooltip: "Height estimated from satellites, 9 to 15 m." |
| Analysis running | Coarse result at once (Sketch), then refine passes; a thin Inkstone bar in the Engawa with stage names and cancel | Points sharpen like accumulating samples | "Sun hours: rough now, final in about 8 s." |
| Engine recompute | Affected numbers hatch, then settle one by one | `--ma-pause` then settle | Live region: one sentence |
| Search and optimisation | Ink dots appear on the futures plot as candidates are scored; the front draws as a brushstroke when done | Dots fade in | "Tried 1,840 bundles, 23 on the front." |
| Offline | Everything local works; photo tiles show a paper placeholder | none | "Offline. Photo context is off; analysis is unaffected." |
| Empty studio | One paper plot on a table with a pencil, and three sample places (London terrace, Hyderabad flat, IIIT campus) | none | "Start a place, or open a sample." |
| Error | Kintsugi MendedError: what still works and one next step | none | "The daylight run stopped. Shadows and energy still work. Try Standard resolution." |

Budgets: first stage in under 2 s warm; any lens shows something within 500 ms; Standard sun hours for one building plus 300 m context within 10 s on an Iris Xe class laptop in a worker.

---

## 9. Eight signature visual moments

Each is a real computation, with a legend, and a reduced-motion version.

| # | Moment | What happens | What it measures | Reduced motion |
|---|---|---|---|---|
| 1 | **The sun sweeps the city** | Dawn to dusk over Gachibowli and the IIIT campus in 12 s on 21 March, then again on 21 May. Shadows of towers swing across the paper city; your building's roof fills with Hidamari gold as hours accumulate. The final frame is the sun-hours map. | Sun position per 6 min, shadow per step, accumulated hours per point | Four stills (9, 12, 15, 17 h) and the final map |
| 2 | **Radiation paints the facades** | Each facade is washed in Hinata colour from the bottom up, like ink wicking into paper, as the cumulative-sky result arrives patch by patch. The radiation rose rises above the roof. | kWh/m²·yr per point, per orientation | Final map with legend |
| 3 | **The daylight floor** | The floor plate is lifted out of the building like a drawer. The work plane fills with Akari light from the windows inward; points that fail sDA stay paper; ASE hot spots get the Bengara hatch. LEED points tally in the corner. | sDA300/50%, ASE1000,250 per point and per room | Static map and tally |
| 4 | **The building bends to the sun** | Phototropic optimiser: unit modules rotate and step, living rooms project and bedrooms recess, frame by frame, as the search walks toward lower cooling plus heating; stepwise energy bars grow beside it, April Li style. Stops on the front, and a seal checks that no shown option is beaten. | Real search iterations; each frame is an evaluated design | The three end states side by side |
| 5 | **The shadow you cast** | Toggle your new tower on and off: the neighbours' facades flash the Kōtai difference, and a ribbon shows the winter sun hours they lose. | Neighbour sun-hours delta | Before and after stills |
| 6 | **The penumbra of not knowing** | Context buildings with estimated heights cast two shadows: a solid one at the likely height and a hatched band out to the plausible height. Click a building and give its real floor count: the band snaps closed. | Height range to shadow range | Same, static |
| 7 | **The city at night as a lantern field** | Yoru over your portfolio: each building you modelled glows with intensity ∝ EUI and hue by dominant end use (cooling, lighting, equipment); unmodelled buildings stay dark with dashed outlines. A slider walks through the hours of a May day and the city breathes with the cooling load. | EUI and hourly load from the engine | Static night view with legend |
| 8 | **The end-use waterfall unfolds** | The building separates into floors (exploded axonometric, Bartlett style); end uses pour as layered paper strips from each floor into a stacked bar (cooling, heating, lighting, equipment, fans, pumps, hot water) with PV as a gold-free `--glow` band flowing back. EUI target line drawn in pencil. | End-use breakdown per floor, PV generation, target | Stacked bar and table |

Moment 1 or 4 is the Hyderabad hero opening; Moment 1 from VISION ("the roof lifts") stays the London opening.

---

## 10. Rendering plan for fidelity at scale

| Layer | Tech | Budget |
|---|---|---|
| Context buildings | Merged, instanced LoD1 extrusions per 250 m tile; roof shapes where OSM has them | ≤ 30 draw calls for context; ≤ 400k triangles total at City level |
| Your buildings | Full geometry, materials, interiors only at Floor and Room level | Existing budgets |
| Shadows | Cascaded shadow maps for live; accumulated soft shadows when still (existing still-life bake) | Bake ≤ 1.5 s |
| Analysis paint | Per-vertex or texture attribute, TSL or CSM shader, legend-bound | No new draw calls |
| Photo context (opt-in) | 3DTilesRendererJS with Google tiles, desaturated to paper and multiplied by the washi pass | Off by default; never under analysis |
| Paper pass | Existing screen-space fibre noise, now also edge-detected ink outlines (Sobel on normals and depth) for the model-shop look | One pass |
| WebGPU | three WebGPURenderer with WebGL2 fallback; adopt per scene once stable on Iris Xe | Feature-flag |

Data pipeline (offline, precomputed into a local pack per city): Overture footprints, Open Buildings 2.5D heights, OSM levels and roof shapes, Copernicus GLO-30 terrain; each building tagged with height source and range. Hyderabad pack first.

---

## 11. Untapped value (what others miss)

1. **Uncertainty in context.** Every city tool treats estimated heights as truth. We show the penumbra (Moment 6) and let one fact close it.
2. **Your impact on others.** Forma and Shadowmap show sun on you; few show the sun you take from neighbours in plain words.
3. **A sun passport for renters and buyers.** For any flat in a modelled block: sun hours per season, hottest wall, sky view, a balcony sun compass. In Hyderabad, where flats are chosen in show rooms, this is new and useful to normal people.
4. **Settings with consequences.** Tools hide rates in dialogs; we show what each rate changes and how much it matters.
5. **Vernacular shading as first-class geometry.** Chajja and jaali are rarely modelled in web tools; here they are presets with projection factor and porosity.
6. **Proof on the optimiser.** Parametric tools show a cloud of options; we seal that nothing shown is beaten, within the encoded rules.

---

## 12. Acceptance checks for this brief (proposed)

| Id | Check |
|---|---|
| UXV-1 | Every lens shows a legend with unit, resolution, date and "Modelled" (lint on component props) |
| UXV-2 | No two continuous ramps visible at once (Playwright assertion on legend count, run on the capped CI only) |
| UXV-3 | Context buildings with estimated height render the hatch and a provenance chip |
| UXV-4 | Every setting has unit, source, scope and `affects`; changing one marks dependents stale before recompute |
| UXV-5 | Phone: every drag has a button alternative; all tools reachable at 360 px |
| UXV-6 | Analysis results carry resolution; the difference lens refuses mismatched resolutions |
| UXV-7 | City level within budgets (≤ 150 draw calls, ≤ 400k triangles) on the Hyderabad pack |

---

## Sources

- Autodesk Forma environmental analysis: https://www.autodesk.com/products/forma/environmental-impact-analysis
- Forma sun hours and daylight tutorial: https://www.autodesk.com/learn/ondemand/module/evaluating-environmental-performance-in-early-design-with-forma/unit/3weR6WZhHz1uASgj4foXig
- Shadowmap: https://www.shadowmap.org , Studio: https://shadowmap.org/solutions/shadowmap-studio
- Molzer 2019, Interactive web-based 3D solar shadow map (TU Wien): https://repositum.tuwien.at/bitstream/20.500.12708/305/2/Molzer%20Georg%20-%202019%20-%20Interactive%20Web-based%203D%20Solar%20Shadow%20Map.pdf
- 3DTilesRendererJS: https://github.com/NASA-AMMOS/3DTilesRendererJS ; three.js 3D Tiles example: https://threejs.org/examples/webgl_loader_3dtiles.html
- Google Photorealistic 3D Tiles: https://developers.google.com/maps/documentation/tile/3d-tiles
- Cesium 3D Tiles: https://cesium.com/why-cesium/3d-tiles/
- Mapbox Standard style: https://docs.mapbox.com/map-styles/standard/guides
- deck.gl effects: https://deck.gl/docs/developer-guide/using-effects
- Overture buildings: https://overturemaps.org/resources/technical-spotlights
- Google Open Buildings 2.5D Temporal: https://sites.research.google/gr/open-buildings/temporal
- GlobalBuildingAtlas: https://gee-community-catalog.org/projects/gba/
- OsmAnd 3D buildings (levels to height): https://osmand.net/blog/3d-buildings
- Telangana open geodata on OSM wiki: https://wiki.openstreetmap.org/wiki/Open_Geospatial_Data_from_Government_of_Telangana
- three-mesh-bvh: https://github.com/gkjohnson/three-mesh-bvh ; three-gpu-pathtracer: https://github.com/gkjohnson/three-gpu-pathtracer
- Ladybug Tools: https://www.ladybug.tools/about.html ; ladybug-web: https://github.com/ladybug-tools/ladybug-web
- TestFit Urban Planner: https://testfit.io/product/urban-planner
- Bruno Simon portfolio case study: https://www.awwwards.com/brunos-portfolio-case-study.html
- April Li, Phototropic Housing: https://www.aprilli.com/sustainability/phototropic-housing-gbbcb
- LEED v4.1 daylight credit report (sDA and ASE thresholds): https://leeduser.buildinggreen.com/sites/default/files/credit_documentation/LEEDv4.1%20Daylighting%20Credit%20Report_Redacted.pdf
- Daylighting metrics overview: https://kalwall.com/daylight-modeling/daylighting-metrics
- Robinson and Stone 2004, cumulative sky method (Solar Energy 77): https://doi.org/10.1016/j.solener.2004.04.016

Not verified in this brief (flag for the climate and rules leads): exact TGSPDCL tariff slabs, the current CEA grid factor, IMAC comfort equations, ECBC projection factor tables. They appear here only as setting names.
