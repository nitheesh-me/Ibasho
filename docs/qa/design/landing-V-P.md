# Landing page review, V-P

Panel: brand and web design, product marketing, plain British English editing.
Build: `pnpm --filter @ibasho/landing build` (manifest discovery: 66 plugins, 7 studio stages), served with `vite preview`, captured headless Chromium (software GL, reduced motion on for crops).
Screenshots: `docs/qa/ux/V-P/landing/review/` (fold, one crop per section, at 1280 and 360, day and night; plus 768 and diagnostic shots). Raw measurements in `review/report.json`.

## Verdict: NOT YET

The page has a real voice and a disciplined type system. The hero is handsome, the gold action is unmistakable, the copy is honest and mostly plain. But as a sales page it shows almost nothing of the product. Below the hero there are eight chapters of text, three or four paragraphs each, with a decorative kanji where the picture should be. Every one of them carries a Preview stamp. A homeowner or an architect scrolls 11,000 pixels (13,500 on a phone) of reading and never sees the city, a sun study, a daylight floor, an energy bar, a rating ladder or the three futures. The studio already makes beautiful pictures (see `docs/qa/ux/V-P/city/round4/radiation.png` and `nightcity.png`); the landing page must show them before it ships.

## Answers to the orchestrator's first impressions

(a) Day mode is not broken and the capture did not force dark. The hero (and the top bar) is fixed to night on purpose (`data-theme="yoru"` in `Landing.tsx`, "lit like a lantern"). Everything below the hero follows the system or the lantern button, and day renders correctly on paper (`review/03-city-1280-day.png`). The real problem is that the first screen never changes, so the "Night" button at the top looks broken (finding M5).

(b) Agreed. The drawing is fine linework but occupies about a third of the hero, floats mid height and is quiet next to a 4 line headline (M1).

(c) No. The page shows none of the product's real surfaces (B1, M7).

## Findings

Severity: Blocker (must fix before shipping), Major (fix in this round), Minor, Polish. Owner: D for `apps/landing` and `packages/content`, C where a still from the city scene is needed.

### Blockers

**B1. No product imagery anywhere below the hero.** Owner C and D.
SPEC 5.1 asks for a baked poster per chapter; `poster` is unset on all nine chapters and the slot (`lp-ch__poster`) never renders. At 1280 the text takes two thirds of each chapter and a single kanji sits alone at the far edge, so the empty third reads as a missing image rather than Ma.
Fix: C bakes one still per chapter from the real city scene, with no interface chrome, in both day and night palettes, at 1600 and 800 wide WebP:
city = paper model of Gachibowli with Vindhya Bhavan inked and a hatched height band on one neighbour;
sun = the shadow sweep on a May noon, sun from the north;
daylight = the floor drawer pulled out with the daylight fill and a glare hatch;
energy = the end use bar beside the EUI range and target;
codes = the rating ladder with likely, possible and unknown points;
compare = the three futures side by side;
design = a drawn floor plan set on a plot in two orientations;
trust = an evidence card opened on one number.
Every still carries the Preview hatch in the corner while that stage is Preview. D then fills `poster` in `chapters.ts`, keeps the glyph small beside the kicker, and gives the image the empty column. Screenshots: `review/03-city-1280-day.png`, `04-sun-1280-day.png`, `08-compare-1280-day.png`.

### Majors

**M1. The hero image undersells the product.** Owner C and D.
The isometric drawing is about 430 px wide in a 1280 viewport, floats at mid height and has large dark margins; on phones it lands after the call to action and two paragraphs. Fix: replace it with (or set behind it) a wide night still of the real city, lanterns glowing by EUI, Vindhya Bhavan lit at the centre, the sun arc kept as a thin line over it. Let the image bleed to the right edge and the bottom of the hero at 1280 and above. On phones show a cropped version of the still directly under the headline, before the body text. Keep the caption, shortened (see m3). Screenshots: `review/fold-1280-day.png`, `review/vp-360-day-heroart.png`, compare with `docs/qa/ux/V-P/city/round4/nightcity.png`.

**M2. The gold action falls below the fold on a 1280 by 800 laptop.** Owner D.
The headline is capped at 18ch inside the 5fr column, so it breaks into four lines ("See how a / building / will live / in its city."), and the two body paragraphs push "Open the studio" to y 800. Fix: allow 20 to 22ch so the title sets in three lines, move the second body paragraph ("Every number opens...") below the actions or drop it from the hero, and reduce the space between the line and the body. Target: action fully visible at 1280 by 720 and at 360 by 740. Screenshot: `review/fold-1280-day.png`.

**M3. Promises run ahead of the product.** Owner D.
Seven of the eight feature chapters carry Preview. The hero says "Every number opens to show where it came from" and the closing line says "see first results in a few minutes", with no qualifier near either. The trust chapter explains Preview, but it is the ninth chapter. Fix: one quiet line under the hero actions, for example "Some results are examples for now and are marked Preview." Change the invitation line to "Choose Hyderabad or London, pick a building or draw your own, and explore it in a few minutes. No account needed." Keep the per chapter stamps once the stills carry the hatch (see m4). Screenshots: `review/fold-1280-day.png`, `review/11-invitation-1280-day.png`.

**M4. Too long and too dense for a landing page.** Owner D.
About 30 paragraphs; 10,861 px tall at 1280 and 13,477 px at 360. Each chapter repeats the same shape (kicker, title, line, three or four paragraphs), so the rhythm flattens and the best lines get lost. Fix: each chapter keeps its title, its one line and at most one short paragraph next to its still. Move the professional detail (sDA and ASE, the code list, the Lean checker) behind a "More detail" disclosure per chapter or into the studio's help. Consider merging Sun and Daylight, and Codes into Compare, to land at six chapters. Target under 7,000 px at 1280. Screenshots: all `review/0*-1280-day.png`.

**M5. The day and night switch looks broken on the first screen.** Owner D.
The hero and bar are always night, so in day mode the button reads "Night" over a dark hero, and pressing it changes nothing visible until you scroll (`review/toggle-1280-night-from-day.png` matches `review/fold-1280-day.png`). Fix, either: let the hero follow the theme with a paper version (ink drawing, sun in `--glow`, gold action kept), or keep the lit hero and move the switch out of the hero bar to the footer with the label "Day colours" or "Night colours". The first is better for the brand ("ink on paper by day, lantern by night").

**M6. Text ghosts and overlaps when the page is painted in software.** Owner D.
In software rendering, scrolled screenshots show whole paragraphs and the building type list repeated over each other (`review/vp-360-day-types.png`). This is the same fault as the "capture glitch" in the earlier full page shots. Cause, confirmed by diagnosis: the washi grain `::before` on `main` spans the whole 11,000 to 13,500 px page with `mix-blend-mode: var(--grain-blend)`, which forces one huge blended layer. With the blend set to normal, or the grain hidden, the ghosting disappears (`review/diag-360-types-noblend.png`, `review/diag-360-types-nograin.png`). Real devices with software or weak GPU compositing (virtual machines, older laptops, some Android) may show the same. Fix: paint the grain as a tiled `background-image` on `body` or per section without a blend mode, or as a fixed position overlay the size of the viewport.

**M7. No concrete proof that the studio is worth opening.** Owner D, with C for the images.
The page tells but never shows a result. One worked example with real (or clearly Preview) figures would do more than three chapters of description. Fix: add a short "Vindhya Bhavan, in one page" strip after the audiences: one still, three numbers (EUI range against the ECSBC target, yearly bill range in rupees, likely green rating level), and the three futures as three small cards with cost and saving, each stamped Preview while it is, linking to the walk through. Use the studio's own components and tokens so it matches the app.

### Minor

**m1. Chapter kickers run together.** "One In its city", "Six Compare futures" read as one phrase. Use a numeral with a thin rule or a middle dot ("1 · In its city"), or drop the numbering. Owner D. Screenshot: `review/03-city-1280-day.png`.

**m2. The brand repeats three times in the first 130 px.** "Ibasho" in the bar, the 居場所 brush mark, and a kicker that says "Ibasho" again. Make the hero kicker a short promise or the cities ("Hyderabad and London") and keep the brush mark. Owner D.

**m3. Copy edits** (plain English, no jargon, customer voice). Owner D.
- Hero body: "It starts in Hyderabad and London." becomes "Available for Hyderabad and London today."
- Hero caption (two sentences, small type): shorten to "Your building in ink among its neighbours. The hatched shadow marks a height we can only estimate."
- Audience, developers: "read the energy code standing early" is hard to parse. Try "see early where you stand against the energy code".
- Compare: "A separate checker, proved sound in Lean, works through the search again" is jargon for customers. Try "A separate checker, itself mathematically proved, repeats the search and confirms nothing better was missed." Keep Lean in the glossary.
- Compare: "Not proved: that the physics matches your building exactly." reads like a note. Try "What is not proved: that the physics matches your building exactly. That part is modelled, and we say so."
- Trust: "explains trade offs" reads as a typo. Use "explains the choices".
- Codes: a run of five acronyms in one sentence. Lead with the plain promise and leave the list to the still and the glossary.
- Daylight: "Professionals get the usual measures" is fine; with M4 it moves behind the disclosure.

**m4. Seven Preview stamps in a row, each a 21 px tall link.** Repetition dulls them and the hit target is under 24 px. Once stills exist, put the Preview hatch on the image corner, keep a single stamp in the kicker only for chapters that are entirely examples, and raise the link's hit area to at least 24 px (44 px preferred). Owner D. Screenshot: `review/03-city-1280-day.png`.

**m5. Words differ between page and studio.** The landing says "hatched band" for an estimated height; the city stage legend says "Dashed tops: estimated heights" (`docs/qa/ux/V-P/city/round4/radiation.png`). Pick one term in `glossary.ts` and use it in both. Owner D, with the scene owner for the legend.

**m6. The closing invitation is flat.** A centred heading, one line and an outlined button on blank paper ends a long page quietly. Set it over a wide still of the city at dusk (C) and keep the outlined button, since gold belongs to the hero. Owner D and C. Screenshot: `review/11-invitation-1280-day.png`.

**m7. Glyph marks.** The daylight chapter reuses 居, already used in the hero mark; the vertical gloss under each glyph is 12 px in the third ink and barely legible. With stills in place, shrink the glyph to sit beside the kicker and drop the vertical gloss, or give daylight its own glyph (明, bright) if one can be baked. Owner D.

### Polish

**p1. Tagline spacing.** In Shippori Mincho the space after the colon nearly vanishes ("Ibasho:improving the place where you belong."). Set the footer tagline in the gothic face or add a little letter spacing after the colon. Owner D. Screenshot: `review/zoom-footer-360-day.png`.

**p2. Glossary layout at desktop.** "Words we use" is a 48rem column of 20 terms; fine, but it is the longest block on the page. With M4 most terms drop out; consider showing it collapsed under a "Words we use" disclosure. Owner D.

**p3. Font weight.** The deferred font stylesheet is 715 kB (its unicode range table) and the build ships about 50 MB of slices. Only Latin and a handful of baked kanji appear on this page. A Latin only subset for the landing would cut the font request to a few files. Owner D.

## What already works

- Type: Shippori Mincho headlines with Zen Kaku Gothic for interface text, well balanced, generous leading, `text-wrap: balance` used well. It feels calm and expensive.
- Colour discipline: gold appears exactly once, vermilion never; both themes use Andon tokens; measured text contrast passes in day and night.
- Honesty: Preview is explained in plain words, "Modelled, not measured" thinking runs through the copy, privacy is stated without fuss, and the AI is said never to write a number.
- Audiences: the five "Who it is for" entries are specific and useful, each with a real place to open. This is the strongest marketing block on the page.
- Building types with their mon icons read well at both widths.
- Accessibility basics: skip link, one h1, labelled sections, decorative kanji hidden from screen readers, glossary links with definitions, 44 px nav targets, no horizontal scroll at 360 (scroll width equals client width).
- Motion: chapters ink in on scroll, never fully hidden (opacity 0.2), and stay fully visible with reduced motion or with JavaScript off (`review/nojs-1280-day.png`).
- No development artefacts, no dashes, no internal names in anything a visitor sees.

## Suggested order

1. M6 (one CSS change), M2 and M3 (copy and spacing), M5.
2. C bakes the stills (B1, M1, m6) from the city scene.
3. D lays out the stills, trims chapters (M4), adds the Vindhya strip (M7), then the minors.
4. One more screenshot pass at 1280 and 360, day and night.
