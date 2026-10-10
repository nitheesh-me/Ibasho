# Andon 行灯: the Ibasho design system

Status: director synthesis v2, 2026-10-10. v2 applies `review/DECISIONS.md` (PR-3, PR-4, PR-5, PR-7, SC-4, TE-8). Source brief: `research/storytelling-visual.md` (SV). Owner: WP-06 (`packages/ui`), with WP-07 (`packages/scene`) for §10. Tokens below are normative; colours were checked for gamut and contrast with an OKLCH to sRGB script on 2026-10-10. Items marked **T5** are specified but not built in T1.

---

## 1. Concept

An *andon* is a paper lantern: a timber frame, a washi skin, a flame inside. That is a home: frame, envelope, energy. Andon has two states.

- **Hiru 昼 (day).** Ink on washi in daylight. Quiet, legible, analytic. Default for reading numbers.
- **Yoru 夜 (night).** The lantern is lit. Sumi ground; panels glow from within like a lit shoji. In 3D, windows glow and every gap leaks warm light, which is the modelled air leakage. Night mode is a diagnostic.

Six rules hold the system together:

1. **Ma 間.** At least 30% of every screen is empty. One idea per screen. A pause before every reveal.
2. **Scarcity creates aura.** Shu vermilion is used only for seals. Gold is used only for real repairs (junctions whose ψ falls) and the one hero action. Nothing else may borrow them.
3. **Every mark is a measurement.** Particles, glows, seams, tints and bar lengths encode real quantities with a legend. Decoration that looks like data is forbidden.
4. **Grammar, not costume.** Japanese is how things open, fold, pause and seal. The house stays true to its place.
5. **Paper is cut, not rounded.** Edges are crisp, borders are drawn, depth is layered paper.
6. **Plain English first.** Every label, route, button and chapter title is English. Japanese appears only as decorative glyphs (`aria-hidden`) and as internal code names. The component names below (Shoji, Byobu, Kumiko) are code names, never UI copy.

## 2. Colour

### 2.1 Core tokens (OKLCH; hex shown for reference only)

| Token | Dye name | Hiru | Yoru | Role | Contrast on paper (Hiru / Yoru) |
|---|---|---|---|---|---|
| `--paper` | Kinari washi | `oklch(95% 0.016 83)` #F4EEE3 | `oklch(18.5% 0.008 67)` #15120F | Page ground | n/a |
| `--paper-raised` | Shoji | `oklch(97.5% 0.010 85)` #FAF6EF | `oklch(22% 0.009 59)` #1E1A16 | Panels, sheets | n/a |
| `--paper-sunk` | Torinoko 鳥の子 | `oklch(91.5% 0.022 83)` #EAE2D3 | `oklch(15% 0.007 67)` #0D0B08 | Wells, trays, inputs | n/a |
| `--ink` | Sumi 墨 | `oklch(25.5% 0.009 53)` #26221F | `oklch(93% 0.033 84)` #F2E7D0 (lamplight) | Primary text | 13.7 / 15.2 |
| `--ink-2` | Aonibi 青鈍 | `oklch(41% 0.012 62)` #4F4944 | `oklch(75.5% 0.028 80)` #B9AE9C | Secondary text | 7.7 / 8.5 |
| `--ink-3` | Ginnezumi 銀鼠 (deepened) | `oklch(50.5% 0.021 59)` #6E6259 | `oklch(64% 0.024 72)` #968A7D | Captions, disabled labels | 5.1 / 5.5 |
| `--line` | Kamenozoki 瓶覗 | `oklch(81.5% 0.017 92)` #C6C2B6 | `oklch(32.5% 0.014 63)` #39332D | Rules, grid, dividers | decorative |
| `--cold` | Ai 藍 / Asagi 浅葱 | `oklch(36% 0.036 210)` #254248 | `oklch(62% 0.075 206)` #49939C | Heat loss, cold, winter | 9.3 / 5.3 |
| `--deep` | Hanada 縹 | `oklch(40% 0.076 227)` #034F67 | `oklch(66% 0.086 224)` #519EB9 | Links, focus ring, electricity | 7.8 / 6.1 |
| `--warm` | Bengara 紅柄 | `oklch(45.5% 0.131 31)` #913325 | `oklch(64% 0.150 33)` #D7644D | Heat, cost, risk, increases | 6.7 / 5.2 |
| `--ember` | Kuchiba 朽葉 | `oklch(66.5% 0.141 53)` #D57835 | `oklch(71% 0.132 55)` #E0894A | Solar gain, gas, warnings (graphics) | 2.8 / 7.0 |
| `--ember-ink` | Kuchiba deep | `oklch(51% 0.097 68)` #8A5A1E | `oklch(74% 0.120 60)` #E29858 | Warning text | 5.1 / 7.9 |
| `--glow` | Yamabuki 山吹 | `oklch(79% 0.171 70)` #FFA401 | `oklch(82% 0.145 73)` #FFB547 | Lantern light, active, PV export (graphics) | 1.7 / 10.6 |
| `--good` | Rokushō 緑青 | `oklch(48% 0.089 153)` #306C45 | `oklch(71% 0.076 151)` #7EAF89 | Savings, carbon cut | 5.4 / 7.5 |
| `--good-soft` | Byakuroku 白緑 | `oklch(76% 0.059 131)` #A4B992 | `oklch(38% 0.048 153)` #2E4A36 | Saving fills | decorative |
| `--seal` | Shu 朱 | `oklch(55% 0.199 33)` #CC2D07 | `oklch(66% 0.200 34)` #F35532 | **Proof seals only** | 4.6 / 5.5 |
| `--gold` | Kintsugi kin | `oklch(67.5% 0.114 84)` #B89039 | `oklch(78.5% 0.117 87)` #D9B45A | **Repairs and hero CTA only** (graphics) | 2.6 / 9.4 |
| `--gold-ink` | Kin deep | `oklch(52% 0.095 80)` #85621D | `oklch(78.5% 0.117 87)` | Gold text | 4.8 / 9.4 |

Text contrast: body ≥ 4.5:1, numbers on the 3D stage ≥ 7:1 (use `--ink` on `--paper-raised` plates). Graphic-only tokens (`--ember`, `--glow`, `--gold`) are never used for text on Hiru; their `-ink` pairs are.

### 2.2 Semantic tokens

| Semantic | Maps to | Rule |
|---|---|---|
| `--surface`, `--surface-raised`, `--surface-sunk` | paper, paper-raised, paper-sunk | |
| `--text`, `--text-2`, `--text-3` | ink, ink-2, ink-3 | |
| `--focus` | deep, 2 px ring + 2 px paper gap | never removed |
| `--delta-saving` | good + left direction + solid fill | always with sign glyph |
| `--delta-increase` | warm + right direction + 45° hatch | always with sign glyph |
| `--state-known` | ink, solid stroke | |
| `--state-estimated` | ink-2, pencil hatch, range dot | |
| `--state-unknown` | ink-2, dashed stroke, breathing 5 s | static under reduced motion |
| `--seal-proved/checked/modelled/cracked` | seal fill / seal ring / ink outline / seal split | §8 |

### 2.3 Fuel palette (categorical, always paired with a hatch)

| Fuel | Token | Hiru | Hatch | Mon |
|---|---|---|---|---|
| Electricity | `--fuel-elec` | deep | diagonal lines | straight-line bolt |
| Gas | `--fuel-gas` | ember | solid | flame of arcs |
| Oil | `--fuel-oil` | ink-2 | dots | droplet |
| LPG | `--fuel-lpg` | `oklch(55% 0.080 300)` fuji | cross-hatch | droplet in ring |
| Biomass | `--fuel-bio` | `oklch(55% 0.080 115)` uguisu | wave | leaf of two arcs |
| District | `--fuel-district` | ink-3 | horizontal lines | three linked rings |
| Export (PV) | `--fuel-export` | glow | dotted outline | sun disc |

### 2.4 Netsu 熱 thermal ramp

Seven stops, OKLCH lightness strictly increasing (greyscale-safe), hue rotates cold to hot through dye colours:

| Stop | OKLCH | Hex | Dye |
|---|---|---|---|
| 0 | `oklch(20% 0.012 290)` | #16151B | Sumi |
| 1 | `oklch(34% 0.045 215)` | #183E46 | Ai |
| 2 | `oklch(46% 0.130 31)` | #933527 | Bengara |
| 3 | `oklch(57% 0.150 40)` | #BE5128 | Beni-kaba |
| 4 | `oklch(67% 0.140 53)` | #D77A38 | Kuchiba |
| 5 | `oklch(79% 0.170 70)` | #FEA408 | Yamabuki |
| 6 | `oklch(96% 0.035 86)` | #FCF1D8 | Hot paper |

Interpolate in OKLab. QA (AC-14): L strictly increasing; adjacent stops ΔE_OK ≥ 0.06 under simulated deuteranopia and protanopia. Accessible alternative ramp "Shiro" (white hot greyscale, L 15% to 97%) in Settings. Every thermal view shows the ramp legend with temperatures and the label "Modelled, not measured". In T1 the ramp is used by the thermal lens and zone tints; the full-scene Netsu render style is T5.

### 2.5 Theming

Tokens are authored in `packages/ui/src/tokens/*.ts` and compiled to `tokens.css`:

```css
:root { color-scheme: light; --paper: oklch(95% 0.016 83); /* Hiru */ }
@media (prefers-color-scheme: dark) { :root:not([data-theme="hiru"]) { color-scheme: dark; --paper: oklch(18.5% 0.008 67); /* Yoru */ } }
:root[data-theme="yoru"] { color-scheme: dark; --paper: oklch(18.5% 0.008 67); }
```

The lantern toggle sets `data-theme`. Optional "follow the sun at my home" uses suncalc for the home's coordinates. `body` always sets an explicit background.

## 3. Typography

Three families only (DEC TE-8), all Google Fonts, self-hosted via Fontsource with unicode-range slices so only used glyph blocks download.

| Role | Family | Weights | Use |
|---|---|---|---|
| Display and narrative | **Shippori Mincho B1** | 500, 700, 800 | Chapter openers, landing hero, score numeral, narrator strip, story text, letters |
| UI | **Zen Kaku Gothic New** | 400, 500, 700 | Labels, buttons, tables, controls, hand notes on the cutaway (500, slightly tracked) |
| Numbers | **M PLUS 1 Code** (variable) | 400 to 600 | Every number, ledger, evidence, code |

Seal and chapter kanji are not a webfont. `packages/ui/scripts/bake-glyphs.ts` bakes the exact glyphs (居 家 勘 試 道 場 所 証 検 模 穏 賢 勇 昼 夜) from Yuji Syuku into SVG paths at build time (a few KB, no font request). Klee One annotations, Zen Old Mincho and Yuji Boku are T5. Noto Sans Telugu and Devanagari arrive with the T3 locale packs.

Scale (perfect fourth, 1.333, base 16, with one UI half step):

| Token | px | Line height | Use |
|---|---|---|---|
| `--fs-cap` | 12 | 1.5 | Captions, axis labels, seal subtitles |
| `--fs-ui` | 14 | 1.5 | Dense UI, tables |
| `--fs-body` | 16 | 1.75 (mincho), 1.5 (gothic) | Body and narration |
| `--fs-h3` | 21 | 1.4 | Panel titles |
| `--fs-h2` | 28 | 1.3 | Screen titles |
| `--fs-h1` | 38 | 1.2 | Chapter titles |
| `--fs-d1` | 50 | 1.15 | Score numeral, landing sections |
| `--fs-d2` | 67 | 1.1 | Landing hero only |

Rules:
- Numbers always use `font-variant-numeric: tabular-nums` in M PLUS 1 Code.
- Signed deltas show an explicit sign with a true minus (U+2212).
- Units appear in `--text-2`, one step smaller.
- Chapter kanji may set `writing-mode: vertical-rl`.

## 4. Space and layout

### 4.1 Units

- **Ken 間** base unit: 8 px.
- **Ma scale** (quarter-ken Fibonacci): `--ma-1` 4, `--ma-2` 8, `--ma-3` 12, `--ma-4` 20, `--ma-5` 32, `--ma-6` 52, `--ma-7` 84, `--ma-8` 136 px.
- **Jō 畳** (one tatami, 1:2): layout cell. `--jo` = 72 px desktop (9 ken), 64 px tablet, 48 px mobile. Panels span whole jō in both axes with one axis twice the other where possible (1×2, 2×4, 3×6), or square pairs (2×2).

### 4.2 Shūgi rule (auspicious tatami layout)

No four panel corners may meet at one point. Junctions form T, never +. Card grids and dashboard layouts stagger accordingly. Lintable: `tools/lint/tatami.ts` reads panel rects in Playwright at 360, 768 and 1440 px and fails if any point is a corner of four rects (AC-11).

### 4.3 Zones

| Zone (code name) | Role | Desktop | Mobile |
|---|---|---|---|
| **Niwa 庭** garden | 3D scene | ~62% width, full height | top 45% |
| **Engawa 縁側** veranda | Narrator strip and hand notes | one jō wide, between scene and room | bottom sheet "peek" |
| **Zashiki 座敷** room | Data, evidence, controls | remaining width | sheet "half" and "full" |
| **Tokonoma 床の間** alcove | The one insight per chapter | a single raised card in Zashiki | top of sheet |

### 4.4 Radii, borders, depth

- Radii: `--r-0` 0 (panels, cards, sheets: paper is cut), `--r-1` 2 px (inputs, chips), `--r-seal` 3 px (square hanko), `--r-mon` 50% (mon, lantern, seals that are round). No pills.
- Borders: drawn, not ruled. Panel frames are SVG brush paths with pressure variation 0.8 to 1.6 px (`<BrushFrame>`), generated once per size and cached. 1 px CSS lines only inside tables.
- Depth is layered paper:
  - Hiru `--kage-1`: `0 1px 0 oklch(25% 0.01 53 / 0.08), 0 6px 18px -8px oklch(25% 0.01 53 / 0.18)`; `--kage-2` doubles offsets.
  - Yoru uses light, not shadow: `--tomoshibi`: `inset 0 0 0 1px var(--line), 0 0 28px -8px oklch(82% 0.145 73 / 0.25)`.
  - Shoji translucency for overlays: `background: color-mix(in oklch, var(--paper-raised) 84%, transparent); backdrop-filter: blur(6px) saturate(1.1)`.

### 4.5 Grain and texture

- **Washi grain:** SVG `feTurbulence` (`baseFrequency 0.8`, `numOctaves 2`) plus 40 long thin fibre strokes, 4% opacity, `mix-blend-mode: multiply` on Hiru, `screen` with a warm tint on Yoru. Procedural, never a bitmap.
- **Shita-e 下絵:** faint pencil construction lines (`--line` at 40%) behind charts and in the cutaway during loading.
- **3D paper pass:** the same fibre noise multiplied over the WebGL frame in screen space so UI and scene share one material.

## 5. Motion

| Token | Value | Principle |
|---|---|---|
| `--ma-pause` | 160 ms | Rest before every important reveal |
| `--t-press` | 90 ms | Hanko press |
| `--t-shoji` | 520 ms, `cubic-bezier(0.25, 1, 0.3, 1)` | Panels slide laterally on rails, damped, no bounce |
| `--t-sumi` | 700 ms, `cubic-bezier(0.1, 0.7, 0.2, 1)` | Text and charts bleed in through a noisy radial mask |
| `--t-ori` | 900 ms, `cubic-bezier(0.6, 0, 0.2, 1)` | Layers unfold along creases (hinge rotations), never fade |
| `--t-hanko` | 90 ms `cubic-bezier(0.5, 0, 0.75, 0)` then spring (stiffness 600, damping 30) | Press, 2-frame squash, ink spread |
| `--t-season` | ≥ 1200 ms | Time of day and season interpolate slowly |
| `--breath` | 5 s | Ambient loops at resting breath rate; heat flow follows the diurnal temperature. Runs at 30 fps only while motes are visible and the tab is visible; otherwise the scene renders on demand |
| `--stagger-fold` | 120 ms | Origami assembly per measure |

Reduced motion (`prefers-reduced-motion` or Settings): all motion becomes cross-fades ≤ 150 ms; particles become static arrows with widths ∝ watts; camera sequences jump-cut; breathing stops; the scene renders on demand only. Autoplay over 5 s is pausable (WCAG 2.2.2). Libraries: Motion (DOM, SVG `pathLength`), maath `easing.damp` (3D), JSON camera keyframes.

## 6. Sound: Oto 音 (opt-in, T5)

Deferred to T5 (DEC PR-7). Specified here so the bus events exist from T1. Off by default; the furin icon turns it on; per-cue toggles in Settings. Sound confirms meaning, never decorates.

| Cue | Sound | Meaning |
|---|---|---|
| `recompute.done` | Single suikinkutsu water drop, pitch by size of saving | A result landed |
| `seal.press` | Soft wooden thump and paper | A certificate passed |
| `seal.crack` | Dry paper tear, quiet | A check failed |
| `panel.slide` | Shoji slide | Panel open or close |
| `fold` | Paper fold | Retrofit assembly step |
| `lantern.lit` | Furin bell | Yoru on |
| `ui.tick` | Kenney interface click | Toggle, chip |
| Ambient per season | Cicadas (summer), rain (tsuyu), snow hush (winter) | Season ring position |
| Sonification | Pink-noise wind, loudness ∝ total watts lost | The house gets quieter after a retrofit |

Implementation: howler for one-shots, Web Audio (Tone.js lazy) for sonification. Every file in the asset manifest with its licence (§11).

## 7. Iconography: Mon 紋

Every measure, fuel, chapter and seal has a kamon-style crest.

Construction rules (lintable in `tools/lint/mon.ts` on the SVG source):
- 24-unit grid, outer circle r = 11 centred at (12, 12).
- Only `circle`, arcs (`A` commands) and straight lines (`M`, `L`, `H`, `V`, `Z`). No Béziers.
- Line variant stroke 1.5 at 24 px; filled variant for chapter seals; sizes 16, 24, 32, 48.
- Rotational or mirror symmetry preferred; every mon has a `title` and is `aria-hidden` when next to a text label.

| Item | Motif |
|---|---|
| Loft insulation | Three stacked arcs under a roof chevron |
| Solid wall insulation (EWI/IWI) | Two nested squares in a circle |
| Cavity fill | Square with a filled inner band |
| Floor insulation | Three short bars under a baseline |
| Glazing | Four-pane kumiko lattice |
| Draught-proofing | Tomoe swirl crossed by a bar |
| Controls | Circle with a single radial tick |
| Heat pump | Three tomoe in rotation |
| Hot water cylinder | Tall rectangle with three horizontal bands |
| Induction hob and gas disconnect | Three concentric circles; disconnect adds one bar across a flame of arcs |
| Junction (thermal bridge) | Two lines meeting at a right angle inside the circle |
| Radiators+ | Five vertical bars in a circle |
| Solar PV | Sun disc with eight straight rays |
| Battery | Rectangle with two cells and a terminal line |
| MVHR | Two opposed arrows of straight lines |
| Cool roof | Roof chevron with three upward rays |
| Shading | Half-circle over three horizontal lines |
| BLDC fan | Three blades of arcs |
| Fuels | §2.3 |
| Chapters | Each chapter kanji inside the circle (Yuji Syuku, subset) |
| Seals | 証 Proved (claims only), 検 Checked, 模 Modelled, split square Cracked |

Rough.js variants are allowed only for hand-drawn narrative diagrams in the engawa, never for controls.

## 8. Components

`packages/ui` exports these. Each has Storybook stories in Hiru, Yoru and reduced motion, plus axe checks. Tier column: T1 unless marked.

| Component | Code name | Purpose | Notes |
|---|---|---|---|
| `Num` | | The only way to render a number | Evidence chip; formats by unit and rounding policy; opens the drawer; carries a Checked, Modelled or Cracked glyph, **never Proved** |
| `RangeBand` | Kasumi | Range with likely dot | Hatch for estimated, dashed for unknown |
| `Seal` | Hanko 判子 | Proved (claims only), Checked (with rung and coverage), Modelled, Cracked, Pressing | Only consumer of `--seal`. Always renders its one-line "Not proved: …" on hover, focus and in the drawer |
| `ClaimSeal` | | A Proved claim in a sentence: "Nothing better is hidden" | Large seal plus claim text; links to the theorem and the certificate |
| `RedThread` | Akai ito 赤い糸 | Animated SVG path from a number to the drawer | `stroke-dashoffset`, 700 ms |
| `EvidenceDrawer` | | In words, How, Check tabs | Recursive input chips |
| `NarratorStrip` | Engawa 縁側 | Narrator strip | Sentence-by-sentence settle; "Plain narrator" marker |
| `InsightCard` | Tokonoma 床の間 | One insight per chapter | At most one per screen |
| `Tabs` | Noren 暖簾 | Tabs and chapter dividers that part on hover | Keyboard roving tabindex |
| `Sheet` | Shoji 障子 | Translucent sliding sheet | Desktop side sheet, mobile bottom sheet with snap points and buttons |
| `Modal` | Fusuma 襖 | Opaque modal | Focus trap, Esc |
| `Futures` | Byōbu 屏風 | Three-panel folding screen | Fixed order: Least upfront, Best return, Lowest running carbon. Four figures per card plus "More" |
| `MeasureCard` | Fuda 札 | Measure card in the tray | States: available, in scenario, ask, needs check (names the check), blocked (reason), ruled out |
| `FuelBars` | Hakari 秤 | Signed per-fuel diverging bars | Centred on zero, sign glyphs, hatch for increases, table toggle |
| `Slider` | Kumiko 組子 | Slider as a wooden lattice bar | Keyboard steps, value as `Num` |
| `MonthRing` | | Year ring with 12 months and per-fuel monthly ring chart | Arrow keys move one month. Replaces the 24-sekki ring (DEC PR-5) |
| `SunRing` | Hi-dokei 日時計 | Sundial time-of-day ring (T2) | Overlay control for the scene |
| `ScoreGroups` | | Score numeral plus four group bars; seven sub-scores on tap | Band instead of numeral while material unknowns exist. Line: "Scored for a typical household, so your bills do not change it." **No letter** |
| `EpcChip` | | Estimated EPC band letter | Always shows the ±1 spread until AC-R1 passes; labelled "Estimated EPC", never "EPC" |
| `ConsentCard` | | Rule effect with authority, weeks, grade badge, source link | "Check with your planning authority" |
| `CheckLane` | | "Possible after a check" list | Each row names the check and its cost grade |
| `WhyNot` | | Why-not list | Reason chip: rule id, ruled out, tenure, witness, target, budget |
| `GradeBadge` | | primary, secondary, announced, estimate | R17 |
| `FieldInput` | | Input showing known, estimated or unknown state | "Not sure" keeps a range |
| `BillInput` | | kWh, £ per bill, direct debit, meter CSV | Shows data quality; direct debit flagged as weak |
| `PictureQuestion` | | Onboarding question with drawings | 44 px targets |
| `DisruptionBadge` | | Days of work, rooms out of use, can you stay in | From `packages/content` |
| `NextStepCard` | | Installer type, accreditation, three questions to ask | From `packages/content` |
| `ToldList` | | Things you told us | Groups, provenance, effect, edit, forget, hidden-futures counter |
| `GoldMist` | Kasumi 霞 | Gold mist band chapter transition | Decorative, `aria-hidden` |
| `Timeline` | Emaki 絵巻 | Chapter timeline | Skippable chapters |
| `Inkstone` | 硯 | Long-task progress with stage labels | Percent and cancel after 10 s |
| `PencilLoader` | Shita-e 下絵 | Pencil underdrawing loader | SVG stroke animation |
| `MendedError` | Kintsugi 金継ぎ | Torn washi error with a gold mend line | What still works, one next step |
| `Lantern` | 行灯 | Day/night toggle | Optional follow-the-sun |
| `Toast` | Tayori 便り | Remembered facts ("Remembered: not inside insulation. Undo") | Polite live region |
| `Palette` | | Command palette | `/`, `Ctrl K` |
| `Letter` | 手紙 | Generated tenant or landlord letter (T3) | Locale fonts |
| `TableAlt` | | Table alternative for any chart | Required prop on charts |
| `BrushFrame` | | Drawn panel border | Cached SVG |
| `Furin`, `GardenObject` | | Sound toggle; memory garden objects (T5) | |

## 9. Voice in the interface

- A calm architect friend who sketches while talking: feeling, then number, then a door to the evidence.
- Short sentences, second person, British spelling in en-GB.
- **Seal copy:**
  - "Proved" only on a claim seal, and every seal carries its "Not proved" line. Example: "Nothing better is hidden. Proved: no option that passes our rules beats these on cost, return and running carbon at once. Not proved: that our energy model matches your home exactly."
  - Physics is always "modelled".
  - Never "guaranteed", "verified savings", "AI-verified" or "save up to".
- **Futures** are named by their axis: Least upfront, Best return, Lowest running carbon.
- **Copy that names a condition states it**: "On a typical January night (4 °C outside)".
- **Japanese words** appear only as decorative glyphs paired with English, never required for understanding.
- No em or en dashes in copy.

## 10. 3D art direction

**Look.** A painted miniature on washi: Enya Honami precision with Yoshida Seiji warmth. Orthographic cutaway (fukinuki yatai) at about 30° elevation, with azimuth snapping in 45° steps. Perspective is used only for the roof lift.

**Still-life rendering** (DEC TE-8).
- When the camera rests, the scene bakes one high-quality frame: PBR, N8AO, accumulated soft shadows, paper multiply.
- Motes, people, the lens, noise rings and seams animate on top as cheap overlays.
- While the camera moves, a light live pass runs.
- The futures miniatures are baked once per result.

**Materials.**
- Brick, slate, render and timber come from Poly Haven (CC0) at 1k, or 2k for the hero facade, desaturated 15% towards paper.
- Interiors are in muted paper tones. Furniture comes from Kenney and Quaternius kits, instanced.
- Insulation reads as soft quilted paper (tinted `--good-soft`).

**Light.**
- Hiru: Qwantani HDRIs crossfaded by time of day, sun from suncalc, overcast Kloofendal sky for the UK default.
- Yoru: dusk HDRI, emissive windows, and leak sprites at infiltration paths with intensity ∝ modelled leakage. Bloom is restricted to emissives.

**People.** Tiny capsule residents in sumi line style. They act out the **zone** comfort state from 5R1C: coat when the zone is below 18 °C, fanning above 26 °C, relaxed otherwise. Never photoreal.

**Honesty rules** (enforced in CI through layer plugins):
- One heat mote = 10 W. The legend is always visible while motes show.
- The ground temperature is named: "a typical January night, 4 °C outside".
- Junction lines in the lens have brightness ∝ ψ·ΔT (W/m), and each line opens its own junction evidence.
- **Gold seams** appear only on junctions whose ψ the chosen package lowers.
- **New-risk hatch** (`--warm`, 45° hatch, never gold) appears on junctions a package worsens, such as IWI joist ends and party-wall returns.
- Room tints show **zone** temperatures with the zone named, never a single-room claim.
- Thermal colours come only from the Netsu ramp, with a temperature legend and "Modelled, not measured".
- Noise rings are drawn at 1 dB steps, with the 37.0 dB threshold ring in `--warm`. A `needs-check` result draws the threshold ring dashed.
- Before and after is a split of one scene, and both sides are engine results.
- Neighbours (T4) are labelled "imagined" unless the user added them.

**Pastiche guard.** A London terrace has London brick, slate and sash. A Hyderabad flat has RCC, chajjas and a water tank. No torii, paper lanterns, blossom or kimono in any scene. QA runs a cultural checklist on every scene.

**Budgets.** 60 fps target and 30 fps floor on Iris Xe, measured by hand at each milestone. CI gates on `renderer.info`: ≤ 150 draw calls, ≤ 300k triangles, ≤ 20k particles. Textures 1k (2k hero) WebP or KTX2. Meshes glTF + meshopt. The `PerformanceMonitor` ladder lowers DPR, then N8AO, then shadows, and drops one tier while an LLM generates.

## 11. Day and night behaviour

| Aspect | Hiru 昼 | Yoru 夜 |
|---|---|---|
| UI ground | Washi, ink text | Sumi, lamplight text, panels lit from behind |
| Depth | Kage shadows | Tomoshibi glow |
| Grain blend | Multiply | Screen, warm tint |
| 3D | Daylight, soft shadows | Dusk, emissive windows, heat leaks glow |
| Story default | Chapters 2 to 4 | Chapters 1 and 5 (opening and closing) |
| Diagnostic | Read numbers | See leaks |

## 12. Accessibility inside the system

- Every colour-coded state also has a pattern, glyph or label.
- Focus ring `--focus` never hidden by sheets (WCAG 2.4.11).
- All drag interactions (Slider, MonthRing, SunRing, Sheet, thermal lens, before/after divider, heat pump drag) have key and click alternatives (2.5.7).
- Touch targets 44 px.
- `lang` attributes on Japanese, Telugu and Hindi fragments; decorative kanji and baked seal glyphs `aria-hidden`, with the English label as the accessible name.
- Seals expose their claim and "Not proved" line to screen readers.
- Charts require `TableAlt` and a one-sentence summary.
- A polite live region announces recompute results as one debounced sentence.
