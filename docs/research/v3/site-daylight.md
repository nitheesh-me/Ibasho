# Site analysis and daylight: brief (v3)

Author: site and daylight research agent. Date: 2026-10-11. Status: research brief, no code.
Scope: sun, shadows, sun hours, radiation on facades and roofs, sky view, views, daylight (sDA, ASE, UDI, DF), glare, urban heat hints, weather and city context for Hyderabad (Gachibowli, IIIT Hyderabad campus). Every method must run in a browser on a laptop, with a stated accuracy against Radiance or Ladybug and a validation test.

Light local checks done for this brief (files in `docs/research/v3/sources/`):

- Downloaded the Hyderabad TMYx EPW (2011 to 2025) and summarised it (section 2).
- Ran one Overpass query over the IIIT Hyderabad campus (section 3).
- Read ECBC 2017 section 4.2.3 (daylight), ECSBC 2024 section 5.2.3, and the LEED v4.1 and v5 (November 2025) BD+C daylight and views text, from the PDFs in `sources/` (sections 1.6, 1.8, 6).

## 0. Summary

1. **Hyderabad's sun is unusual for a tool built around London.** At 17.4°N the sun passes overhead around 9 May and 3 August. On about 85 days (roughly 10 May to 2 August) the noon sun is in the **north**, so north facades take direct sun in the hottest and wettest months. In June and July the monsoon raises the diffuse fraction to 0.44 to 0.56. Ibasho should say this plainly. Most UK-trained intuition and many tools treat north as "no sun".
2. **One kernel serves almost everything.** For each sensor point, the kernel finds which sky directions it can see, then multiplies that by a sky matrix. Shadows, sun hours, cumulative radiation, sky view factor, ASE, the direct part of sDA, views and a simple glare check are all different weightings of that one visibility result. Build that kernel once, well.
3. **There are two paths and one contract.** A CPU path (three-mesh-bvh in a worker) is the canonical, deterministic, testable result. A GPU path (shadow maps per sky patch) gives interactive previews. Both return the same `SiteResult`, tagged with a method tier and an uncertainty band. On this laptop the browser runs SwiftShader (software GL), so tests and CI must use the CPU path.
4. **ASE and direct sun can be done exactly in the browser. sDA cannot, but can come close.** ASE1000,250 uses direct sun only, so ray casting matches Radiance up to geometry tolerance. sDA300/50% needs inter-reflections and blind operation. Three tiers cover it: (a) sky component plus split-flux, (b) browser radiosity or path-traced daylight coefficients, (c) Radiance run by the companion app. The UI shows which tier produced each number.
5. **The Indian code targets are concrete and computable.** ECBC 2017 uses UDI 100 to 2,000 lux for 90% of potential daylit time, 8:00 to 17:00 IST (2,920 h), at least one point per m², with obstructions modelled within twice their height. The area thresholds by building type are in section 6.2. It also has a manual Daylight Extent Factor method, which Ibasho can apply exactly and instantly. ECSBC 2024 (§5.2.3) keeps the same thresholds and DEF method, but widens the window to at least 8 continuous hours between 07:00 and 17:00 IST. LEED v5 now cites LM-83-23 and gives 1 to 4 points for average sDA (40/55/65/75%), with a glare narrative only above 20% ASE.
6. **City data is thin on heights.** In the IIIT campus box, OSM has 313 building ways, **0 with `height` and 15 with `building:levels`** (4.8%). Heights must come from fused sources (section 3.2). Each building carries a height provenance, and an unknown height is shown as unknown (hatched), never as a default treated as fact.
7. **Untapped value:** a shading ledger (who shades whom, in kWh, closed with a conservation identity that Lean can check), a Knowles solar envelope for Hyderabad's north sun, a "coolest walk" outdoor comfort map for the campus, and per-window shading factors fed straight into the monthly heat balance.

## 1. Methods catalogue

### 1.1 Sun position

| Method | Accuracy | Cost | Use |
|---|---|---|---|
| NREL SPA (Reda and Andreas 2004) | ±0.0003° zenith and azimuth, years -2000 to 6000 | about 2 µs per call in JS | Canonical. Port to TS on `@ibasho/dmath` (needs `atan2`, `asin`, `acos`, `tan`; dmath has `sin`, `cos` now) so it is bit-deterministic. https://midcdmz.nrel.gov/spa/ , paper https://www.nrel.gov/docs/fy08osti/34302.pdf |
| suncalc 2.1.1 (already a dependency, ARCH section 9) | Around 0.1° to 0.3° class (simplified VSOP-free formulae, no refraction model of note) | trivial | UI sun-dial and animation only, never for a recorded number |
| Radiance `gendaymtx` / Ladybug `Sunpath` | Ladybug uses an NOAA-style algorithm, close to SPA for building work | reference | Cross-check |

Golden test: SPA paper Table A4.1. For 17 October 2003, 12:30:30 local (UTC-7), lat 39.742476, lon -105.1786, elevation 1830.14 m, P 820 mbar, T 11 °C, ΔT 67 s, the expected topocentric zenith is 50.11162° and the azimuth is 194.34024°. Assert to 1e-5°.

Hyderabad facts (computed for this brief, lat 17.445; approximate declination formula, so dates ±2 days):

| Fact | Value |
|---|---|
| Zenith passages | about 9 May and 3 August |
| Days with the noon sun north of zenith | about 85 (10 May to 2 August) |
| Noon altitude 21 June / 21 March / 21 December | 84.0° (north) / 72.6° (south) / 49.1° (south) |
| Sunrise azimuth 21 June / 21 December | 65° / 115° from north |

Consequences for design advice: on south faces a horizontal overhang works all year. East and west need vertical fins or deep reveals. North needs a small overhang or fins against May to August sun. Roofs dominate solar gain (high sun all year), so roof albedo and insulation come first.

### 1.2 Sky models and sky matrices

| Item | Choice | Notes and source |
|---|---|---|
| Sky luminance and radiance distribution | Perez all-weather sky (Perez, Seals, Michalsky 1993) | Driven by EPW DNI, DHI and dew point, as in Radiance `gendaymtx`. Paper: https://doi.org/10.1016/0038-092X(93)90017-I |
| Tilted plane irradiance (no obstruction) | Perez 1990 transposition | Feeds the climate pack's `planeIrradiance` (replacing the planned Collares-Pereira-Rabl step for hourly work). Reference implementation: pvlib `irradiance.perez` https://pvlib-python.readthedocs.io/en/stable/reference/generated/pvlib.irradiance.perez.html |
| Sky subdivision | Tregenza 145 patches plus 1 ground (Radiance MF:1). Reinhart MF:2 = 577, MF:4 = 2,305 | MF:1 for radiation and SVF. MF:2 for daylight coefficients. Direct sun handled separately (see 1.6) |
| Cumulative sky | Robinson and Stone 2004 cumulative sky: one radiance vector per patch summed over the period | Ladybug "LB Cumulative Sky Matrix" equivalent. https://doi.org/10.1016/j.solener.2004.04.016 |
| Luminous efficacy | Perez 1990 luminous efficacy model, or EPW illuminance columns directly | The EPW has GHI, DNI and DHI illuminance (fields 17 to 19). Use the file's columns where present, and flag the model where not |
| Ground | Lambertian ground hemisphere, albedo from EPW or user (default 0.2) | Ladybug traces the ground hemisphere too, to avoid errors of about 20% on vertical walls (LBT forum: https://discourse.ladybug.tools/t/difference-between-lb-incident-radiation-and-ladybug-solar-radiation-components/17626/5) |

The sky matrix is pure arithmetic over EPW rows, so it belongs in the deterministic engine layer (L1, dmath).

### 1.3 The visibility kernel

The kernel computes visibility V[s][p] in {0, 1} (or a fraction with sub-samples), for sensor s (a point with a normal) and sky patch or sun direction p. Then:

| Quantity | Formula over V |
|---|---|
| Cumulative irradiation on a sensor (Wh/m²) | Σp V[s][p] · L_p · ω_p · max(0, n·d_p), plus the ground term and the direct-sun term |
| Sky view factor | Σp V · ω_p · cos(θ_p) / π over the upper hemisphere (horizontal sensor), or the vertical variant |
| Sun hours on a date or period | Σ over hourly sun positions with the sun up: V[s][sun_t] · [n·d_t > 0] |
| Shadow mask at time t | 1 − V[s][sun_t] |
| ASE direct illuminance | E_dir(s,t) = V[s][sun_t] · τ(θ) · Ev,dn(t) · cos θ, with τ glazing transmittance at the incidence angle |
| Sky component (daylight factor part) | Same as SVF, but through glazing and on a CIE overcast sky |
| Views | The hit ID and distance per ray from eye sensors (1.8) |
| Shading ledger | The ID of the first blocker per blocked ray (section 5.1) |

Two implementations of the kernel:

| Path | How | Speed (indicative, laptop) | Determinism | Use |
|---|---|---|---|---|
| **CPU canonical** | three-mesh-bvh 0.9.16 (already in `packages/scene`) `raycastFirst` in a worker. One BVH for the whole site (building shells, terrain, tree proxies). | Of order 1 to 5 M rays/s per worker on a 100k-triangle scene (to be measured). 10k sensors × 146 patches × 2 ≈ 3M rays, a few seconds | Deterministic given the same triangle order and IEEE basic ops (no trig in the inner loop) | Recorded numbers, tests, the certificate, CI on SwiftShader |
| **GPU preview** | Patch-centric shadow maps: for each sky patch or sun direction, render one orthographic depth map of the scene. A fragment pass over a "sensor texture" (positions and normals packed like a lightmap) tests each sensor against it and accumulates weighted radiance into a float target. That is O(patches) draws, not O(sensors × patches) rays. | 146 to 577 depth renders of the scene. Interactive on a real GPU, seconds on an integrated one | Not bit-stable across GPUs. Values snapped and labelled `preview` | Heat maps while dragging, city-scale views |
| GPU ray (option) | three-mesh-bvh `MeshBVHUniformStruct` shader BVH (its `gpu-path-tracing` examples), or WebGPU compute via three's `WebGPURenderer` / TSL | Fast where WebGPU exists | Same caveat | Path-traced daylight coefficients (1.6 tier b) |

Shadow map resolution sets accuracy. A 4,096² map over a 500 m site gives about 12 cm texels. Fit the frustum per patch to the target building's sensor bounds plus the obstruction ring, not the whole city. Use a small normal-offset bias and test bias against the CPU path (section 7).

### 1.4 Shadows and sun hours

- **Live shadows**: the three.js directional light, with the sun vector from SPA, a cascaded or fitted frustum, and drei `AccumulativeShadows` for the still-life bake (ARCH TE-8 already does soft shadows). This is visual only.
- **Shadow hours map**: kernel over hourly sun positions for a chosen day (or a 21st-of-month set), output in hours. Standard outputs:
  - UK pack (BRE BR 209, 2022): at least 2 h of sun on 21 March over 50% of a garden or amenity area; VSC 27%; APSH 25% annual and 5% in winter. https://www.bregroup.com/bookshop/site-layout-planning-for-daylight-and-sunlight-br-209-2022
  - India pack: report sun hours on 21 December (winter sun wanted) and 21 May / 21 June (sun unwanted). Indian rules have no BR 209 equivalent sun-hours rule, so frame it as advice, not compliance.
- **Annual direct sun for ASE**: there are about 4,400 sun-up hours a year. Rather than casting each one, bin the sun positions into Reinhart MF:4 or MF:6 sun-patch directions (Radiance's 5-phase method uses 5,165 solar positions). The error from binning is under about 1° of sun direction. Alternatively, cast all 4,400 exactly on the CPU for small rooms (100 sensors × 4,400 = 440k rays, under a second).

### 1.5 Cumulative radiation on facades and roofs

- Sensor grid: 0.5 to 1 m on facades, 1 m on roofs, with the normal offset 1 to 2 cm.
- Output: annual and monthly kWh/m², plus "percent of unobstructed" (sensor result over the same plane with no context). This ratio is the clean input for the engine (section 4).
- **Reflections**: like Ladybug Incident Radiation, the browser version ignores inter-building reflections. Glass towers in Gachibowli reflect strongly onto neighbours, so flag "reflected sun not included" in that case. For dense glass canyons the SRA (Robinson and Stone 2005) adds one reflection bounce cheaply via view factors. https://doi.org/10.1016/j.solener.2005.02.004
- Expected accuracy: with Perez plus the ground hemisphere, the browser matches Ladybug or Radiance (`-ab 0`) within about 2% to 5% on annual totals for opaque context, once both use the same EPW and patch count. The residual comes from sensor offset and patch discretisation. Against `-ab 2`, add the missing reflected component: typically 2% to 10% on facades in dense canyons. These are targets that section 7 measures, not published guarantees.

### 1.6 Daylight: sDA, ASE, UDI, DF

Metric definitions:

| Metric | Definition | Source |
|---|---|---|
| sDA300/50% | % of sensors with ≥ 300 lux for ≥ 50% of occupied hours (08:00 to 18:00 local standard time, 3,650 h). Blinds operate when > 2% of sensors get > 1,000 lux direct sun | IES LM-83 (LM-83-12, revised LM-83-23; check the 2023 changes against the IES text before coding) https://store.ies.org/product/lm-83-23-approved-method-ies-spatial-daylight-autonomy-sda-and-annual-sunlight-exposure-ase/ |
| ASE1000,250 | % of sensors with > 1,000 lux **direct sun only** (no inter-reflection, blinds open) for > 250 h | LM-83 |
| UDI 100 to 2,000 | % of time illuminance is within the band | Nabil and Mardaljevic 2006 https://doi.org/10.1080/09613210500491100 ; ECBC 2017 §4.2.3 uses it |
| DF | E_in / E_out,horiz under a CIE overcast sky, in % | BS 8206-2 / CIBSE LG10. EN 17037 uses target DF from city median diffuse illuminance |
| LEED v4.1 EQ Daylight, option 1 | Uses LM-83-12. 1 point at average sDA ≥ 40%, 2 at ≥ 55%, 3 at ≥ 75% (healthcare: 1, 2, then exemplary). Spaces with ASE > 10% need a glare narrative | LEED v4.1 BD+C guide (`sources/leed41bdc.pdf`); LEEDuser calculator https://leeduser.buildinggreen.com/sites/default/files/credit_documentation/LEEDv4.1%20Daylighting%20Credit%20Calculator_Redacted.pdf |
| LEED v5 EQ Occupant Experience, Option 5 Lighting | Path 4 Daylight Simulation per LM-83-23: average sDA300/50% (or sDA150/50% for spaces without visual tasks, 225 lux design target) ≥ 40% = 1, ≥ 55% = 2, ≥ 65% = 3, ≥ 75% = 4 points. ASE spaces are not excluded. Glare narrative where ASE net > 20%. Path 3 Proximity: 30% of regularly occupied area within 6 m of glazing with VLT > 40% (1 point). Path 1 Solar Glare: glare control devices wherever direct or reflected sun reaches (1 point) | LEED v5 BD+C Reference Guide, November 2025 (`sources/leedv5bdc.pdf`, pp. 157 to 162) |

The computation tiers (the UI badge names the tier):

| Tier | Method | Cost | Accuracy vs Radiance (rtrace/rcontrib, -ab 6 class) |
|---|---|---|---|
| T0 instant | **ECBC Daylight Extent Factor** (manual method, section 6.1) and **ASE exact** (direct sun ray casting, 1.4) | ms | DEF is a code method (exact to the code by definition). ASE matches Radiance up to geometry and sun binning (about 1% to 3% of area) |
| T1 fast | Daylight coefficients for **sky component** (visibility × patch luminance through glazing τ(θ)) plus the **BRE split-flux internally reflected component**: IRC = 0.85 W / (A (1 − R)) · (C R_fw + 5 R_cw) (Hopkinson, Longmore, Petherbridge) | under 1 s per floor | Good near windows. Split-flux spreads IRC uniformly, so it tends to overestimate at the back of deep rooms and underestimate near windows. Errors of 20% to 40% in illuminance are plausible in deep or L-shaped rooms. Treat sDA from T1 as ±10 to 15 percentage points until measured |
| T2 browser | **Path-traced daylight coefficients** ("rcontrib in the browser"): per sensor, trace diffuse paths through the room (3 to 5 bounces, Lambertian) and bin each escaping ray by the Reinhart MF:2 patch. The DC matrix (sensors × 578) times the hourly sky vector gives hourly illuminance. Direct sun via exact sun rays (two-phase plus direct sun, like the Radiance 2PDDS method). Blinds as a second DC set with diffuse transmission | 10k sensors × 578 floats ≈ 23 MB. GPU minutes, CPU tens of minutes | Can converge to Radiance within about 5% to 10% on illuminance for Lambertian rooms, given enough paths. Needs measuring (section 7). three-gpu-pathtracer by the three-mesh-bvh author is the starting point https://github.com/gkjohnson/three-gpu-pathtracer |
| T3 reference | **Companion app** (127.0.0.1:7357) runs Radiance `rfluxmtx` / `rcontrib`, or Honeybee-Radiance, when installed. The browser sends the model (HBJSON), the companion returns the result | minutes | Reference. Radiance itself is validated against measurement: Reinhart and Andersen 2006 https://doi.org/10.1016/j.enbuild.2006.03.012 ; Accelerad (GPU Radiance) in Jones and Reinhart https://mit.edu/SustainableDesignLab/publications/15_Jones.pdf |

Blind rule detail: per hour, if more than 2% of a space's sensors get > 1,000 lux direct sun, use the blinds-closed DC set for that hour. LM-83 specifies how the closed state transmits. Ladybug and Honeybee commonly use a diffusing shade of about 20% transmittance as the generic stand-in; confirm this against LM-83-23.

### 1.7 Glare indicators (hints, not compliance)

- **DGPs** (simplified daylight glare probability, Wienold 2009): DGPs = 6.22e-5 · Ev + 0.184, where Ev is the vertical eye illuminance from the same DC matrix at eye sensors (1.2 m seated, facing the view direction). Valid only when no direct sun sits in or near the field of view. Flag when the sun is visible from the eye sensor. Bands: < 0.35 imperceptible, 0.35 to 0.40 perceptible, 0.40 to 0.45 disturbing, > 0.45 intolerable. Source: Wienold, "Dynamic daylight glare evaluation", BS 2009 http://www.ibpsa.org/proceedings/BS2009/BS09_0944_0951.pdf
- **ASE map** is itself the LEED glare trigger (> 10% of area).
- **Sun-in-view**: from eye sensors, cast rays to the sun at each hour. The output is "hours with the sun inside a 30° cone of your desk view" (ray casting, exact).
- Full DGP needs a fisheye luminance image (evalglare). That is T3 companion only.

### 1.8 Views

From eye sensors at 1.2 m (seated) or 1.5 m (standing), cast a horizontal fan (e.g. 360 rays per 1° and ±15° vertical rows). Each ray records what it hits first (glazing exit, then sky, ground, tree, building ID) and the distance.

| Output | Use |
|---|---|
| Direct line of sight to vision glazing (yes/no per sensor) | LEED v4 / v4.1 Quality Views: line of sight for 75% of regularly occupied area. https://leeduser.buildinggreen.com/credit/NC-v4/EQc8 . **LEED v5** Option 1 Path 2 Quality Views: views for 75% (2 points) or 90% (3 points) of regularly occupied area, glazing VLT > 40%, showing nature, landmarks or art **or** objects ≥ 7.5 m beyond the glazing, occupant within 3 × head height; atria up to 30% |
| View content fractions: sky, nature (trees from canopy data), built, ground; median distance; share > 7.6 m (25 ft) | v4.1 asks for views of nature, urban landmarks or art, at 25 ft or more, glazing VLT over 40%, within 3 × head height (LEEDuser summary; verify) |
| Multiple lines of sight ≥ 90° apart | v4 option |
| "View lost" when a new tower is placed | Untapped: a before/after diff for a neighbour's proposal |

The Heschong Mahone "view factor ≥ 3" is a human rating scale and cannot be computed from geometry alone. Ibasho should show content fractions and leave the rating to the user.

### 1.9 Urban heat island and outdoor comfort hints

Label these as hints only (unknown is not zero; these are indicators, not forecasts):

| Indicator | Method | Source |
|---|---|---|
| Sky view factor map (ground level) | Kernel, 1.3 | Oke 1981 links SVF and H/W to max nocturnal UHI: ΔTmax = 7.54 + 3.97 ln(H/W), ΔTmax = 15.27 − 13.88 SVF (mid-latitude calm clear nights, so for Hyderabad it is only a ranking) https://doi.org/10.1002/joc.3370010304 |
| Surface albedo and green fraction of the plot | Materials plus the canopy layer | |
| Outdoor MRT and UTCI along paths | MRT from the SolarCal method (ASHRAE 55 Appendix C) with the kernel's direct and diffuse plus a longwave sky/ground split weighted by SVF. UTCI from the published polynomial (Bröde et al. 2012) | Ladybug implements both: https://www.ladybug.tools/ladybug/docs/ladybug.solarcal.html , https://github.com/ladybug-tools/ladybug-comfort |
| Land surface temperature context | Landsat 8/9 LST (100 m thermal, resampled 30 m) as a background layer | https://www.usgs.gov/landsat-missions/landsat-collection-2-surface-temperature |

## 2. Weather for Hyderabad

| Source | What | Notes |
|---|---|---|
| **Climate.OneBuilding TMYx, WMO 431285** Hyderabad Gandhi Intl AP (Shamshabad, 17.233 N 78.417 E, 617 m) | TMYx 2004 to 2018, 2007 to 2021, 2009 to 2023, **2011 to 2025** | Downloaded: `sources/epw/IND_TG_Hyderabad-Gandhi.Intl.AP.431285_TMYx.2011-2025.epw`. Built from NCEI ISD plus ERA5. Comes with `.wea` (Radiance), `.stat`, `.ddy` (2025 ASHRAE design days). https://climate.onebuilding.org/WMO_Region_2_Asia/IND_India/TG_Telangana/IND_TG_Hyderabad-Gandhi.Intl.AP.431285_TMYx.2011-2025.zip |
| **ISHRAE 2014, WMO 431280** (Begumpet, about 10 km from Gachibowli) | Typical year | https://climate.onebuilding.org/WMO_Region_2_Asia/IND_India/TG_Telangana/IND_TG_Hyderabad-Gandhi.Intl.AP.431280_ISHRAE2014.zip . The station is closer to the city, but older data. One forum report says it gives a 1990-dated file https://onebuilding.org/archive/energyplus-support/msg34397.html |
| **NASA POWER** hourly and daily API | GHI, DNI, DHI, T2M, RH2M, WS10M; hourly from 2001; solar about 1° grid, meteorology 0.5° × 0.625° | Free, no key, CORS-friendly JSON. Use for "actual year" and heatwave years. Coarse, so flag it as satellite and reanalysis. https://power.larc.nasa.gov/docs/services/api/ |
| **Open-Meteo** forecast and historical (ERA5) | Hourly GHI, DNI, diffuse, temperature | Free, no key. Enables a "today" mode: sun on your balcony this afternoon, tomorrow's cooling load. https://open-meteo.com/en/docs |
| PVGIS (ERA5 database) | TMY and hourly PV | https://re.jrc.ec.europa.eu/pvg_tools/en/ |
| NREL NSRDB South Asia | 10 km satellite irradiance (older years) | https://nsrdb.nrel.gov/ (coverage and years to confirm) |

Summary of the TMYx 2011 to 2025 file, computed here:

| Quantity | Value |
|---|---|
| Annual GHI / DNI / DHI | 1,907 / 1,896 / 607 kWh/m² |
| Monthly GHI (kWh/m²) | Jan 160, Feb 172, Mar 201, Apr 197, May 200, **Jun 152, Jul 117, Aug 133, Sep 130**, Oct 157, Nov 144, Dec 144 |
| Diffuse fraction | 0.21 to 0.27 dry season. **0.44 Jun, 0.56 Jul, 0.52 Aug, 0.48 Sep** |
| Sunshine hours (DNI > 120 W/m², WMO definition) | 3,604 h. Lowest July (217), highest April (353) |
| Median diffuse horizontal illuminance 09:00 to 17:00 | about 16 klux (Jan) to about 30 klux (Jul to Sep) |
| Dry bulb range | 10 °C to 41 °C |
| ASHRAE 2025 cooling 0.4% (from the `.ddy` / DESIGN CONDITIONS row) | 39.8 °C DB |

Design implications for daylight: the monsoon sky is bright and diffuse (30 klux medians), so north and monsoon-season sDA comes easily. The dry season (February to May) has clear skies and high direct sun, which drives ASE and glare. Report ASE by season, not only annually.

Weather handling rules:

- The EPW file is untrusted input, so it goes through `@ibasho/core/schemas`. Hash it, and record the hash in each `SiteResult`.
- The station is 25 km south of Gachibowli and about 80 m higher in elevation. Say so. Do not adjust.
- Keep the climate pack's monthly tables in sync: generate the Hyderabad monthly plane irradiance from the same EPW via Perez (one source of truth).

## 3. City context: Gachibowli and IIIT Hyderabad

### 3.1 What OSM has (measured)

Overpass query, bbox 17.440,78.343 to 17.452,78.355 (the IIIT campus and its edges), 2026-10-11, `way[building]; out tags`:

| Count | Value |
|---|---|
| Building ways | 313 |
| With `height` | **0** |
| With `building:levels` | **15** (4.8%), e.g. Himalaya Academic Block 3, Bakul Nivas 5, Parijaat Nivas 4, Kadamba Nivas 4, Academic Office 5, Blocks C to E 6 |
| Tags | `yes` 290, `residential` 8, `dormitory` 5, `university` 3 |
| Named "Himalaya" | Yes ("Himalaya Academic Block", levels 3). **No "Vindhya" name found** in this bbox |

A wider Gachibowli query was refused (rate limit). Run it again, politely, at build time from a script with caching. Overpass etiquette: a User-Agent header, one request at a time, cache to disk. https://wiki.openstreetmap.org/wiki/Overpass_API

### 3.2 Height and context sources to fuse

| Layer | Source | Resolution | Notes |
|---|---|---|---|
| Footprints | OSM; **Overture Maps buildings** (OSM + Microsoft + Google merged, GeoParquet) | Footprint | https://docs.overturemaps.org/guides/buildings/ |
| Heights, time series | **Google Open Buildings 2.5D Temporal** (India, yearly 2016 to 2023, building presence, fractional count and height rasters at 4 m effective) | 4 m raster | https://sites.research.google/gr/open-buildings/temporal/ (Earth Engine `GOOGLE/Research/open-buildings-temporal/v1`) |
| Heights, global | GlobalBuildingAtlas (TUM 2025, 3 m) | Per building | Reported to underestimate Indian mid-rise often by more than 40% https://researchmatters.in/news/researchers-test-globalbuildingatlas-worlds-newest-global-map-buildings-our-cities |
| Heights, coarse | GHSL GHS-BUILT-H (100 m average height) | 100 m | Sanity bound only. https://human-settlement.emergency.copernicus.eu/ghs_buildH2023.php |
| India stack | Geospatial Open Building Stack (GOBS): Google footprints + temporal heights + OSM landuse, about 189M Indian buildings | Per building | https://talks.cam.ac.uk/talk/index/247124/ |
| Terrain | Copernicus DEM GLO-30 | 30 m | Gachibowli has granite outcrops and lakes. Terrain matters for low sun only. https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model |
| Trees | **Meta / WRI High Resolution Canopy Height** (1 m, Tolan et al. 2024), OSM `natural=tree` | 1 m | Convert to proxy crowns (ellipsoids) with a seasonal transmittance (e.g. 0.2 to 0.4 dense evergreen; user-adjustable). https://registry.opendata.aws/dataforgood-fb-forests/ |
| Visual backdrop only | Google Photorealistic 3D Tiles via NASA-AMMOS 3DTilesRendererJS | Mesh | Needs a key, and its terms restrict caching and analysis. Use it for looks, never for numbers. https://github.com/NASA-AMMOS/3DTilesRendererJS |

Height resolution order per building (each carries `heightSource` and an uncertainty band):

1. User entry or a loaded plan.
2. OSM `height`.
3. OSM `building:levels` × a floor-to-floor height by type: residential 3.0 m, office 3.6 to 4.0 m, hostel 3.2 m.
4. Google 2.5D temporal, latest year.
5. Unknown: drawn hatched. It is excluded from metric claims, or bracketed (run the analysis at low and high height and show the range).

Untapped UX: tap a building and type its floor count. Ibasho stores the edit locally (with an optional export as a suggested OSM note, never an automated edit).

Context radius rule: ECBC models obstructions closer than twice their height (§4.2.3.1 e). For a 60 m Gachibowli tower that is 120 m. Ibasho should load at least max(150 m, 2 × the tallest nearby height) and state the radius used.

### 3.3 Reference buildings

- `sources/Vindhya_bhavan.pdf` is 4 A3 sheets of electrical layouts (junction boxes, UPS rooms). It is useful for room outlines and window marks, not heights. The plan owner agent should extract the geometry.
- Himalaya Academic Block: OSM footprint plus 3 levels. It is a good first validation target, because a footprint exists and campus users can check sun and shadow claims on the ground.

## 4. How it plugs into Ibasho

Proposed module split (layering per ARCH section 3):

| Piece | Layer | Contents |
|---|---|---|
| `@ibasho/dmath` additions | L0 | `atan2`, `asin`, `acos`, `tan` (already planned as "not yet built") |
| New `packages/site` (`site` engine) | L1, worker | SPA port; EPW parse via schemas; Perez sky and sky matrix (MF:1, MF:2); Tregenza and Reinhart patch geometry; metric aggregation (sDA, ASE, UDI, DF, sun hours, SVF) from a visibility or DC matrix; ECBC DEF manual method; split-flux IRC; quantisation to bigint; the ledger identity |
| CPU kernel | L1 worker (three-mesh-bvh has no DOM dependency, but it does import `three`) | Needs an ARCH decision: either allow `three` math and BVH in a dedicated `site-kernel` worker package (L1.5), or keep the kernel in `scene` and post the V matrix back. Recommend a separate worker package, so the canonical path is testable in Node |
| GPU preview kernel | L3 `packages/scene` | Patch shadow maps, heat map materials, sun path dome, shadow animation |
| Contracts | L0 `@ibasho/core` | `SiteModel`, `SensorGrid`, `SiteResult` (below) |
| Companion | L4 `apps/companion` | Radiance runner (T3), optional |

`SiteResult` (sketch for core):

```
SiteResult {
  inputsHash, weatherHash, sceneHash, method: 'T0'|'T1'|'T2'|'T3', kernel: 'cpu'|'gpu-preview',
  surfaces: { id, monthlyIrradiation_Whm2: bigint[12] | 'unknown', unobstructedRatio: Q, sunHours: {...} }[]
  windows:  { id, monthlyShadingFactor: Q[12] }          // F_sh,obst for the engine
  rooms:    { id, sDA, ASE, UDI, DFmean, band: [lo, hi], tier } []
  ledger:   { receiver, blocker, lost_Wh: bigint }[]
}
```

The engine link: the monthly heat balance today takes plane irradiance from the climate pack. Add a per-window and per-surface `monthlyShadingFactor` (ISO 52016-1 / ISO 13790 F_sh,obst style) from `SiteResult`. With no site result it is `unknown`, and the engine falls back to the pack's documented default with a visible "no context shading" note. This is the most valuable single integration, because site context changes cooling loads in Hyderabad by double-digit percentages on low floors in dense blocks (to be measured, section 7).

Determinism and the Lean link: GPU results never enter the certificate. Only CPU-kernel results, quantised to fixed point, do. The ledger identity in 5.1 is pure bookkeeping, so the TS mirror checker can verify it.

## 5. Untapped ideas worth building

### 5.1 The shading ledger ("who takes my sun")

Each blocked ray stores the ID of the first building it hits. So for each receiving surface:

`unobstructed_Wh = received_Wh + Σ_blockers lost_Wh(blocker)` (exact per ray, with integer Wh after quantisation)

- It answers "the tower to your west costs your roof 310 kWh a year of PV potential" and "your new floor would take 2.1 sun hours from your neighbour's courtyard on 21 December". The second is a solar-rights view that planners and neighbours actually argue about.
- The identity closes exactly in fixed point, so it is a natural certificate obligation (Lean: sum conservation over a finite map), with the same style as the money ledger.
- Nobody consumer-facing shows this.

### 5.2 Knowles solar envelope for Hyderabad

The solar envelope is the largest volume on a plot that does not shade chosen neighbour surfaces during chosen hours (Knowles 1981). It is computable as the lower envelope of planes through the protected edges along each sun direction. The Hyderabad twist: protect north neighbours in winter (sun south) and south neighbours in May to August (sun north). The envelope's shape is visibly different from a London one, and it makes a good teaching moment. It also connects to the phototropic housing inspiration (Aprilli): massing that leans and steps to the sun. https://www.aprilli.com/sustainability/phototropic-housing-gbbcb

### 5.3 Phototropic massing search

Add the envelope and per-facade radiation as variables to the existing retrofit search: setbacks per floor, fin depth per orientation, roof PV coverage. The objectives stay the engine's (price, energy, operating cost), with daylight (sDA ≥ target, ASE ≤ 10%) as constraints. Parametric runs use the T1 tier. The winner gets re-checked at T2 or T3.

### 5.4 "Coolest walk" on campus

UTCI along footpaths, at hourly resolution on typical May and October days, between hostels and academic blocks (IIIT: Bakul Nivas to Himalaya). Output: "leave at 13:40 via the tree-lined path: 4 °C UTCI cooler than the road". It uses the same kernel plus tree transmittance, needs no new physics, and is very visible.

### 5.5 Per-window "sun clock"

For every window, a small ring chart: the months and hours of direct sun, with the overhang or fin that would cut the unwanted part and keep the winter part. This is computed exactly from sun rays, and plain English: "this west window gets sun 14:30 to 18:00 from March to May; a 45 cm fin on the south edge removes 70% of it". It is the most practical everyday output for normal people.

### 5.6 "Today" mode

SPA plus an Open-Meteo forecast: what the sun will do to your rooms this afternoon, when to close the west blinds, and when the roof PV will peak. It turns the twin into a daily habit.

## 6. Code targets this module must compute (daylight and site)

### 6.1 ECBC 2017 manual DEF method (§4.2.3.2), exact and instant

Daylit depth = DEF × head height (perpendicular, stopping at an opaque partition taller than the head). Width = window width + min(1 m each side, distance to partition, half the gap to the next window). Facades are assigned to the cardinal direction within ±45°. Obstructions are ignored. DEF values (Table 4-3):

| Shading | Latitude | Window | VLT < 0.3: N / S / E / W | VLT ≥ 0.3: N / S / E / W |
|---|---|---|---|---|
| None or PF < 0.4 | ≥ 15°N (Hyderabad) | All | 2.5 / 2.0 / 0.7 / 0.5 | 2.8 / 2.2 / 1.1 / 0.7 |
| None or PF < 0.4 | < 15°N | All | 2.4 / 2.0 / 1.3 / 0.6 | 1.7 / 2.2 / 1.5 / 0.8 |
| PF ≥ 0.4 | All | No light shelf | 2.8 / 2.3 / 1.5 / 1.1 | 3.0 / 2.5 / 1.8 / 1.5 |
| PF ≥ 0.4 | All | Light shelf | 3.0 / 2.5 / 1.8 / 1.6 | 3.5 / 3.0 / 2.1 / 1.8 |

Skylights: aperture + H (skylight), 1.5 H (monitor), H or 2H (sawtooth).

### 6.2 ECBC 2017 simulation method (§4.2.3.1), carried into ECSBC 2024 (§5.2.3, Table 5.1)

| Building category | ECBC | ECBC+ | SuperECBC |
|---|---|---|---|
| Business, Educational | 40% | 50% | 60% |
| No Star Hotel, Star Hotel, Healthcare | 30% | 40% | 50% |
| Resort | 45% | 55% | 65% |
| Shopping complex | 10% | 15% | 20% |
| Assembly | Exempt | | |

These are the shares of above-grade floor area that must achieve 100 to 2,000 lux for at least 90% of potential daylit time. ECBC 2017: 8 h a day between 08:00 and 17:00 IST (2,920 h). ECSBC 2024: at least 8 continuous hours between 07:00 and 17:00 IST (at most 2,920 h). Schools in both: 7 h between 07:00 and 15:00. The ECSBC tiers are named ECSBC, ECSBC+ and Super ECSBC, with the same percentages. Make the window a setting of the rules pack. Work plane 0.8 m, at least one point per m². Use the actual VLT. Model obstructions within 2 × their height (default reflectance 30% man-made, 0% natural). Interior defaults: walls 50%, ceiling 70%, floor 20%, furniture 50%. Note: ECBC says "BEE approved software". Ibasho's result is therefore an estimate of compliance, worded as such.

Building types map: office (Business), education, hotel, hospital (Healthcare), lab (Business, or exempt where processes forbid daylight), and apartments and single homes under **Eco Niwas Samhita** instead. ENS uses openable window-to-floor area ratio (WFRop) minimums by climate zone, plus VLT rules, not UDI. ENS 2018 and 2024: https://beeindia.gov.in/sites/default/files/BEE_ENS_2024.pdf (the regulation agent owns the exact table).

### 6.3 Other targets the same kernel serves

| Scheme | Metric | Notes |
|---|---|---|
| LEED v4.1 EQ Daylight; LEED v5 Lighting Paths 3 and 4 | sDA, ASE, distance to glazing | Points in 1.6 |
| LEED Quality Views | Line of sight, content | 1.8 |
| IGBC / GRIHA (India) | Daylight factor or illuminance share, views | Regulation agent to confirm the tables. Same kernel |
| EN 17037 | Target illuminance 300 lux over 50% of area, 50% of daylight hours (DF-equivalent from city median diffuse illuminance); sunlight ≥ 1.5 h on a chosen day | The Hyderabad median diffuse is high, so the DF targets come out low. Calculate per EPW |
| UK BR 209 (home-uk pack) | VSC, APSH, 2 h on 21 March | 1.4 |
| NBC 2016 Part 8 (India) | Daylight factor guidance with an 8,000 lux design sky | Classic IS / SP 41 method. Easy T1 output |

## 7. Validation plan

Tests run on the CPU path (SwiftShader-safe). Golden data is generated once offline, with light jobs only, and committed as fixtures with provenance.

| # | Test | Reference | Pass threshold (proposal) |
|---|---|---|---|
| V1 | SPA vector | SPA paper Table A4.1 | ±1e-5° |
| V2 | SPA vs suncalc over 8,760 Hyderabad hours | SPA | Report the max error. The UI threshold is 0.5° |
| V3 | Perez transposition on unobstructed planes (0°, 90° at N, E, S, W; 17° tilt south) from the Hyderabad EPW | pvlib `get_total_irradiance(model='perez')` | Hourly MBE < 1%, annual < 0.5% |
| V4 | Cumulative radiation, isolated box and street canyons H/W = 0.5, 1, 2, 4 | Ladybug "LB Incident Radiation" (same EPW, same patch density), and Radiance `-ab 0` | Annual per sensor within 3%; mean within 1.5% |
| V5 | Sky view factor of an infinite canyon | Analytic: SVF = cos(atan(2H/W)) for the canyon floor centreline, i.e. 1/sqrt(1 + (2H/W)²) | Within 1% at 577 patches |
| V6 | Shadow hours on 21 December / 21 June for a cube on a plane | Analytic shadow polygons | Cell agreement at least 99% (excluding boundary texels) |
| V7 | CPU vs GPU kernel | CPU | Mean absolute difference < 2%; flag texels near edges |
| V8 | Daylight factor, side-lit rooms (CIE 171:2006 test cases for the sky component; BRE IRC worked examples) | CIE 171 analytic, BRE | SC within 2% abs DF; IRC within the method's own example |
| V9 | sDA/ASE, reference office rooms 4 × 6 m and 8 × 12 m, four orientations, Hyderabad EPW, blinds per LM-83 | Honeybee-Radiance (annual daylight recipe), run once via the companion or offline | ASE within 3 percentage points; sDA within 5 points at T2 and 15 points at T1 (record the actual errors) |
| V10 | ECBC DEF method | ECBC Note 4-1 worked example (Delhi office, 60 × 30 m, 4 floors, VLT 0.39, light shelves, PF ≥ 0.4, head height 3.0 m) | Exact match to the worked numbers |
| V11 | Ledger identity | Construction | Exact (bigint equality), mirrored in the checker |
| V12 | Field check (hobby) | Phone lux meter and timed sun photos at Himalaya block; sun-patch edges on 21 December | Qualitative, logged in STATUS |

Uncertainty display: every room number shows its tier and band, e.g. "sDA 58% (fast estimate, likely 45% to 70%)". Bands come from the V9 results per tier, not from guesses.

## 8. Performance budgets (target, mid-range laptop)

| Task | Budget | Path |
|---|---|---|
| Sun position and a live shadow update | < 16 ms per frame | GPU |
| Sun-hours map, one day, 1 building, 5k sensors | < 1 s | CPU worker |
| Annual radiation, 1 building + 300 m context, 10k sensors, MF:1 | < 5 s CPU, < 1 s GPU | Both |
| ASE per floor (500 sensors, binned annual sun) | < 2 s | CPU |
| sDA T1 per floor | < 1 s | CPU |
| sDA T2 per floor | < 2 min GPU, background | GPU / WebGPU |
| City heat map (2 km², Gachibowli) | progressive, preview only | GPU |

Keep load smooth: at most 2 workers by default (matches the machine rule), progressive refinement, and cancel on edit.

## 9. Open decisions for the orchestrator

1. Where the CPU kernel lives (a new L1.5 `site-kernel` package that may import `three` math and three-mesh-bvh, versus inside `scene`). Recommendation: a new package, with a lint exception scoped to it.
2. Whether SPA trig goes through dmath (deterministic, slower) or Math (fast, preview only). Recommendation: dmath for recorded results.
3. Whether the companion ships a Radiance runner (T3). It is valuable for calibrating the T1 and T2 bands. It is optional at runtime.
4. Install requests (blackboard INTERFACES if frozen): `three-gpu-pathtracer` (T2), `@turf/turf` or `polygon-clipping` (footprint ops), `parquet-wasm` or `hyparquet` (Overture GeoParquet), `geotiff` (DEM and canopy rasters).

## 10. Sources

- NREL SPA: https://midcdmz.nrel.gov/spa/ ; Reda and Andreas, NREL/TP-560-34302 https://www.nrel.gov/docs/fy08osti/34302.pdf
- Perez 1993 sky: https://doi.org/10.1016/0038-092X(93)90017-I ; pvlib Perez https://pvlib-python.readthedocs.io/en/stable/reference/generated/pvlib.irradiance.perez.html
- Robinson and Stone 2004 cumulative sky: https://doi.org/10.1016/j.solener.2004.04.016 ; SRA 2005 https://doi.org/10.1016/j.solener.2005.02.004
- Ladybug radiation study docs: https://ladybug.tools/ladybug-radiance/docs/ladybug_radiance.study.radiation.html ; urban scale thread https://discourse.ladybug.tools/t/ladybug-for-large-urban-scenes-shading-context-and-solar-radiation/21429
- three-mesh-bvh: https://github.com/gkjohnson/three-mesh-bvh ; three-gpu-pathtracer https://github.com/gkjohnson/three-gpu-pathtracer ; three-realtime-rt thread https://discourse.threejs.org/t/three-realtime-rt-turn-on-ray-traced-lighting-for-three-js-soft-shadows-1-bounce-gi-temporal-denoise-webgl2/92763
- IES LM-83-23: https://store.ies.org/product/lm-83-23-approved-method-ies-spatial-daylight-autonomy-sda-and-annual-sunlight-exposure-ase/
- LEED daylight (LEEDuser): https://leeduser.buildinggreen.com/sites/default/files/credit_documentation/LEEDv4.1%20Daylighting%20Credit%20Calculator_Redacted.pdf ; views https://leeduser.buildinggreen.com/credit/NC-v4/EQc8 , https://leeduser.com/blog/quality-views-new-leed-sample-window-credit
- UDI: Nabil and Mardaljevic 2006 https://doi.org/10.1080/09613210500491100
- DGPs: Wienold 2009 http://www.ibpsa.org/proceedings/BS2009/BS09_0944_0951.pdf
- Radiance validation: Reinhart and Andersen 2006 https://doi.org/10.1016/j.enbuild.2006.03.012 ; Jones and Reinhart (Accelerad) https://mit.edu/SustainableDesignLab/publications/15_Jones.pdf
- ECBC 2017 (BEE): §4.2.3 and Note 4-1 (local copy in `sources/`); ECSBC 2024 §5.2.3 (`sources/ecsbc2024.pdf`). LEED v4.1 BD+C (`sources/leed41bdc.pdf`) and LEED v5 BD+C Reference Guide, November 2025 (`sources/leedv5bdc.pdf`). Eco Niwas Samhita 2024: https://beeindia.gov.in/sites/default/files/BEE_ENS_2024.pdf ; ENS 2018 https://policy.asiapacificenergy.org/sites/default/files/Eco-Niwas%20Samhita%202018%20%28Energy%20Conservation%20Building%20Code%20for%20Residential%20Buildings%29.pdf
- BRE BR 209 (2022): https://www.bregroup.com/bookshop/site-layout-planning-for-daylight-and-sunlight-br-209-2022
- Oke 1981 canyon UHI: https://doi.org/10.1002/joc.3370010304 ; Ladybug SolarCal and comfort https://www.ladybug.tools/ladybug/docs/ladybug.solarcal.html , https://github.com/ladybug-tools/ladybug-comfort
- Weather: Climate.OneBuilding India https://climate.onebuilding.org/WMO_Region_2_Asia/IND_India/index.html ; NASA POWER https://power.larc.nasa.gov/docs/services/api/ ; Open-Meteo https://open-meteo.com/en/docs ; PVGIS https://re.jrc.ec.europa.eu/pvg_tools/en/ ; ISHRAE file thread https://onebuilding.org/archive/energyplus-support/msg34397.html
- City data: Overpass https://wiki.openstreetmap.org/wiki/Overpass_API ; Overture buildings https://docs.overturemaps.org/guides/buildings/ ; Google Open Buildings Temporal https://sites.research.google/gr/open-buildings/temporal/ ; Google Open Buildings import (OSM wiki) https://wiki.openstreetmap.org/wiki/Import/Google_Open_Buildings ; GOBS talk https://talks.cam.ac.uk/talk/index/247124/ ; GlobalBuildingAtlas India test https://researchmatters.in/news/researchers-test-globalbuildingatlas-worlds-newest-global-map-buildings-our-cities ; GHSL https://human-settlement.emergency.copernicus.eu/ghs_buildH2023.php ; Copernicus DEM https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model ; Meta canopy height https://registry.opendata.aws/dataforgood-fb-forests/ ; 3DTilesRendererJS https://github.com/NASA-AMMOS/3DTilesRendererJS ; Landsat LST https://www.usgs.gov/landsat-missions/landsat-collection-2-surface-temperature
- Inspiration: Aprilli phototropic housing https://www.aprilli.com/sustainability/phototropic-housing-gbbcb
