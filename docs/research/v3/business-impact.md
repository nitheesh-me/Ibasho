# Business impact and uniqueness (v3)

Brief for the v3 direction: Hyderabad focus, more building types, codes and green ratings, site analysis, optimisation. Author: business impact strategist. Date: 2026-10-11.

Status of facts: web research with light checks only. Vendor prices are mostly unpublished; where a figure is old or from one source, it says so. Treat every number here as a pointer to a source, not as engine data.

## 1. Summary

1. **The market splits in two.** Fast early design tools (cove.tool, Forma, Sefaira, TestFit, Archistar) are paid, Western, and built for firms with Revit or SketchUp. Rigorous tools (DesignBuilder, IES VE, EnergyPlus via Ladybug) are slow, expert only, and arrive after the massing is fixed. Nobody serves the Indian architect, small developer, campus estate office or tenant at the moment of decision.
2. **India has three gates and no single tool for them.** A Hyderabad commercial building must pass the Telangana ECBC at approval (mandatory since 2014, checked online by GHMC with third party assessors), may chase IGBC, GRIHA, LEED or EDGE, and now faces ECSBC 2024 and ENS 2024. Each has its own tool or spreadsheet. A single early pass that answers "do I pass code, and which rating points am I near" is open ground.
3. **What India needs most is what Western tools model worst:** ceiling fans and adaptive comfort (IMAC), humidity and monsoon, diesel backup during outages, water scarcity and tankers, heat waves and warmer futures, rooftop solar under Telangana's 2025 net metering rules, and tenant cost splits.
4. **Ibasho's existing strengths fit this gap exactly:** a deterministic engine, ranges for unknowns, provenance on every number, a checker proved sound in Lean, local first, plain English. These are not features rivals can bolt on quickly.

## 2. Landscape

| Tool | What it does well | Who pays | Gap Ibasho can fill | Source |
|---|---|---|---|---|
| cove.tool | Cloud early design: energy, daylight, views, glare, water, embodied carbon, cost; LEED and code baselines | Mid to large US firms; custom pricing, not published (one 2018 figure: about USD 3,500 a year for 5 seats) | Not India first; no fans, DG or tanker water; black box to clients | https://dealroom.co/companies/cove-tool/ , https://datadrivenaec.com/tools/cove-tool |
| Sefaira (Trimble) | Energy and daylight inside SketchUp, early stage | SketchUp firms | Tied to SketchUp; limited Indian codes; no retrofit or operations | https://sketchup.trimble.com/products/sefaira |
| ClimateStudio (Solemma) | Fast, accurate Radiance daylight (sDA, ASE, glare), EnergyPlus | Rhino users, daylight specialists | Needs Rhino and expertise; desktop; no code plus rating plus money in one pass | https://www.solemma.com/climatestudio |
| Ladybug Tools | Free, open source, the best climate and solar analysis kit (Radiance, EnergyPlus, OpenStudio) | Computational designers | Grasshopper only; steep learning; no story for owners | https://www.ladybug.tools/ |
| Autodesk Forma (was Spacemaker, bought for about USD 240m) | Site context, massing, sun, daylight, wind, noise, operational carbon, in the browser | Planning and design teams; subscription or AEC Collection (older third party price about USD 1,445 a year) | Massing level only; no Indian codes; no ratings; costly for small firms | https://blogs.autodesk.com/forma/2023/05/08/autodesk-introduces-forma-the-next-evolution-of-spacemaker/ , https://www.nasdaq.com/articles/why-autodesk-spent-$240-million-on-this-ai-platform-for-early-stage-real-estate |
| Andrew Marsh web tools | Free, beautiful, instant sun path, shading and psychrometric apps | Students, teachers, architects | Single purpose sketches; no building model, no money, no codes | https://andrewmarsh.com/software/ |
| IFC EDGE app | Free, simple, 20 percent better than baseline in energy, water and materials; India city data; certification via GBCI | Developers in emerging markets, India included | Generic baselines; tick box measures, not geometry; no comfort, no site, no operations | https://edgebuildings.com/ , https://edgebuildings.com/wp-content/uploads/2022/03/ifc0060-edge-brochure-india-en-2021-11-03.pdf |
| DesignBuilder | EnergyPlus GUI, detailed HVAC, ECBC and LEED workflows used by Indian consultants | Energy consultants | Slow, expert, Windows desktop, late in design | https://designbuilder.co.uk/ |
| IES VE | Whole building simulation, compliance, operations twins | Large consultancies | Expensive; expert only; late | https://www.iesve.com/ |
| Archistar | Planning rules plus feasibility plus generative design (Australia, US) | Developers | No India; rules but no physics | https://www.businessnewsaustralia.com/articles/nab--airtree-and-more-back--11m-raise-for-proptech-archistar.html |
| TestFit | Fast feasibility, unit mix, parking, generative design for yield | US developers | Yield only, no energy, no climate | https://aecmag.com/computational-design/testfit-generative-design-targets-building-optimisation |
| Hypar | Cloud space planning and test fits, open functions | Commercial interiors | No energy, comfort or code | https://www.worldconstructionnetwork.com/news/hypar-platform-expansion |
| Gujarat G-ENS platform | ENS 2024 residential compliance (RETV), reports | Gujarat projects | One state, one code, compliance only | https://gujaratensplatform.gbpn.org/faqs |

**Pattern.** Physics tools have no money, code or story; feasibility tools have money but no physics; the free tools (EDGE, Andrew Marsh, Ladybug) are each one slice. None of them prove anything, show uncertainty, or work offline on a laptop in Hyderabad.

## 3. Who is underserved

| Who | Decision they face | When it is made today | What they lack |
|---|---|---|---|
| Indian architect, small practice | Orientation, WWR, shading, roof, wall build up, AC versus fans | Concept, by rule of thumb; energy consultant hired after drawings for ECBC paperwork | A fast, cheap, India aware check during concept |
| Small developer (G+4 to G+10 apartments, small offices) | Which green measures pay, which rating to chase, sale price premium | Late, when the bank or buyer asks | Code plus rating plus cost in one pass, in rupees |
| Campus estate office (IIIT Hyderabad, universities) | Which old hostel or academic block to retrofit first; solar; water | Ad hoc, after a failure or an audit | A portfolio view of existing buildings with measured bills |
| Facility manager | Set points, fan first operation, DG hours, pump schedules | Daily, by habit | Operational what if, with cost and comfort |
| Coworking operator (WeWork India and others; Hyderabad takes a large share of flex demand) | Fit out, AC zoning, per desk energy cost, tenant billing | At lease, without energy data | Per desk and per tenant energy and cost model |
| Landlord, rental | What to fix to keep tenants, who pays for what | Rarely | Fair split of bills and gains between owner and tenant |
| Tenant (Ravi) | Which room to sleep in during May, fan versus AC, what to ask the landlord | Never formally | Plain English advice on things a tenant can change |
| Students | Learning building physics | Courses using EnergyPlus or Ladybug | A visual, honest, open model to play with |

## 4. Decisions made too late

| Decision | Why it is late | Cost of lateness |
|---|---|---|
| Massing and orientation for sun and heat gain | Energy model comes after layout is fixed for ECBC submission | Cooling load locked in for 50 years |
| Window to wall ratio and shading on west and south | Facade chosen for looks, then checked | Glare, high AC, blinds always down |
| Fan first versus full AC design | Comfort assumed to need 24 degrees C sealed AC | IMAC work suggests set points of 28 to 30 degrees C with a fan can save 44 to 67 percent of cooling energy versus 24 degrees C (https://ideas.repec.org/a/gam/jeners/v16y2023i19p6807-d1247433.html) |
| Rainwater harvesting and water reuse sizing | Done to satisfy bylaws, not to cut tanker spend | 12,500 Hyderabad apartments booked tankers in 2025 versus 4,000 the year before (https://www.siasat.com/hyderabad-water-tanker-bookings-soar-as-monsoon-remains-elusive-3505532/amp/) |
| Rooftop PV area and structure | Roof given to services and water tanks first | Lost roof area under Telangana 2025 net metering rules (https://www.mercomindia.com/telangana-regulator-issues-rooftop-solar-regulations-2025) |
| Green rating target | Picked after design; points chased with add ons | Expensive measures for cheap points |
| Backup power sizing | DG sized to full load by habit | Diesel power costs about Rs 25 to 40 per kWh versus grid about Rs 8.5 to 11 per kWh for LT commercial in Telangana (https://powerline.net.in/2026/08/06/keeping-the-lights-on-growing-demand-for-fuel-efficient-and-reliable-backup-solutions/ , https://tgsouthernpower.org/resources/PDF/Tariffs/63tarifffile.pdf) |

## 5. What nobody models well

| Topic | Why it matters in Hyderabad | Who models it today | Data to use |
|---|---|---|---|
| Adaptive comfort with ceiling fans | Most Indian homes and many offices run mixed mode | Research only (CEPT IMAC, IMAC R) | IMAC and IMAC R bands; ASHRAE 55 elevated air speed (https://opus.lib.uts.edu.au/handle/10453/134672) |
| Monsoon humidity and latent load | Comfort and AC sizing in July to September | Detailed simulators only | ISHRAE or EPW weather, psychrometrics |
| Diesel backup and outages | Cost, carbon, PM2.5; about 1.47 million DG sets over 5 kVA in India in 2022 | Nobody in early design | CSTEP via https://carboncopy.info/bengaluru-mumbai-patna-with-the-highest-pm2-5-emissions-from-diesel-generators-study |
| Water scarcity | Tankers, borewells, rainwater harvesting payback | EDGE (water percent only) | HMWSSB tariffs and tanker prices; rainfall data |
| Heat waves and future climate | Hyderabad around 44 degrees C average maximum in May 2024; state above 46 degrees C (https://newsonair.gov.in/telangana-experiences-severe-heatwave-conditions-18-districts-record-temperatures-exceeding-46-degrees-celsius) | Rare, morphing of weather files by experts | Morphed EPW (CCWorldWeatherGen style), heat index hours |
| Tenant energy split | Coworking, rentals, malls | Billing software, not design tools | Submeter logic, area and occupancy rules |
| Retrofit of existing campus blocks | IIIT, universities, government buildings | Energy auditors with spreadsheets | Bills plus calibrated model (Ibasho already does this for homes) |
| Code plus rating in one early pass | Telangana ECBC mandatory at approval since 2014 (https://www.nrdc.org/experts/implementing-ecbc-and-cool-roofs-telangana); ECSBC 2024 adds ECSBC+, Super ECSBC and renewable provision (https://beeindia.gov.in/sites/default/files/BEE_ECSBC_2024.pdf) | Separate consultants per gate | Codes as Ibasho rules packs |
| Explaining trade offs to non experts | Owners, campus committees and tenants decide | Nobody | Ibasho narrator plus red thread provenance |
| Grid carbon in India | 0.727 kgCO2 per kWh weighted average, FY 2023 to 24 (CEA v20) | Often a US or UK factor | https://cea.nic.in/wp-content/uploads/2021/03/User_Guide_Version_20.0.pdf |

Context: India's cooling demand in buildings is projected to grow about elevenfold from 2017 to 18 by 2037 to 38, with room AC ownership rising from about 8 percent to about 40 percent of households (India Cooling Action Plan, via https://www.unep.org/news-and-stories/story/india-advances-ground-breaking-plan-keep-planet-and-people-cool). Every design decision that avoids an AC compounds.

## 6. Proposed unique features

Each one reuses the engine, rules packs, provenance and checker. Ranked by impact over effort.

### F1. Three gates, one pass (code, rating, money)

One screen, updated live as the user edits: **Telangana ECBC or ECSBC 2024 pass or fail by clause**, **nearest rating points** (IGBC, GRIHA, LEED, EDGE percent saving), and **rupees** (capex, annual bill, payback). Each gate is a rules pack; Kleene logic shows "unknown" for missing inputs rather than a false pass.

- Who: Indian architects, small developers, campus estate offices.
- Why untapped: each gate today has its own consultant and tool; EDGE is free but generic, DesignBuilder is late and expert. Nobody shows "two cheap changes take you from fail to ECSBC+ and 4 IGBC points".
- Ibasho edge: "Why not?" exclusions and the red thread make compliance auditable for the third party assessor.

### F2. Fan first comfort map

For every room, hours inside the IMAC or IMAC R 80 percent band with windows and fans only, then with AC at 26, 28 or 30 degrees C. The output is not just kWh but "this room needs AC for 310 hours a year; with a fan, 120". Includes humidity limits for the monsoon.

- Who: architects, tenants, facility managers, campuses (hostels are fan rooms).
- Why untapped: Western tools assume sealed AC at fixed set points; IMAC lives in papers.
- Ibasho edge: honest comfort with ranges; ties to the cooling action plan story.

### F3. Outage, diesel and solar ledger

Model grid outage hours, DG set size and fuel, battery, and rooftop PV under Telangana's 2025 net metering caps (80 percent of contracted demand for commercial). Report true rupees per kWh, CO2 with the CEA factor, and PM2.5 from diesel. Suggest right sizing DG and replacing hours with batteries.

- Who: offices, hospitals, labs, hotels, apartment associations, coworking.
- Why untapped: no early design tool treats backup power as part of energy; yet diesel costs three to four times grid power.
- Ibasho edge: fixed point money and carbon with provenance; the checker can prove no cheaper backup mix was hidden.

### F4. Water and heat futures

A "summer 2040" toggle: morphed weather for Hyderabad, extra heat wave days, and a water balance (rainwater harvesting, greywater reuse, borewell, tanker days and cost). Shows which design holds up when the climate warms and the monsoon fails.

- Who: developers, apartment associations, campuses, insurers in the long run.
- Why untapped: future climate files are an expert craft; water is a single percent in EDGE. Nobody shows tanker spend and heat hours together.
- Ibasho edge: unknown is not zero; futures shown as ranges.

### F5. Campus portfolio retrofit (IIIT Hyderabad as hero)

Load several existing buildings (Vindhya, Himalaya, hostels) from drawings, add their bills, calibrate each (as Ibasho already does for homes), then rank retrofits across the campus under one budget: cool roofs, shading, fan upgrades (BLDC), PV, chiller tuning. Output a five year plan with a proof that no better plan under the same budget was hidden.

- Who: university estate offices, government buildings, corporate campuses.
- Why untapped: audits are spreadsheets, one building at a time; no tool does calibrated portfolio optimisation with a certificate.
- Ibasho edge: bill calibration, search over buildable packages and the Lean checker scale naturally from one home to a campus.

### F6. Fair split for owners and tenants

Split energy and water bills and retrofit gains between landlord and tenants, or between coworking members per desk and per zone, using submeter logic and documented rules. Show "this LED and fan upgrade pays the landlord back in 3 years if rent rises Rs X, or the tenant in 2 years if they fund it". Plain English, with the split method visible.

- Who: landlords, tenants (Ravi), coworking operators, small offices.
- Why untapped: the split incentive is the main reason rental buildings are not retrofitted, and design tools ignore who pays.
- Ibasho edge: bookkeeping that sums exactly (Lean checks that the split adds up to the bill and nothing is double counted).

### F7. Site twin in the real city with phototropic massing

Place the building in a 3D Hyderabad block (OpenStreetMap buildings with heights), then compute sun hours, radiation on each facade and roof, shadows cast on neighbours, sDA and ASE per floor and views. Add a "phototropic" search, inspired by April Li's phototropic housing (https://www.aprilli.com/sustainability/phototropic-housing-gbbcb): step and tilt floors to trade winter sun, summer shade and neighbour daylight, in a hot climate where the goal is often less sun, not more.

- Who: architects, developers, planning reviewers, students.
- Why untapped: Forma does context but no Indian codes, money or ratings; Ladybug needs Grasshopper. Nobody combines the neighbours' loss of sun with your own energy.
- Ibasho edge: deterministic, offline, beautiful Andon rendering; results feed F1 directly.

### F8. Decision memory and grounded advisor

AI memory that remembers the user's constraints ("no inside insulation", "budget Rs 40 lakh", "hostel must stay open in May") and re-runs recommendations when bills, tariffs or codes change, for example when TGERC updates tariffs or a state notifies ECSBC. It narrates what changed and why, but every digit comes from the engine.

- Who: everyone, especially non experts and committees.
- Why untapped: AI design assistants invent numbers; simulation tools do not remember why.
- Ibasho edge: the grounding validator already blocks numbers the engine did not produce.

## 7. Impact and effort

| Feature | Users reached | Uniqueness | Effort | Builds on |
|---|---|---|---|---|
| F1 Three gates | High | High | Medium (rules packs for ECBC, ECSBC, ENS, IGBC, EDGE, LEED subsets) | Kleene rules, packs |
| F2 Fan first comfort | High | Very high | Low to medium | Monthly engine plus hourly comfort module |
| F3 Outage and solar ledger | High | Very high | Medium | Money and carbon fixed point |
| F4 Water and heat futures | Medium | High | Medium | Climate pack, ranges |
| F5 Campus portfolio | Medium (high value per user) | Very high | High | Calibration, search, checker |
| F6 Fair split | Medium | Very high | Low | Bookkeeping, Lean |
| F7 City site twin | High (visual hook) | Medium to high | High | Scene, new solar module |
| F8 Decision memory | High | High | Medium | Narrator, memory |

Suggested order: F2 and F6 (cheap, unique), then F1 and F3 (the Hyderabad wedge), then F7 (the demo wow), then F5 with IIIT data, with F4 and F8 woven through.

## 8. Positioning in one line

"The only tool that tells an Indian architect, campus or tenant, in plain English and in rupees, whether a building passes code, how close it is to a green rating, how it feels with a fan, what an outage and a dry summer cost, and proves it hid nothing better."

## 9. Risks and honesty

- Codes are copyrighted (BEE asks not to reproduce ECSBC and ENS text). Encode the rules and cite clauses; do not copy text.
- Ibasho is not a certified compliance tool. Label outputs "pre check, not a certificate" and point to TPAs, IGBC, GRIHA or GBCI.
- IMAC bands and morphing methods carry uncertainty; show ranges.
- Tariffs change yearly (TGERC). Store them as dated data with source.
- LEED and IGBC points need judgement; show "likely", "possible", "unknown", never a score that looks final.

## 10. Sources

- cove.tool: https://dealroom.co/companies/cove-tool/ , https://datadrivenaec.com/tools/cove-tool , https://www.g2.com/products/cove-tool/pricing
- Sefaira: https://sketchup.trimble.com/products/sefaira
- ClimateStudio: https://www.solemma.com/climatestudio (pricing not verified)
- Ladybug Tools: https://www.ladybug.tools/
- Forma: https://blogs.autodesk.com/forma/2023/05/08/autodesk-introduces-forma-the-next-evolution-of-spacemaker/ , https://www.nasdaq.com/articles/why-autodesk-spent-$240-million-on-this-ai-platform-for-early-stage-real-estate , https://www.aecplustech.com/tools/autodesk-forma
- Andrew Marsh: https://andrewmarsh.com/software/
- EDGE: https://edgebuildings.com/ , https://edgebuildings.com/wp-content/uploads/2022/03/ifc0060-edge-brochure-india-en-2021-11-03.pdf , https://yourstory.com/2016/05/ifc-edge/
- DesignBuilder: https://designbuilder.co.uk/ ; IES VE: https://www.iesve.com/
- Archistar: https://www.businessnewsaustralia.com/articles/nab--airtree-and-more-back--11m-raise-for-proptech-archistar.html ; TestFit: https://aecmag.com/computational-design/testfit-generative-design-targets-building-optimisation ; Hypar: https://www.worldconstructionnetwork.com/news/hypar-platform-expansion
- ECSBC 2024: https://beeindia.gov.in/sites/default/files/BEE_ECSBC_2024.pdf , https://mercomindia.com/bees-new-building-code-could-boost-solar-adoption-in-commercial-buildings , draft extension to 20,000 m2 (June 2026): https://powermin.gov.in/static/uploads/2026/07/f981ac1fc7a15c1136606ec2cd1979ca.pdf
- ENS 2024: https://www.beeindia.gov.in/sites/default/files/BEE_ENS_2024.pdf ; G-ENS: https://gujaratensplatform.gbpn.org/faqs
- Telangana ECBC: https://www.nrdc.org/experts/implementing-ecbc-and-cool-roofs-telangana , https://www.nrdc.org/press-releases/hyderabad-pioneers-online-energy-conservation-building-code-certification-becoming , https://www.ghmc.gov.in/Townplanning_Reports/TSECBCFAQs.pdf
- IMAC: https://opus.lib.uts.edu.au/handle/10453/134672 , https://ideas.repec.org/a/gam/jeners/v16y2023i19p6807-d1247433.html , https://asiacleanenergyforum.adb.org/wp-content/uploads/2018/06/Rajan-Rawal-Adaptive-Thermal-Comfort_-Practices-and-Policies.pdf
- Tariffs: https://tgsouthernpower.org/resources/PDF/Tariffs/63tarifffile.pdf
- Rooftop solar: https://www.mercomindia.com/telangana-regulator-issues-rooftop-solar-regulations-2025 , https://solarquarter.com/2025/08/25/telangana-issues-new-draft-regulation-for-rooftop-solar-systems-in-2025
- Diesel: https://powerline.net.in/2026/08/06/keeping-the-lights-on-growing-demand-for-fuel-efficient-and-reliable-backup-solutions/ , https://cseindia.org/content/downloadreports/8033 , https://carboncopy.info/bengaluru-mumbai-patna-with-the-highest-pm2-5-emissions-from-diesel-generators-study
- Water and heat: https://www.siasat.com/hyderabad-water-tanker-bookings-soar-as-monsoon-remains-elusive-3505532/amp/ , https://thesouthfirst.com/news/as-temperature-increases-in-hyderabad-so-do-water-woes , https://newsonair.gov.in/telangana-experiences-severe-heatwave-conditions-18-districts-record-temperatures-exceeding-46-degrees-celsius
- Grid carbon: https://cea.nic.in/wp-content/uploads/2021/03/User_Guide_Version_20.0.pdf , https://www.climatiq.io/data/source/government-of-india-_-central-electricity-authority
- Cooling: https://www.unep.org/news-and-stories/story/india-advances-ground-breaking-plan-keep-planet-and-people-cool
- Green building scale (IGBC over 20,000 registered projects, figures vary): https://themachinemaker.com/news/green-building-congress-2026-to-drive-indias-net-zero-transition/
- Hyderabad office and flex: https://research.jllapsites.com/appd-market-report/q3-2025-office-hyderabad , https://allwork.space/2026/02/wework-india-to-add-3300-desks-in-hyderabad , https://www.nbmcw.com/news/hyderabad-holds-highest-vacant-office-stock-of-28-mn-sq-ft-vestian.html
- Phototropic housing: https://www.aprilli.com/sustainability/phototropic-housing-gbbcb
