# Ibasho: Visual Storytelling Brief

Author role: Creative Director, visual storytelling.
Status: research brief v1. Input for design system, 3D, narrative, content and QA agents.
Founding plan: `report/M1.typ` (editable twin, documented physics, signed per fuel deltas, Pareto futures, Lean proofs, LLM narrates only).

---

## 0. The idea in five lines

1. **The house is a lantern.** By day it is paper in sunlight. By night it glows, and every leak of light is a leak of heat. Light/dark mode is the physics, not a skin.
2. **The roof blows off.** Japanese painters invented the dollhouse cutaway 900 years ago (*fukinuki yatai*, "blown-off roof"). Our opening shot lifts the roof off the user's own home.
3. **The home is an emaki.** The story unrolls like a handscroll, in chapters, separated by gold mist bands (*kasumi*), human feeling first, numbers second.
4. **Repair is beauty.** Retrofits fold into place like origami, and the seams where new meets old are traced in gold (*kintsugi*), exactly on the thermal bridges they fix.
5. **Proof is a seal.** Every Lean-verified number carries a red *hanko* stamp. Every number has a red thread back to its evidence.

---

## 1. Research findings and challenged assumptions

### 1.1 What Dami Lee actually teaches

Dami Lee (Vancouver architect, founder of Nollistudio, 2M+ subscribers, 200M+ views) is primarily a *narrative* teacher, not an isometric illustrator. Her AIA25 keynote gives the rules we should steal ([AIA](https://www.aia.org/article/dami-lee-encouraged-architects-harness-power-storytelling-aia25)):

| Dami Lee principle | Her words | Ibasho translation |
|---|---|---|
| Human first | "show the architecture through the human; show the human condition through the architecture" | Lead with "your kitchen is 14 °C on January mornings", never with "U = 2.1 W/m²K". Tiny residents live in the cutaway. |
| Inverted pyramid | Emotion opens, technical detail follows | Each chapter opens with a feeling, then one number, then the evidence drawer. |
| Hook then teach | "They start learning without even realizing they're learning" | Interaction before explanation: the user drags the sun before we explain solar gain. |
| Alternate tension and data | Pacing switches to hold attention | Chapter rhythm: tension beat (loss, cost, cold) then data beat (what fixes it). |
| You are the human element | "You are the final human element" | The owner's choices (memory) visibly reshape the story. |

**Challenge 1.** The brief assumed Dami Lee equals isometric cutaways. Sources do not confirm that. The cutaway vocabulary comes from a different lineage, which is stronger for us because it is Japanese and narrative:

| Reference | Why it matters | Source |
|---|---|---|
| *Fukinuki yatai* (吹抜屋台) | Roofless, ceiling-less oblique view into interiors; used in the Genji Monogatari Emaki (c. 1120 to 1140). The original dollhouse cutaway. | [Wikipedia](https://en.wikipedia.org/wiki/Fukinuki_yatai), [JAANUS](https://projects.mcah.columbia.edu/jaanus/record/fukinukiyatai) |
| *Kasumi* / Genji clouds | Gold mist bands that separate scenes and steer the eye. Our chapter transitions. | [McCormick, Harvard](https://scholar.harvard.edu/sites/scholar.harvard.edu/files/melissamccormick/files/mccormick_2019_genji_paintings_kuruma_arasoi.pdf) |
| Enya Honami | Architect drawing isometric cutaways of sento and kissaten. Precise, warm, inhabited. | [Kottke](https://kottke.org/24/08/isometric-drawings-of-japanese-bathhouses-and-cafes), [Spoon & Tamago](https://www.spoon-tamago.com/honami-enya-artwork-book/) |
| Yoshida Seiji, *Houses with a Story* | 33 cutaway houses, each with a story about its resident. Exactly our "your home as a story". | [Parka Blogs](https://www.parkablogs.com/content/book-review-houses-story-yoshida-seiji-art-works) |
| Atelier Bow-Wow, *Graphic Anatomy* | Sectional perspectives that include structure, furniture and "the behaviour of people". Behaviorology. | [Harvard GSD](https://www.gsd.harvard.edu/exhibition/architectural-ethnography-by-atelier-bow-wow), [RIBA](https://www.architecture.com/riba-books/books/architects-and-designers/product/atelier-bow-wow-graphic-anatomy-2.html) |
| Bruno Simon, folio 2025 | Craft benchmark: Three.js WebGPU + TSL, day/year cycle, weather, staged loop, KTX2 compression, MIT code. | [GitHub](https://github.com/brunosimon/folio-2025) |

### 1.2 Ibasho, the concept

Ibasho means "a place where you can feel like yourself" ([ibasho.org](https://ibasho.org)). Dr Emi Kiyota's Ibasho movement builds places where elders are assets, not burdens, and where people *own and shape* their space (Ofunato Ibasho House after the 2011 tsunami; peer-reviewed social capital gains in the Philippines and Nepal). Design consequence: **the user is the author of their home's future, not a recipient of a score.** Agency over verdict. Warmth over alarm.

### 1.3 Japanese spatial ideas as interface grammar

| Idea | Meaning | Interface role |
|---|---|---|
| *Ma* (間) | Interval in space and time; "gate + sun", light through an empty doorway ([Japan House LA](https://japanhousela.com/articles/a-perspective-on-the-japanese-concept-of-ma)) | Deliberate pauses before reveals; generous empty space; one idea per screen |
| *Genkan* (玄関) | Entry where you step up and leave the street behind | Onboarding |
| *Engawa* (縁側) | Veranda, neither inside nor garden ([TU Wien](https://repositum.tuwien.at/handle/20.500.12708/223228)) | The strip between the 3D scene and the data panel where the narrator speaks |
| *Shoji* (障子) | Translucent paper slider | Translucent panels; the before/after portal |
| *Fusuma* (襖) | Opaque sliding partition | Modal sheets |
| *Noren* (暖簾) | Split curtain at a threshold | Tabs and chapter dividers that part on hover |
| *Tokonoma* (床の間) | Alcove that displays one object | The single featured insight per chapter |
| *Byōbu* (屏風) | Folding screen in panels | The three Pareto futures as a three-panel screen |
| *Emaki* (絵巻) | Horizontal narrative handscroll | The chapter timeline |
| *Kintsugi* (金継ぎ) | Gold repair that honours damage | Retrofit seams |
| *Hanko* (判子) | Personal seal | Proof stamp on verified numbers |
| *Kamon* (家紋) | Family crest from circles and straight lines only ([Bridges 2018](https://archive.bridgesmathart.org/2018/bridges2018-463.html)) | Icon system |
| *Shūgi-shiki* tatami | Auspicious layout where no four mat corners meet; junctions form T, never + ([Wikipedia](https://en.wikipedia.org/wiki/Tatami)) | Layout grid rule |
| *Nijūshi sekki* | 24 solar terms of the year | Season scrubber ticks |

**Challenge 2: pastiche risk.** A UK Victorian terrace must look like a UK Victorian terrace. No cherry blossom, torii, or kimono clichés. Japan lives in the *grammar* (how things open, fold, pause, seal), the type and the palette. The house stays true to its place. This is the line between homage and orientalism, and QA should test for it.

**Challenge 3: honesty of pictures.** A pretty particle stream that is not quantitative is a lie, and M1 promises every number is traceable. Rule: **every visual encoding is a measurement.** One particle = a fixed number of watts. The thermal view says "modelled, not measured". Gold seams appear only where the model found a thermal bridge.

**Challenge 4: 3D everywhere.** Perspective 3D is disorienting for normal people. Default to an orthographic 2.5D camera (legible, diagram-like, Honami-style). Reserve perspective for two emotional moments: the opening roof lift and the street zoom.

**Challenge 5: WebGPU.** Bruno Simon went WebGPU + TSL. We target WebGL2 as baseline and progressively enhance with WebGPU compute for particles. Offline-first means it must run on a modest laptop.

---

## 2. Design system: **Andon** (行灯, paper lantern)

### 2.1 Concept

An andon is a paper lantern: a timber frame, washi skin, a flame inside. That is exactly Ibasho's object: a home (frame), its envelope (skin), its energy (flame). The design system has two states:

- **Hiru (昼, day).** Washi paper in daylight. Ink on paper. Quiet, legible, analytic. Default for reading numbers.
- **Yoru (夜, night).** The lantern is lit. Dark sumi ground, interface elements glow from within like light through paper. In 3D, windows glow and gaps leak warm light, which *is* air leakage and heat loss. Dark mode becomes a diagnostic.

Follows `prefers-color-scheme`, but the toggle is a small lantern the user can light, with an optional sync to the real sunset time at the home's location (suncalc).

### 2.2 Colour tokens

Named after traditional dye colours; hex values from [Wikipedia, Traditional colors of Japan](https://en.wikipedia.org/wiki/Traditional_colors_of_Japan) unless marked *custom*. Cross-check with [nipponcolors.com](https://www.nipponcolors.com).

| Token | Name | Hiru (day) | Yoru (night) | Role |
|---|---|---|---|---|
| `--paper` | Kinari washi *custom* | #F3EDE2 | #15120F | Page ground |
| `--paper-2` | Torinoko (鳥の子) | #E2BE9F at 25% over paper | #1E1A17 | Raised surfaces |
| `--ink` | Sumi (墨) | #27221F | #F2E6CF *custom* (lamplight) | Primary text |
| `--ink-2` | Aonibi (青鈍) | #4F4944 | #B9AE9C *custom* | Secondary text |
| `--line` | Kamenozoki (瓶覗) | #C6C2B6 | #3A332D *custom* | Rules, grid |
| `--mute` | Ginnezumi (銀鼠) | #97867C | #7D716A | Disabled, captions |
| `--cold` | Ai (藍) | #264348 | #48929B (Asagi-iro) | Cold, heat loss to outside, winter |
| `--deep` | Hanada (縹) | #044F67 | #3E8BA6 *custom* | Links, focus |
| `--warm` | Bengara (紅柄) | #913225 | #C4553F *custom* | Heat, cost, risk |
| `--ember` | Kuchiba (朽葉) | #D57835 | #E08A4A | Warnings, solar gain |
| `--glow` | Yamabuki (山吹) | #FFA400 | #FFB547 *custom* | Lantern light, active state |
| `--good` | Rokushō (緑青) | #407A52 | #7FB08A *custom* | Savings, carbon reduction |
| `--good-soft` | Byakuroku (白緑) | #A5BA93 | #2E4A36 | Savings backgrounds |
| `--seal` | Shu (朱) | #FF3500 → use #D83A1C *custom, AA on paper* | #FF5A36 | Hanko proof seal only |
| `--gold` | Kintsugi gold *custom* | #B8913A | #D9B45A | Retrofit seams, premium accents |

Rules: `--seal` is used for nothing but proofs. `--gold` is used for nothing but repairs and the one hero CTA. Scarcity creates aura.

**Thermal ramp "Netsu" (熱).** An ironbow-like ramp ([FLIR palettes](https://www.flir.com/discover/industrial/picking-a-thermal-color-palette/)) rebuilt from dye colours: Sumi #1B1A1F → Ai #264348 → Kakishibu #934337 → Bengara #913225 → Kuchiba #D57835 → Yamabuki #FFA400 → Paper #FFF4DC. QA must verify CIELAB lightness rises monotonically and the ramp survives deuteranopia simulation; adjust the middle stops if not. Provide an alternative "White hot" greyscale ramp for accessibility.

### 2.3 Typography (all free, Google Fonts, self-host via Fontsource for offline)

| Role | Font | Why | Link |
|---|---|---|---|
| Display, chapter titles (JP + Latin) | **Shippori Mincho B1** (400 to 800) | Mincho with simulated ink bleed (B1). Letterpress on washi. Not seen in SaaS. | [Specimen](https://fonts.google.com/specimen/Shippori+Mincho+B1) |
| Long-form narrative | **Zen Old Mincho** (400 to 900) | Calm, clean mincho by former typesetter Yoshimichi Ohira, no distracting ink traps | [Specimen](https://fonts.google.com/specimen/Zen+Old+Mincho) |
| UI, labels, buttons | **Zen Kaku Gothic New** (300 to 900) | Quiet gothic, pairs with both mincho faces | [Specimen](https://fonts.google.com/specimen/Zen+Kaku+Gothic+New) |
| Numbers, evidence, code | **M PLUS 1 Code** (variable 100 to 700) | Japanese-capable monospace; tabular figures for ledgers and deltas | [Specimen](https://fonts.google.com/specimen/M+PLUS+1+Code) |
| Hand annotations (Dami Lee marginalia) | **Klee One** (400, 600) | Pencil-like handwriting with Latin; for callouts drawn on the cutaway | [Specimen](https://fonts.google.com/specimen/Klee+One) |
| Brush kanji for chapter seals | **Yuji Syuku** or **Yuji Boku** | Calligraphic; used only for the single kanji of each chapter | [Syuku](https://fonts.google.com/specimen/Yuji+Syuku), [Boku](https://fonts.google.com/specimen/Yuji+Boku) |

Rules:
- Scale on a 1.333 ratio (perfect fourth): 12 / 16 / 21 / 28 / 38 / 50 / 67 px. Display sizes only for chapter openers.
- Numbers always in M PLUS 1 Code with `font-variant-numeric: tabular-nums`. Signed deltas show the sign explicitly ("−1,240 kWh gas, +1,610 kWh electricity"), with a true minus sign (U+2212).
- Japanese fonts are huge. Subset at build time to the kanji actually used (pyftsubset or glyphhanger), ship WOFF2, preload only display + UI.
- Optional vertical setting (`writing-mode: vertical-rl`) for chapter kanji on the landing page and chapter openers.

### 2.4 Texture: washi, sumi, light

- **Washi grain.** A procedural fibre noise overlay: SVG `feTurbulence` (baseFrequency 0.8, 2 octaves) plus long thin fibre strokes, at 3 to 5% opacity, multiplied over `--paper`. Never a bitmap; scales crisp. On night mode, the same grain is lit from behind (screen blend, warm tint) so panels look like a lit shoji.
- **Sumi edge.** Panel borders are not 1px CSS lines. They are SVG paths with slight width variation (a brush pressure profile), so frames look drawn.
- **3D paper pass.** A final post pass multiplies the WebGL frame by the same fibre noise in screen space, so 3D and UI share one material.
- **Shita-e (下絵, underdrawing).** Faint pencil construction lines appear behind charts and in the cutaway during loading. Craft made visible.

### 2.5 Layout grammar: the tatami grid

- **Module.** A 1:2 tatami cell. Base unit `ken` = 8px; a tatami cell in the UI is 9 × 18 ken at desktop. Spacing tokens `--ma-1` to `--ma-7`: 4, 8, 12, 20, 32, 52, 84 px.
- **Shūgi rule.** Panels tile like an auspicious tatami floor: **no four panel corners may meet at one point**. Junctions form T shapes, never +. This yields staggered, lively compositions that are still orderly, and it is lintable (QA can check panel rects in Playwright).
- **Three zones** on desktop: *Niwa* (garden, the 3D scene, ~62% width), *Engawa* (narrator strip, 1 tatami wide, holds the LLM narration and Klee One annotations), *Zashiki* (room, data and evidence panels). On mobile they stack: scene, engawa as a bottom sheet, zashiki behind a noren tab.
- **Tokonoma.** Each chapter has exactly one alcove card for its single most important insight. Nothing else competes.
- **Ma.** At least 30% of every screen is empty. Empty is a feature.

### 2.6 Motion principles

| Principle | Rule | Token |
|---|---|---|
| **Ma before motion** | A 160 ms rest before every important reveal. Silence then movement. | `--ma-pause: 160ms` |
| **Slide like shoji** | Panels move laterally on rails, damped, no bounce, slight friction at the end | `--ease-shoji: cubic-bezier(0.25, 1, 0.3, 1)`, 520 ms |
| **Fold like origami** | Layers enter by unfolding along creases (hinge rotations), never by fading | `--ease-ori: cubic-bezier(0.6, 0, 0.2, 1)`, 900 ms |
| **Bleed like ink** | Text and charts appear by a noisy radial mask, like ink soaking into paper | `--ease-sumi: cubic-bezier(0.1, 0.7, 0.2, 1)`, 700 ms |
| **Press like a seal** | Hanko: 90 ms press, 2 frame squash, ink spread | `--ease-hanko: cubic-bezier(0.5, 0, 0.75, 0)` then spring |
| **Breathe** | Ambient loops run at resting breath rate (5 s cycle). Heat flows breathe with the diurnal temperature. | `--breath: 5s` |
| **Seasons are slow** | Time of day and season changes interpolate over ≥1.2 s; nothing about weather is instant | |
| **Reduced motion** | `prefers-reduced-motion`: all of the above become cross-fades ≤150 ms; particles become static arrows with widths ∝ watts | |

Libraries: [Motion](https://motion.dev) for DOM, [maath](https://github.com/pmndrs/maath) `easing.damp` for 3D, [Theatre.js](https://github.com/theatre-js/theatre) for authored camera sequences (pin versions; the `@theatre/r3f` API is flagged unstable). Reference: [Codrops, camera fly-through with Theatre.js + R3F](https://tympanus.net/codrops/?p=70449).

### 2.7 Sound: *Oto* (音), opt-in

Off by default; a small furin (wind bell) icon turns it on. Sound confirms meaning, never decorates.

| Event | Sound | Source |
|---|---|---|
| A recompute finishes | single suikinkutsu water drop (pitched by size of the saving) | [Wikimedia Commons recording](https://commons.wikimedia.org/wiki/File:Suikinkutsu_recording.ogg) (check licence), [OpenGameArt water harp, CC-BY-SA](https://opengameart.org/content/water-harp) |
| Proof verified (hanko) | soft wooden thump + paper | synthesised, or Kenney [Impact Sounds](https://kenney.nl/assets/impact-sounds) (CC0) |
| Panel slide | shoji slide | [Freesound 843263 "SlidingDoors"](https://freesound.org/people/Sandwichbill/sounds/843263/) (CC0 search) |
| Retrofit layer folds | paper fold | [Freesound 367683](https://freesound.org/people/FunWithSound/sounds/367683/), [398896](https://freesound.org/people/Anthousai/sounds/398896/) (CC0 search) |
| Night mode lit | furin bell | [Freesound 501168 "Furin japanese wind chime"](https://freesound.org/people/ayustat2001/sounds/501168/) (CC0 search) |
| UI ticks | Kenney [Interface Sounds](https://kenney.nl/assets/interface-sounds) (CC0) | |
| Ambient bed per season | cicadas (summer), rain (tsuyu), snow hush (winter) | [freesound.org](https://freesound.org), filter CC0 |

**Sonification bonus.** The heat-loss stream has a faint pink-noise "wind" whose loudness tracks total watts lost. After a retrofit, the house literally gets quieter. Implement with Web Audio (or [Tone.js](https://github.com/Tonejs/Tone.js)); [howler.js](https://howlerjs.com) for one-shots.

### 2.8 Iconography: *Mon* (crests)

Every retrofit measure, fuel and chapter gets a **kamon-style icon**, built only from circles and straight lines inside a circle, on a 24-unit compass grid. This gives an iconography no other product has, with a strict, testable construction rule.

| Item | Mon motif |
|---|---|
| Loft insulation | Three stacked arcs under a roof chevron |
| Solid wall insulation | Two nested squares in a circle (wall within wall) |
| Glazing | Four-pane lattice (shoji kumiko) in a circle |
| Draught proofing | Wind swirl (tomoe) crossed by a bar |
| Heat pump | Three tomoe spinning (circulation) |
| Solar PV | Sun disc with 8 rays of straight lines |
| Gas / electricity / oil (fuels) | Flame, lightning bolt of straight lines, droplet |
| Proof | Square seal with 証 |

Line icons at 1.5px for UI, filled mon for chapter seals. Rough.js ([roughjs.com](https://roughjs.com)) for hand-drawn diagram variants in narrative scenes.

### 2.9 Voice

Short sentences. Second person. Warm, never alarmed. Feeling, then number, then a door to the evidence. Example: "Your front room loses most of its warmth through the bay window. 1,240 kWh of gas a year. *See how we know.*" The LLM narrator receives these style rules as a system prompt and only cites computed evidence IDs (M1 rule).

---

## 3. Signature visualisations (React Three Fiber)

### 3.1 Camera and rendering modes

- **Default camera:** `OrthographicCamera`, elevation ~30°, azimuth snaps in 45° steps (rotate by dragging the compass mon). This is the fukinuki yatai view.
- **Opening shot:** perspective, street level, then the roof lifts off and floats up 2 m, ceiling plane dissolves, camera blends to orthographic. (Blend projection matrices over 1.4 s.)

Render styles are plugins, switchable per chapter:

| Mode | Look | Technique |
|---|---|---|
| **Sumi** (ink) | Line drawing on washi, hatching in shadow | Sobel edges on depth + normals (custom postprocessing Effect), line wobble via noise, toon ramp shading |
| **Washi** (default) | Soft painted miniature, Honami-like | PBR + [N8AO](https://github.com/N8python/n8ao) ambient occlusion + [AccumulativeShadows](https://drei.docs.pmnd.rs/staging/accumulative-shadows) + optional Kuwahara pass ([Maxime Heckel](https://blog.maximeheckel.com/posts/on-crafting-painterly-shaders)) + paper multiply |
| **Netsu** (thermal) | False colour surfaces | Material swap to a ShaderMaterial reading per-surface temperature attribute |
| **Yoru** (night lantern) | Dark scene, glowing windows and leaks | Emissive window panes, bloom, leak sprites at infiltration paths |
| **Shita-e** (loading) | Pencil underdrawing | Edges only, grey, low alpha, animated dash |

Selection highlights use drei [Outlines](https://drei.docs.pmnd.rs/abstractions/outlines) (inverted hull, crisp, not blurred) in `--glow`.

### 3.2 Heat loss that breathes (*Kaze*, 風)

- From each envelope element (wall, roof, floor, window, door, infiltration) emit GPU particles **at a rate proportional to its heat loss in watts** (`UA × ΔT`, from the physics engine). Legend: "each mote = 10 W". Particles drift outward along the surface normal, curl into wind, and fade. Colour from the Netsu ramp by local loss density.
- **Breathing:** ΔT follows the hourly outdoor temperature for the selected day, so flows swell at night and ebb at noon on a slow 5 s loop when idle.
- Hover a stream: element highlights, engawa shows "Bay window: 380 W right now, 1,240 kWh/yr gas", with the evidence link.
- Implementation: instanced points with a CustomShaderMaterial ([THREE-CustomShaderMaterial](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial)); WebGPU compute via [TSL](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language) when available. Budget ≤ 20k particles.

### 3.3 Thermal camera (*Netsu*, 熱)

- Surface temperature per element from steady state: `T_surface = T_in − U · R_si · (T_in − T_out)` for interior view; exterior view mirrors with `R_se`. Thermal bridges (lintels, wall/floor junctions) get ψ-value hot lines.
- A **viewfinder lens** the user drags over the house (circular mask, like a handheld camera) instead of a global toggle. Inside the lens: Netsu; outside: Washi. Playful, and keeps context.
- Persistent label in the lens rim: "Modelled, not measured. ±" with model uncertainty.

### 3.4 Sun path and shadows (*Hi*, 日)

- [suncalc](https://github.com/mourner/suncalc) gives altitude/azimuth for the home's lat/long. Draw the sun's daily arc and the solstice arcs as brush strokes on a translucent dome.
- **Hi-dokei scrubber:** a sundial ring around the house. Drag the gnomon shadow to set time of day. Directional light and shadows follow. Window solar gain (W) updates live, shown as warm light pools on the floor whose area ∝ gain.
- Sky: [@takram three-atmosphere](https://github.com/takram-design-engineering/three-geospatial) for physically based sky at the real sun position, or blend the Poly Haven **Qwantani day set** (12 HDRIs at one location from dawn to night, see §6) for a painterly sky.

### 3.5 Seasons scrubber: 24 solar terms

- The year ring is divided into the **24 sekki** (Risshun, Usui, Keichitsu, Shunbun ... Tōji, Shōkan, Daikan), each a tick with its kanji. Monthly bills per fuel draw as a ring chart around it (signed, per fuel, M1 rule).
- Scrubbing the year changes: sun arc, outdoor temperature, foliage on the street trees (Quaternius), snow on the roof (cold roof = good loft insulation: snow melts faster on poorly insulated roofs, a real and teachable phenomenon).
- Revisit hook: on return, the app opens on the *current* sekki.

### 3.6 What-if: the shoji portal

- A shoji screen stands in the cutaway. Slide it: on one side is the house today, on the other the house after the chosen future. Built with drei [MeshPortalMaterial](https://drei.docs.pmnd.rs/portals/mesh-portal-material) rendering the "after" scene; the slide distance drives `blend`.
- Every number visible in the "after" world is recomputed by the engine (M1: recompute, never add), not interpolated.
- Sliders for what-ifs (budget, energy price, carbon factor, occupancy) are rendered as wooden *kumiko* bars. Moving one triggers a ~160 ms ma pause, then the suikinkutsu drop when the recompute lands.

### 3.7 The three futures: byōbu

- The Pareto front (cheapest, best return, lowest carbon) unfolds as a **three-panel folding screen**. Each panel is a miniature live render of that future's house plus its ledger: cost, per fuel ΔkWh (signed), ΔCO₂, payback, Green Home Score.
- Behind the screen, a scatter of all feasible packages (cost vs carbon) drawn in sumi dots; the Pareto front is a gold brushstroke connecting the three. Infeasible packages are shown greyed with the rule that excluded them ("needs roof rights: tenant").

### 3.8 Retrofit assembly: origami and kintsugi

- Choosing a future triggers assembly. Each measure arrives as a flat sheet that **folds along crease lines** into place (vertex shader rotates panel groups around hinge edges, staggered by 120 ms, paper fold sound). Loft insulation unrolls like a scroll; wall insulation folds around the facade; new windows slide in like shoji.
- Where the model had flagged thermal bridges, a **gold seam** draws itself along the junction (animated line with `--gold`, subtle metallic shader, grain). Gold marks repaired weakness, honestly placed.
- The heat particles visibly thin out. The house gets quieter. Then the Green Home Score is **stamped** with the hanko seal, because Lean proved its bounds.

### 3.9 Zoom out: street and city (*Machi*, 町)

- Pull back from the house: neighbours appear as massing blocks (Kenney [City Kit Suburban](https://kenney.nl/assets/city-kit-suburban) / [Building Kit](https://kenney.nl/assets/building-kit), or OSM footprints pre-baked into a GLB for offline). Each neighbour is a lantern; brightness = estimated heat loss.
- "If your street did what you did": aggregate saving shown as the street dimming. Optional online layer: [MapLibre](https://maplibre.org) + [OpenFreeMap](https://openfreemap.org) tiles or [OSM Buildings](https://osmbuildings.org).

### 3.10 Proof and evidence

- **Hanko seal:** any number backed by a Lean theorem gets a small red 証 seal; click opens the theorem name and statement in plain words ("Score is always between 0 and 100").
- **Red thread (*akai ito*):** clicking any number draws a thin red thread from the number across the screen to its evidence (input, formula, source dataset). The thread is a curved SVG path animated with `stroke-dashoffset`. Traceability becomes a visible gesture.

### 3.11 Performance budget

| Item | Budget |
|---|---|
| Frame time | 60 fps on Intel Iris Xe class; 30 fps floor |
| Draw calls | ≤ 150 (instancing for furniture, particles) |
| Triangles | ≤ 300k in view |
| Textures | KTX2 (ETC1S/UASTC), ≤ 1k for most, 2k hero |
| Meshes | glTF + meshopt/Draco via gltf-transform |
| Idle | `frameloop="demand"`; breathing loop throttled to 30 fps |
| Adaptation | drei `PerformanceMonitor` lowers DPR, disables Kuwahara, then N8AO |
| Fallback | No WebGL: a static 2.5D SVG cutaway generated from the same twin |

---

## 4. Narrative structure: the home as an emaki

### 4.1 Chapters

Each chapter: one kanji seal, one feeling, one interaction, one tokonoma insight, an evidence drawer. Transitions are gold kasumi bands sweeping across.

| # | Chapter | Feeling (opens with) | Interaction | Tokonoma insight |
|---|---|---|---|---|
| 0 | **Genkan** 玄関, Step in | "Come in. Tell us about your home." | Onboarding (below) | "We know 11 things about your home. 4 are guesses. You can fix them anytime." |
| 1 | **Ie** 家, The house as it is | "This is your home." | Roof blows off; walk the cutaway; tiny residents | The twin, with unknowns shown as dotted outlines (unknown ≠ 0) |
| 2 | **Kaze** 風, Where the warmth goes | "On a January night, your house breathes out 4.1 kW." | Breathing heat, thermal lens | Biggest loss element |
| 3 | **Hi** 日, Light and sun | "Your back bedroom gets 3 hours of winter sun." | Sun scrubber, shadows | Solar gain and overheating risk |
| 4 | **Toki** 時, A year in your home | "Winter costs you five times what summer does." | 24 sekki scrubber, per fuel bills | Seasonal per fuel profile |
| 5 | **Michi** 道, Three paths | "There are 64 ways to change your home. 23 are possible for you. Three stand out." | Byōbu, Pareto, constraints | The three futures |
| 6 | **Kintsugi** 金継ぎ, Mending | "Here is your home, mended." | Origami assembly, shoji portal | Signed deltas, payback, hanko |
| 7 | **Machi** 町, Your street | "Your street could save the same as 40 cars." | Zoom out, street lanterns | Aggregate carbon |
| 8 | **Ibasho** 居場所, Your place | "This is where you belong. And where it is going." | Score seal, plan saved, memory recap | Next step and revisit date |

Pacing rule (Dami Lee): odd chapters are tension beats (loss, cost), even chapters are relief beats (understanding, options). Each chapter ≤ 60 s for a first-time user; skippable via the emaki timeline.

### 4.2 Onboarding: the genkan

- A literal genkan step: the user "steps up" by choosing who they are, rendered as three pairs of shoes on the step: **owner, tenant, landlord**. This sets tenure constraints (M1 feasibility).
- Five questions max, each answered with a physical object in a small diorama: postcode (a lantern lights on a map), house type (pick a miniature: terrace, semi, flat, detached, bungalow), age band (brick bond changes), heating (boiler/heat pump/storage heater mon), budget (coins on a tray, ¥ / £ adapted to locale).
- Everything else is defaulted from archetypes and **visibly marked as a guess** (dotted outline, Klee One note "we guessed"). The house builds itself as answers arrive, tatami by tatami.
- Escape hatch: "Show me a sample home" loads the demo terrace.

### 4.3 Revisit: *Okaeri* (お帰り, welcome home)

- On return, the house is already there (IndexedDB), lit for the current local time and sekki. The engawa greets: "Okaeri. It's Shōsetsu now, first snow. Since your last visit, gas prices rose 6%. Your plan's payback improved by 8 months."
- Memory recap from the narrator, citing stored owner constraints: "You said no heat pump for now. I've left it out."
- A small **diary scroll** lists past sessions and decisions; completed measures get permanent gold seams on the house. The house accumulates history, wabi-sabi style.

### 4.4 Loading, empty and error states

| State | Treatment |
|---|---|
| App boot | The 居 kanji draws itself stroke by stroke in sumi (stroke order animation from SVG paths), paper grain fades in |
| Scene loading | **Shita-e**: the house appears as a pencil underdrawing, then is "painted" in as assets arrive. Progress = how much is painted. |
| Recompute (< 300 ms) | No spinner. The ink in the changed numbers briefly re-bleeds. |
| Recompute (long, package search) | An inkstone: a sumi stick grinding in a circle; ink darkens with progress |
| LLM narrating | Brush writing in the engawa, word by word; fallback template narrator if no model |
| Empty (no home yet) | An empty tatami room with afternoon light, one line: "Every home starts empty." |
| Error | A torn washi edge with a kintsugi line across it: "Something broke. We've mended what we could." plus details drawer |
| Offline | A small unlit lantern icon: "Working offline. Everything still computes here." |

---

## 5. The constrained but extraordinary demo: 90 seconds

One home: a **1900s UK mid-terrace, solid brick, slate roof, bay window, gas combi boiler**. One owner persona: a tenant-turned-buyer, budget £15k.

| Time | Beat |
|---|---|
| 0:00 | Street at dusk (Yoru). Lanterns along the terrace. One is ours. |
| 0:06 | The roof blows off and floats up. Camera settles into fukinuki yatai. Tiny resident in a coat at the kitchen table. |
| 0:15 | Heat breathes out of the bay window and the uninsulated loft. Sound of wind. "4.1 kW tonight." |
| 0:25 | User drags the thermal lens over the bay: deep bengara. Lintel glows as a hot line. |
| 0:35 | Drag the sun to Tōji (winter solstice) noon: a thin pool of light on the back bedroom floor. |
| 0:45 | Byōbu unfolds: three futures. User taps "best return". Rejects heat pump (memory remembers). Recompute drop. |
| 0:60 | Origami assembly: loft quilt unrolls, internal wall insulation folds in, draught strips slide. Gold seams trace the lintel. |
| 0:72 | Particles thin, wind quietens. Slide the shoji: before / after. Signed per fuel deltas. |
| 0:82 | Score 41 → 68 stamped with the hanko. Red thread from 68 to its evidence. |
| 0:90 | Pull back: the terrace dims lantern by lantern. "Your street could do this too." |

This is the slice to make perfect before breadth.

---

## 6. Asset sourcing

### 6.1 HDRIs (Poly Haven, CC0; verified via api.polyhaven.com)

| Asset | Use | URL |
|---|---|---|
| Qwantani day set: `qwantani_dawn`, `_sunrise`, `_morning`, `_mid_morning`, `_noon`, `_afternoon`, `_late_afternoon`, `_sunset`, `_dusk_1`, `_dusk_2`, `_night`, `_moonrise` (all have `_puresky` variants) | Time of day scrubber: crossfade between HDRIs shot at one location | [polyhaven.com/a/qwantani_dawn_puresky](https://polyhaven.com/a/qwantani_dawn_puresky) |
| `kloofendal_overcast_puresky` | UK-like overcast default | [polyhaven.com/a/kloofendal_overcast_puresky](https://polyhaven.com/a/kloofendal_overcast_puresky) |
| `kloofendal_misty_morning_puresky`, `misty_dawn`, `winter_sky`, `winter_evening` | Winter and mist moods | [polyhaven.com/hdris](https://polyhaven.com/hdris) |
| `ninomaru_teien` | Japanese garden; landing page reflections | [polyhaven.com/a/ninomaru_teien](https://polyhaven.com/a/ninomaru_teien) |
| `small_empty_room_1` to `_4`, `reading_room` | Interior lighting for room close-ups | [polyhaven.com/hdris](https://polyhaven.com/hdris) |

### 6.2 Textures (Poly Haven / ambientCG, CC0)

| Use | Poly Haven IDs |
|---|---|
| UK brick | `red_brick`, `red_brick_03`, `large_red_bricks`, `brick_wall_001` |
| Slate roof | `roof_slates_02`, `roof_slates_03`, `patterned_slate_tiles` |
| Clay roof (other locales) | `clay_roof_tiles`, `clay_roof_tiles_02` |
| Render / plaster | `white_stucco`, `clay_plaster`, `rough_plaster_brick` |
| Timber | `japanese_cedar_planks`, `plywood`, `roof_planks` |
| Landing page room | `tatami_mat`, `bamboo_wall`, `japanese_cedar_planks` |
| Insulation stand-in | `wool_boucle` (tinted) |
| Snow on roof | `snow_02`, `snow_04` |
| Street | `pavement_02`, `herringbone_pavement`, `grass_path_2` |

More: [ambientcg.com](https://ambientcg.com) (CC0).

### 6.3 Models

| Source | Pack | Use |
|---|---|---|
| Kenney (CC0) | [Furniture Kit](https://kenney.nl/assets/furniture-kit) (120 objects) | Interior dressing |
| Kenney (CC0) | [Building Kit](https://kenney.nl/assets/building-kit), [City Kit Suburban](https://kenney.nl/assets/city-kit-suburban), [City Kit Roads](https://kenney.nl/assets/city-kit-roads), [Nature Kit](https://kenney.nl/assets/nature-kit) | Street and neighbours |
| Quaternius | [Ultimate Home Interior](https://quaternius.com/packs/ultimatehomeinterior.html), [Ultimate Nature](https://quaternius.com/packs/ultimatenature.html) | Interior, seasonal trees |
| Poly Haven (CC0) | `potted_plant_01`, `planter_pot_clay`, `Rockingchair_01`, `lantern_chandelier_01`, `dining_table` | Hero props |
| Poly Pizza | [poly.pizza](https://poly.pizza) | Low poly gap fillers (check per model licence) |
| Own | The house shell | Generated procedurally from the twin (walls, openings, roof) so geometry and physics share one source of truth |

Residents: tiny stylised figures (Quaternius characters or simple capsule people in sumi line style). They act out comfort states: coat indoors when cold, fanning when overheating.

### 6.4 Fonts

Shippori Mincho B1, Zen Old Mincho, Zen Kaku Gothic New, M PLUS 1 Code, Klee One, Yuji Syuku, Yuji Boku (all verified in the Google Fonts catalogue; self-host via [Fontsource](https://fontsource.org)).

### 6.5 Libraries and shader references

| Need | Library / reference |
|---|---|
| Scene helpers | [drei](https://github.com/pmndrs/drei): Outlines, MeshPortalMaterial, AccumulativeShadows, CameraControls, PerformanceMonitor, Text (troika) |
| Post | [postprocessing](https://github.com/pmndrs/postprocessing), [react-postprocessing](https://github.com/pmndrs/react-postprocessing), [N8AO](https://react-postprocessing.docs.pmnd.rs/effects/n8ao) |
| Custom materials | [THREE-CustomShaderMaterial](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial), [TSL](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language) |
| Painterly | [Maxime Heckel, On Crafting Painterly Shaders](https://blog.maximeheckel.com/posts/on-crafting-painterly-shaders) (generalised and anisotropic Kuwahara, structure tensor) |
| Animation | [maath](https://github.com/pmndrs/maath), [Motion](https://motion.dev), [Theatre.js](https://github.com/theatre-js/theatre), [GSAP](https://gsap.com) for SVG stroke work |
| Sun / sky | [suncalc](https://github.com/mourner/suncalc), [takram three-geospatial](https://github.com/takram-design-engineering/three-geospatial) |
| Text in 3D | [troika](https://github.com/protectwise/troika) |
| Tweak panel (dev only) | [leva](https://github.com/pmndrs/leva) |
| Accessibility in 3D | [react-three-a11y](https://github.com/pmndrs/react-three-a11y) |
| 2D hand-drawn | [Rough.js](https://roughjs.com), [rough-notation](https://github.com/rough-stuff/rough-notation) |
| Sun path diagram conventions | [Ladybug Tools](https://www.ladybug.tools) |
| Craft benchmark | [Bruno Simon folio-2025](https://github.com/brunosimon/folio-2025) |

---

## 7. Landing page: "Ibasho no kōjō"

- **Hero:** a single lit andon in a dark tatami room (Poly Haven `tatami_mat`, `japanese_cedar_planks`, `ninomaru_teien` reflections). Vertical brush title 居場所 in Shippori Mincho B1. As the user scrolls, the lantern's paper becomes a house's walls: the lantern *is* the home.
- **Scroll as emaki:** horizontal handscroll sections separated by gold kasumi, previewing chapters 1 to 7 with live miniature renders (each a tiny R3F canvas sharing one WebGL context via drei `View`).
- **Three promises** in tokonoma cards with mon icons: *Every number has evidence. Every proof has a seal. Every home has a future.*
- **CTA:** a single gold button, "Step into your home", leading to the genkan.
- Built from a content manifest so it updates as features land (plugin registry lists chapters and modes; the landing page renders what exists).

---

## 8. Plugin hooks for the visual layer

Visual features register like everything else. Proposed contracts (for the architecture agent to formalise):

```ts
interface VisualLayerPlugin {
  id: string;                      // "heat-flow", "thermal-lens", "sun-path"
  chapter: ChapterId[];            // where it can appear
  requires: EvidenceKey[];         // twin/physics outputs it reads (typed)
  Scene: React.FC<LayerProps>;     // R3F component
  Legend?: React.FC;               // quantitative legend (mandatory if it encodes numbers)
  evidenceAt?(hit: Intersection): EvidenceRef; // click any visual to get its evidence
  reducedMotion: React.FC<LayerProps>;        // required fallback
}
interface RenderStylePlugin { id: "sumi" | "washi" | "netsu" | "yoru" | string; effects: React.FC; materials?: MaterialOverride }
interface ChapterPlugin { id: ChapterId; kanji: string; seal: MonId; beats: Beat[]; tokonoma(ctx): Insight }
interface SoundPlugin { id: string; on: AppEvent; play(ctx): void }
```

Rule enforced by QA: a VisualLayerPlugin that encodes a number without a `Legend` and `evidenceAt` fails CI.

---

## 9. Risks and open questions

| Risk | Mitigation |
|---|---|
| Japanese pastiche on a British home | Grammar not ornament; cultural review checklist in QA |
| Japanese font weight (MBs) | Build-time subsetting; Latin-only fallback first paint |
| Thermal view mistaken for measurement | Permanent "modelled" label and uncertainty band |
| Particles exaggerate | Fixed watts per particle; legend always visible |
| GPU limits on cheap laptops | PerformanceMonitor ladder; SVG fallback |
| Sound annoys | Off by default; per event toggles |
| Theatre.js API churn | Pin version; keep sequences as plain JSON keyframes |
| Freesound/Commons licences vary | Asset manifest with licence per file; CI check |

Open: final house archetype list beyond the demo terrace; whether the street layer ships offline (pre-baked) or only online; whether the brush kanji per chapter is Yuji Syuku or custom-drawn SVG.
