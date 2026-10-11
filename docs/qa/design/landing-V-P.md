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

## Round 3

Build: `pnpm --filter @ibasho/landing build`, served with `vite preview` on port 4174, headless Chromium through the guard (software GL, reduced motion), one browser per batch. Shots and raw measurements: `docs/qa/ux/V-P/landing/round4/` (fold and full at 360, 768, 1280 and 1600 by day, 1280 and 360 by night; `ch-<section>-<width>-<theme>.png` close-ups of every section at 1280 day and night and 360 day; `info-*.json` with heights, gold action position and every visible image). Script: `round4/shoot.mjs <batch>`.

### Verdict: NOT YET (close)

The page has turned a corner. The day hero is now handsome paper and ink, the gold action sits well above the fold everywhere, the worked example reads like a real result, and the stills finally show the product. No development artefacts, no dashes, no page errors, no sideways scroll. What holds it back is the night half and three stills that do not say what their chapter says. A trailer will cut between day and night, so the night hero and the night chapters must be as strong as the day ones. Fix the five majors below and this ships; none is more than a re-render or a few lines of copy.

### Checks

| Check | Result |
|---|---|
| Doubled stills (night under day) | Gone. Exactly one visible still per section at every width and theme; day loads only `*-day`, night only `*-night` (`info-*.json`). |
| Height at 1280 | 6,963 px by day and by night. Under 7,000, but only by 37 px; any new line tips it over. 1600 is 7,173; 768 is 10,369; 360 is 10,953. |
| Gold action above the fold | Bottom at 623 px on 1280 by 800 and 1600 by 900, 668 px on 360 by 740, 852 px on 768 by 1024. Pass. |
| Page errors, console errors | None in any run. |
| Horizontal scroll | None (scroll width equals viewport at all four widths). |
| Development artefacts, dashes | None in the visible text (full text sweep at 1280). |
| Preview marks | On the hero still, the example, every chapter still and the hero footnote. Correct and calm. |

Note on the tall phone and tablet full page shots: Chromium's software capture wraps around after about 8,000 px, so `full-360-*.png` and `full-768-day.png` show the hero again near the bottom. This is the capture, not the page; the per section close-ups at 360 render correctly.

### Round 1 and 2 findings

| Id | Status |
|---|---|
| B1 no product imagery | Resolved. Nineteen stills placed by theme. Quality issues below (M10 to M13). |
| M1 hero image | Partly. By day the paper city is strong. It still sits in a boxed frame at about 560 px instead of bleeding to the edge, and the night hero is weak (M8). |
| M2 gold action below the fold | Resolved. |
| M3 promises ahead of the product | Resolved: Preview line under the actions, invitation reworded. |
| M4 too long | Resolved at 1280 (6,963 px). Fragile, see the table. |
| M5 day and night switch | Resolved. The hero follows the theme. |
| M6 ghosting | Resolved (fixed grain, no blend). No ghosting in any close-up. |
| M7 no concrete proof | Resolved. "Vindhya Bhavan, in one page" carries real Preview figures and three futures. |
| m1 kickers | Resolved ("01, In its city" with a rule). |
| m2 brand three times | Resolved. |
| m3 copy edits | Resolved. |
| m4 Preview stamps | Resolved: hatch in the still corner, 28 px target. |
| m5 hatched or dashed | Resolved on the page ("hatched" throughout). |
| m6 flat invitation | Resolved. The dusk city behind "Start with a place." is lovely. |
| m7 glyphs | Resolved (removed). |
| p1 tagline spacing | Resolved (gothic face). |
| p2 glossary | Resolved (folded "Words we use"). |
| p3 font weight | Open. `fonts-*.css` is still 715 kB. |
| Second opinion: day mode, monospace data, mobile hero | Resolved: real paper day mode, data set in a mono face, still directly under the headline on phones. |

### Findings, round 3

#### Blockers

None.

#### Majors

**M8. The night hero does not carry the first screen.** Owner C and D.
At 1280 the night still is a wide wireframe city with a lantern about 60 px across in a 560 px box; most of the frame is black, and a "Vindhya Bhavan" label is baked in at about 5 px (unreadable, and it looks like interface chrome). On phones the night hero is a tight top down crop of a lit roof that reads as an abstract pattern, not a building in a city. The caption under both still says "The hatched shadow marks a height we can only estimate", and no hatch or shadow is visible at night.
Fix: C renders a night hero framed like the day one (same camera, Vindhya filling about a third of the frame, neighbours lit dimly by EUI), with no baked label; the phone crop keeps the whole building and a ring of neighbours. D gives the night hero its own caption, for example "Your building lit by how much energy it uses, among its neighbours." Shots: `round4/fold-1280-night.png`, `round4/crop-hero-1280-night.png`, `round4/fold-360-night.png`.

**M9. "LIKELY, No level yet" reads as a contradiction.** Owner D.
The codes plate shows four identical rows (GHMC stars, LEED, IGBC, EDGE), each a "LIKELY" stamp beside "No level yet". A reader takes it as "likely no level", which is both confusing and a poor advert. The example strip repeats it as "GHMC stars: no level likely yet".
Fix: say what the design is short of, in words: "Not yet at the first level" with how far ("needs about 10% less energy for one star"), or show the nearest level as Possible. Drop the stamp when there is no level. In the example: "Green rating: not yet at one GHMC star, about 3% to 34% above the code's reference." Shots: `round4/ch-codes-1280-day.png`, `round4/ch-example-1280-day.png`.

**M10. The night sun and daylight chapters show the same lantern.** Owner C.
At night the city, sun and daylight stills are near copies: dark ground, one glowing block. "Follow the sun across the year" over a night picture has no sun and no shadow; the daylight night still shows a floating glow beside the building rather than daylight on a floor. Scrolling the night page, three chapters in a row look identical (`round4/full-1280-night.png`).
Fix: sun and daylight are daytime ideas. By night use a dusk version of each (low warm sun, long shadows; the drawer floor with its daylight fill still visible), or reuse the day render with the night grade. Keep the lantern for the city and energy chapters only. Shots: `round4/ch-city-1280-night.png`, `round4/ch-sun-1280-night.png`, `round4/ch-daylight-1280-night.png`.

**M11. The day daylight still shows no daylight.** Owner C.
The chapter promises "Bright areas fill with colour and dim corners stay plain paper", but the drawer floor is plain pale paper with no fill, and the building beside it is a flat dark grey slab that looks like a rendering fault. Fix: paint the drawer with the daylight fill (gold to paper), add the glare hatch near one window, and render the parent building in the paper model style. Shot: `round4/ch-daylight-1280-day.png`.

**M12. The example still by day is a night picture.** Owner C and D.
"Vindhya Bhavan, in one page" uses `hero-phone` (a warm, lit, top down roof close-up) in both themes. On the paper day page it reads as an orange abstract and fights the figures beside it. Fix: C renders a day version (the energy or trust still framing, whole building, paper neighbours); D picks it by theme as the chapters do. Shot: `round4/ch-example-1280-day.png`.

#### Minor

**m8. Energy plate: an unlabelled black bar.** Below the end use legend there is a black bar with a hatched start and no label, and the legend lists four of six coloured segments. The copy promises "pumps, hot water and solar". Label the bar ("As drawn, against the reference") or remove it, and list every segment or say "and 2 more". The kicker says "Energy, bills and carbon" but carbon appears nowhere; drop "and carbon" or add one carbon figure. Owner D (plate) and C if the plate is baked. Shot: `round4/ch-energy-1280-day.png`.

**m9. Trust plate shows "Linked values 149".** A count of linked values means nothing to a customer. Replace with something they can use: "Sources: 3 weather and tariff files, 1 code" or "Opens to 149 linked numbers". Owner D. Shot: `round4/ch-trust-1280-day.png`.

**m10. A dark propeller shape on the trust still.** The phone crop of the trust still shows a black four bladed mark in the courtyard (the radiation rose or a sun dial) that reads as a glitch; the plate hides it at 1280. Remove it from the still or make it legible. Owner C. Shot: `round4/ch-trust-360-day.png`.

**m11. Compare plate hides the three futures.** The compare still shows three panes, but the plate covers most of them and repeats the example's three cards, wrapped awkwardly ("Rs 24 / lakh"). Make the plate a single line strip along the bottom (three names and savings) so the panes show. Owner D. Shot: `round4/ch-compare-1280-day.png`.

**m12. Height margin.** 1280 sits 37 px under the 7,000 px target. Trim 150 to 200 px of slack, for example the gap above "Who it is for" or below the example, so later copy does not tip it. Owner D. Shot: `round4/full-1280-day.png`.

**m13. Location line twice in a row.** "IIIT Hyderabad · 17.45° N, 78.35° E" closes the hero and opens the example two screens later. Keep it on the example only, or shorten the hero one to "IIIT Hyderabad". Owner D.

#### Polish

**p4. Hero still frame.** By day the still could bleed to the right edge at 1280 and above, as M1 asked; the boxed frame with a hairline feels like a screenshot. Owner D.

**p5. Day sun still.** The soft shadow blob is pleasant but does not say "sun"; a thin sun arc or a second shadow time faintly drawn would make the chapter instantly legible. Owner C. Shot: `round4/ch-sun-1280-day.png`.

**p3 (carried). Font stylesheet 715 kB.** Owner D.

### What works now

- The day hero is the brand: ink on paper, real neighbours, Preview hatch, gold action, all in the first 640 px.
- The worked example sells the product better than any paragraph: ranges against the code, bills in crore and lakh, three costed futures, each honest about being an example.
- Copy is short, plain and sounds like a person. The trust chapter ("it never writes a number") and the footer privacy line are exactly right.
- The dusk invitation and the design chapter's two orientation plan are the most beautiful frames on the page.
- Day and night are now one design in two lights; the switch changes the first screen.
