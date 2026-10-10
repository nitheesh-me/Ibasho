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

## Public API (M-0)

| Export | What |
|---|---|
| `andon.css`, `tokens.css`, `fonts.css` | Generated tokens (Hiru, Yoru), the three families, base and component styles |
| `@ibasho/ui/tokens` | Token sources as data, `renderTokensCss`, colour maths (OKLCH, contrast, CVD simulation) |
| `Num`, `formatEvidence`, `Dec` helpers | The only way to render a number |
| `Seal`, `ClaimSeal`, `sealName`, `SEAL_LABEL`, `NOT_PROVED` | Hanko seals and their copy |
| `Glyph`, `BAKE_LIST` | Kanji baked from Yuji Syuku into SVG paths (no font request) |
| `EvidenceProvider`, `staticEvidence`, `useStaticEvidence` | Where `Num` finds nodes |

## Scripts

- `pnpm --filter @ibasho/ui tokens` regenerates `src/styles/tokens.css` from `src/tokens/*.ts` (a test fails on drift).
- `pnpm --filter @ibasho/ui bake-glyphs` refetches Yuji Syuku at a pinned commit, checks its SHA-256 and rewrites `src/glyphs/baked.ts` (committed; tests never touch the network).
- `pnpm --filter @ibasho/ui storybook` / `build-storybook`: every story renders Hiru and Yoru side by side, with a reduced motion toggle.

## Status

M-0 step 5 done: tokens, fonts, baked glyphs, `Num`, `Seal`, `ClaimSeal`, stories for each. Acceptance covered so far: F1 (AC-14 ramp), F2 (text contrast), F5 (`--seal` and `--gold` scarcity, checked in tests until the lint lands), F6 (type test), F8 at the source (three families), F9 (baked glyphs).

Not built yet (M-A onward): `Sheet`, `NarratorStrip`, `ScoreGroups`, `EpcChip`, the other DS 8 components, `BrushFrame`, mon icons and `tools/lint/mon`, chart primitives with `TableAlt`, motion presets beyond CSS tokens, axe and visual snapshot runs over stories (F4), the network audit (F8 in a browser).

Commands: `pnpm --filter @ibasho/ui typecheck`, `pnpm --filter @ibasho/ui test`.
