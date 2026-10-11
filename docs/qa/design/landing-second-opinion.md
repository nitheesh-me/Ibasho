# Landing page: independent second-opinion critique

A second reviewer from a different model family looked at the fold screenshots in `docs/qa/ux/V-P/landing/`. Read alongside `landing-V-P.md`.

### What Works

* **Distinctive, poetic editorial voice**: The copy (*"See how a building will live in its city"*, *"Every number opens to show where it came from"*) immediately breaks away from generic B2B SaaS tropes and establishes an intimate, considered architectural point of view.
* **Compelling isometric concept**: The wireframe building with dotted fenestration, solar path arc, and hatched shadow projection (*"Your building in ink among paper neighbours"*) provides a grounded, evocative metaphor for building simulation.
* **Cultural and geographic grounding**: Anchoring the brand in Hyderabad and London with Vindhya Bhavan as a concrete case study avoids the Silicon Valley abstraction trap and gives Ibasho authentic weight.

---

### What Looks Unfinished, Generic, or Broken

* **Colour & Theme (Day Mode is broken or missing)**: Despite the core concept being *"ink on paper by day, lantern by night"*, Day mode (`fold-1280-day.png`) is rendered on the same dark charcoal background as Night mode; the toggle simply swaps the button label between "Night" and "Day" without rendering an actual warm paper/washi canvas.
* **Colour & Lighting (Flat OLED, not "Lantern")**: Night mode lacks true Japanese lantern illumination (*chōchin / andon*); it is an ordinary dark UI with a blurred yellow circular radial gradient acting as a sun dot, rather than architectural light bleeding through screens, apertures, or layered surfaces.
* **Imagery (Missing product proof & simulation reality)**: The isometric graphic is purely decorative. For a studio that promises sun, shade, energy, bills, carbon, and green codes, there are zero environmental data readouts, radiation scales, daylight factor contours, or local climate indicators.
* **Hierarchy & Composition (Void masquerading as *Ma*)**: On large desktop (`fold-1600-day.png`), the layout devolves into an unanchored left text block and an isolated right graphic floating in vast darkness; Japanese spatial *ma* is charged, deliberate negative space, not accidental CSS flexbox margin gaps.
* **Typography (Editorial fatigue and missing architectural rigor)**: The heavy high-contrast serif is used for headline, subhead, and multiple body paragraphs, creating visual heaviness; the Japanese Kanji eyebrow (`居場所`) is timid and tiny, while there is zero technical/monospace typography to convey data precision and engineering credibility.
* **UI Craft (Generic SaaS button and raw hyperlink)**: The primary CTA (`Open the studio`) is a blocky mustard-yellow rectangle straight out of a starter template, clashing with the delicate wireframe lines; the secondary link (`Or walk through Vindhya Bhavan`) uses a default browser underline that looks like an unfinished wireframe placeholder.
* **Responsiveness (Critical mobile & tablet fold cutoff)**: At 360px (`fold-360-day.png`) and 768px (`fold-768-day.png`), the visual centerpiece is severely amputated or pushed entirely below the fold,a mobile visitor sees only a wall of text and an ambiguous glowing yellow dot at the bottom edge.

---

### 5 Highest-Impact Concrete Changes

1. **Actually implement "Ink on Paper" for Day Mode**: Build a genuine day theme using a textured warm ecru/washi paper base (`#F4F1EA`), rich sumi ink linework (`#1B1A18`), vermilion/cinnabar hanko accents, and crisp architectural drafting lines so the Day/Night toggle delivers on its signature brand promise.
2. **Turn the illustration into a live spatial instrument**: Embed architectural HUD elements directly into the isometric scene,a Hyderabad/London toggle, a solar time-of-day slider, solar altitude/azimuth readouts, and a live heat/carbon tag,proving instantly that Ibasho is a high-precision studio rather than an art portfolio.
3. **Restructure mobile and tablet hierarchy**: On viewports ≤768px, pull the sun diagram up into the viewport (either above the fold as a compact hero header or directly flanking a tightened 2-line headline) so mobile users immediately see the spatial model before the fold.
4. **Elevate CTA and specimen links into crafted architectural controls**: Replace the solid yellow rectangle with a refined, tactile control (hairline sumi border, delicate washi fill, or subtle lantern glow on hover) and turn *"Vindhya Bhavan, Hyderabad"* into an interactive architectural specimen card with coordinates and climate zone tag.
5. **Establish a dual Serif + Precision Monospace type system**: Keep the serif strictly for the brand marque and headline, but introduce an architectural monospace / technical sans for the Kanji eyebrow, body metadata, city coordinates, and simulation stats to balance poetic calm with engineering rigor.
