# Regulation, building control and city planning: feasibility rules for Ibasho

Status: research brief, retrieved 2026-10-10. Scope: England (primary), Wales (variant), Scotland (stub), India with Telangana (secondary market). Owner: regulation specialist agent.

## 1. Purpose and position in the pipeline

M1 says "search only what can be built": every candidate package is filtered for feasibility before it reaches the Pareto front, and Lean proves that every accepted package is feasible. This brief supplies the rules that define "feasible". Each rule is a small, pure, versioned record with a condition over home and measure attributes, an effect, and a source. Rules ship as plugin packs (one per jurisdiction), so Telangana, Wales or a city layer can be added without touching the core.

Three design decisions follow from the research:

1. **Three effects are not enough; use five.** `block` (cannot be built at all), `consent` (buildable only after someone says yes: LPA, listed building consent, freeholder, RWA, DISCOM, highway authority, neighbour), `oblige` (buildable, but the law forces a specific spec, for example a whole wall to U 0.30 or extra ventilation), `warn` (legal but risky, or rule unverifiable), `info` (incentives and context). `oblige` is the important addition: it changes cost and physics, so the optimiser must apply it before scoring.
2. **Unknown is not false.** Following M1 ("unknown ≠ 0"), conditions evaluate in three-valued logic. A `block` whose condition is `unknown` marks the package `needs-check`, never silently feasible.
3. **Rules carry provenance grades.** `primary` (I read the legal or standard text), `secondary` (council or trade summary), `announced` (policy decided, law not yet made). The UI shows the grade beside every consent card.

## 2. Assumptions challenged

| Common belief | What the primary source says | Consequence for Ibasho |
|---|---|---|
| "ASHP permitted development needs 42 dB(A) at the neighbour" | MCS 020 a) Issue 1.1 (14/04/2025) sets **37.0 dB LAeq,5min**, at 1 m from the neighbour's habitable room window or door, ignoring the façade effect, with no background noise credit. Many installer blogs still quote 42 dB from old MCS 020. | Encode 37.0 and the exact formula. This is the most testable rule in the pack and the best visual story. |
| "The 1 m boundary rule is gone, so siting is easy" | The 1 m rule was removed on 29 May 2025 (SI 2025/560), but the noise test is unchanged in spirit, and moving a unit towards the boundary usually shortens `r` to the neighbour's window. | Keep the retired rule in the pack with `effectiveTo: 2025-05-28` so the history is visible; the binding constraint is noise. |
| "Part O applies when we insulate" | Part O applies only to new residential buildings; not to change of use or extensions (gov.uk FAQ). | Overheating becomes an Ibasho **advisory** warn after airtightening, labelled as not a legal requirement. |
| "Future Homes Standard affects retrofit" | FHS (AD L 2026, AD F 2026) takes effect 24 March 2027 for new work; existing-element tables are unchanged (Table 3.3 in 2026 equals Table 4.3 in 2021). | Retrofit rules use the same U-values before and after 2027; flow temperature and heat pump sizing text tightens. |
| "MEES 2030 is law" | Government response of 21 January 2026 is policy. Statutory instrument expected 2027. EPC E remains the legal minimum until 1 October 2030. | Two rules: current E (`primary`) and 2030 C (`announced`). |
| "Indian codes apply to every home" | ENS 2024 applies to residential buildings with connected load of 100 kW or more, contract demand of 120 kVA or more, or plot area of 3000 m² or more. A single Hyderabad flat or bungalow is out of scope. | ENS becomes a **benchmark** score for houses and a real `oblige` rule only for large societies. |
| "Exporting rooftop solar pays like importing" | TGERC draft (Aug 2025) settles monthly surplus at the lowest discovered solar bid tariff, far below retail. | Optimiser sizes PV for self-consumption; export value is a separate, low line. |
| "External wall insulation is permitted development" | Only for dwellinghouses, only with a similar-appearance finish, and never on Article 2(3) land. Flats have no Part 1 householder PD at all. | Most brick-to-render EWI in England needs planning permission. |

## 3. Rule schema (plugin contract)

```ts
type Jurisdiction = 'GB-ENG' | 'GB-WLS' | 'GB-SCT' | 'IN' | 'IN-TG' | 'CITY';
type Authority = 'LPA' | 'LPA-prior-approval' | 'LBC' | 'building-control'
  | 'freeholder' | 'landlord' | 'RWA' | 'DISCOM' | 'highway' | 'neighbour';

type Effect =
  | { kind: 'block'; reason: string }
  | { kind: 'consent'; authority: Authority; typicalWeeks?: number; feeGBP?: number }
  | { kind: 'oblige'; spec: Obligation }      // e.g. { element: 'wall', maxU: 0.30 }
  | { kind: 'warn'; risk: string }
  | { kind: 'info'; note: string; valueGBP?: number; valueINR?: number };

interface Rule {
  id: string;                     // stable, e.g. 'ENG.PD.ASHP.NOISE'
  jurisdiction: Jurisdiction;
  measures: MeasureKind[];        // which measures it can touch ('*' for package rules)
  scope: 'measure' | 'package';   // package rules see the whole set (AD F counting)
  when: Expr;                     // pure predicate, three-valued
  effect: Effect | ((ctx) => Effect);
  effectiveFrom: string; effectiveTo?: string;
  source: { url: string; clause: string; grade: 'primary' | 'secondary' | 'announced' };
  explain: string;                // template for the narrator, numbers filled from ctx
}
```

`Expr` is a small JSON AST (`and`, `or`, `not`, `cmp`, `in`, `fn`) rather than arbitrary code, so the same rule can be evaluated in TypeScript, rendered as a sentence, and exported to Lean as data. Named functions (`fn`) are the escape hatch for numeric procedures that deserve their own tests: `mcs020a_Lp`, `adf_category`, `ens_retv`.

Evaluation order: (1) filter by jurisdiction and date, (2) evaluate measure rules per measure, (3) evaluate package rules, (4) apply all `oblige` specs to the package (they change U-values, add MEV or bigger radiators), (5) re-run physics, (6) package status = `blocked` if any block is true, `needs-check` if any block is unknown, else `feasible` with a **consent ledger** (union of all consent effects).

## 4. Home attributes the rules need

| Group | Attributes | Typical source |
|---|---|---|
| Location | `jurisdiction`, `lpa`, `discom`, `climateZone` (NBC: composite for Hyderabad) | postcode or PIN |
| Designations | `listedGrade` (I, II*, II, none), `inCurtilageOfListed`, `article23Land` (conservation area, National Park, AONB/National Landscape, Broads, WHS), `article4RemovedClasses[]`, `scheduledMonument` | planning.data.gov.uk datasets: `listed-building-outline`, `conservation-area`, `article-4-direction-area`, `world-heritage-site`, `scheduled-monument` |
| Form | `dwellingType` (detached, semi, terrace, flat, maisonette), `storeys`, `topFloorHeightM`, `isBlockOfFlats` | user, EPC |
| Tenure | `tenure` (owner, landlordPRS, tenantPRS, leaseholder, socialTenant), `leaseAlterationCovenant` (absolute, qualified, silent, unknown), `roofIsCommonArea` | user, lease |
| Fabric | per element: `type`, `U`, `areaM2`, `historicVapourOpen`; per elevation: `frontsHighway`, `onBoundary`, `backOfFootway`, `finish` | twin |
| ASHP siting | `units[]` with `LwA`, `volumeM3`, `mount` (ground, wall, flatRoof, pitchedRoof), `floorLevel`, `edgeDistM`, `reflectiveSurfaces`, and per assessment position `rM`, `barrierType`, `lineOfSight` | 3D twin |
| Energy | `epcBand`, `epcIssued`, `propertyValueGBP`, `sanctionedLoadKW`, `dtUtilisation` | EPC register, DISCOM |
| History | `pastMeasures[]` with dates (needed by AD F counting and MEES cap) | memory store |

## 5. The rule table

Notation: `h` is the home, `m` the measure, `p` the package. Effects: B block, C consent (authority), O oblige, W warn, I info. Grade: P primary, S secondary, A announced.

### 5.1 England: permitted development (GPDO 2015 Sch 2)

| id | condition | effect | grade | source |
|---|---|---|---|---|
| ENG.PD.ASHP.LISTED | `m=ashp ∧ (h.listedGrade≠none ∨ h.inCurtilageOfListed)` | C(LPA) + C(LBC) | S | [Oxford CC](https://www.oxford.gov.uk/planning-advice/planning-advice-heat-pumps), [GPDO Pt14](https://www.legislation.gov.uk/uksi/2015/596/schedule/2/part/14) |
| ENG.PD.ASHP.SCHEDMON | `m=ashp ∧ h.scheduledMonument` | C(LPA) | S | as above |
| ENG.PD.ASHP.NOISE | `m=ashp ∧ ∃ap: mcs020a_Lp(units, ap) > 37.0` | C(LPA) | P | [MCS 020 a) Issue 1.1](https://mcscertified.com/wp-content/uploads/2025/04/MCS-020-a-Issue-1.1-Final.pdf) |
| ENG.PD.ASHP.LIGHTWELL | `m=ashp ∧ ∃u: u.reflectiveSurfaces > 3` | C(LPA) (fails MCS 020 a) | P | MCS 020 a) Step 4 |
| ENG.PD.ASHP.VOLUME | `m=ashp ∧ ∃u: u.volumeM3 > (h.isBlockOfFlats ? 0.6 : 1.5)` | C(LPA) | S | Oxford CC, [MCS news](https://mcscertified.com/new-permitted-development-rules-in-england-air-source-heat-pump-installations-must-now-comply-with-mcs-020-a/) |
| ENG.PD.ASHP.COUNT | `m=ashp ∧ count(units) > (h.dwellingType=detached ? 2 : 1)` | C(LPA) | P | [SI 2025/560](https://www.legislation.gov.uk/uksi/2025/560) |
| ENG.PD.ASHP.WIND | `m=ashp ∧ h.hasWindTurbine` | C(LPA) | S | Oxford CC |
| ENG.PD.ASHP.PITCHED | `m=ashp ∧ u.mount=pitchedRoof` | C(LPA) | S | Oxford CC |
| ENG.PD.ASHP.FLATROOF | `m=ashp ∧ u.mount=flatRoof ∧ u.edgeDistM < 1.0` | C(LPA) | S | Oxford CC |
| ENG.PD.ASHP.HWY23 | `m=ashp ∧ h.article23Land ∧ (u.onElevation.frontsHighway ∨ u.nearerHighwayThanHouse)` | C(LPA) | S | Oxford CC |
| ENG.PD.ASHP.HWYGF | `m=ashp ∧ ¬h.article23Land ∧ u.onElevation.frontsHighway ∧ u.floorLevel > 0` | C(LPA) | S | Oxford CC |
| ENG.PD.ASHP.COOLONLY | `m=ashp ∧ m.mode=coolingOnly` | C(LPA) | S | Oxford CC |
| ENG.PD.ASHP.BOUNDARY1M | `m=ashp ∧ u.boundaryDistM < 1.0` (effectiveTo 2025-05-28) | C(LPA) | P | SI 2025/560 (retired) |
| ENG.PD.ASHP.SITING | `m=ashp` | W: site to minimise visual and amenity impact; remove when unused | S | Oxford CC |
| ENG.PD.PV.PROJ | `m=pv ∧ m.onPitchedOrWall ∧ m.projectionM > 0.2` | C(LPA) | S | [Wyre Forest DC](https://www.wyreforestdc.gov.uk/planning-and-buildings/planning-for-householders/installation-of-solar-panels-on-domestic-properties) |
| ENG.PD.PV.HEIGHT | `m=pv ∧ roof=pitched ∧ m.topZ > h.roofRidgeZ` (chimneys excluded) | C(LPA) | S | Wyre Forest DC |
| ENG.PD.PV.FLAT06 | `m=pv ∧ roof=flat ∧ m.topZ > h.roofHighestZ + 0.6` | C(LPA) | S | [SI 2023/1279](https://www.legislation.gov.uk/uksi/2023/1279), [Cornwall](https://www.cornwall.gov.uk/planning-and-building-control/planning-advice-and-guidance/solar-panels-and-planning-permission/) |
| ENG.PD.PV.FLAT23 | `m=pv ∧ roof=flat ∧ h.article23Land` | C(LPA-prior-approval) on visual impact | S | Cornwall |
| ENG.PD.PV.WALL23 | `m=pv ∧ m.mount=wall ∧ h.article23Land ∧ wall.frontsHighway` | C(LPA) | S | Wyre Forest DC |
| ENG.PD.PV.LISTED | `m=pv ∧ (listed ∨ curtilageListed ∨ scheduledMonument)` | C(LPA) + C(LBC) | S | Wyre Forest DC |
| ENG.PD.ART4 | `m.pdClass ∈ h.article4RemovedClasses` | C(LPA) | P | [GPDO art 4](https://www.legislation.gov.uk/uksi/2015/596/article/4), [planning.data.gov.uk](https://www.planning.data.gov.uk/dataset/) |
| ENG.PD.EWI.FLAT | `m=ewi ∧ h.dwellingType∈{flat, maisonette}` | C(LPA) (Part 1 PD is for dwellinghouses only) | S | [Croydon](https://www.croydon.gov.uk/household-retrofit-guidance-private-properties/Insulating%20your%20property/external-walls), [GPDO Pt1](https://www.legislation.gov.uk/uksi/2015/596/schedule/2/part/1) |
| ENG.PD.EWI.ART23 | `m=ewi ∧ h.article23Land ∧ m.finish ∈ {render, stone, pebbledash, timber, plastic, tiles}` | C(LPA) | S | GPDO Pt1 Class A, [gov.wales mirror](https://www.gov.wales/planning-permission-external-walls) |
| ENG.PD.EWI.LOOK | `m=ewi ∧ m.finish ≠ similar(h.elevation.finish)` | C(LPA) | S | Croydon, GPDO Pt1 A.3(a) |
| ENG.LB.ANY | `(listed ∨ curtilageListed) ∧ m.altersCharacter` (includes internal works: IWI, windows, secondary glazing fixings, floors) | C(LBC); unconsented works are a criminal offence | P | [P(LBCA)A 1990 s7](https://www.legislation.gov.uk/ukpga/1990/9/section/7) |
| ENG.LB.LLBCO | `h.inLocalLBCOArea ∧ m ∈ order.coveredMeasures` | replaces C(LBC) with conditions | S | [Bristol Clifton LLBCO](https://services.bristol.gov.uk/files/documents/10053-clifton-local-listed-building-consent-order-llbco-guidance) |

### 5.2 England: Building Regulations

| id | condition | effect | grade | source |
|---|---|---|---|---|
| ENG.BR.L.RENOV | `m ∈ {ewi, iwi, cwi, roofReplace, flatMembrane} ∧ (m.areaShare(element) > 0.5 ∨ p.envelopeShare > 0.25)` | O: whole element to U ≤ wall ext/int 0.30, cavity 0.55, roof 0.16, floor 0.25; if not feasible or payback > 15 yr, best feasible with U ≤ 0.7 | P | [AD L 2021 Vol 1](https://assets.publishing.service.gov.uk/media/662a2e3e55e1582b6ca7e592/Approved_Document_L__Conservation_of_fuel_and_power__Volume_1_Dwellings__2021_edition_incorporating_2023_amendments.pdf) para 4.11 to 4.13, 11.3, Table 4.3 |
| ENG.BR.L.NEWEL | `m ∈ {windows, doors, newWall, newRoof, newFloor}` | O: window U ≤ 1.4 or WER B; wall 0.18, roof 0.15, floor 0.18 | P | AD L 2021 Table 4.2 |
| ENG.BR.L.FLOW55 | `m ∈ {ashp, gshp, wetSystemReplace} ∧ (newWet ∨ fullyReplacedWet)` | O: emitters sized for flow ≤ 55 °C, or lowest feasible | P | AD L 2021 5.10; [AD L 2026](https://assets.publishing.service.gov.uk/media/69c122a6cfa346b9d4704a55/ADL1_2026.pdf) 4.10 |
| ENG.BR.L.HPSIZE | `m ∈ {ashp, gshp}` | O: meet full design heat loss, no reliance on secondary heaters; from 2027-03-24 ASHP inverter driven and modulating to mid-season load | P | AD L 2026 4.12 to 4.14 |
| ENG.BR.L.HPSITE | `m=ashp ∧ u.adjacentToBedroom` | W | P | AD L 2021 6.42 |
| ENG.BR.L.HIST | `h.historicVapourOpen ∧ m ∈ {iwi, ewi}` | W: improve only where no long-term fabric deterioration; breathable systems | P | AD L 2026 0.11 |
| ENG.BR.F.CAT | `p` contains energy efficiency measures; compute `cat = adf_category(major, minor)` incl. `h.pastMeasures` | A: none; B: O natural vents (1.47 to 1.59) or cMEV or MVHR; C: O cMEV or MVHR or expert natural design | P | [AD F 2021 Vol 1](https://assets.publishing.service.gov.uk/media/61deba42d3bf7f054fcc243d/ADF1.pdf) 3.6 to 3.13, Table 3.1, Diagram 3.1 |
| ENG.BR.F.WIN | `m=windows ∧ existing windows have trickle vents` | O: replacements include background ventilators | P | AD F 2021 3.14 |
| ENG.BR.O.ADVISORY | `p` raises airtightness ∧ (`h.topFloorFlat ∨ singleAspect ∨ glazing S/W > 25%`) | W (Ibasho advisory; Part O does not apply to existing homes) | P | [Part O FAQ](https://www.gov.uk/guidance/approved-document-o-overheating-frequently-asked-questions) |
| ENG.BR.B.REG7 | `m=ewi ∧ h.topFloorHeightM ≥ 18 ∧ m.insulantClass ∉ {A1, A2-s1,d0}` | B | P | [Building Regs 2010 reg 7](https://www.legislation.gov.uk/uksi/2010/2214/regulation/7) |
| ENG.BR.B.11M | `m=ewi ∧ 11 ≤ h.topFloorHeightM < 18` | W: AD B external wall guidance applies | S | AD B Vol 1 |
| ENG.BR.NOTIFY | `m ∈ {ewi, iwi, cwi, windows, ashp, gshp, pv, mvhr}` | C(building-control) or competent person scheme self-certification | S | Croydon, AD L/F |
| ENG.FHS.SCOPE | `h.isNewBuild ∧ workStart ≥ 2027-03-24` | I: FHS 2026 standards apply; not used for retrofit | P | [Circular 01/2026](https://www.gov.uk/government/publications/the-future-homes-and-buildings-standards-building-circular-012026/the-future-homes-and-buildings-standards-building-circular-012026-letter) |
| ENG.EWI.HWY | `m=ewi ∧ elevation.backOfFootway` | C(highway) for projection over the highway | S | local highway authority practice |
| ENG.EWI.BOUNDARY | `m=ewi ∧ elevation.onBoundary` | C(neighbour) for encroachment, W fire separation | S | Croydon (party matters to professional) |

### 5.3 Tenure, rentals and incentives (England and Wales)

| id | condition | effect | grade | source |
|---|---|---|---|---|
| UK.TEN.LEASE | `h.tenure=leaseholder ∧ m.touches ∈ {roof, externalWall, commonParts, structure}` | C(freeholder). Qualified covenant: consent not unreasonably withheld | P | [LTA 1927 s19](https://www.legislation.gov.uk/ukpga/Geo5/17-18/36/section/19), [Nesta](https://www.nesta.org.uk/blog/four-realities-for-installing-a-heat-pump-in-a-flat/) |
| UK.TEN.LEASE.ABS | `UK.TEN.LEASE ∧ h.leaseAlterationCovenant=absolute` | W: needs deed of variation or court certificate (LTA 1927 Pt I); treat as long-lead consent | S | LTA 1927 |
| UK.TEN.TENANT | `h.tenure ∈ {tenantPRS, socialTenant} ∧ m.fixed` | C(landlord) | S | general law of tenancy |
| UK.TEN.SPLIT | `h.tenure=landlordPRS` | I: payer is landlord, saver is tenant; show both ledgers | n/a | M1 |
| EW.MEES.NOW | `h.tenure=landlordPRS ∧ h.epcBand ∈ {F, G} ∧ ¬h.exemption` | B on letting; O: reach E | P | [PRS Regs 2015](https://www.legislation.gov.uk/uksi/2015/962) |
| EW.MEES.2030 | `h.tenure=landlordPRS ∧ ¬(h.epcEER ≥ C ∧ h.epcIssued < 2029-10-01) ∧ ¬shortLet` | O: by 2030-10-01 meet fabric standard plus heating or smart standard (band C equivalent), spend up to cap; cap = £10,000 per 10 yr, or 10% of value if value < £100,000; spend since 2025-10-01 counts; BUS grant does not | A | [Gov response 21 Jan 2026](https://www.gov.uk/government/consultations/improving-the-energy-performance-of-privately-rented-homes-2025-update/outcome/improving-the-energy-performance-of-privately-rented-homes-government-response-html) |
| EW.MEES.EXEMPT3P | `EW.MEES.* ∧ some required consent refused` | I: third-party consent exemption, register entry, 5 yr | A | same |
| EW.MEES.PENALTY | `EW.MEES.2030 unmet after deadline` | W: up to £30,000 per property per breach | A | same |
| UK.BUS | `h.jurisdiction ∈ {GB-ENG, GB-WLS} ∧ m ∈ {ashp, gshp}` | I: £7,500 grant via MCS installer, valid EPC; air-to-air £2,500 | S | [Ofgem BUS](https://www.ofgem.gov.uk/environmental-and-social-schemes/boiler-upgrade-scheme-bus/installers), [NICEIC](https://niceic.com/views/the-warm-homes-plan-what-it-means-for-homeowners/) |

### 5.4 Wales and Scotland variants

| id | condition | effect | grade | source |
|---|---|---|---|---|
| WLS.PD.ASHP | from 2026-06-01: same structure as ENG (MCS 020(a), 1.5 m³, 2 detached else 1, highway rules, listed excluded) | C(LPA) when any limb fails | P | [gov.wales heat pumps](https://www.gov.wales/planning-permission-heat-pumps) |
| WLS.PD.EWI | `m=ewi ∧ projection > 0.16 m ∨ protected land ∧ cladding` | C(LPA) | S | [gov.wales external walls](https://www.gov.wales/planning-permission-external-walls) |
| SCT.STUB | `h.jurisdiction=GB-SCT` | W: rule pack not encoded; Scottish PD and building standards differ | n/a | to research |

### 5.5 India and Telangana

| id | condition | effect | grade | source |
|---|---|---|---|---|
| IN.ENS.SCOPE | `h.connectedLoadKW ≥ 100 ∨ h.contractKVA ≥ 120 ∨ h.plotM2 ≥ 3000` | O: ENS 2024 mandatory; alterations comply with 5.2, 5.3, 8.2. Else I: benchmark only | P | [ENS 2024](https://beeindia.gov.in/WriteReadData/L45218/0405504518282114.pdf) 2.2, 2.6 |
| IN.ENS.RETV | `climate ∈ {composite, hotDry, warmHumid, temperate} ∧ ens_retv(h) > 15` | O if in scope, else W (BEE target 12) | P | ENS 2024 5.2.1.4; [ENS 2018](https://policy.asiapacificenergy.org/sites/default/files/Eco-Niwas%20Samhita%202018%20%28Energy%20Conservation%20Building%20Code%20for%20Residential%20Buildings%29.pdf) 3.4, Table 3 |
| IN.ENS.UROOF | `h.roof.U > 1.2` | O or W as above | P | ENS 2024 5.2.1.3 |
| IN.ENS.WFR | `WFRop < {composite 12.5, hotDry 10.0, warmHumid 16.66, temperate 12.5, cold 8.33}%` | O or W | P | ENS 2018 Table 1 |
| IN.ENS.VLT | `VLT < f(WWR)`: 0 to 0.30 → 0.27; to 0.40 → 0.20; to 0.50 → 0.16; to 0.60 → 0.13; to 0.70 → 0.11 | O or W (window replacement must not drop below) | P | ENS 2018 Table 2 |
| IN.ENS.COLD | `climate=cold ∧ U_envelope > 1.8` | O or W | P | ENS 2024 5.2.1.5 |
| IN.TG.COOLROOF | `h.jurisdiction=IN-TG ∧ residential ∧ plot ≥ 600 sq yd (≈ 502 m²) ∧ new permit` | O: cool roof material; else I: recommended retrofit | S | [NRDC](https://www.nrdc.org/bio/prima-madan/telangana-announces-groundbreaking-cool-roof-policy) |
| IN.TG.NM.SIZE | `m=pv ∧ arrangement=net ∧ (kW < 1 ∨ kW > 500)` | B | P (draft) | [TGERC draft 2025](https://www.tgerc.telangana.gov.in/file_upload/uploads/Regulations/Draft/2025/Solar%20rooftop%20amendment%2014.08.2025.pdf) 4.2, 4.8 |
| IN.TG.NM.LOAD | `m=pv ∧ residential ∧ kW > h.sanctionedLoadKW` | C(DISCOM) load enhancement, else B | P (draft) | TGERC draft 4.9; [Energetica](https://www.energetica-india.net/news/telangana-unveils-2025-rooftop-solar-reforms-widening-net-metering-and-shared-energy-access) |
| IN.TG.DT50 | `Σ LT rooftop kW on h.dt + m.kW > 0.5 × dt.ratedKVA` | B (first come first served); unknown → needs-check | P (draft) | TGERC draft 5.1, 5.2 |
| IN.TG.GNM | `arrangement ∈ {group, virtual} ∧ (kW < 10 ∨ kW ≥ 100)` | B | P (draft) | TGERC draft 4.3, 4.5, 4.8 |
| IN.TG.SETTLE | `m=pv ∧ arrangement=net` | I: monthly settlement; surplus paid at lowest discovered solar tariff | P (draft) | TGERC draft 8.1.3 |
| IN.ROC.FEAS | `m=pv ∧ kW ≤ 10` | I: no technical feasibility study; above 10 kW deemed approved after 15 days; commissioning 15 days; ≤ 5 kW network strengthening at DISCOM cost | S | [Rights of Consumers Amdt 2024](https://indiaenvironmentportal.org.in/reports-and-documents/electricity-rights-of-consumers-amendment-rules-2024), [Moneylife](https://moneylife.in/article/govt-amends-electricity-rules-timeline-for-new-connections-cut-setting-up-rooftop-solar-units-turns-easier/73501.html) |
| IN.RWA.ROOF | `h.dwellingType=flat ∧ h.roofIsCommonArea ∧ m ∈ {pv, swh, coolRoof, rooftopUnit}` | C(RWA) resolution; offer VNM or society common-facility PV as alternatives | S | RERA 2016 s2(n) (terraces are common areas), state apartment acts |
| IN.TEN | `h.tenure=tenant ∧ m.fixed` | C(landlord) | S | general |
| IN.STRUCT | `m=pv ∧ roof=RCC` | W: structural and wind load check (IS 875 Pt 3) | S | engineering practice |
| IN.CEA | `m=pv ∧ gridTied` | O: CEA DG connectivity standards (anti-islanding inverter) | S | TGERC draft 4.1 |
| IN.PMSG | `m=pv ∧ residential` | I: ₹30,000/kW to 2 kW, ₹18,000 for the 3rd kW, cap ₹78,000; RWA common facility ₹18,000/kW to 500 kW (includes residents' own plants) | S | [Delhi solar portal](https://solar.delhi.gov.in/page/central-subsidy) |

## 6. Three rules worth implementing as named functions

**6.1 `mcs020a_Lp` (the hero rule).** For each unit and each assessment position (1 m outside the centre of a neighbour's habitable-room window or door, all sides, ground and upper floors):

`Lp = LwA + 10·log10( Q / (4·π·r²) ) − A_B`

with `Q ∈ {2, 4, 8}` for 1, 2, 3 reflecting surfaces within 1 m (more than 3 fails outright), `r` to 0.1 m, and `A_B` from the matrix: Type 1 barrier (masonry or solid fence ≥ 18 mm) 10 / 5 / 0 dB for no view / partial view / full view; Type 2 (thinner solid fence) 5 / 2.5 / 0; no barrier 0. Two units: `Lp,total = 10·log10(10^(Lp1/10) + 10^(Lp2/10))`. Round to 0.1 dB; pass iff every position is ≤ 37.0. Golden test from the standard's worked example: `LwA 60, Q4, r 8.0 m, brick wall partial view → 32.0 dB(A)` (check: 60 − 23.0 − 5 = 32.0).

Story moment: the user drags the outdoor unit around the 3D garden; sound rings shrink behind the brick wall, the neighbour's bedroom window glows amber at 36.8 and red at 37.1, and the consent ledger flips between "Permitted development" and "Planning application, about 8 weeks". This is a Dami Lee style explainer that is also a real compliance calculation.

**6.2 `adf_category(major, minor)`** from AD F Diagram 3.1 (read from the rendered figure):

| major \ minor | 0 | 1 | 2 | 3 | 4 | 5 | 6+ |
|---|---|---|---|---|---|---|---|
| 0 | A | A | A | B | B | B | B |
| 1 | B | B | B | B | B | B | C |
| 2 | B | B | B | B | C | C | C |
| 3 | B | C | C | C | C | C | C |
| 4+ | C | C | C | C | C | C | C |

Major: EWI or IWI on more than 50% of external wall, more than 30% of windows or doors replaced, sealing a suspended ground floor, sealing or removing a chimney. Minor: loft insulation renewal, cold-to-warm loft, cavity wall insulation, EWI or IWI on 50% or less, 30% or less of windows, sealed loft hatch, sealing service penetrations. Count past measures too. Following PAS 2035 is an accepted alternative route. This function is monotone in both arguments, which Lean can prove by `decide` over the saturated domain.

**6.3 `ens_retv`**: `RETV = (1/A_env)·[a·Σ(A_opq·U_opq·ω) + b·Σ(A_glz·U_glz·ω) + c·Σ(A_glz·SHGC_eq·ω)]` with (a, b, c) = composite and hot-dry (6.06, 1.85, 68.99), warm-humid (5.15, 1.31, 65.21), temperate (3.38, 0.37, 63.69); ω are orientation factors from the ENS tables (to import with the building-physics pack). The `c` term dominates in Hyderabad, which is why shading and glass choice beat wall insulation there: a direct expression of M1's "same spreadsheet, different physics".

## 7. City view: aggregation rules and ideas

The city layer evaluates rules over a set of homes (a street, a block, a DT service area) and produces opportunities rather than blocks.

| id | aggregation | output | source |
|---|---|---|---|
| CITY.HNZ | homes inside a designated heat network zone (England, regulations expected 2026; 10 largest cities first) | I: heat network becomes a candidate measure. Connection notices can target new buildings, existing communally heated buildings, and non-domestic buildings above 100 MWh/yr with wet systems, 12 months to connect, exemptions for low-carbon heat. Individually heated homes are not compelled | [HNZ response](https://www.gov.uk/government/consultations/proposals-for-heat-network-zoning-2023/outcome/heat-network-zoning-consultation-2023-summary-of-government-response) |
| CITY.SGL | adjacent houses with gardens or pavement access, combined heat demand | I: shared ground loop (Kensa style street network). BUS-eligible if total heat pump capacity on the loop ≤ 300 kWth and each property ≤ 45 kW; removes outdoor units, so MCS 020 a) noise rules vanish for the street | [Ofgem BUS](https://www.ofgem.gov.uk/environmental-and-social-schemes/boiler-upgrade-scheme-bus/installers), [Kensa](https://kensa.co.uk/funding/boiler-upgrade-scheme) |
| CITY.NOISE | all ASHPs on a street, existing and proposed | W: cumulative soundscape at each window. MCS 020 a) only counts the installing property's units, so the street map shows where the legal test and lived experience diverge | MCS 020 a) scope |
| CITY.DT | Telangana homes grouped by distribution transformer | Hosting capacity bar: Σ rooftop kW vs 50% of DT rating; DISCOMs must publish DT-wise available capacity quarterly | TGERC draft 5.2 |
| CITY.SOCIETY | flats in one RWA | I: one common-facility PV and VNM split, PM Surya Ghar ₹18,000/kW, single RWA consent instead of N individual disputes | Delhi portal, TGERC GNM/VNM |
| CITY.CA | homes in one conservation area | I: street-level design code or local listed building consent order (as in Bristol Clifton) converts N consents into one approved pattern | Bristol LLBCO |
| CITY.AREA | low-income clusters | I: Warm Homes Plan shifts low-income grants to area-based delivery from 2027/28 | NICEIC summary |
| CITY.COOLROOF | Hyderabad wards | Roof albedo map, 300 km² state target to 2028 | NRDC |

Visual idea: the "street section" view. One isometric slice of a terrace, each house a different colour by consent burden (PD, prior approval, planning, LBC), with a shared ground loop drawn under the pavement as a glowing line that unlocks heat pumps for the houses whose own noise test failed.

## 8. Lean 4 targets from this rule set

1. **Feasibility soundness:** `accepted p → ∀ r ∈ pack, r.effect = block → eval r h p = false` (with three-valued `eval`, `unknown` never counts as false).
2. **Consent monotonicity:** for measure-scoped rules, `consents (p ∪ q) ⊇ consents p`. Package-scoped rules are monotone because `adf_category` is monotone (prove by `decide` on the 5 × 7 saturated table).
3. **Obligation idempotence:** applying the `oblige` specs twice equals applying them once, so the optimiser cannot loop.
4. **MEES cap arithmetic:** counted spend ≤ cap, cap = min(10000, 0.1·value) when value < 100000, else 10000; BUS grant excluded from counted spend.
5. **Noise sum:** `Lp,total ≥ max(Lp1, Lp2)`, so adding a unit never helps a failing site. Proved over reals with Mathlib `Real.logb` monotonicity, or over a fixed-point integer encoding.

Physics is still out of Lean's reach (M1 honest boundary); the rule functions get golden tests from the standards' worked examples instead.

## 9. Data, versioning and honesty

- **Designations:** planning.data.gov.uk exposes `conservation-area`, `article-4-direction-area`, `listed-building-outline`, `world-heritage-site`, `scheduled-monument`, `tree-preservation-zone`, `flood-risk-zone`. Cache a local extract for offline use; a polygon hit sets `unknown → true`, a miss sets `false` only if the LPA's dataset is marked complete.
- **Versioning:** every rule has `effectiveFrom/effectiveTo`; the twin can be evaluated "as of" any date. Demo: scrub a timeline from 2025-05-28 to 2025-05-29 and watch a terrace's heat pump move from planning application to permitted development.
- **Verification flags to resolve before release:**
  - Telangana: final Regulation No. 1 of 2025 (gazetted 15 Nov 2025) was read only as its Aug 2025 draft; capacity numbers match press reports of the final, settlement rate wording not confirmed.
  - England Class G and Class A details came from councils (the legislation site blocked automated fetch); confirm against the consolidated GPDO.
  - Cool Roof Policy threshold ("600 sq yd and above" vs "more than"), SR/emittance values.
  - MEES 2030 is announced policy; regulations expected 2027.
  - Scotland not encoded.
- **Not legal advice:** every consent card links its source and says "check with your planning authority". The LLM narrator may explain a rule but never evaluate one; the rule engine is the only judge, matching M1's narrator boundary.

## 10. Recommended demo slice

Constrained but extraordinary: one Victorian mid-terrace in a London conservation area (leasehold flat upstairs, owner-occupied house downstairs as a twin pair), plus one Hyderabad top-floor flat in an RWA society.

- Terrace: ASHP noise drag (6.1), EWI blocked to the street but allowed to the rear, AD F category ticking from A to B as measures stack, Part L obligation turning "insulate 40% of rear wall" into "whole rear wall to 0.30", MEES 2030 ledger for the landlord twin, street shared-loop alternative.
- Hyderabad: RETV dial dominated by solar gain, cool roof and shading beating insulation, RWA consent card, VNM option, DT hosting bar for the lane.

Every rule touched in the demo carries a `primary` grade or an explicit flag.
