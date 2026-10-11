# @ibasho/ui

Andon design system: tokens, CSS, components, mon icons, motion presets, `Num`, chart primitives, Storybook.

- **Owner:** WP-06 (UI kit). Skeleton created by WP-00 at G0.
- **Layer:** L2 (imports L0 only: `@ibasho/core`). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Use

```ts
import '@ibasho/ui/andon.css'; // once, at the app root: tokens, three webfonts, base, components
import { ClaimSeal, EvidenceProvider, Num, Seal } from '@ibasho/ui';
```

- Wrap the app in `<EvidenceProvider source={...}>`. A source is `{ node(id), open?(id, chipEl), locale? }`; `staticEvidence(nodes)` builds one from a list. `ui` cannot import the store or engine, so the app (WP-08) supplies it.
- `<Num ev={id} />` renders the node by its unit and rounding policy (half even, exact decimals, true minus U+2212, ranges with "to"). Props: `seal` (override, never `proved`), `signed`, `delta` (`saving` or `increase`), `as` (`kWh`, `MWh`, `kgCO2e`, `tCO2e`), `size` (`ui`, `body`, `display`). DOM: `button.ib-num[data-num][data-ev][data-seal]`. A missing node renders `[data-num][data-missing]` with no digits.
- `<Seal level="checked" check={{ rung: 'lean-native', coverage: 'all' }} />`. Levels: `checked`, `modelled`, `cracked`, `unverified`, `pressing`, and `proved`, which requires `claim` and `notProved`. DOM: `.ib-seal[data-seal]`, `role="img"`, its "Not proved" line in `aria-describedby`. Sizes `glyph`, `sm`, `md`, `lg`, `xl`; `press` plays the hanko.
- `<ClaimSeal claim={{ id, sentence, theorems, notProved }} statement proofHref certificateHref press />`. DOM: `section.ib-claim[data-claim]`. Copy should come from `@ibasho/spec-gen` `seals.json`.
- Theme: `data-theme="hiru"` or `"yoru"` on `<html>` or any subtree; without it the system preference decides. `data-motion="reduced"` on `<html>` forces reduced motion. Put `.ib-washi` on a surface for the procedural grain.

## Public API

| Export | What |
|---|---|
| `andon.css`, `tokens.css`, `fonts.css` | Generated tokens (Hiru, Yoru), the three families, base, component and kit styles |
| `@ibasho/ui/tokens` | Token sources as data, `renderTokensCss`, colour maths (OKLCH, contrast, CVD simulation) |
| `Num`, `formatEvidence`, `Dec` helpers, `magnitude` | The only way to render a number; `magnitude` gives bar lengths from the same node |
| `Seal`, `ClaimSeal`, `sealName`, `SEAL_LABEL`, `NOT_PROVED` | Hanko seals and their copy |
| `Glyph`, `BAKE_LIST` | Kanji baked from Yuji Syuku into SVG paths (no font request) |
| `EvidenceProvider`, `staticEvidence`, `useStaticEvidence` | Where `Num` finds nodes |
| `Sheet` | Shoji sheet: side from 900 px, bottom below with peek, half, full (each a button). `aside.ib-sheet[data-open][data-snap]` |
| `NarratorStrip`, `sentencesFromRendered` | Engawa strip; "Plain narrator" marker; chips without seals (R11). `section.ib-narrator` |
| `ScoreGroups`, `SCORE_LINE` | Score 0 to 100, four groups, seven parts on tap, band while material fields are unknown. No letter |
| `EpcChip`, `epcSpread`, `epcLabel` | "Estimated EPC" with the spread either side until `bandValidated` (AC-R1) |
| `Futures`, `FutureCard`, `DoNothingLine`, `FUTURE_ORDER` | Byobu screen in fixed order and the fourth line "If nothing is done" (SPEC 14). `[data-do-nothing]` |
| `Negatives`, `negativeItems` | What gets worse, on every card and the fourth line; `negativeItems` maps core `Negative[]` |
| `MeasureCard` | Fuda: available, in scenario, ask, needs check, blocked, ruled out. `article.ib-fuda[data-state]` |
| `FuelBars` | Signed diverging bars per fuel, hatch for increases, table toggle |
| `Slider` | Kumiko bar over evidence stops; keys, step buttons, tap; `aria-valuetext` in words |
| `WhyNot` | Reason chips: rule, memory, tenure, witness, target, budget |
| `CheckLane`, `GradeBadge` | "Possible after a check" (R22) with the check, its cost and grade (R17) |
| `MonthRing`, `MONTH_NAME` | Twelve month ring with per-fuel stacks; arrow keys wrap; table |
| `ChartFrame`, `TableAlt` | Every chart: a one sentence summary and a table alternative |
| `Mon`, `MONS`, `monFor`, `isMonId`, `MEASURE_MON` | Kamon crests for measures and fuels (DS 7) |

Components are presentational. Props carry `EvidenceId`s and plain strings; the app maps engine output to them. Every digit sits inside a `Num` (tests audit this per component).

## Scripts

- `pnpm --filter @ibasho/ui tokens` regenerates `src/styles/tokens.css` from `src/tokens/*.ts` (a test fails on drift).
- `pnpm --filter @ibasho/ui bake-glyphs` refetches Yuji Syuku at a pinned commit, checks its SHA-256 and rewrites `src/glyphs/baked.ts` (committed; tests never touch the network).
- `pnpm --filter @ibasho/ui storybook` / `build-storybook`: every story renders Hiru and Yoru side by side, with a reduced motion toggle.

## Status

M-0, M-A and M-B sets done: tokens, fonts, baked glyphs, `Num`, seals, and the kit above with stories (`Kit/*`, illustrative evidence in `stories/kit-evidence.ts`). Acceptance covered: F1, F2, F5, F6, F7 (no letter on the score, EPC spread), F8 at the source, F9; AC-B1 and AC-B3 at the component level (fourth line, negatives on every card); R17 badges; R22 lane; 2.5.7 alternatives for every drag (Sheet, Slider, MonthRing).

Not built yet (M-D): the rest of DS 8 (`RangeBand`, `RedThread`, `EvidenceDrawer`, `InsightCard`, `Tabs`, `Modal`, `ConsentCard`, inputs, `ToldList`, loaders, `MendedError`, `Lantern`, `Toast`, `Palette`, `BrushFrame`), `tools/lint/mon`, axe and visual snapshot runs over stories (F4), the network audit (F8 in a browser), a Latin-first fonts entry.

Commands: `pnpm --filter @ibasho/ui typecheck`, `pnpm --filter @ibasho/ui test`.

## v3 studio kit (DESIGN_SYSTEM 13)

`src/v3/`, styles in `src/styles/v3.css` (imported by `andon.css`). Stories: `stories/Studio.stories.tsx`.

| Export | What |
|---|---|
| `StageBar`, `STAGE_LABEL`, `overallFraction` | Seven beads (geometry to options), rough or refined half beads, stale hatch, split on failure, Cancel after 1 s, percent and time left past 10 s, Preview stamp. Reads core `StageBarState` |
| `PreviewStamp`, `Stale`, `TierCaption`, `ApplicabilityChip` | Preview word on a pencil hatch (never a seal); "updating" hatch; rough and refining captions; R34 ladder in plain words |
| `ScaleLadder`, `stepLevel`, `ModeTabs` | City, Site, Building, Floor, Room (vertical or breadcrumb); Make, Look, Choose, Prove, Tell tabs with arrow keys |
| `LensPanel`, `AnalysisLegend`, `Histogram`, `RAMPS`, `rampColor`, `rampGradient` | One panel for every lens; legend with unit, resolution, period, method, tier, "Modelled, not measured", Preview; OKLab ramps Hinata, Hidamari, Akari, Sora, Netsu, Kotai, Shiro |
| `TypeCards`, `TypeCard`, `TYPE_INFO`, `ScheduleStrip` | Eight building types with mons (`type-*` in `MONS`) and a 24 hour strip |
| `EuiGauge`, `EndUseBar`, `RatingLadder`, `stepState` | EUI range against target and bands; end uses with PV negative; three gates on one savings axis (likely, possible, not yet) |
| `LedgerRow`, `Stepper`, `ChoiceChips` | Settings ledger row: control, unit, origin chip, grade, scope, "changes N numbers" |
| `Range`, `SunScrubber`, `Picker` | Andon inputs: kumiko track with step buttons; 24 hour sun scrubber (night hatch, daylight band, sunrise and sunset, altitude arc, Home and End); listbox picker. No native range or select anywhere |
| `CompareGrid`, `FilmStrip` | 1, 2 or 1 + 3 compare; versions with the EUI after each |
| `Menu` | Menu button (More): arrows, Enter, Escape; a `danger` item sits last in warm ink |
| `loadAndonFonts`, `ABOVE_THE_FOLD` | Starts the first screen's faces at once and resolves when loaded or after a short cap, so apps render without a font swap |
| `.ib-btn`, `.ib-btn--quiet`, `.ib-btn--hero` | Buttons; gold only on the one hero action |

`Num` draws seal `preview` with a dashed underline and no glyph (AC-PG3). v3 units (`kWh/m2.yr`, `micro-paise/*`, `lux`, ...) are in `DISPLAY`.
