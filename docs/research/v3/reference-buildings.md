# Reference buildings: IIIT Hyderabad, coworking towers, phototropic massing

Brief RB (v3). Owner request: Hyderabad focus, more building types, floors and rooms, 3D city context for shadows and sun. This brief turns two real campus drawings into fixture descriptions, adds three coworking towers and the campus neighbourhood for a city scene, and proposes how Ibasho can take the phototropic housing idea further.

Status words used below: **read** (taken from the drawing text), **measured** (scaled from the drawing or OSM geometry, plus or minus 10%), **assumed** (a stated default, to be replaced), **unknown** (keep as unknown in the model, never zero).

## 1. Sources and what they are

| Source | What it is | Local copy |
|---|---|---|
| Vindhya Bhavan floor plans, IIIT Hyderabad estate office, Dec 2022 | 4 page A3 vector CAD export (iLovePDF), real text layer, not a scan. Cellar, first, second, third floor plans. North arrow on every sheet. Room names, sizes in feet and inches, areas in sq ft. | `docs/research/v3/sources/Vindhya_bhavan.pdf` from https://intranet.iiit.ac.in/offices/static/files/Vindhya_bhavan.pdf |
| Himalaya Building floor plans, same office, Dec 2022 | 7 page A3 vector CAD export. Basement, first to sixth floor plans, four blocks (Vrithi, Shodh, Bodh, Block D). Sizes mostly in metres, level datums (+99.00 to +118.50). | `docs/research/v3/sources/Himalaya_Building.pdf` from https://intranet.iiit.ac.in/offices/static/files/Himalaya_Building.pdf |
| OpenStreetMap | Building footprints, levels, names for campus and towers (ODbL). Vindhya is relation 2829427 (4 courtyards as inner rings). | https://www.openstreetmap.org/relation/2829427 |
| WeWork India location pages and listing sites | Addresses, floor counts (conflicting), floor plates | links in section 4 |
| APRILLI, Phototropic Housing | ZNE multi housing competition entry, San Francisco | https://www.aprilli.com/sustainability/phototropic-housing-gbbcb |

Tools used: `pdfinfo`, `pdfimages -list` (only tiny logo images, so the plans are vectors), `pdftotext -raw`, `pdftoppm -r 60` for viewing, Overpass API (maps.mail.ru mirror) and the OSM 0.6 API for geometry. Scale on the drawings was calibrated against labelled rooms (Vindhya A7 classroom 32'3" x 42'9"; Himalaya 230 seat hall 65'2" x 65'8") and cross checked with OSM.

**Licensing note.** The PDFs are on IIIT's intranet host but fetched without login. Treat them as reference only: derive simplified massing and room schedules, do not ship the PDFs or occupant names in the app. Faculty names appear on the plans; fixtures must use room functions, not names.

## 2. Campus location and orientation

| Item | Value | Status |
|---|---|---|
| IIIT Hyderabad campus centroid | 17.4453 N, 78.3490 E (OSM way 31355320, 31.7 ha) | read |
| Address | Prof. C R Rao Road, Gachibowli, Hyderabad 500032 | read |
| Elevation | about 540 to 560 m above sea level (Deccan plateau, granite outcrops). Himalaya drawing datum +99.00 is a local site datum, not sea level | assumed |
| Campus grid rotation | building long axes run at bearing 130/310 deg and 40/220 deg. Plans are drawn with true north pointing to the lower right at about 45 deg | measured (OSM and north arrows agree) |
| Climate (ECBC 2017 zone) | Composite (Hyderabad). Cooling dominated, monsoon June to September | read, ECBC climate map |
| Sun | latitude 17.45 N. Noon sun altitude: 21 Dec 49 deg (south), equinox 72.5 deg, 21 Jun 96 deg (6 deg north of zenith). North facades get direct sun on summer mornings and evenings | computed |
| Code context | Telangana made ECBC mandatory in 2014, first in India with Andhra Pradesh. https://www.nrdc.org/bio/sameer-kwatra/hyderabad-goes-hi-tech-building-energy-codes | read |

Implication for the engine: every orientation in a Hyderabad fixture should be stored as a true bearing of the facade normal, not "front/back". With the campus grid at 40/130/220/310, Vindhya and Himalaya have **no facade facing a cardinal direction**; each long facade takes a diagonal mix of morning or afternoon sun. That is a good teaching case for the site analysis features (sun hours, ASE).

## 3. Reference building A: Vindhya Bhavan (academic research block, "education" plus "lab" plus "office")

### 3.1 Massing

| Property | Value | Status |
|---|---|---|
| Type | Academic: research centres, labs, classrooms, library, data centre, offices, bank | read |
| Form | Rectangular ring of wings with a central spine. Two long bars (A row, C row) joined by end links (B2, B6) and a central spine (A4 to C4). Three pavilions (B3, B4, B5) sit on cross corridors. Four courtyards between them | read (plans), measured (OSM inner rings) |
| Footprint envelope | 165 m x 81 m oriented box (OSM outer ring). Drawing scale gives about 145 m x 72 m for the built edge without steps and canopies | measured |
| Courtyards | 4 open courts: 2 of about 47 x 14 m, 2 of about 41 x 10 m (OSM inner rings 211070667, 675, 676, 677) | measured |
| Gross footprint (outer minus courts) | about 9,100 m2 incl. open walkways; labelled wing areas on the first floor sum to 54,956 sq ft = 5,106 m2 net of corridors | measured / read |
| Long axis bearing | 130/310 deg. A row facades face about 220 deg (SW, afternoon sun); C row facades face about 40 deg (NE, morning sun); end wings A1/C1 face about 130 deg (SE) and A7/C7 about 310 deg (NW) | measured |
| Storeys | Cellar (partial, under C4 and C5) + 3 floors labelled first, second, third. OSM building:levels = 3. The "first floor" sheet holds MAIN ENTRANCE and SECURITY, so it is the entry level | read |
| Floor to floor | unknown. Use 3.9 m (assumed, typical for this campus; Himalaya measures 3.85 m) | assumed |
| Wing geometry | Pavilions with chamfered (octagonal) corners, about 10.7 to 13.3 m deep (35'1" and 43'8" room depths read). Corridors: central spine 15'0" (4.6 m), cross corridors 10'0" (3.0 m), local 5'6" to 6'6" | read |
| Cores | 4 lifts (A4, A6, B4/C4, A2), 4 or more stairs at the wing junctions (A2, A6, C2, C6 and the C4 grand stair) | read |
| Windows | Tags W1, W2, W3 (windows), V1, V2, V3 (ventilators), V/W combined units. Counts per floor (text tags): first W1 36, W2 90, V2 20; second W1 51, W2 105, V2 40; third W1 44, W2 87, V2 68. No window schedule in the PDF, so sizes are unknown. Default W1 1.5 x 1.5 m, W2 1.2 x 1.5 m, V 0.6 x 0.45 m | read (counts), assumed (sizes) |
| Shading | Not drawn. Wing ends are chamfered; external shading unknown | unknown |
| Plant | Data centre on first floor A1 with 3 precision AC units (PAC1 to PAC3), 120 kVA and 4 x 30 kVA UPS, battery banks; AHU rooms on each floor (11'3" x 8'8"); chiller, generator and sump on the C side at cellar level | read |

### 3.2 Storey by storey

Area figures are the sq ft labels on the plans (1 sq ft = 0.0929 m2). Room counts are approximate.

**Cellar (partial, under C4 and C5, sloping site).** Civil engineering teaching labs and the estate office.

| Zone | Function | Size read | Ibasho room type |
|---|---|---|---|
| C4 cellar | Estate engineers' offices (E.E., Dy.E.E., J.E., A.E.E.), common circulation 42' x 13'6", electrical store 19'3" x 14'0", grand staircase, UPS, toilets | about 3,000 sq ft | office, circulation, store |
| C5 cellar west | Transportation lab 23'6" x 29'3", SM (soil mechanics) lab 25'9" x 20', survey lab 8'9" x 19'3", construction materials store, building materials lab 37'9" x 19'3" | about 3,400 sq ft | lab (wet/heavy) |
| C5 cellar east | Civil and mechanical workshop 50'3" x 20'7", hydraulics lab 59'3" x 19'3", junction box gallery 59'3" x 7'11" | about 3,500 sq ft | workshop, lab |
| Spine | Passage 9'0" wide between the two lab rows | | corridor |

**First floor (entry, rooms 1xx).**

| Wing | Area | Functions |
|---|---|---|
| A1 | 1,363 sq ft | Data centre: 28 server racks, precision AC, 120 kVA UPS, MUX and UPS room |
| A3 | 6,687 sq ft | C-STAR incubator: CEO and chairman cabins, 18 workstations, conference 32'6" x 28'0", lunch area, pantry, library, server room |
| A4 | 1,376 sq ft | Lift, stair, toilets, AHU |
| A5 | 5,788 sq ft | IIIT library: reading halls 65'0" x 19'6" (79 seats) and 48'0" x 15'6" (48 seats), librarian |
| A7 | 1,365 sq ft | Students' work space |
| B2 | about 2,700 sq ft | Server staff room, structural engineering research scholars lab, M.Tech case lab |
| B3 | 3,669 sq ft | TTO outreach, DST Prayas Shala makers lab |
| B4 | 1,316 sq ft | Anasaraka lab |
| B5 | 4,422 sq ft | Cognitive science lab, biometrics and security identity lab |
| B6 | 4,636 sq ft | Students' work space (43 and 44 desks plus discussion areas) |
| C1 | 2,047 sq ft | EERC earthquake engineering: H and V shake tables, material testing lab 35'1" x 59'1", UTM, compression testing |
| C3 | 8,480 sq ft | CIE (innovation and entrepreneurship): startup cabins, 7 to 19 seat work areas, conference |
| C4 | 3,385 sq ft | Main stair hall, security, entrance steps |
| C5 | 8,277 sq ft | CIE: open studio with curved pods, video conference, pantry |
| C7 | 2,145 sq ft | SBI bank branch and ATM |

**Second floor (rooms 2xx).**

| Wing | Functions |
|---|---|
| A1 | LSI lab |
| A3 | SPCRC (signal processing): workstations 8 to 19, meeting 16'6" x 19'5", admin, record room |
| A5 | Library upper level |
| A7 | CR-1 classroom 32'3" x 42'9" (1,365 sq ft) |
| B2 | Power research centre, building science lab |
| B3 | I-HUB |
| B4 | Applied lab |
| B5 | Virtual labs, conference (seating 17) |
| B6 | Students' work space, teaching labs 1 and 2 (50 and 59 seats, collapsible acoustic partition, 109 combined), teaching lab 105 seats |
| C1 | Seminar hall II (36 to 54 seats) |
| C3, C5 | CIE; Centre for IT in Building Science (CBS), Advanced Lighting Lab, CVIT applied lab, PhD and MS labs, faculty cabins about 10' x 10' |
| C7 | Teaching lab (90 seats) |

**Third floor (rooms 3xx).**

| Wing | Functions |
|---|---|
| A1, A3, B2 | CCNSB (computational natural sciences and bioinformatics): faculty cabins, labs, science lab with fume hood, dry lab |
| A5 | CSG, CVEST (VLSI and embedded systems) |
| A7 | CEH (exact humanities) |
| B3, B5, B6 | Robotics labs |
| C1 | Auditorium 35'0" x 34'3" with stepped seating, ISWOC lab 35'0" x 18'0" |
| C3 | CEH faculty cabins, labs, audio recording studio |
| C4, C5 | CIE classrooms (2 rooms 1 to 4 and 5 to 8 desks layout), plotter and scanning room, conference rooms |
| C7 | Seminar hall I (fan shaped) |

### 3.3 Fixture sketch (Vindhya)

```yaml
id: in-hyd-iiith-vindhya
type: education.research   # mixed: lab, office, classroom, library, data centre
location: { lat: 17.4458, lon: 78.3498, climate: ecbc-composite, epw: IND_TS_Hyderabad }
north_rotation_deg: 310        # plan "right" points to bearing 310 (NW)
storeys:
  - { id: cellar, level_m: -3.9, height_m: 3.9, footprint: [C4, C5], ground_contact: partial }
  - { id: L1, level_m: 0.0, height_m: 3.9, entry: true }
  - { id: L2, level_m: 3.9, height_m: 3.9 }
  - { id: L3, level_m: 7.8, height_m: 3.9, roof: flat }   # roof type unknown
wings: # chamfered rectangles, depth about 11 to 13 m
  A1: { area_sqft: 1363, uses: [data_centre, lab, lab] }   # L1, L2, L3
  A3: { area_sqft: 6687, uses: [office.incubator, lab, lab] }
  A5: { area_sqft: 5788, uses: [library, library, lab] }
  C1: { area_sqft: 2047, uses: [lab.heavy, assembly.seminar, assembly.auditorium] }
  C5: { area_sqft: 8277, uses: [office.cowork, lab, classroom] }
  # ... remaining wings from the tables above
courtyards: 4
window_tags: { W1: unknown_size, W2: unknown_size, V2: unknown_size }
special_loads: { data_centre_ups_kva: 120, precision_ac_units: 3 }
```

## 4. Reference building B: Himalaya Building (academic, lecture halls, admin, research, incubator)

### 4.1 Massing

Four blocks in a row, linked by bridges and a central corridor, with stepped heights. Plan width (Vrithi to Block D) about 158 m at the scale of the second floor sheet (0.172 m per pixel at 60 dpi, calibrated on the 65'2" square hall and on 9.80 m lecture hall widths).

| Block | Plan size (measured) | Storeys above entry | Basement | Character |
|---|---|---|---|---|
| Vrithi | about 19 x 23 m | 3 (roof terrace above third) | yes | Administration: registrar, accounts, HR, examinations, dean, director |
| Shodh | about 44 x 44 m, four wings round a courtyard (courtyard about 13.6 x 13.3 m, "courtyard below" and "void" on upper floors), bow fronted ends | 4 (terrace above fourth) | yes (sunken, with curved landscape retaining wall) | Faculty and research centres (LTRC, CVIT, MLL, DSAC, Cog Sci), auditorium |
| Bodh | about 46 x 45 m, lecture halls either side of a spiral stair drum, fan shaped 230 seat halls (65'2" x 65'8") | 3 (terrace above third) | no | Teaching: 12 lecture halls, 10 classrooms, 2 tiered halls |
| Block D | about 26 x 37 m | 6 (OSM building:levels 6, way 211078709) | no | Incubator and faculty: reception, accelerators (44 and 48 seats), phone booths, café, slide between floors, cut outs, faculty cabins, HVI lab |

| Property | Value | Status |
|---|---|---|
| OSM | "Himalaya Academic Block" way 187896823 (1,592 m2, 3 levels); "D Block" way 211078709 (1,242 m2, 6 levels) | read |
| Orientation | North arrow to the lower right at about 45 deg, same as Vindhya. Long axis roughly 130/310 deg | measured |
| Level datums | Block D entry +99.30 (ramp 1:10 from +99.00), +100.60, +102.00, +102.90, +103.42, +103.58 on the second floor, +110.85 m on the fourth floor, +118.50 m labelled "fifth floor level" on the sixth floor sheet. Implied floor to floor about 3.85 m; the 118.50 label does not fit a uniform stack (mezzanine or label error) | read, inconsistency flagged |
| Lecture halls | LH 1 to 12: six at 9.80 x 8.80 m (86.24 m2) and six at 9.80 x 13.20 m (129.32 m2), two per level per side, "2' wide passage" between stepped rows; screens 8'0", boards 12' | read |
| Classrooms | 101 to 105, 201 to 205, 301 to 304: 32'0" x 28'7" (915 sq ft, 64 chairs) and 32'0" x 43'4" (1,387 sq ft, 105 chairs); 230 and 232 seat tiered halls 4,126 sq ft spanning two levels | read |
| Faculty cabins | Shodh: about 4.50 x 2.86 m (12.6 to 13.2 m2), F10 to F41. Block D: 3.22 x 5.77 m (18.6 m2) and variants | read |
| Toilets | Per floor in each block; WC cubicles 1050 x 1500 mm; ladies and gents wash rooms about 3.0 x 3.6 and 2.8 x 4.4 m; accessible toilet 1810 x 2610 mm | read |
| Windows | Tags W1, W2, W3, mostly on Bodh lecture halls (W1/W3 alternating, 6 per hall side). Block D lists internal glazing panels (for example "2nos x 87in glass", 35in glass doors) but no external schedule | read (tags), unknown (sizes) |
| Central plant (first floor yard) | Chillers 1 x 100 TR + 2 x 150 TR (400 TR total, about 1.4 MW cooling), primary, secondary and condenser pumps, 2 cooling towers 3 x 3 x 3.6 m, 1,000 kVA transformer, 2 x 500 kVA DG sets, 2,000 A copper bus duct, underground sump 150,000 litres (15 x 5 x 2 m) | read |

The plant list is unusually valuable: it gives a real installed cooling capacity for a known floor area. A rough check: Himalaya gross area is in the order of 15,000 to 20,000 m2 (four blocks, 3 to 6 storeys), so 400 TR is about 70 to 90 W/m2 of installed cooling, or 190 to 250 sq ft per TR, which is typical for Indian institutional buildings. Ibasho can use this as a plausibility gate, not as an input.

### 4.2 Storey by storey

| Storey (sheet name) | Vrithi | Shodh | Bodh | Block D |
|---|---|---|---|---|
| Basement | Diversity admission office 4.18 x 4.18, grading hall and sorting room 4.32 x 8.68 (10 staff each), conference 4.4 x 4.4, staff 14, front desk, UPS, electrical | VIP lounge 8.71 x 9.53, faculty and staff dining 8.71 x 11.06 with serving counters, pantry 4.23 x 3.53, CVIT experimental labs 1 to 3 (8.71 x 4.27, 5.64 x 4.27), exam and academic stores, corridors 4.5 m | none | none |
| First (entry) | Dean academics, examination cell, strong room, OMR and ID cards, academics staff 6.86 x 4.46, manager cabins | Faculty lounge and dining 8.70 x 13.20, faculty meeting hall 8.7 x 13.1 (60 pax), board room 4.4 x 5.7 (12 pax), chairperson 4.2 x 6.8, CEO room, exhibition hall 6.48 x 4.34, two open to sky courts 13'9" square | LH 1, 2, 7, 8; classrooms 101 to 105; lower tier of 230 seat hall; spiral stair drum | Reception 8.75 x 4.2, mentor lounge 4.6 x 5.0, lobby, 84 seat hall (55in LED, 106in screen), AHU 4.6 x 8.8 |
| Second | Registrar, accounts staff 7.61 x 8.9, HR, admin cabin, network room, stores | Four wings round the courtyard void: faculty cabins F10 to F13, LTRC, large meeting room (20 pax), conference rooms | LH 3, 4, 9, 10; classrooms 201 to 205; 232 seat hall | Accelerators (48 seats), outdoor work space, meeting rooms, phone booth, locker, slide, cut outs |
| Third | Admin block: director cabin 4.4 x 5.54, conference 4.4 x 7.57, outreach office, PA, communication cell, pantry | CVIT and MLL wings, faculty F14 to F29, director discussion room 13.63 x 13.23 | LH 5, 6, 11, 12; classrooms 301 to 304 | Café and pantry counter, accelerators (44 seats), lab, phone booth |
| Fourth | terrace | Cog Sci auditorium 17.70 x 8.70 (stepped), DSAC, open classroom, faculty F30 to F41 (3.31 x 4.50) | terrace | Faculty cabins 1 to 10 (3.22 x 5.77), PhD rooms 6.54 x 5.70, conference 4.43 x 3.77, cafeteria with stepped seating, mezzanine above |
| Fifth | | terrace | | Faculty cabins 1 to 10, HVI lab 4.34 x 7.19, conference 3.96 x 8.78 (cut out above), PhD work stations |
| Sixth | | | | Faculty cabins 1 to 11, PhD labs 25.97 and 39.73 m2, faculty conference, network room |

### 4.3 Why these two are good fixtures

- **Vindhya** is a courtyard building with shallow wings: almost every room has a window, so daylight (sDA) and solar gain (ASE) per wing will vary sharply with the 40/130/220/310 facade bearings. It mixes very different loads: a data centre (24/7, 120 kVA UPS), wet labs, a library, a bank, classrooms and incubator offices. That is an honest test for end use breakdown and ECBC mixed use rules.
- **Himalaya** has stepped heights (3, 4, 3, 6 storeys) so blocks shade each other and the terraces: perfect for the "place it in a city, test shadows" demand. It has dense, scheduled occupancy (12 lecture halls, two 230 seat halls) that stresses ventilation and cooling peaks, plus a measured central plant to sanity check results.
- Both are on the same campus grid, so one site model serves both, with real neighbours (section 5).
- IIIT Hyderabad hosts the **Centre for IT in Building Science** (CBS, in Vindhya, second floor) and its Advanced Lighting Lab: https://cbs.iiit.ac.in . A natural audience and a source of validation data (they run ECBC and LEED simulation work and cool roof monitoring).

## 5. 3D city context: IIIT campus and neighbours

Campus centroid 17.4453 N, 78.3490 E. Suggested scene tile: 17.440 to 17.450 N, 78.343 to 78.355 E (about 1.1 x 1.3 km). Footprints from OSM; heights where OSM has `building:levels` (3.5 m per level assumed for residential, 3.9 m academic), else assumed.

| Building (OSM id) | Centre | Footprint m2 | Levels | Use | Height used |
|---|---|---|---|---|---|
| Vindhya, relation 2829427 | 17.4458, 78.3498 | 11,263 outer minus 4 courts | 3 + cellar | academic | 11.7 m assumed |
| Himalaya Academic Block, way 187896823 | 17.4454, 78.3491 | 1,592 (part only) | 3 | academic | 11.7 m |
| D Block (Himalaya), way 211078709 | 17.4457, 78.3488 | 1,242 | 6 | academic, incubator | 23.1 m |
| Academic Office, way 1173384711 | 17.4450, 78.3499 | 635 | 5 | admin | 19.5 m |
| Ananda Nivas, way 187896590 | 17.4440, 78.3485 | 1,012 | 6 | residential | 21 m |
| Buddha Nivas, way 227239535 | 17.4433, 78.3485 | 1,006 | 6 | residential | 21 m |
| Blocks C, D, E residential, ways 1378100098 to 100 | 17.4433 to 17.4443, 78.3478 | 1,010 to 1,245 | 6 | residential | 21 m |
| Kadamba Nivas (hostel), way 412935829 | 17.4472, 78.3476 | 3,226 | 4 | dormitory | 14 m |
| Parijaat Nivas, ways 639403214 to 216 | 17.4470 to 17.4476, 78.3469 to 78.3474 | 346 to 441 each | 4 | dormitory | 14 m |
| Bakul Nivas, way 639403217 | 17.4482, 78.3485 | 1,677 | 5 | dormitory | 17.5 m |
| Palash mess, way 96346275 | 17.4448, 78.3457 | 603 | unknown | dining | 6 m assumed |
| New building under construction, way 1549736302 | 17.4462, 78.3481 | 3,269 | unknown | construction | unknown |
| GMC Balayogi athletic stadium, way 116087827 | 17.4462, 78.3441 | 18,998 | stadium | sports | 15 m assumed (stands) |
| GMC Balayogi SATS indoor stadium, way 211070668 | 17.4481, 78.3452 | 6,288 | unknown | sports | 20 m assumed |
| Ellaa Hotel, way 342258075 | 17.4420, 78.3444 | 2,911 | unknown | hotel | unknown |
| DLF Cyber City Gachibowli, way 413274269 | 17.4477, 78.3554 | 30,843 (site) | unknown | IT offices, towers | about 60 m (towers), assumed |
| PSR Prime Towers, way 477923815 | 17.4471, 78.3541 | 1,962 | unknown | office | unknown |
| Large unnamed offices, ways 356021378, 356021380, 1428328638 | 17.447, 78.352 to 78.354 | 4,000 to 6,600 | unknown | office | unknown |
| Indian School of Business, way 159299915 | 17.4319, 78.3385 | campus 104 ha | | education | context only |
| University of Hyderabad, way 277804473 | 17.452, 78.327 | campus 897 ha | | education | context only |

Real tall neighbours for shadow tests a little further out: Phoenix Centaurus (way 1235249271, 17.4265, 78.3404, 23 levels, height 90 m tagged) and T6 Phoenix 285 (relation 17826513, 18 levels, 64 m tagged) in the Financial District.

**Gaps.** Many OSM buildings near campus have no levels or heights. Rule: an unknown height is drawn as a hatched ghost volume and is excluded from shadow results with a visible "unknown neighbour" flag, rather than assumed zero (which would overstate sun) or a default (which would invent shade). Optional fill: Google Open Buildings 2.5D (temporal heights for India, CC BY 4.0) at https://sites.research.google/gr/open-buildings/ ; use as "estimated" with its own provenance tag.

## 6. Coworking reference buildings in Hyderabad (office type)

WeWork lists five Hyderabad centres: Rajapushpa Summit, Phoenix H10, Krishe Emerald, RMZ Spire, Raheja Mindspace Building 9 (https://wework.co.in/hyderabad/). Three are profiled below. Floor counts conflict across listing sites, so every figure has a status.

| | Krishe Emerald (WeWork) | Rajapushpa Summit (WeWork) | RMZ Spire (WeWork) |
|---|---|---|---|
| Address | Kondapur Main Road, Laxmi Cyber City, Whitefields, Kondapur, HITEC City 500081 | Nanakramguda, Financial District 500032 | Silpa Gram Craft Village area, HITEC City (plus code C9MM+5QX); "RMZ Spire Tower 110" |
| Coordinates | 17.4580 N, 78.3683 E (OSM way 776432080, "Wework Krishe Emerald") | unknown in OSM; Financial District, about 17.41 to 17.42 N, 78.34 E | unknown in OSM; HITEC City, about 17.45 N, 78.38 E |
| Footprint | OSM polygon 1,633 m2, oriented box 59 x 37 m, long axis bearing 23/203 deg (long facades face about 113 deg ESE and 293 deg WNW) | floor plate 45,454 sq ft (4,220 m2) per myHQ | WeWork floor plate about 20,000 sq ft (1,860 m2) per myHQ; whole campus 2 blocks |
| Storeys | 15 in OSM and on WeWork's page; listings also say 10 or 7 floors for the WeWork part | 3 basements + ground + 11 (myHQ); WeWork part 1 or 2 floors | listings say 2 blocks, 39 floors (unverified); WeWork about 5 floors, about 2,943 seats |
| Height | about 15 x 3.9 = 58 m assumed | about 12 x 4.0 = 48 m assumed | about 160 m if 39 floors, assumed and unverified |
| Facade | Glass curtain wall, typical HITEC City Grade A (from listing photos); WWR and glass spec unknown | "ultra modern" A grade tower, curtain wall assumed | Curtain wall, high rise; spec unknown |
| WeWork seats | not given | about 900 to 1,484 (conflicting) | about 2,943 |
| Sources | https://www.openstreetmap.org/way/776432080 , https://myhq.in/managed-office/wework-hiteccity , https://www.office-hub.com/in/properties/krishe-emerald-kondapur-main-road-laxmi-cyber-city-whitefields-kondapur-hyderabad-a0v3m00000Oq3z5AAB | https://wework.co.in/hyderabad/financial-district/rajapushpa-summit/ , https://myhq.in/office-space-for-rent/rajapushpa-summit-financialdistrict | https://myhq.in/managed-office/wework-rmz-spire-hiteccity , https://therealtytoday.com/news/sanofi-signs-lease-for-2-7-lakh-sq-ft-office-space-in-hyderabad-at-2-crore-rent |

Useful generic office fixture derived from these: a HITEC City Grade A tower, 4,000 m2 floor plate, 3 basements of parking, 12 to 15 office floors at 3.9 to 4.2 m, central core, all glass curtain wall (assume WWR 60 to 70% until measured), coworking density about 6 to 7 m2 per seat (WeWork figures above give 20,000 sq ft per floor and about 600 seats per floor at RMZ Spire, about 3.1 m2 per seat net, which is very dense). This is the classic Hyderabad case where ECBC SHGC limits and west glare matter most, and where an Ibasho "what if you add fins" study is most persuasive.

Krishe Emerald is the best first pick: it has a real OSM polygon, a tagged height in floors, a known address, and long facades facing ESE and WNW, so afternoon WNW sun is the story.

## 7. Phototropic housing: the idea, and how Ibasho can embody it

### 7.1 What the page shows

Phototropic Housing (APRILLI with Won Hee Ko, UC Berkeley CED) is a zero net energy multi housing competition entry for San Francisco. Key moves (https://www.aprilli.com/sustainability/phototropic-housing-gbbcb):

- "Living space growing toward the solar energy resource to maximize solar heat gain throughout the year."
- No north facing units; most face SE or SW.
- Living rooms project outward (day use, views); bedrooms recess with more solid wall and insulation (night heat loss).
- South and west modules are **tilted toward true south**.
- Incident solar radiation maps per surface, colour coded by need (heating, comfort, cooling) drove the articulated facade.
- IES VE model against an ASHRAE 90.1 baseline: EUI 32.15 to 13.75 kBtu/ft2 (53% lower); natural ventilation through a central atrium saves about 15% of cooling and fan energy; glazing U 0.16, SHGC 0.32, VLT 60%; roof PV, west facade PV, solar hot water and small wind take it to net -0.21 kBtu/ft2.

### 7.2 What changes in Hyderabad (the untapped point)

San Francisco is heating led, so its building leans **into** the sun. Hyderabad (17.45 N, composite, cooling led) needs the opposite for walls and the same for roofs:

- The sun is high: noon altitude 49 to 96 deg. Roofs and near horizontal surfaces collect far more than any wall. So "grow toward the sun" means **grow the roof** (a PV canopy, tilted about 15 to 18 deg south), not the facade.
- Walls should be **skiaphilic** (shade seeking): lean away from the low east and west sun, open to the north for steady diffuse daylight, and self shade the south with projecting floors. In June the sun even crosses to the north at noon, so north glass needs short fins too.
- Every unit or room still wants light: the target is sDA 300/50% at least 55% while ASE 1000,250 stays at or below 10% (LEED v4 style daylight metrics), and low annual incident radiation on glass.

So the Hyderabad version is a **heliotropic roof and skiaphilic walls**: one building that leans its PV toward the sun and its windows away from it. We have not found an Indian tool that presents massing this way to non experts.

### 7.3 Proposals for Ibasho

1. **Sun bent massing generator (parametric, deterministic).** Inputs: site polygon, storeys, floor plate, room programme, latitude, EPW. Each floor plate may shift (cantilever or recess, step 0.3 m, limit set by structure rule, for example 3 m) and the roof may tilt. Objective: minimise annual incident radiation on glazing plus cooling EUI, maximise roof PV kWh and sDA, subject to ASE limit, FAR and setback rules (Telangana building rules pack). Search: the existing package search (bounded, seeded PRNG, reproducible), not an LLM. Output: a ranked set of "leaning" massings with the numbers, each traceable to the model.
2. **Generative facades per orientation.** For each facade cell, compute fin depth and spacing from the sun path so that direct sun is cut during cooling hours (cut off angle method, as in ECBC projection factor). Result: deep vertical fins on ESE and WNW, horizontal shelves on SSW, short fins on NNE. Render it in the 3D scene so the building visibly "grows" its shading; one slider for "how much shade".
3. **Radiation skin view.** Colour every surface by annual kWh/m2 (or by the phototropic page's need classes: cooling, comfort, heating). In Hyderabad nearly everything will read "cooling", which itself is a plain English lesson. Cheap path: sky patches (Tregenza 145) times a sun visibility mask from the scene, cached per geometry hash.
4. **Projecting living, recessed sleeping, Indian edition.** Translate the room rule: day rooms project to the north and east for daylight and breeze; bedrooms recess behind deep verandas and jaali on the west. Offer it as a room layout suggestion with the comfort reason stated.
5. **City aware leaning.** Because Ibasho places the building among real neighbours (section 5), the generator should lean toward the sky that is actually open: a tower beside DLF Cyber City or Krishe Emerald gets a different answer from one on open campus land. This is the part most massing tools miss: they optimise in a void.
6. **Kinetic "phototropic" animation.** Show a day or year scrub where shading cells rotate as the sun moves (a design aid, not a claim the building moves). Good for the visual fidelity goal, and honest: label as illustration.
7. **Honesty rules.** Every generated massing carries its constraints (structure limit, setback, FAR) and the documented model behind each number. Unknown wall build ups stay unknown and widen the result band; no LLM numbers.

### 7.4 Quick demo story using the references

"Vindhya, as built" (diagonal grid, shallow wings, courtyards) versus "Vindhya, sun bent" (same programme, wings pivoted 10 deg toward the NNE/SSW axis, roof PV canopy over courtyards, WNW fins). Show change in glazing radiation, ASE, roof PV and cooling EUI, then place Himalaya Block D next door to show how its 6 storeys shade the courtyard canopy in winter afternoons.

## 8. Unknowns to carry, not fill

| Item | Building | Plan |
|---|---|---|
| Window sizes and glazing spec (U, SHGC, VLT) | both | assume ECBC defaults, flag, widen band |
| Floor to floor | Vindhya | 3.9 m assumed |
| Wall and roof build up | both | likely RCC frame, brick or block infill, plastered; unknown |
| External shading | both | unknown; not drawn |
| Roof use and PV | both | Himalaya terraces read; PV unknown |
| Exact Vindhya entry level relative to site | Vindhya | cellar is partial (sloping site) |
| Himalaya +118.50 m level label | Himalaya | inconsistent; ignore for heights |
| Coworking tower heights and floor counts | all three | conflicting listings; use OSM where present |
| Neighbour heights | campus tile | ghost volumes when unknown |

## 9. References

- IIIT Hyderabad, Vindhya Bhavan floor plans (2022): https://intranet.iiit.ac.in/offices/static/files/Vindhya_bhavan.pdf
- IIIT Hyderabad, Himalaya Building floor plans (2022): https://intranet.iiit.ac.in/offices/static/files/Himalaya_Building.pdf
- OpenStreetMap contributors (ODbL): Vindhya https://www.openstreetmap.org/relation/2829427 , IIIT campus https://www.openstreetmap.org/way/31355320 , Himalaya https://www.openstreetmap.org/way/187896823 , D Block https://www.openstreetmap.org/way/211078709 , WeWork Krishe Emerald https://www.openstreetmap.org/way/776432080
- Overpass API mirror: https://maps.mail.ru/osm/tools/overpass/api/interpreter
- WeWork India Hyderabad locations: https://wework.co.in/hyderabad/
- WeWork Rajapushpa Summit: https://wework.co.in/hyderabad/financial-district/rajapushpa-summit/
- myHQ listings: https://myhq.in/managed-office/wework-hiteccity , https://myhq.in/office-space-for-rent/rajapushpa-summit-financialdistrict , https://myhq.in/managed-office/wework-rmz-spire-hiteccity
- Office Hub, Krishe Emerald: https://www.office-hub.com/in/properties/krishe-emerald-kondapur-main-road-laxmi-cyber-city-whitefields-kondapur-hyderabad-a0v3m00000Oq3z5AAB
- The Realty Today, Sanofi lease at RMZ Spire: https://therealtytoday.com/news/sanofi-signs-lease-for-2-7-lakh-sq-ft-office-space-in-hyderabad-at-2-crore-rent
- APRILLI, Phototropic Housing: https://www.aprilli.com/sustainability/phototropic-housing-gbbcb
- IIIT Hyderabad Centre for IT in Building Science: https://cbs.iiit.ac.in , https://web2py.iiit.ac.in/research_centres/default/view_area/12
- NRDC, Hyderabad and ECBC: https://www.nrdc.org/bio/sameer-kwatra/hyderabad-goes-hi-tech-building-energy-codes
- Google Open Buildings 2.5D: https://sites.research.google/gr/open-buildings/
