# Building and floor editor: brief (v3)

Status: research brief, 2026-10-11. Author: building and floor editor specialist.
Scope: which open-source editors and data models to borrow from, Ibasho's building data model, editor interactions, import and export, and phone and tablet layouts.
Inputs read: `docs/VISION.md`, `docs/ARCHITECTURE.md` (sections 5.2 and 10), `packages/core/src/twin.ts`, the two IIIT Hyderabad plan PDFs and `osm_iiit.json` in `docs/research/v3/sources/`, and ECBC 2017 (`sources/ecbc2017.pdf`).

---

## 0. Summary

1. **Use the Dragonfly model as the core: 2.5D storeys built from extruded room plates, with window and shade rules on each wall segment.** Ladybug Tools' Dragonfly already does this. It is the right abstraction for Ibasho, because one model covers a massing sketch, a room-by-room plan and a full energy model, and it translates cleanly to Honeybee, gbXML, IDF and IFC. Rooms that do not fit 2.5D (sloped attics, domes) fall back to 3D faces.
2. **The plan is the source and `HomeTwin` is compiled from it.** The editor owns `ibasho.building/1`. A pure, deterministic `compile()` turns it into the existing `Element[]` and `Junction[]` (ARCH 5.2), so the engine, scene and Lean checker stay as they are. Geometry and physics keep one source, which is already a rule (ARCH 10).
3. **Coordinates are integer millimetres, with Clipper2 for 2D geometry.** Clipper2 works natively on integer coordinates, so splitting rooms, offsetting walls, unions and adjacency are exact and deterministic. This matches the dmath and fixed-point rules and keeps areas checkable in Lean.
4. **Pascal Editor (MIT, React Three Fiber, Zustand) is the nearest stack match.** Borrow its interaction patterns and its node and tool split. Do not adopt its data model, because it has no energy semantics (no boundary conditions, constructions or space types).
5. **The IIIT plans are vector PDFs, not scans.** Vindhya page 1 has about 6,000 vector paths and Himalaya page 1 has about 120,000. The text layer holds room names and dimensions: 458 imperial labels such as `23'6"X14'7"` in Vindhya, and 99 metric labels such as `8.71X11.06M` in Himalaya. A trace-assist importer can snap to real wall lines, take its scale from the labels, and pre-fill each room's name and function. Few tools do this.
6. **OSM does not know building heights here.** Of the 313 buildings near IIIT, 15 have `building:levels`, none has `height`, and Vindhya is not named. The OSM importer must bring heights in as ranges (from Open Buildings 2.5D or a default of levels × 3 m), never as plain numbers. Unknown is not zero.
7. **Code checks run live while you draw.** ECBC 2017 rules, such as WWR of 40% or less, SRR of 5% or less, the projection factor PF = H/V, and the manual daylit-area method (DEF × head height), can be computed straight from plan geometry with no simulation. They show as health chips on every wall and room.
8. **There are three editing depths over one model:** Massing (footprint, floors, WWR per facade), Plan (rooms, functions, openings) and Detail (constructions, shades, systems, zones). A normal person can stay in Massing and still get valid EUI, ECBC and LEED numbers. A professional goes deeper in the same file.
9. **Every change is a command that produces Immer patches.** That one mechanism gives undo and redo, an event log the AI memory can read ("you widened the west windows on 3 Oct"), cheap re-compiles, and sync later if wanted (Yjs).
10. **The exporters (gbXML, epJSON and IDF, IFC4, Honeybee and Dragonfly JSON, GeoJSON) are plugins.** This gives users their professional tools (OpenStudio, EnergyPlus, Radiance via Ladybug, Revit, Bonsai) for free, and lets them check Ibasho's numbers with an independent engine.

---

## 1. Survey: editors and data models

### 1.1 Interactive editors (UX and code to borrow)

| Project | Stack and licence | What it does well | What to take | What to leave |
|---|---|---|---|---|
| **Pascal Editor** [github.com/pascalorg/editor](https://github.com/pascalorg/editor) | TypeScript, React Three Fiber, WebGPU, Zustand. MIT. | A browser 3D building editor. Node graph `Building > Level > Wall, Zone, Slab, Ceiling, Roof, Item, Scan, Guide`. Separate core, viewer and editor packages. It has an MCP package that exposes scene tools to AI hosts. | The split between node registry and tools. Wall-chain drawing. Guide nodes (underlays). The idea of an MCP tool surface (we already have `apps/mcp`). The level stack UI. | Its data model has no boundary conditions, constructions or space-type loads. Its WebGPU-first rendering conflicts with our software-GL constraint. ([Level node docs](https://mintlify.wiki/pascalorg/editor/api/nodes/level)) |
| **react-planner** (CVDLab) [github.com/cvdlab/react-planner](https://github.com/cvdlab/react-planner) | React, Redux, Three.js. MIT. | A 2D SVG plan that you can walk in 3D. A catalogue of `lines` (walls), `holes` (doors and windows) and `areas` (rooms auto-detected from closed wall loops). | Area detection from wall graphs. Holes that slide along a line by offset. The SVG plan as the default view. | Immutable.js and Redux era code. Unmaintained. Floats everywhere. |
| **blueprint3d** (furnishup) [github.com/furnishup/blueprint3d](https://github.com/furnishup/blueprint3d) | Three.js. Check the repo LICENSE (ES6 ports exist, for example [jan0991/blueprint-js](https://github.com/jan0991/blueprint-js)). | Corner and wall graph: drag a corner and every attached wall follows. Rooms are found from the graph. | The corner-graph drag behaviour. | Interiors only. Single storey. |
| **Sweet Home 3D** [sweethome3d.com](https://www.sweethome3d.com/) | Java (GPL). There is an HTML5 viewer. | The best everyday "draw rooms by double-click" UX. Levels with elevation. Dimension lines. Home.xml export ([format thread](https://www.sweethome3d.com/support/forum/viewthread_thread,6708_offset,20)). | Its keyboard flow (type a length while drawing, Enter, type an angle). Double-click to fill a room inside walls. Level tabs. | Java code. Furniture-centric. |
| **FloorspaceJS** (NREL) [github.com/NREL/floorspace.js](https://github.com/NREL/floorspace.js), [paper](https://www.nrel.gov/docs/fy18osti/70491.pdf) | Vue, D3. BSD-style. Embedded in the OpenStudio Application. | The only open browser editor built for energy modelling. You draw story by story; spaces get space types, thermal zones and constructions; window definitions repeat along edges; there is an image underlay. | The proof that a 2D story editor plus space types is enough for building energy models (BEM). Its window-definition model (repeating or WWR per edge). Image underlay with scale. | Low activity ([OSArch wiki](https://wiki.osarch.org/openstudio-openstudio-application-geometry/)). Vue. Its own JSON format, with known merge bugs ([UnmetHours](https://unmethours.com/question/70492/floorspacejs-json-file-corrupted-after-merging-with-osm/)). |
| **Bonsai** (formerly BlenderBIM) [bonsaibim.org](https://bonsaibim.org/), IfcOpenShell [ifcopenshell.org](https://ifcopenshell.org/) | Blender, Python. LGPL and GPL. | Native IFC authoring. Wall and slab tools with layer sets. Space generation from bounding walls. Drawings generated from the model. | IFC concepts done right: material layer sets, `IfcRelSpaceBoundary`, and spaces derived from walls. The WASM build ([wasm.ifcopenshell.org](https://wasm.ifcopenshell.org/)) for heavy offline validation only. | The Pyodide build is "incredibly heavy" with a long load time. Not for the app path. |
| **Ladybug Tools Spider** [ladybug.tools/spider](https://www.ladybug.tools/spider/) | Three.js. MIT. | A gbXML viewer and validator in the browser. | Test our gbXML export against it by hand. Its surface-type colour conventions. | Viewer only. |

### 1.2 Data models and exchange schemas

| Schema | Hierarchy | Strength | Ibasho use |
|---|---|---|---|
| **Dragonfly** [Room2D](https://www.ladybug.tools/dragonfly-core/docs/dragonfly.room2d.html), [Story](https://www.ladybug.tools/dragonfly-core/docs/dragonfly.story.html), [Building](https://ladybug.tools/dragonfly-core/docs/dragonfly.building.html) | Model > Building > Story > Room2D. Each Room2D is a horizontal floor polygon plus a height. Each polygon segment carries a boundary condition, window parameters (`SimpleWindowRatio`, `RepeatingWindowRatio`, `SingleWindow`, `DetailedWindows`) and shading parameters (`Overhang`, `ExtrudedBorder`, `LouversByDistance` and others). Story has `floor_to_floor_height` and a `multiplier`. Building can also hold 3D Honeybee rooms. | Exactly the "massing to plan" spectrum. It translates to Honeybee and so to EnergyPlus, OpenStudio and Radiance ([Model to Honeybee](https://docs.ladybug.tools/dragonfly-primer/components/2_serialize/model_to_honeybee)). | **Model the core on it.** Keep field names close so a Dragonfly JSON exporter is a straight mapping. |
| **Honeybee** [Model schema wiki](https://github.com/ladybug-tools/honeybee-schema/wiki/1.1-Model-Schema) | Model > Room > Face (Wall, Floor, RoofCeiling, AirBoundary) > Aperture and Door. Shades attach to Room, Face, Aperture or Door. Boundary conditions: Outdoors, Ground, Adiabatic, Surface. | Full 3D, simulation-ready. Energy and radiance properties live in extensions. | Fallback for non-extrudable rooms. Use as the vocabulary for `compile()` output. |
| **gbXML** [7.02 docs](https://gbxml.org/schema_doc/7.02/GreenBuildingXML_Ver7.02.html) | Campus > Building > Space (ShellGeometry, SpaceBoundary), plus Surface (`surfaceType`, `AdjacentSpaceId`, Opening) and Construction, Layer, Material, Zone. | The common exchange format for BEM tools (Revit, OpenStudio, IES, DesignBuilder, cove.tool). | Primary export. Secondary import. |
| **EnergyPlus IDF and epJSON** [energyplus.net/documentation](https://energyplus.net/documentation) | Zone, `BuildingSurface:Detailed`, `FenestrationSurface:Detailed`, `Shading:Zone:Detailed`, Construction, Material, plus schedules, loads and HVAC. | The reference engine. epJSON is plain JSON, so a TypeScript writer is easy. | Export for professionals and for independent cross-checks. |
| **OpenStudio OSM** [openstudio.net](https://openstudio.net/) | Building > BuildingStory > Space (SpaceType) > Surface > SubSurface. ThermalZone groups spaces. | SpaceType holds loads and schedules. Story and Space separate from ThermalZone. | Copy the idea that **space type** and **thermal zone** are separate from the room. |
| **IFC4** via That Open [engine_web-ifc](https://github.com/ThatOpen/engine_web-ifc), [engine_components](https://github.com/ThatOpen/engine_components) | IfcSite > IfcBuilding > IfcBuildingStorey > IfcSpace, IfcWall, IfcSlab, IfcWindow, IfcDoor, IfcRelSpaceBoundary, IfcMaterialLayerSet. | The BIM interchange standard. web-ifc reads and writes at near-native speed in WASM. Recent versions are MIT. Older IFC.js packages were AGPL, so check the version ([note](https://skillselion.com/skills/openaec-foundation/three.js-claude-skill-package/threejs-impl-ifc-viewer)). | Import from architects' IFC. Export IFC4 Reference View. Load web-ifc lazily (it is several MB of WASM). |
| **Speckle** [speckle.systems](https://speckle.systems/), [server](https://github.com/specklesystems/speckle-server) | Base objects with `Objects.BuiltElements.*` (Level, Room, Wall). Content-addressed object graph. | Versioned, diffable objects. Connectors to Revit and Rhino. | Borrow the idea: **content-hash each node** (we already hash results). Optional Speckle exporter later. |
| **OSM Simple 3D Buildings** [wiki](https://wiki.openstreetmap.org/wiki/Simple_3D_Buildings) | `building`, `height`, `min_height`, `building:levels`, `roof:shape`, `roof:height`, `building:part`. | Free footprints worldwide. | Site context and footprint import. |
| **Overture buildings** [docs](https://docs.overturemaps.org/guides/buildings) and **Google Open Buildings 2.5D Temporal** [catalogue](https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_Research_open-buildings-temporal_v1) | Footprints conflated from OSM and ML sources. Heights for South Asia at 4 m effective resolution, 2016 to 2023, from Sentinel-2. CC BY 4.0 and ODbL. | Fill the height gap in India. | Neighbour heights as `estimated` ranges for shadow and sun-hours analysis. |

### 1.3 Geometry libraries

| Library | Licence | Role |
|---|---|---|
| **Clipper2** [github.com/AngusJohnson/Clipper2](https://github.com/AngusJohnson/Clipper2), TypeScript port `clipper2-ts`, or WASM `clipper2-wasm` | BSL-1.0 | Integer polygon booleans and offsets: room split, wall thickness, union of footprints, setbacks, the daylit-area union. Deterministic on integers. |
| **earcut** [github.com/mapbox/earcut](https://github.com/mapbox/earcut) | ISC | Triangulate floor and roof polygons with holes for the scene. |
| **manifold-3d** [manifoldcad.org/docs/jsapi](https://manifoldcad.org/docs/jsapi/modules/manifold.html) | Apache-2.0 | Guaranteed-manifold 3D booleans (wall minus openings, roof trims) in the scene worker only. Its `CrossSection` wraps Clipper2. |
| **three-mesh-bvh** [github.com/gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | MIT | Fast picking and raycasts for site sun-hours and view analysis. |
| **pdf.js** [github.com/mozilla/pdf.js](https://github.com/mozilla/pdf.js) | Apache-2.0 | Render plan PDFs as an underlay. `getOperatorList()` gives vector paths and `getTextContent()` gives labels. |
| **Immer** patches [immerjs.github.io/immer/patches](https://immerjs.github.io/immer/patches) | MIT | Command patches for undo, redo, the event log and incremental compile. |
| **@use-gesture/react** [github.com/pmndrs/use-gesture](https://github.com/pmndrs/use-gesture) | MIT | Unified pointer, touch, pinch and pen gestures on SVG and R3F. |
| **Yjs** [yjs.dev](https://yjs.dev/) | MIT | Optional later: shared editing between devices. It is not needed for local-first single use. |
| **CubiCasa5k** [github.com/CubiCasa/CubiCasa5k](https://github.com/CubiCasa/CubiCasa5k) | CC BY-NC (dataset) | Raster plan parsing. Park it for the companion only. It is too heavy for the laptop and the browser. |

---

## 2. Data model: `ibasho.building/1`

### 2.1 Principles

- **Source and derivation.** `BuildingDoc` is what the user edits. `compile(doc, packs) -> { twin: HomeTwin-compatible, faces, adjacency, quantities, lints }` is pure, deterministic and memoised by content hash. The engine never reads the editor document directly.
- **Integer millimetres** for every plan coordinate and height (`Mm = number`, a safe integer). Angles are stored as integer millidegrees. Areas come out as exact integers in mm² (bigint when summed), so the Lean checker can verify the bookkeeping (section 2.5).
- **Unknown is not zero.** Any dimension can be a `NumField`: traced from a PDF (`document`), guessed from OSM (`estimated` with a range), or `stated` by the user. The editor draws estimated geometry with a dashed pencil line (Andon "guess looks like a guess").
- **IDs are stable** (`rm_`, `sg_`, `op_`, and so on) and survive edits, so evidence threads, AI memory and certificates can point at them.
- **Packs supply vocabularies.** Space types, constructions, window products and shading presets come from `home-*`, `rules-*` and a new `building-*` pack. The document stores ids, never copied numbers.

### 2.2 Hierarchy

```
Site
 ├─ location { lat, lon, elevationM, trueNorthDeg, climatePackId, codeIds[] }
 ├─ context[]   ContextBuilding (footprint, height range, source: osm|overture|open-buildings|traced)
 │              ContextTree (point, crown radius, height range, leaf-on months)
 ├─ terrain?    simple slope or heightfield
 └─ buildings[]
     Building { id, name, typology, codeTargets, origin{x,y}, rotation }
      ├─ storeys[]   Storey { id, name, elevation, floorToFloor, multiplier, isBelowGrade }
      │    ├─ rooms[] Room2D (2.5D, the default)
      │    │     floor: Polygon (outer + holes), ceilingHeight, plenumDepth
      │    │     segments[i] (one per polygon edge, derived ids):
      │    │        boundary: Outdoors | Ground | Adiabatic | Adjacent(roomId, segId) | AirBoundary
      │    │        wall: constructionId, thicknessMm (interior or exterior side)
      │    │        glazing: WindowRule   (see 2.3)
      │    │        shading: ShadeRule[]  (overhang, fins, louvres, light shelf, balcony)
      │    │     spaceTypeId, zoneId, occupancyOverrides?, name, label position
      │    │     floorBoundary: Ground | Adjacent | Exposed (pilotis, overhang over open air)
      │    │     ceilingBoundary: Roof | Adjacent | Exposed
      │    ├─ rooms3d[]  Room3D (Honeybee-style faces) for attics, domes, sloped ceilings
      │    ├─ cores[]    stair, lift, shaft (unconditioned, area-excluded flags)
      │    └─ underlay?  PDF or image ref, page, calibration (two points + real distance)
      ├─ roofs[]       RoofSpec (flat, mono, gable, hip, from OSM roof:shape) over a storey, cool-roof albedo, PV zones
      ├─ shades[]      free context shades attached to the building (canopies, screens, jaali)
      ├─ zones[]       ThermalZone { id, roomIds, systemId, setpoints, schedule set }
      ├─ systems[]     HVAC, DHW, lighting control, PV, battery (refs into existing SystemRef)
      └─ massing?      MassingSpec (used when rooms are empty; see 2.4)
```

### 2.3 Openings and shading: rules first, then instances

The approach follows Dragonfly and FloorspaceJS. A rule on a segment generates openings. The user can then "explode" the rule into editable instances.

| `WindowRule` | Parameters | Use |
|---|---|---|
| `Ratio` | wwr (0 to 0.95), sillMm, headMm?, productId | Massing and quick edits ("40% west") |
| `Repeating` | wwr, windowWidthMm, spacingMm, sillMm, headMm | Office ribbon or punched facades |
| `Single` | widthMm, heightMm, sillMm, offsetMm | One window, a balcony door |
| `Detailed` | `Opening[]` each { kind window, door, glass-door, vent; rect in segment u-v coords; productId; operable; frameMm } | Traced plans, IFC import |
| `None` | | Party walls, blank facades |

| `ShadeRule` | Parameters | Derived |
|---|---|---|
| `Overhang` | depthMm, offsetAboveHeadMm, extensionMm each side, angle | ECBC PF = H/V, SEF, shadow mask |
| `Fins` | depthMm, spacing or per-window, both or left or right | Vertical PF |
| `Louvres` | count or spacingMm, depthMm, angle, horizontal or vertical | |
| `LightShelf` | inside and outside depth, height | ECBC DEF "with light shelf" row |
| `Balcony` | depthMm, solid or rail parapet height | Counts as overhang for the floor below and as a floor extension |
| `Screen` | porosity 0..1 (jaali, perforated metal), offsetMm | Effective g-value and visible transmittance multiplier |

Product ids point to the pack (U, g, VLT, frame factor, cost). Missing data stays a `NumField` with a range.

### 2.4 Massing mode (early design and normal people)

`MassingSpec` replaces rooms when the user has not drawn any:

| Field | Meaning |
|---|---|
| footprint | polygon (drawn, OSM, or a template rectangle) |
| storeys | count, floorToFloor, ground floor height |
| setbacks[] | per-storey inset or offset per edge (terraces, podium and tower) |
| core | % of area or a polygon, unconditioned |
| perimeterDepthMm | default 4,570 (15 ft, ASHRAE 90.1 Appendix G perimeter zoning convention); ECBC daylight depth |
| wwrByFacade | N, E, S, W (or by segment) |
| shadesByFacade | overhang depth, fins |
| programme | % mix of space types (for example office 70, meeting 10, corridor 15, toilets 5) |

`compile()` auto-zones a massing into a core and four perimeter zones per storey, which is the standard BEM simplification, so EUI, end use and LEED energy work straight from a box. "Explode to rooms" turns the generated zones into editable Room2Ds.

**Phototropic generator** (inspired by [Aprilli phototropic housing](https://www.aprilli.com/sustainability/phototropic-housing-gbbcb)). This is a massing operator, not a new type. Each storey's setback per edge is a parameter, and the search (ARCH 6) can sweep setbacks against sun hours on terraces, self-shading of the facades below, roof PV yield and floor area lost. The parameters stay buildable through rules: minimum terrace depth, structure grid and FSI or FAR. This is "parametric modelling to suggest bundles" applied to form.

### 2.5 Quantities and what Lean checks

`compile()` emits a quantities table, and the certificate gains a small geometry section:

| Quantity | Definition | Checkable claim |
|---|---|---|
| Gross floor area per storey | area of union of room floors + walls (Clipper2) | Equals the sum of room net areas plus wall footprint, with no overlap (the overlap area is exactly 0 mm²) |
| Net conditioned area | sum of rooms whose space type is conditioned | Same set as the zone membership |
| Facade gross area per orientation bin | Σ segment length × storey height for Outdoors segments | Σ openings ≤ gross per segment; WWR = Σ opening / gross |
| Adjacency symmetry | every Adjacent(a→b) has b→a with equal overlap length | Proved symmetric; interior wall area counted once |
| Roof and SRR | skylight area / gross roof | ECBC SRR ≤ 5% |
| PF per window | H / V from overhang and window geometry | ECBC Note 4-2 example (PF = 0.345) reproduced as a test |

All are integer sums, which fits the existing columnar certificate and the TypeScript mirror of the checker.

### 2.6 Space function presets (room types)

A `SpaceType` in a pack carries: label (plain English), icon, conditioned or not, people density, lighting power density, equipment power density, outdoor air per person and per m², hot water use, setpoints, schedule set id, a daylight target (lux and whether ECBC daylight applies), noise sensitivity, and the source for every number. Values come from documented tables such as ECBC 2017 space-function LPD, ASHRAE 62.1 and 90.1 or COMNET schedules, and NBC 2016 occupant loads. They are never typed in by hand and never come from an LLM.

The typologies the owner named, with their minimum preset sets:

| Typology | Space types (minimum set) |
|---|---|
| Office (WeWork style) | open office, enclosed office, meeting, phone booth, pantry, lounge, reception, corridor, toilet, server or IT, storage, lift lobby |
| Hotel | guest room, guest bathroom, corridor, lobby, restaurant, kitchen, laundry, back of house, gym, banquet |
| Education (Himalaya, Vindhya) | classroom, lecture hall, faculty office, teaching lab, computer lab, library, dining, corridor, toilet, store |
| Hospital | ward, ICU, operating theatre, consult, imaging, pharmacy, corridor, waiting, sterile store, kitchen |
| Lab (Vindhya C3 materials labs) | wet lab, dry lab, instrument room, fume-hood lab (high outdoor air), store, office |
| Apartments and rental | living, bedroom, kitchen, bathroom, balcony (unconditioned, counts as shade), stair, lobby, parking |
| Single-family home | the existing `home-uk` and `home-in` room set (living, rest, kitchen, bath, loft) |

Presets are drag targets: drop "Classroom" on a room and the label, tint, loads and daylight target change together. A room with no type is `unknown` and shows as a range in EUI. It is never zero.

### 2.7 Relationship to the current `HomeTwin`

| `HomeTwin` today | Source in `BuildingDoc` |
|---|---|
| `form.storeys`, `storeyHeightM`, `footprintM2`, `perimeterM`, `frontAzimuthDeg` | Derived from storeys, the footprint union and `trueNorth` (kept for the UK SAP path) |
| `elements[]` (wall, roof, floor, window, door, rooflight) | Emitted from segments, openings, roofs and floors, with `geometry.polygon` in metres |
| `junctions[]` | Derived: window perimeters become lintel, sill and jamb lines; storey edges become intermediate-floor lines; footprint corners become corner lines; the footprint becomes the ground-floor line. Each has a K1 default ψ unless stated |
| `zones.livingAreaFrac` | Sum of rooms of type living over the total (homes) |
| `site.neighbours`, `boundaries` | From `context[]` and the plot polygon |

This keeps WP-02 (engine) and WP-04 (Lean) untouched for homes. New building types need new engine plugins (multi-zone), which another brief covers. The contract change belongs to `@ibasho/core` (an INTERFACES entry, not a local copy).

---

## 3. Editor interactions

### 3.1 Modes and tools

| Mode | Tools | Notes |
|---|---|---|
| **Site** | place building, pin location (search or GPS), import OSM, Overture or Open Buildings context, draw plot boundary, add tree, set true north | A map underlay as a raster tile in the plan only (OSM tiles, credited) |
| **Massing** | footprint (rect, polygon, OSM pick), storeys ±, setback drag per edge per storey, core, WWR per facade slider, overhang depth slider, programme mix | Results update live (debounced worker compile) |
| **Plan** | room rect, room polygon, wall chain (rooms found from closed loops, as in react-planner), split room by line, merge rooms, offset or move edge, insert vertex, room function brush, auto-label from underlay | The SVG plan is the main view, with 3D beside it or toggled |
| **Openings** | apply WindowRule to segment or facade, place a single window or door, explode rule, drag along wall, set sill and head, product picker | Snaps: centre of segment, equal spacing, grid, align with the window below |
| **Shading** | overhang, fins, louvres, balcony, screen per opening, segment or facade; depth handle in 3D | Shows PF and the ECBC SEF live |
| **Detail** | constructions per segment and roof, zones (lasso rooms), systems, schedules | Professional depth |
| **Analyse** | sun path and shadow scrub (day and hour), sun hours, radiation on facades, daylit area, sDA and ASE (when computed), views | Reads compile outputs and the site worker. Handed to the site analysis brief |

### 3.2 Snapping and precision

- Priority order: typed value, then existing vertex, then edge midpoint, then edge extension and perpendicular, then underlay vector line, then grid (default 100 mm, 300 mm on touch), then angle lock (15° steps, 0 and 90 by default).
- **Type while drawing** (from Sweet Home 3D): start a wall, type `4.2`, Enter, type `90`, Enter. Feet and inches are accepted (`23'6"`), because Indian plans often use them, as Vindhya does. They are stored in mm.
- Dimension strings are editable in place: tap the "4.20 m" label and type.
- Equal-spacing and alignment guides appear only while dragging.

### 3.3 Storey operations

| Action | Behaviour |
|---|---|
| Add storey above | Copies the plan of the current storey (choice: rooms, walls only, footprint only) |
| Extrude | Drag the roof edge in 3D to add storeys (snaps to whole floors) |
| Multiplier | "Floors 3 to 9 typical": one storey with multiplier 7 (the Dragonfly convention), exported expanded or with a multiplier |
| Below-grade | Basement or cellar (Vindhya has a cellar): ground boundary automatic |
| Ghost storey | The storey below is shown at 20% ink for tracing and alignment |

### 3.4 Undo, history and AI memory

- Every tool emits a `Command { id, label, at, patches, inverse, actor: 'user' | 'agent' | 'import' }`.
- Undo and redo are patch stacks. The log is persisted in IndexedDB (`packages/store`), with a snapshot every 50 commands.
- The AI narrator and memory read the command log as facts ("you added a 600 mm overhang to the west windows of Floor 2"). Agent edits over MCP arrive as commands with `actor: 'agent'` and can be undone like any other.
- Named versions ("Option A: deep overhangs") are branches of the log. The futures UI compares compiled results.

### 3.5 Keyboard map (desktop)

| Key | Action | Key | Action |
|---|---|---|---|
| V | select | R | room rectangle |
| P | room polygon | W | wall chain |
| S | split | M | merge |
| O | opening | H | shade |
| F | function brush | Tab | cycle snap target |
| Shift | disable snap | Alt | duplicate drag |
| PgUp / PgDn | storey up or down | 1 / 2 / 3 | plan, 3D, split view |
| Ctrl+Z / Ctrl+Shift+Z | undo, redo | Del | delete |
| Enter | confirm typed value | Esc | cancel tool |
| ? | shortcut sheet | / | command palette ("add storey", "set WWR 30% west") |

### 3.6 Touch and pen

| Gesture | Action |
|---|---|
| One finger drag on empty plan (draw tool active) | draw. With no tool active, it pans |
| Two finger drag or pinch | pan and zoom (never draws) |
| Long press on room | context sheet (function, rename, split, delete) |
| Pen | draws; finger pans (palm rejection via `pointerType`) |
| Two finger tap / three finger tap | undo / redo (Procreate convention) |
| Handles | minimum 44 px hit target (WCAG 2.5.5), drawn at 8 px |

### 3.7 Live health (plan lints)

These are computed in `compile()` and shown as quiet chips (ink by day, lantern glow by night), never as modals:

| Lint | Rule |
|---|---|
| Open loop, self-intersection, overlap | Geometry validity (blocks export) |
| Room under 1 m² or thinner than 600 mm | Probable drawing error |
| Window wider than segment, sill + height > ceiling | Opening validity |
| WWR > 40% on any facade or overall | ECBC 2017 4.3.2(a) (`ecbc2017.pdf`) |
| VLT < 0.27 | ECBC 2017 4.3.2(b) |
| SRR > 5% | ECBC 2017 4.3.4 |
| Daylit area below the Table 4-1 target (Business and Educational 40%, Hotel and Healthcare 30%, Resort 45% for ECBC level) | Manual DEF method 4.2.3.2: daylit depth = DEF × head height, using the DEF table by orientation, latitude band (Hyderabad 17.4° N is in the ≥15° N band) and VLT |
| Unknown space type | Shows the EUI range widening |
| Unmatched adjacency | Two rooms touch but the boundary is Outdoors |

Each chip opens the red thread (clause, inputs, formula), as in VISION moment 5.

---

## 4. Import

| Source | Path | Notes |
|---|---|---|
| **PDF plan (vector)** | pdf.js renders an underlay. `getOperatorList` extracts line segments in page units. `getTextContent` extracts labels | The IIIT PDFs are CAD exports through iLovePDF: A3, vector, with a text layer. See 4.1 |
| **PDF or image plan (raster)** | Underlay plus two-point scale calibration. Manual trace with snapping to edges detected by a light Sobel filter | No ML in the browser. CubiCasa-style parsing is optional and runs in the companion |
| **OSM** | Overpass query by bbox (as already fetched in `sources/osm_iiit.json`). Footprint polygon to massing. `building:levels` and `height` to a storey range | Near IIIT: 313 buildings, 15 with levels, 0 with height, Vindhya unnamed. Himalaya is way 187896823 (`building=university`, 3 levels). Heights default to a range: levels × [2.8, 3.6] m, or the Open Buildings 2.5D estimate |
| **Overture or Open Buildings** | GeoParquet or tile extract through the companion (too big for the browser), then context buildings | Credit CC BY 4.0 and ODbL |
| **IFC (2x3, 4)** | web-ifc in a worker: IfcBuildingStorey to Storey, IfcSpace to Room2D (when the footprint extrudes vertically, else Room3D), IfcWindow and IfcDoor to Detailed openings, IfcRelSpaceBoundary to adjacency, and material layers to constructions where they match | Load lazily. Unmatched constructions become `unknown` with a range |
| **gbXML** | Space and Surface to Room3D, then try to flatten to Room2D | For round-trips with OpenStudio and Revit |
| **Dragonfly or Honeybee JSON** | Near one-to-one | The Ladybug ecosystem |
| **Templates** | Typology plus area and storeys produce massing plus a programme | DOE prototype-like defaults per typology, sourced |

### 4.1 Trace-assist for vector PDFs (the untapped part)

1. **Calibrate automatically.** Parse dimension labels (`(\d+)'(\d+)"\s*[xX]\s*(\d+)'(\d+)"` and `([\d.]+)\s*[xX]\s*([\d.]+)\s*[mM]`). Find the enclosed loop nearest each label. Solve for scale by least squares over all labels. Show residuals: a label that disagrees is a drawing error or an unusual room, and is flagged rather than trusted.
2. **Find walls.** Pair parallel segments at typical wall spacing (100 to 380 mm in Indian construction: 115 mm half brick, 230 mm full brick) into wall centrelines.
3. **Find rooms.** Build a planar graph from the centrelines plus the snapped door gaps, find faces (half-edge face walk), and keep faces that contain a label.
4. **Name and type rooms.** Match the label to a space type by keyword table ("LAB", "Faculty & Staff Dining", "WASH ROOM", "CORRIDOR", "STORE", "LIFT", "UPS", "ELECTRICAL ROOM"). Unmatched rooms stay `unknown`.
5. **Split by storey.** Page and title text ("CELLAR FLOOR PLAN", "FIRST FLOOR PLAN", "GROUND FLOOR") give storey names. Several plans on one A3 sheet are separated by clustering.
6. **The user confirms every room.** Imported geometry carries `source: { kind: 'document', doc: 'survey', ref: 'Vindhya_bhavan.pdf p1' }`. A wrong guess is one tap to fix.

The aim is that a Vindhya C3 floor goes from PDF to a labelled, scaled, zoned storey in under five minutes. Himalaya page 1 has 120k paths, so the parsing runs in a worker with a spatial hash, and the underlay renders as a cached bitmap per zoom level.

---

## 5. Export

| Format | Writer | Validates with |
|---|---|---|
| **gbXML 7.x** | Our own TypeScript XML writer from compiled faces (surfaceType, AdjacentSpaceId, Opening, Construction) | gbXML XSD (offline test fixture), Spider viewer by hand, OpenStudio import |
| **epJSON and IDF** | TypeScript writer: Zone, BuildingSurface:Detailed, FenestrationSurface:Detailed, Shading:Building:Detailed, Construction and Material from packs, schedules from space types | EnergyPlus `--convert-only` in the companion (optional) |
| **IFC4 Reference View** | web-ifc `CreateIfcEntity` and `WriteLine`. Walls as IfcWall with extruded area solids, IfcSpace per room, IfcWindow and IfcDoor in IfcOpeningElement, plus IfcRelSpaceBoundary | Bonsai or IfcOpenShell `validate` (companion) |
| **Dragonfly and Honeybee JSON** | Direct mapping | `dragonfly-core` validation (companion). Opens Radiance sDA and ASE through Ladybug for power users |
| **GeoJSON** | Footprints, storeys and heights for maps | geojson.io |
| **glTF** | Scene mesh with element ids | Three.js editor |
| **PDF and SVG plan** | The Andon-styled plan with labels and dimensions | Print |

The exporters, importers and tools are plugins (`IbashoModule` with `kind: 'importer' | 'exporter' | 'editor-tool'`), so packs can add, for example, an NBC India fire-egress lint without touching the editor.

---

## 6. Responsiveness

| Width | Layout | Editing scope |
|---|---|---|
| Phone (< 600 px) | Full-screen plan or 3D, with a bottom sheet for properties (snap points: peek, half, full). Storey picker as a horizontal chip row. Tools in a thumb bar | Site, Massing, function brush, WWR and overhang sliders, single windows. Room drawing works as rectangle only with a 300 mm grid. Numeric entry preferred (tap a dimension, type) |
| Tablet (600 to 1100 px) | Plan and 3D split (draggable divider, like the shoji in ARCH 10), with a side sheet | All modes. Pen draws, fingers navigate |
| Desktop (> 1100 px) | Plan, 3D, inspector and results rail | Everything, plus keyboard and command palette |

- The SVG plan is the cheap, crisp default on every device. 3D uses `frameloop="demand"` and the existing quality ladder. On phones the 3D view starts as a baked still-life (ARCH 10) and goes live only while being touched.
- Compiles run in the engine worker, debounced to 120 ms while dragging. A drag previews geometry locally and recomputes numbers on release.
- Every tool is reachable by keyboard and screen reader through the a11y outline (rooms as a list: name, function, area, windows). The plan outline doubles as a non-visual editor ("Room 3, Classroom, 42 m², 2 windows west").

---

## 7. Proposed packages and ownership (for BUILD_PLAN)

| Package | Layer | Contents |
|---|---|---|
| `@ibasho/core` (amend) | contracts | `BuildingDoc` types, zod schemas, `Command` type |
| `packages/plan` (new) | engine-side, pure | Integer geometry kernel (Clipper2), `compile()`, adjacency solver, quantities, lints, massing auto-zoning, PF and DEF calculators. No DOM, no `Math.*` beyond exact ops |
| `packages/editor` (new) | UI | Tools, snapping, gestures, history, SVG plan, inspector, bottom sheets |
| `packages/scene` (amend) | UI | Room2D extrusion, openings via manifold-3d, shades, context buildings, sun scrub |
| `packs/building-in`, `packs/building-global` (new) | packs | Space types, typology templates, constructions, window products, ECBC and ASHRAE values with sources |
| `packages/interop` (new) | adapters | Importers and exporters (pdf, osm, ifc, gbxml, epjson, dragonfly) as plugins, with lazy WASM |

Test fixtures: Vindhya C3 first floor (traced), Himalaya ground floor (traced), a WeWork-like office massing (template), and GH1 (the existing terrace, compiled from a `BuildingDoc` and checked to match today's hand-written twin within tolerance, as a regression).

---

## 8. Risks and open questions

| Risk | Mitigation |
|---|---|
| A 2.5D model cannot hold pitched attics (GH1 loft) | Room3D fallback. GH1 regression fixture |
| Clipper2 TS port speed on a 120k-path PDF | Run it only on candidate wall segments after a spatial-hash prefilter. WASM build as a fallback |
| web-ifc bundle size | Lazy chunk, behind an "Import IFC" action |
| Changing the HomeTwin contract ripples across WPs | Additive: the `BuildingDoc` compiles to today's twin. INTERFACES entry first |
| Space-type numbers with weak sources | Every value carries a source and a range. Unknown types widen the result |
| Scope: this is a large editor | Phase it: Massing, then Plan (rect and polygon, split, function), then Openings and Shades, then PDF trace, then IFC and gbXML |

---

## 9. Sources

- Pascal Editor: https://github.com/pascalorg/editor ; node docs https://mintlify.wiki/pascalorg/editor/api/nodes/level
- react-planner: https://github.com/cvdlab/react-planner
- blueprint3d: https://github.com/furnishup/blueprint3d ; https://github.com/jan0991/blueprint-js
- Sweet Home 3D: https://www.sweethome3d.com/ ; Home.xml https://www.sweethome3d.com/support/forum/viewthread_thread,6708_offset,20
- FloorspaceJS: https://github.com/NREL/floorspace.js ; https://www.nrel.gov/docs/fy18osti/70491.pdf ; https://wiki.osarch.org/openstudio-openstudio-application-geometry/
- Bonsai and IfcOpenShell: https://bonsaibim.org/ ; https://ifcopenshell.org/ ; https://wasm.ifcopenshell.org/ ; https://community.osarch.org/discussion/comment/23510
- That Open Company: https://github.com/ThatOpen/engine_web-ifc ; https://github.com/ThatOpen/engine_components ; https://github.com/ThatOpen/engine_fragment
- Speckle: https://speckle.systems/ ; https://github.com/specklesystems/speckle-server
- Honeybee schema: https://github.com/ladybug-tools/honeybee-schema/wiki/1.1-Model-Schema
- Dragonfly: https://www.ladybug.tools/dragonfly-core/docs/dragonfly.room2d.html ; https://www.ladybug.tools/dragonfly-core/docs/dragonfly.story.html ; https://docs.ladybug.tools/dragonfly-primer/components/2_serialize/model_to_honeybee
- Spider gbXML viewer: https://www.ladybug.tools/spider/
- gbXML: https://gbxml.org/schema_doc/7.02/GreenBuildingXML_Ver7.02.html
- EnergyPlus: https://energyplus.net/documentation ; OpenStudio: https://openstudio.net/
- OSM Simple 3D Buildings: https://wiki.openstreetmap.org/wiki/Simple_3D_Buildings ; roof shapes https://wiki.osm.org/wiki/Key:roof:shape
- Overture buildings: https://docs.overturemaps.org/guides/buildings
- Google Open Buildings 2.5D Temporal: https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_Research_open-buildings-temporal_v1
- Clipper2: https://github.com/AngusJohnson/Clipper2 ; clipper2-ts https://www.jsdelivr.com/package/npm/clipper2-ts
- manifold-3d: https://manifoldcad.org/docs/jsapi/modules/manifold.html ; earcut https://github.com/mapbox/earcut ; three-mesh-bvh https://github.com/gkjohnson/three-mesh-bvh
- pdf.js: https://github.com/mozilla/pdf.js ; Immer patches https://immerjs.github.io/immer/patches ; use-gesture https://github.com/pmndrs/use-gesture ; Yjs https://yjs.dev/
- CubiCasa5k: https://github.com/CubiCasa/CubiCasa5k
- ECBC 2017 (BEE India): local copy `docs/research/v3/sources/ecbc2017.pdf`; clauses 4.2.3 (daylight, Tables 4-1 to 4-3), 4.3.2 (WWR 40%, VLT 0.27), Note 4-2 (PF = H/V), 4.3.4 (SRR 5%)
- IIIT Hyderabad plans: https://intranet.iiit.ac.in/offices/static/files/Vindhya_bhavan.pdf ; https://intranet.iiit.ac.in/offices/static/files/Himalaya_Building.pdf (local copies in `sources/`)
- Phototropic housing: https://www.aprilli.com/sustainability/phototropic-housing-gbbcb
- WCAG 2.5.5 target size: https://www.w3.org/WAI/WCAG21/Understanding/target-size.html
