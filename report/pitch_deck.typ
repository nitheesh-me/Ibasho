// Pitch deck. Compile from the repo root:
//   typst compile --root . --font-path report/fonts report/pitch_deck.typ deliverables/pitch_deck.pdf
// Fonts and seal come from the studio: Shippori Mincho B1, Zen Kaku Gothic New (Fontsource, OFL), the vermilion seal.

#let ink = rgb("#1d1d1b")
#let paper = rgb("#f7f4ee")
#let muted = rgb("#5b6770")
#let accent = rgb("#BE3A26")
#let tint = rgb("#efd9cf")
#let rule-c = rgb("#d5d0c4")
#let night = rgb("#1a1814")
#let warm = rgb("#e9e1d2")

#set document(title: "Team #124 · Ibasho · Pitch", author: "Team #124")
#set text(font: ("Shippori Mincho B1", "Libertinus Serif"), size: 18pt, fill: ink, lang: "en", region: "gb")
#set par(leading: 0.6em, justify: false)

#let sans(body, ..args) = text(font: "Zen Kaku Gothic New", ..args, body)

#let slide(part: none, dark: false, bg: none, body) = page(
  width: 33.867cm,
  height: 19.05cm,
  margin: (x: 2cm, top: 2.2cm, bottom: 1.8cm),
  fill: if dark { night } else { paper },
  background: bg,
  header: context {
    set text(font: "Zen Kaku Gothic New", size: 9pt, fill: if dark { rgb("#b9b2a4") } else { muted })
    grid(columns: (1fr, auto),
      [#box(baseline: 20%, image("final/img/seal-ibasho.svg", height: 1.1em)) #h(0.3em) Ibasho #h(0.6em) #if part != none { text(fill: if dark { rgb("#e98a72") } else { accent }, part) }],
      [Team \#124 #h(0.8em) #counter(page).display()],
    )
  },
)[
  #set text(fill: if dark { rgb("#efe9dc") } else { ink })
  #body
]

#let statement(body) = text(size: 36pt, body)
#let lede(body) = block(width: 80%, text(size: 21pt, fill: muted, body))

// ───────────── 1. Title ─────────────
#slide(dark: true, bg: image("final/img/poster-lanterns.jpg", width: 100%, height: 100%, fit: "cover"))[
  #place(top + left, dx: -2cm, dy: -2.2cm, rect(width: 33.867cm, height: 19.05cm, stroke: none,
    fill: gradient.linear(night, night.transparentize(15%), night.transparentize(100%), angle: 0deg)))
  #v(0.6cm)
  #image("final/img/seal-ibasho.svg", height: 1.8cm)
  #v(0.2cm)
  #text(size: 68pt, weight: "bold")[Ibasho]
  #v(-0.4cm)
  #text(size: 28pt)[See how a building will live in its city.]
  #v(0.6cm)
  #block(width: 52%, sans(size: 15pt, fill: rgb("#cfc7b6"))[Sun, daylight, energy, carbon, codes and retrofits for any building, from a single desk to a whole city.])
  #v(1fr)
  #sans(size: 11pt, fill: rgb("#b9b2a4"))[Team \#124 · Megathon X · Lloyds problem statement 2]
]

// ───────────── 2. Problem ─────────────
#slide(part: "Problem")[
  #statement[Lloyds asked for a green score for one home. But a home's energy depends on far more than the home.]
  #v(1.2cm)
  #grid(columns: (1fr, 1fr, 1fr), column-gutter: 1.4cm, row-gutter: 0.4cm,
    sans(size: 11pt, fill: accent, weight: "bold")[Neighbours],
    sans(size: 11pt, fill: accent, weight: "bold")[Use],
    sans(size: 11pt, fill: accent, weight: "bold")[Place],
    [A top floor flat in Hyderabad cooks in May. The same flat beside a taller block does not.],
    [On the same floor plate, a lab uses about 1.6 times the energy of an office.],
    [A London terrace and a Gachibowli block need different physics, codes and tariffs.],
  )
]

// ───────────── 3. Problem: the scale ─────────────
#slide(part: "Problem")[
  #statement[Sustainability starts at a desk and grows.]
  #v(2.2cm)
  #let steps = ("Desk", "Room", "Floor", "Building", "Community", "Area", "City")
  #box(width: 100%, height: 3cm)[
    #place(top + left, dy: 0.5cm, line(length: 100%, stroke: 2pt + accent))
    #for (i, s) in steps.enumerate() {
      let x = i * 100% / (steps.len() - 1)
      place(top + left, dx: x - 0.25cm, dy: 0.25cm, circle(radius: 0.25cm, fill: if i == steps.len() - 1 { accent } else { paper }, stroke: 2pt + accent))
      place(top + left, dx: x - 2cm, dy: 1.1cm, box(width: 4cm, align(center, text(size: 22pt, s))))
    }
  ]
  #v(1.4cm)
  #lede[A homeowner, an architect, a campus estates team and a business ask the same question at different scales. A score for one house, cut off from its street, misses most of it.]
]

// ───────────── 4. Approach: the pipeline ─────────────
#slide(part: "Approach")[
  #statement[Published physics, run on a real city, explained in plain words.]
  #v(1.3cm)
  #let st = (
    ([Place], [OpenStreetMap city, hourly weather]),
    ([Building], [storeys, rooms, walls, windows, shades]),
    ([Calculate], [sun, radiation, daylight, energy, codes]),
    ([Evidence], [a range, a source and a method for each number]),
    ([Explain], [the narrator reads results, never computes]),
  )
  #grid(columns: (1fr,) * 5, column-gutter: 0.5cm,
    ..st.map(((h, b)) => block(width: 100%, stroke: (top: 2pt + accent), inset: (top: 0.4cm))[
      #text(size: 22pt, weight: "semibold", h) \
      #sans(size: 11.5pt, fill: muted, b)
    ]))
  #v(1.2cm)
  #grid(columns: (1fr, 1fr, 1fr), column-gutter: 1.2cm,
    [A rough answer in under a second, then refined, then final.],
    [Unknowns, such as a neighbour's height or a wall's insulation, stay as ranges.],
    [A package of measures is recomputed as a whole, never summed.],
  )
]

// ───────────── 5. Approach: what it stands on ─────────────
#slide(part: "Approach")[
  #place(bottom + right, dx: -0.4cm, dy: -0.2cm, rotate(-8deg, image("final/img/seal-proved.svg", height: 2.6cm)))
  #statement[Nothing is invented. Every method is published, and every number can be checked.]
  #v(1cm)
  #grid(columns: (1.05fr, 1fr), column-gutter: 1.6cm,
    {
      set text(size: 17pt)
      table(columns: (auto, 1fr), stroke: (_, y) => (top: 0.5pt + rule-c), inset: (x: 0pt, y: 7pt), column-gutter: 0.8cm,
        sans(size: 11pt, fill: muted)[Sun position], [NREL Solar Position Algorithm],
        sans(size: 11pt, fill: muted)[Sky and radiation], [Perez all weather models],
        sans(size: 11pt, fill: muted)[Building energy], [ISO 13790 hourly model],
        sans(size: 11pt, fill: muted)[UK homes], [SAP 10.2 and RdSAP 10],
        sans(size: 11pt, fill: muted)[Carbon], [UK government 2024 factors],
        sans(size: 11pt, fill: muted)[City and weather], [OpenStreetMap, TMYx, PVGIS],
      )
    },
    [
      #set text(size: 18pt)
      *An independent checker.* A proof checker written in Lean 4 re-derives savings, carbon, bills and ranking for each building result.
      #v(0.5cm)
      *The AI only explains.* A sentence that writes a number of its own is rejected.
      #v(0.5cm)
      *Private.* It runs on your own machine, with no account and no data leaving it.
    ],
  )
]

// ───────────── 6. Solution: the studio ─────────────
#slide(part: "Solution")[
  #grid(columns: (0.9fr, 1.3fr), column-gutter: 1.2cm,
    [
      #statement[A studio for any building, in its real city.]
      #v(0.8cm)
      #text(size: 18pt, fill: muted)[Pick a place, pick or draw a building and set it among its real neighbours. See its sun and shade, daylight, energy by end use, bills, carbon, code standing and green rating path, then compare changes.]
      #v(0.6cm)
      #sans(size: 11pt, fill: muted)[Eight building types · Hyderabad and London]
    ],
    align(horizon, image("final/img/poster-sun.jpg", width: 100%)),
  )
]

// ───────────── 7. Solution: both sides ─────────────
#slide(part: "Solution")[
  #statement[It works for buildings that stand, and for buildings still on paper.]
  #v(1.2cm)
  #grid(columns: (1fr, 1fr), column-gutter: 2cm,
    [
      #sans(size: 11pt, fill: accent, weight: "bold")[Existing buildings]
      #v(0.2cm)
      Which retrofits suit it, in what order, what each saves in electricity and gas, and what it does to carbon and value.
    ],
    [
      #sans(size: 11pt, fill: accent, weight: "bold")[Before you build]
      #v(0.2cm)
      Draw it, place it on a real plot and see its sun, daylight, energy and code standing while a change still costs almost nothing.
    ],
  )
]

// ───────────── 8. Solution: what you can do ─────────────
#slide(part: "Solution")[
  #statement[What you can do with it today]
  #v(0.9cm)
  #let f = (
    ([Find anything by name], [places, buildings, floors and rooms]),
    ([See it in its city], [Hyderabad and London, real neighbours]),
    ([Sun and shadow], [any day, any hour, who shades whom]),
    ([Daylight and radiation], [floor by floor, wall by wall]),
    ([Energy, bills and carbon], [split by end use, in local tariffs]),
    ([Codes and green ratings], [what it meets and what it is short of]),
    ([What if, side by side], [glazing, shading and solar compared]),
    ([Design before you build], [brief, plan editor, place on a plot]),
    ([Green Home Score], [ranked homes, retrofits, savings, value]),
    ([A narrator that explains], [plain words, every number sourced]),
    ([Come back any time], [revisit, branch, update, see what changed]),
    ([Works with AI agents], [an MCP link for Claude Code and others]),
  )
  #grid(columns: (1fr, 1fr, 1fr), column-gutter: 1.1cm, row-gutter: 0.55cm,
    ..f.map(((h, b)) => block(stroke: (top: 0.6pt + rule-c), inset: (top: 0.25cm), width: 100%)[
      #text(size: 17pt, weight: "semibold", h) \
      #sans(size: 10.5pt, fill: muted, b)
    ]))
]

// ───────────── 11. Results: buildings ─────────────
#slide(part: "Results")[
  #statement[Modelled buildings land inside their published benchmark ranges.]
  #v(1cm)
  #let rows = (
    ("Vindhya Bhavan, labs", 182, 231, 150, 400, "CBECS lab"),
    ("Himalaya, teaching", 110, 140, 95, 240, "CBECS education"),
    ("HITEC City office", 130, 166, 110, 230, "BEE office"),
    ("Gachibowli flats", 35, 45, 25, 80, "Eco Niwas"),
  )
  #let W = 17cm
  #let k = W / 400
  #grid(columns: (7cm, W, auto), column-gutter: 0.6cm, row-gutter: 0.45cm, align: horizon,
    ..rows.map(((n, a, b, lo, hi, src)) => (
      text(size: 17pt, n),
      box(width: W, height: 0.9cm)[
        #place(rect(width: W, height: 0.9cm, fill: rgb("#efebe2"), stroke: none))
        #place(dx: lo * k, rect(width: (hi - lo) * k, height: 0.9cm, fill: tint, stroke: none))
        #place(dx: a * k, dy: 0.2cm, rect(width: calc.max((b - a) * k, 3pt), height: 0.5cm, fill: accent, stroke: none))
      ],
      sans(size: 10.5pt, fill: muted)[#a to #b, #src #lo to #hi],
    )).flatten(),
    [], box(width: W, height: 0.6cm)[
      #for t in (0, 100, 200, 300, 400) {
        place(dx: t * k - 0.6cm, box(width: 1.2cm, align(center, sans(size: 9.5pt, fill: muted, str(t)))))
      }
    ], [],
  )
  #v(0.5cm)
  #sans(size: 10.5pt, fill: muted)[kWh per m² a year. Dark bar: the modelled range. Pale band: the published benchmark. Sun position matches the NREL reference to within 0.00001 degrees.]
]

// ───────────── 12. Next ─────────────
#slide(part: "Next")[
  #statement[From a working studio to real homes and whole communities.]
  #v(0.9cm)
  #grid(columns: (1fr, 1fr, 1fr), column-gutter: 1.1cm,
    ..(("final/img/homes-portfolio-1280.jpg", [Real homes], [Test the home model on real EPC records and meter data.]),
       ("final/img/prove.jpg", [Full models in the studio], [Switch the full site, energy and code models on in every view.]),
       ("final/img/next-london.jpg", [Grow the ladder], [More cities, more building types, whole neighbourhoods.])).map(((img, h, b)) => [
      #box(width: 100%, height: 4.2cm, clip: true, stroke: 0.5pt + rule-c, image(img, width: 100%, height: 4.2cm, fit: "cover"))
      #v(0.35cm)
      #text(size: 19pt, weight: "bold", fill: accent, h)
      #v(-0.2cm)
      #text(size: 16pt, b)
    ]))
]

// ───────────── 13. Close ─────────────
#slide(dark: true, bg: image("final/img/poster-hero.jpg", width: 100%, height: 100%, fit: "cover"))[
  #place(top + left, dx: -2cm, dy: -2.2cm, rect(width: 33.867cm, height: 19.05cm, stroke: none, fill: night.transparentize(18%)))
  #v(1fr)
  #align(center)[
    #image("final/img/seal-proved.svg", height: 2.4cm)
    #v(0.2cm)
    #text(size: 72pt, weight: "bold")[Ibasho]
    #v(-0.3cm)
    #text(size: 28pt)[A better place to be, from a desk to a city.]
    #v(0.6cm)
    #sans(size: 11pt, fill: rgb("#b9b2a4"))[Team \#124]
  ]
  #v(1fr)
]
