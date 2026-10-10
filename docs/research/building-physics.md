# Building Physics Brief

Ibasho's energy engine: a reduced-order, documented model that runs in the browser and is credible enough to rank retrofit packages for a UK terrace and a Hyderabad flat with the same code.

Status: research brief v1, 2026-10-10. Owner: building-science specialist. Audience: physics, optimisation, score/finance and Lean agents.

---

## 1. Decisions at a glance

| # | Decision | Why |
|---|---|---|
| P1 | **Monthly quasi-steady-state heat balance**, SAP 10.2 core (ISO 52016-1 monthly / ISO 13790 lineage), extended for cooling, opaque solar gains and latent load | Documented, auditable, ~10^4 flops per evaluation. A 4,096-package search plus 200-sample uncertainty runs in under a second in a Web Worker |
| P2 | Two run modes: **Standard** (SAP occupancy, 21 °C, SAP factors, EPC-comparable) and **Your home** (actual occupants, thermostat, hours, live tariffs, optional bill calibration) | EPCs over-predict metered use for bands C to G by 8% to 48% ([Few et al. 2023](https://serl.ac.uk/serl-paper-examines-epc-ratings-gap/)). Users need both "official-like" and "my bill" numbers |
| P3 | UK construction defaults from **RdSAP 10 (June 2025)** age bands A to M. India defaults derived from material layers (ENS 2018 method) | RdSAP is the national convention for existing homes. India has no RdSAP equivalent |
| P4 | **Climate packs** built from NASA POWER 2001-2020 monthly climatology, vertical/tilted irradiance by Collares-Pereira-Rabl + isotropic transposition. SAP Appendix U is an alternative pack for UK rating mode | One method for all latitudes. Validated against PVGIS within ±4% for 5 of 6 cities |
| P5 | **Heat pump COP from temperature lift** (Staffell et al. 2012 fit) with weather-compensated flow temperature that depends on **emitter capacity vs post-retrofit heat loss** | Makes "insulate first, then your radiators work with a heat pump" a computed result, not a slogan |
| P6 | **PV self-use via SAP 10.2 Appendix M β-factor** with battery capacity term | Published, monthly, battery-aware, no hourly data needed |
| P7 | Packages are always **recomputed whole**, never summed | Interactions (fabric shrinks heat pump; glazing cuts gains; IWI cuts thermal mass) are physical |
| P8 | **Slab tariffs (India) priced monthly at the marginal slab** | A saving of 100 kWh in a 450 kWh month is worth the 9.50 ₹ slab, not the average |
| P9 | Every stage emits an **evidence record** (inputs, equation id, source URL, output, unit) | M1 rule: every number traceable |
| P10 | Uncertainty is first class: each default carries a range, results show P10/P50/P90 | Unknown ≠ 0, and the performance gap is real |

---

## 2. Engine pipeline and plugin seams

Each stage is a pure function `run(input, ctx) -> { output, evidence[] }`, versioned, swappable.

```
ClimatePack ─┐
Geometry ────┼─> Fabric(H_tr) ─┐
Ventilation(H_ve) ─────────────┼─> Gains(int, solar, opaque) ─> HeatBalance(Q_H, Q_C) ─┐
DHW(Q_W) ──────────────────────┴──────────────────────────────────────────────────────┼─> Systems(η, COP, SEER) ─> Renewables(PV, battery, solar thermal)
Lights/Appliances/Cooking ────────────────────────────────────────────────────────────┘          │
                                                                                                    v
                                                    DeliveredEnergy per fuel per month ─> Cost / Carbon / Primary ─> Score inputs
```

Plugin points (all registry-based): `ClimatePack`, `ConstructionLibrary` (UK RdSAP, India), `SystemModel` (boiler, ASHP, AC, geyser, storage heater), `MeasurePlugin` (applies parameter deltas + cost + lifetime + applicability), `TariffPlugin` (flat, standing charge, slab, ToU, export), `CarbonPack` (SAP 10.2, DESNZ year, CEA), `CalibrationPlugin`. An hourly ISO 52016-1 5R1C engine can later slot in behind the same `HeatBalance` interface for overheating hours.

---

## 3. Equations

Notation: month m = 1..12, n_m days, t_m = 0.024·n_m (kWh per W over the month). Temperatures θ in °C, powers in W, energies in kWh.

### 3.1 Geometry (archetype parameters)

Inputs: built form (detached, semi, end/mid terrace, flat ground/mid/top, bungalow), footprint A_fp (m²), storeys n_s, storey height h (m, default 2.5 UK, 3.0 India), perimeter P, glazing ratio per facade, orientation of front facade, roof type.

- TFA = A_fp · n_s; V = TFA · h
- Exposed wall area A_w = P_exposed · h · n_s − A_openings (party walls by built form)
- Roof area: A_roof = A_fp (loft) or A_fp / cos(pitch) for rafters
- Occupancy (SAP Table 1b): N = 1 + 1.76·[1 − exp(−0.000349·(TFA − 13.9)²)] + 0.0013·(TFA − 13.9) for TFA > 13.9, else 1. "Your home" mode overrides with actual N.

### 3.2 Fabric heat transfer H_tr (W/K)

H_tr = Σ_i A_i·U_i + y·Σ A_exp

- Windows: U_w,eff = 1 / (1/U_w + 0.04) (curtain allowance, SAP 10.2 §3.2)
- Thermal bridging y from RdSAP 10 Table 21: 0.15 (age A to I), 0.11 (J), 0.08 (K to M) W/m²K
- Party walls (RdSAP Table 15): solid 0.0, cavity unfilled 0.5, cavity filled 0.2 W/m²K
- Solid ground floor (BS EN ISO 13370 via RdSAP 10 §5.12), λ_g = 1.5 W/mK clay:
  d_t = w + λ_g·(R_si + R_f + R_se), B′ = 2A/P;
  if d_t < B′: U = 2λ_g·ln(πB′/d_t + 1)/(πB′ + d_t); else U = λ_g/(0.457B′ + d_t), R_si = 0.17, R_se = 0.04
- Suspended timber floor: U = 1/(2R_si + R_f + 1/(U_g + U_x)), U_x = 2hU_w/B′ + 1450·ε·v·f_w/B′ (h = 0.3, U_w = 1.5, v = 5, f_w = 0.05, ε = 0.003, R_f = 0.2 uninsulated)
- Insulation added to an element: U_new = 1 / (1/U_0 + d/λ)

Heat loss parameter HLP = H/TFA (W/m²K). Thermal mass parameter TMP (kJ/m²K): 250 masonry, 100 timber frame or any internally insulated masonry (RdSAP Table 22). India RCC/brick: 250.

### 3.3 Infiltration and ventilation H_ve (W/K)

SAP 10.2 §2 algorithm (air changes per hour):

1. n_flue = (80·open chimneys + 20·open flues + 20·blocked chimneys + 10·extract fans + 10·passive vents + 40·flueless fires) / V
2. Without a test: n_inf = n_flue + 0.1·(n_s − 1) + {0.35 masonry | 0.25 frame} + {0.2 unsealed susp. floor | 0.1 sealed | 0} + 0.05 (no lobby) + (0.25 − 0.2·f_dp), where f_dp = fraction of openings draught-proofed. With a test: n_inf = AP50/20 + n_flue
3. Shelter: n_sh = n_inf·(1 − 0.075·s), s = sheltered sides (0 to 4)
4. Wind: n_m = n_sh·v_m/4 (v_m from SAP Table U2, India default 3.0 m/s)
5. Effective rate: natural: n_eff = n_m if n_m ≥ 1 else 0.5 + 0.5·n_m². MVHR: n_eff = n_m + 0.5·(1 − η_hr·f_iu). MEV/PIV: n_eff = max(0.5, n_m + 0.25)
6. H_ve,m = 0.33·n_eff,m·V

Total H_m = H_tr + H_ve,m. Heat loss L_m = H_m·(θ_i − θ_e,m).

### 3.4 Solar gains through glazing

G_sol,m = Σ_windows 0.9·A_w·S_m(orient, tilt)·g⊥·FF·Z (W) (SAP 10.2 eq. 5)

- g⊥ (SAP Table 6b): single 0.85, double 0.76, double low-E soft 0.63, triple low-E 0.57
- FF: 0.7 wood/PVC, 0.8 metal
- Z: heating 0.3/0.54/0.77/1.0 and cooling 0.5/0.7/0.9/1.0 for heavy/more than average/average/very little overshading (SAP Table 6d). External shading measures act on Z_cool (and Z_heat) per facade
- S_m: from the climate pack (§4). In UK rating mode use SAP U3: S = S_h·(A·cos²(φ−δ) + B·cos(φ−δ) + C) with k1..k9 from SAP Table U5

### 3.5 Solar gains on opaque elements (needed for hot climates)

SAP ignores these. ISO 13790/52016 monthly includes them and they dominate a Hyderabad top-floor flat:

Φ_op,m = Σ_k [ α_k·R_se·U_k·A_k·I_k,m − F_r,k·R_se·U_k·A_k·h_r·Δθ_er ]

α: solar absorptance (dark RCC 0.75, aged white coating 0.35 to 0.45, new cool roof 0.20 to 0.25), R_se = 0.04 m²K/W, h_r = 5·ε ≈ 4.5 W/m²K, Δθ_er = 11 K temperate, 13 K tropical, F_r = 1 roof, 0.5 wall ([ISO 13790 implementation notes](https://simulationresearch.lbl.gov/modelica/releases/latest/help/Buildings_ThermalZones_ISO13790_BaseClasses.html), [entise](https://entise.readthedocs.io/en/latest/methods/auxiliary/solar/solargainsiso13790.html)). The sky term is independent of α, so cool roofs save less than the solar term alone suggests. That honesty matters for the demo.

### 3.6 Internal gains (SAP Table 5, typical column)

G_int,m = 60N (metabolic) + G_L,m + G_A,m + (35 + 7N) (cooking) − 40N (losses) + G_pumps + G_W,m

- Appliances: E_A = 207.8·(TFA·N)^0.4714 kWh/yr, E_A,m = E_A·[1 + 0.157·cos(2π(m − 1.78)/12)]·n_m/365, G_A,m = 1000·E_A,m/(24n_m)
- Lighting (simplified Appendix L): Λ_B = 11.2·59.73·(TFA·N)^0.4714 klm·h/yr; E_L = Λ_B·C_daylight/ε_lm, ε = 80 lm/W LED, 21.3 legacy; E_L,m = E_L·[1 + 0.5·cos(2π(m − 0.2)/12)]·n_m/365; G_L,m = 850·E_L,m/(24n_m)
- Cooking electricity: E_cook = 138 + 28N kWh/yr
- Water heating gains: G_W,m = 1000·[0.25·(0.85·Q_W,m) + 0.8·(Q_dist,m + Q_store,m)]/(24n_m)
- India "Your home" mode adds ceiling fans: E_fan = n_fans·P_fan·h_day·n_m/1000 (P_fan 70 to 75 W AC induction, 28 to 35 W BLDC)

### 3.7 Space heating demand

Utilisation factor (SAP Table 9a, ISO 13790):

τ = TMP/(3.6·HLP) (h); a = 1 + τ/15; γ = G/L with G = G_int + G_sol (+ Φ_op optional)
η = (1 − γ^a)/(1 − γ^(a+1)) for γ ≠ 1, η = a/(a+1) for γ = 1, η = 1 if γ ≤ 0.

Mean internal temperature: SAP two-zone model (Table 9, 9b, 9c). Living area 21 °C, elsewhere θ_h2 = 21 − HLP + HLP²/12 (control type 2), off-periods 7 h and 8 h (weekday), temperature drop
t_c = 4 + 0.25τ; θ_sc = (1 − R)(θ_h − 2) + R(θ_e + ηG/H);
u = 0.5·t_off²·(θ_h − θ_sc)/(24t_c) if t_off ≤ t_c, else u = (θ_h − θ_sc)(t_off − 0.5t_c)/24.
θ_i = f_LA·θ_1 + (1 − f_LA)·θ_2. "Your home" mode replaces 21 °C and the schedule with user values.

Monthly demand: **Q_H,m = 0.024·(L_m − η_m·G_m)·n_m**, floored at 0. SAP counts Oct to May only. Ibasho computes all 12 months and lets the climate decide (Delhi needs Dec to Feb heating, Hyderabad none).

### 3.8 Space cooling demand

SAP Table 10a/10b generalised. θ_c = 24 °C UK; India default 26 °C ("Your home" lets users pick; BEE requires a 24 °C default AC setting).

γ_c = G/L_c with L_c = H·(θ_c − θ_e,m) and G including Φ_op with Z_cool;
η_c = (1 − γ_c^(−a))/(1 − γ_c^(−(a+1))) (SAP 10.2 Table 10a);
**Q_C,m = 0.024·(G_m − η_c,m·L_c,m)·n_m·f_cool·f_int**, floored at 0.

f_cool = cooled floor fraction (e.g. bedrooms 0.4). f_int = operating hours/24 (SAP uses 0.25; India night use 6 to 8 h measured ([Oxford Brookes study](https://radar.brookes.ac.uk/radar/items/b4988545-d335-44d7-9129-4216da43a844/1))). SAP restricts cooling to Jun to Aug; Ibasho does not.

Latent load (humid climates, ventilation + infiltration air only):
Q_lat,m = 0.024·n_m·f_int·[0.817·n_eff·V·f_cool·max(0, ω_e,m − ω_i) + 50·N_cooled] (kWh), with ω in g/kg, V in m³, and 0.817 W per (m³/h)·(g/kg) = ρ·h_fg/3.6×10⁶ (ρ = 1.2 kg/m³, h_fg = 2,450 kJ/kg), plus ~50 W latent per occupant in cooled rooms. ω_e from monthly T and RH (climate pack), ω_i = 11.6 g/kg (26 °C, 55% RH). Mumbai July: ω_e ≈ 19.8 g/kg, so a 200 m³ flat at 1 ach carries ~1.3 kW latent while the AC runs. Expect latent to add 20% to 50% in Mumbai monsoon months and near zero in Delhi May (engine output, to be checked against metered AC data).

Free-running temperature (comfort indicator for the score): θ_free,m = θ_e,m + G_m/H_m. Shown as "your home would sit at X °C without AC". Hour counts need the hourly plugin.

### 3.9 Domestic hot water

SAP Appendix J (simplified, UK): showers/day N_sh = 0.45N + 0.65 (with bath), 6 min at 9 to 11 l/min, f_hot = (41 − T_cold)/(52 − T_cold); baths 0.13N + 0.19 at 73 l; other V_o = 9.8N + 14 l/day; monthly factors Table J2 (1.10 Jan to 0.90 Jun/Jul).
Energy content: **Q_W,m = 4.18·V_d,m·n_m·(52 − T_cold,m)/3600** kWh.
T_cold (mains, UK): 8.0, 8.2, 9.3, 12.7, 14.6, 16.7, 18.4, 17.6, 16.6, 14.3, 11.1, 8.5 °C (SAP Table J1).
Losses: distribution 0.15·Q_W (combi or long pipes), cylinder storage 0.5 to 1.5 kWh/day by insulation, primary circuit per SAP Table 3.
India: hot water at 40 °C, 20 to 35 l/person/day, T_cold = θ_e,m (rooftop tanks), so demand falls to near zero Apr to Jun. Typical systems: 15 to 25 l electric geyser (η = 0.90 incl. standing loss), solar water heater, LPG instantaneous.

### 3.10 Systems: delivered energy by fuel

E_f,m = Σ_end-uses Q_u,m / η_u,f (or ×1/COP, ×1/SEER) + auxiliary.

| System | Default seasonal efficiency | Range | Source |
|---|---|---|---|
| Gas condensing boiler (2005+), space | 0.84 | 0.80 to 0.89 | SAP Table 4a/4b, PCDB typical; EoH comparison uses 84% ([HPA](https://hpauk.org.uk/?p=273)) |
| Gas non-condensing (pre-2005) | 0.70 | 0.60 to 0.78 | SAP Table 4b |
| Combi DHW (summer) | 0.80 | 0.75 to 0.85 | SAP Appendix D |
| Oil boiler | 0.84 / 0.70 | | SAP Table 4b |
| Direct electric, storage heaters | 1.00 | | SAP Table 4a |
| ASHP space | COP model below | SPF 2.5 to 3.8 | [Staffell 2012](https://doi.org/10.1039/C2EE22653G), [EoH](https://es.catapult.org.uk/news/heat-pumps-shown-to-be-three-times-more-efficient-than-gas-boilers/) |
| AC (split) | SEER = ISEER·0.85 | 3★ 3.5 to 4.0, 5★ ≥5.0 to 5.3 (2026 table) | [BEE labels via Onida](https://onida.com/blog/energy-efficiency-breakthrough-how-the-2026-bee-standards-deliver-superior-energy-savings-and-faster-cost-recovery-for-consumers/), SAP Table 10c UK default 4.3 |
| Electric geyser | 0.90 | | standing loss allowance |

**Heat pump model (the key interaction):**

1. Design heat loss: Φ_d = H_d·(θ_in,d − θ_e,d), θ_in,d = 21 °C, θ_e,d from CIBSE 99.6%: London −3.0, Edinburgh −5.4 ([MCS heat load calculator](https://heatloadcalculator.mcscertified.com/docs/reference-sources/design-conditions)), Manchester −3.5 (estimate, verify against MIS 3005-D Table 2).
2. Heat pump size: smallest of {5, 6, 8, 10, 12, 14, 16} kW ≥ Φ_d (plus 0.5 kW DHW allowance for small homes).
3. Existing emitter capacity at ΔT50: Φ_rad,50 = k_os·Φ_d,base, with k_os = 1.0 default (sized for the pre-retrofit house at 70 °C mean water), range 0.8 to 1.5. User can enter radiator list.
4. Required design mean water temperature: θ_mw,d = 20 + 50·(Φ_d/Φ_rad,50)^(1/1.3); design flow θ_f,d = θ_mw,d + 2.5.
5. Weather compensation per month: θ_f,m = 20 + (θ_f,d − 20)·((20 − θ_e,m)/(20 − θ_e,d))^(1/1.3).
6. COP_m = 6.08 − 0.09·ΔT + 0.0005·ΔT², ΔT = θ_f,m − θ_e,m (ASHP fit, valid ΔT 15 to 60 K). DHW at ΔT = 55 − θ_e,m.
7. Field factor f_field = 0.90 (defrost, cycling, aux), range 0.80 to 1.0. SPF_m = COP_m·f_field.
8. Feasibility flag: θ_f,d > 55 °C needs emitter upgrade (measure "radiators+") or a high-temperature R290 unit (COP penalty applies automatically through ΔT).

Worked example (London): a solid-wall semi with Φ_d = 9 kW and radiators sized for it needs ~72 °C design flow; weather compensation gives ~54 °C in an average heating month and a seasonal SPF ≈ 2.65. After EWI + loft, Φ_d ≈ 5 kW, the same radiators need ~54 °C design flow (~42 °C average), seasonal SPF ≈ 3.1, and the unit shrinks from 10 kW to 5 kW. Datasheets show a 21% to 28% SCOP drop from 35 °C to 55 °C flow ([reduco.ai comparison](https://reduco.ai/blog/heizung/effizienteste-waermepumpen-scop-vergleich), [Stiebel Eltron WPL 19 A: 4.44 vs 3.64](https://www.stiebel-eltron.com/en/home/products-solutions/renewables/heat_pump/air_water_heat_pumps/wpl-19-24-a/wpl-19-a-set.html)). The fit reproduces that range. EoH field average for ASHPs is 2.93 ([HPA, Jan 2025](https://hpauk.org.uk/?p=273)); our defaults land at 2.6 to 3.2 for typical retrofits, slightly conservative.

### 3.11 PV, battery, solar thermal

- Monthly yield: **E_PV,m = P_kWp·H_poa,m·PR_m·Z_PV**. PR_m = 0.86·[1 − 0.004·(θ_cell,m − 25)], θ_cell = θ_e,m + 25·Ḡ_m with Ḡ_m = H_poa,m/(6·n_m) the mean daytime plane irradiance in kW/m² (a crude NOCT term, 25 to 31 K per kW/m²). Calibrated PR: UK 0.81, India 0.75 (PVGIS ratios below). SAP rating mode uses 0.8 fixed (SAP eq. M1). Z_PV: 1.0, 0.8, 0.5, 0.35, 0.2 for none, modest, significant, heavy, severe (SAP Table M1).
- Self-consumption (SAP 10.2 Appendix M): R_m = E_PV,m/D_m, where D_m = monthly electricity demand PV can serve (lights, appliances, cooking, pumps, plus electric space and water heating);
  C1 = 1.610 − 0.0973·C_bat, C2 = 0.415 − 0.00776·C_bat, C3 = 0.511 + 0.0866·C_bat (C_bat usable kWh, max 15);
  **β_m = min( exp(−C1·(R_m + C2)^C3), D_m/E_PV,m )**; self-used = β·E_PV, exported = (1 − β)·E_PV.
- Solar water heating: Q_sol,m = min(0.6·Q_W,m, A_c·η_0·H_poa,m·0.45) (simplified, documented as reduced-order; SAP Appendix H is the upgrade path).

### 3.12 Cost, carbon, primary energy, signed deltas

- Cost_f = Σ_m E_f,m·p_f(m, E_f,m) + 365·SC_f, export credit −E_ex·p_ex. Slab tariffs price each month's consumption through the slab ladder.
- Carbon: C = Σ_f Σ_m E_f,m·EF_f,m − E_ex,m·EF_ex,m (monthly electricity factors where the pack has them).
- Primary: PE = Σ E_f·PEF_f.
- **ΔE_f = E_f,base − E_f,after, ΔC = Σ_f ΔE_f·EF_f** (M1 rule). Negative ΔE_elec for a heat pump is shown, not hidden.

### 3.13 Calibration ("Your home" mode with bills)

If annual gas and electricity are known: solve one behavioural parameter (mean set-point offset Δθ within ±2.5 K, or heating hours) so modelled gas matches metered within 5%. Never scale U-values to fit. If no bills, apply a band-dependent prior from Few et al. 2023 to display the expected metered range alongside the modelled value.

---

## 4. Climate packs

### 4.1 Method (embed compactly)

- Source: NASA POWER climatology API (2001-2020), parameters T2M, ALLSKY_SFC_SW_DWN, ALLSKY_SFC_SW_DIFF, RH2M, HDD/CDD ([POWER API](https://power.larc.nasa.gov/docs/services/api/temporal/climatology/)).
- Transposition: monthly mean day (Klein representative days), Collares-Pereira-Rabl hourly split of global and diffuse, isotropic sky, albedo 0.2. Produces S, SE, E, NE, N, ..., horizontal and any tilt. 240 steps per day, runs in microseconds.
- Pack format: per city 12 months × {θ_e, GHI, DHI, RH, v} = 60 numbers (~1 KB JSON). Orientation irradiance computed at load time, so one pack serves any facade. Optional online plugin fetches POWER for any lat/lon and caches in IndexedDB.
- Degree days for display: Hitchin's formula, HDD = n·(θ_b − θ_e)/(1 − e^(−k(θ_b − θ_e))), k = 0.71.
- UK rating mode alternative: SAP 10.2 Appendix U tables (21 regions, postcode lookup Table U6). Thames region monthly θ_e: 5.1, 5.6, 7.4, 9.9, 13.0, 16.0, 17.9, 17.8, 15.2, 11.6, 8.0, 5.1 °C ([SAP 10.2](https://files.bregroup.com/SAP/SAP%2010.2%20-%2011-04-2023.pdf)). POWER grid cells run ~0.6 K colder than SAP Thames (urban heat island excluded), a known bias to show in evidence.

### 4.2 Validation of the irradiance method vs PVGIS 5.3 (optimal plane, kWh/m²·yr)

| City | Ibasho plane (tilt ≈ 0.9·lat) | PVGIS H(i) optimal | Diff | PVGIS E_y kWh/kWp (14% loss) | Implied PR |
|---|---|---|---|---|---|
| London | 1,220 | 1,264 (40°) | −3.5% | 1,023 | 0.81 |
| Manchester | 1,128 | 1,097 (39°) | +2.8% | 888 | 0.81 |
| Edinburgh | 1,082 | 1,108 (42°) | −2.3% | 909 | 0.82 |
| Hyderabad | 2,004 | 2,014 (23°) | −0.5% | 1,508 | 0.75 |
| Mumbai | 2,000 | 2,038 (25°) | −1.8% | 1,525 | 0.75 |
| Delhi | 1,878 | 2,163 (32°) | −13% | 1,623 | 0.75 |

Delhi's gap is a database difference (POWER satellite GHI vs PVGIS ERA5 reanalysis, which tends to over-estimate under heavy aerosol). Ship POWER as default and show the PVGIS figure as an upper bound. Source: [PVGIS API](https://re.jrc.ec.europa.eu/api/v5_3/PVcalc), queried 2026-10-10.

### 4.3 Monthly tables (kWh/m²·month irradiance; θ_e in °C; PV plane tilted at ≈0.9·latitude, equator-facing; HDD base 15.5 °C; CDD base 24 °C)

**London** (51.51 N)

| Month | θ_e | GHI | S vert | E/W vert | N vert | PV plane | HDD15.5 | CDD24 |
|---|---|---|---|---|---|---|---|---|
| Jan | 4.1 | 26 | 55 | 20 | 10 | 54 | 352 | 0 |
| Feb | 4.3 | 42 | 61 | 29 | 16 | 66 | 315 | 0 |
| Mar | 6.1 | 82 | 82 | 52 | 31 | 102 | 292 | 0 |
| Apr | 9.0 | 121 | 89 | 74 | 45 | 129 | 196 | 0 |
| May | 12.3 | 151 | 90 | 91 | 62 | 144 | 111 | 0 |
| Jun | 15.5 | 159 | 87 | 95 | 69 | 145 | 43 | 1 |
| Jul | 17.6 | 158 | 89 | 95 | 66 | 147 | 19 | 2 |
| Aug | 17.3 | 130 | 86 | 78 | 51 | 131 | 21 | 2 |
| Sep | 14.7 | 97 | 86 | 61 | 35 | 114 | 56 | 0 |
| Oct | 11.3 | 57 | 73 | 38 | 21 | 83 | 137 | 0 |
| Nov | 7.3 | 30 | 56 | 22 | 11 | 57 | 246 | 0 |
| Dec | 4.8 | 21 | 49 | 16 | 8 | 46 | 332 | 0 |
| **Year** | 10.4 | 1073 | 902 | 672 | 425 | 1220 | 2121 | 5 |

**Manchester** (53.48 N)

| Month | θ_e | GHI | S vert | E/W vert | N vert | PV plane | HDD15.5 | CDD24 |
|---|---|---|---|---|---|---|---|---|
| Jan | 3.6 | 20 | 40 | 15 | 8 | 39 | 368 | 0 |
| Feb | 3.6 | 37 | 56 | 26 | 14 | 60 | 332 | 0 |
| Mar | 5.1 | 78 | 81 | 51 | 29 | 100 | 323 | 0 |
| Apr | 7.7 | 118 | 90 | 74 | 44 | 127 | 234 | 0 |
| May | 10.8 | 152 | 92 | 93 | 61 | 146 | 150 | 0 |
| Jun | 13.8 | 151 | 85 | 92 | 66 | 139 | 72 | 0 |
| Jul | 15.4 | 149 | 87 | 91 | 63 | 139 | 45 | 1 |
| Aug | 15.1 | 124 | 85 | 76 | 49 | 126 | 49 | 1 |
| Sep | 13.0 | 87 | 78 | 55 | 33 | 102 | 90 | 0 |
| Oct | 9.9 | 50 | 64 | 33 | 19 | 73 | 176 | 0 |
| Nov | 6.5 | 24 | 43 | 17 | 10 | 44 | 270 | 0 |
| Dec | 4.3 | 15 | 34 | 12 | 6 | 33 | 348 | 0 |
| **Year** | 9.1 | 1005 | 834 | 635 | 405 | 1128 | 2457 | 2 |

**Edinburgh** (55.95 N)

| Month | θ_e | GHI | S vert | E/W vert | N vert | PV plane | HDD15.5 | CDD24 |
|---|---|---|---|---|---|---|---|---|
| Jan | 3.4 | 17 | 46 | 14 | 7 | 43 | 375 | 0 |
| Feb | 3.4 | 34 | 59 | 25 | 12 | 62 | 339 | 0 |
| Mar | 4.6 | 70 | 77 | 46 | 26 | 93 | 337 | 0 |
| Apr | 6.9 | 110 | 87 | 70 | 42 | 120 | 258 | 0 |
| May | 9.8 | 146 | 92 | 91 | 60 | 141 | 181 | 0 |
| Jun | 12.7 | 137 | 80 | 84 | 63 | 125 | 99 | 0 |
| Jul | 14.4 | 136 | 82 | 84 | 60 | 127 | 62 | 0 |
| Aug | 14.1 | 113 | 80 | 70 | 46 | 115 | 69 | 0 |
| Sep | 12.2 | 79 | 75 | 51 | 30 | 96 | 111 | 0 |
| Oct | 9.2 | 45 | 66 | 32 | 17 | 72 | 197 | 0 |
| Nov | 6.1 | 21 | 53 | 18 | 8 | 51 | 283 | 0 |
| Dec | 3.9 | 12 | 40 | 11 | 5 | 37 | 358 | 0 |
| **Year** | 8.4 | 921 | 837 | 597 | 376 | 1082 | 2670 | 1 |

**Hyderabad** (17.39 N)

| Month | θ_e | GHI | S vert | E/W vert | N vert | PV plane | HDD15.5 | CDD24 |
|---|---|---|---|---|---|---|---|---|
| Jan | 21.6 | 152 | 136 | 85 | 42 | 172 | 3 | 17 |
| Feb | 24.9 | 161 | 116 | 89 | 43 | 175 | 0 | 53 |
| Mar | 28.7 | 193 | 101 | 105 | 56 | 199 | 0 | 150 |
| Apr | 31.7 | 200 | 68 | 107 | 59 | 196 | 0 | 233 |
| May | 33.3 | 207 | 59 | 110 | 80 | 194 | 0 | 289 |
| Jun | 28.8 | 164 | 57 | 87 | 78 | 153 | 0 | 150 |
| Jul | 26.5 | 143 | 56 | 76 | 68 | 136 | 0 | 94 |
| Aug | 25.5 | 142 | 57 | 76 | 58 | 138 | 0 | 72 |
| Sep | 25.2 | 146 | 70 | 79 | 53 | 146 | 0 | 62 |
| Oct | 24.1 | 156 | 100 | 86 | 50 | 165 | 1 | 45 |
| Nov | 22.1 | 146 | 123 | 82 | 42 | 163 | 2 | 20 |
| Dec | 20.8 | 144 | 138 | 82 | 40 | 166 | 4 | 11 |
| **Year** | 26.1 | 1956 | 1082 | 1064 | 667 | 2004 | 10 | 1195 |

**Mumbai** (19.08 N)

| Month | θ_e | GHI | S vert | E/W vert | N vert | PV plane | HDD15.5 | CDD24 |
|---|---|---|---|---|---|---|---|---|
| Jan | 23.2 | 151 | 142 | 86 | 41 | 175 | 1 | 32 |
| Feb | 25.7 | 161 | 122 | 90 | 41 | 178 | 0 | 68 |
| Mar | 28.7 | 204 | 109 | 112 | 52 | 213 | 0 | 151 |
| Apr | 30.7 | 212 | 74 | 114 | 60 | 208 | 0 | 204 |
| May | 31.2 | 220 | 62 | 117 | 81 | 206 | 0 | 224 |
| Jun | 28.7 | 150 | 54 | 80 | 70 | 141 | 0 | 145 |
| Jul | 26.6 | 118 | 49 | 63 | 55 | 112 | 0 | 96 |
| Aug | 26.1 | 125 | 53 | 67 | 52 | 121 | 0 | 83 |
| Sep | 26.2 | 143 | 71 | 78 | 51 | 144 | 0 | 83 |
| Oct | 26.2 | 162 | 108 | 89 | 49 | 172 | 0 | 87 |
| Nov | 24.6 | 145 | 128 | 82 | 40 | 165 | 0 | 52 |
| Dec | 23.3 | 141 | 140 | 80 | 39 | 165 | 1 | 34 |
| **Year** | 26.8 | 1932 | 1112 | 1058 | 631 | 2000 | 3 | 1260 |

**Delhi** (28.61 N)

| Month | θ_e | GHI | S vert | E/W vert | N vert | PV plane | HDD15.5 | CDD24 |
|---|---|---|---|---|---|---|---|---|
| Jan | 13.6 | 96 | 100 | 56 | 33 | 118 | 79 | 0 |
| Feb | 17.4 | 122 | 109 | 71 | 37 | 144 | 19 | 2 |
| Mar | 23.6 | 175 | 118 | 100 | 49 | 191 | 1 | 38 |
| Apr | 30.4 | 197 | 91 | 109 | 59 | 196 | 0 | 195 |
| May | 35.0 | 208 | 77 | 113 | 74 | 194 | 0 | 343 |
| Jun | 35.9 | 183 | 68 | 99 | 75 | 168 | 0 | 356 |
| Jul | 32.3 | 155 | 65 | 84 | 66 | 145 | 0 | 257 |
| Aug | 29.8 | 151 | 70 | 83 | 58 | 146 | 0 | 182 |
| Sep | 28.3 | 152 | 88 | 85 | 49 | 158 | 0 | 136 |
| Oct | 25.2 | 145 | 118 | 84 | 44 | 166 | 0 | 64 |
| Nov | 20.1 | 107 | 110 | 63 | 35 | 132 | 6 | 8 |
| Dec | 15.2 | 94 | 107 | 56 | 31 | 120 | 48 | 1 |
| **Year** | 25.6 | 1785 | 1121 | 1002 | 609 | 1878 | 152 | 1583 |

Storytelling hooks hiding in these tables: in Hyderabad, a west wall in May gets 110 kWh/m² while the south wall gets 59 (high sun passes overhead). The roof gets ~200. "Your hottest wall faces the sky" is a true, computed headline. In London, a south window gains more in January (55) than an east one does in March (52).

---

## 5. Construction defaults

### 5.1 UK (RdSAP 10, England, W/m²K)

Age bands (England): A <1900, B 1900-29, C 1930-49, D 1950-66, E 1967-75, F 1976-82, G 1983-90, H 1991-95, I 1996-2002, J 2003-06, K 2007-11, L 2012-22, M 2023+ ([RdSAP 10 spec](https://bregroup.com/documents/d/bre-group/rdsap-10-specification-10-06-2025), Table 1).

| Element | A-B | C | D | E | F | G-H | I | J | K | L | M |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Solid brick as built | 1.7 (2.5 if ≤200 mm, 1.4 for 280-420) | 1.7 | 1.7 | 1.7 | 1.0 | 0.60 | 0.45 | 0.35 | 0.30 | 0.28 | 0.26 |
| Cavity as built | 1.5 | 1.5 | 1.5 | 1.5 | 1.0 | 0.60 | 0.45 | 0.35 | 0.30 | 0.28 | 0.26 |
| Filled cavity | 0.7 | 0.7 | 0.7 | 0.7 | 0.40 | 0.35 | 0.45 | 0.35 | 0.30 | 0.28 | 0.26 |
| Solid wall + 100 mm EWI/IWI (A to D via §5.8 formula, ≈0.30 to 0.32) | 0.32 | 0.32 | 0.32 | 0.32 | 0.28 | 0.24 | 0.21 | 0.19 | 0.17 | 0.16 | 0.15 |
| Timber frame as built | 2.5/1.9 | 1.9 | 1.0 | 0.80 | 0.45 | 0.40 | 0.40 | 0.35 | 0.30 | 0.28 | 0.26 |
| Loft, unknown insulation | 0.40 | 0.40 | 0.40 | 0.40 | 0.40 | 0.40/0.30 | 0.26 | 0.16 | 0.16 | 0.16 | 0.15 |
| Floor (solid, insulation by band) | susp. timber | none | none | none | none | none | 25 mm | 75 mm | 100 mm | 100 mm | 140 mm |
| Thermal bridging y | 0.15 | 0.15 | 0.15 | 0.15 | 0.15 | 0.15 | 0.15 | 0.11 | 0.08 | 0.08 | 0.08 |

Loft U by measured thickness (RdSAP Table 16, joists): 0 mm 2.3, 25 mm 1.0, 50 mm 0.68, 100 mm 0.40, 150 mm 0.30, 200 mm 0.21, 270 mm 0.16, 300 mm 0.14, ≥400 mm 0.11.
Stone walls: U = 54.876·W^(−0.561) sandstone/limestone, 45.315·W^(−0.513) granite (W in mm).
Windows (Table 24, PVC/wood): single 4.8 (g 0.85), double pre-2002 12 mm gap 2.8 (g 0.76), double 2002+ 2.0 (g 0.72), double/triple 2022+ 1.4, secondary glazing 2.9 (low-E 2.2). Metal frames +0.6 to +0.9.
Infiltration: masonry 0.35 ach structural, extract fans by age (RdSAP Table 5).

### 5.2 India (derived from layers, W/m²K)

No national RdSAP equivalent exists. Values are computed with R_si = 0.13 (walls), 0.10/0.17 (roof up/down), R_se = 0.04, 12 mm plaster both sides (λ 0.72), and conductivities from the ENS 2018 code annex ([Eco Niwas Samhita 2018](https://policy.asiapacificenergy.org/sites/default/files/Eco-Niwas%20Samhita%202018%20%28Energy%20Conservation%20Building%20Code%20for%20Residential%20Buildings%29.pdf)). Treat as defaults with ±15% ranges.

| Archetype element | Layers | U | Notes |
|---|---|---|---|
| Load-bearing / infill brick 230 mm | burnt clay λ 0.81 | 2.0 | pre-2000 apartments, independent houses |
| Infill brick 115 mm | λ 0.81 | 2.9 | internal-quality partitions used externally |
| AAC block 200 mm | λ 0.18 | 0.8 | post-2010 apartments |
| Fly-ash brick 230 mm | λ 0.9 | 2.1 | |
| RCC roof slab 150 mm, bare | λ 1.58 | 3.3 | top-floor flats, the hot-roof problem |
| RCC 150 + brick-bat coba 100 mm | + λ 0.8 | 2.4 | traditional weathering course |
| RCC + 50 mm XPS + screed | + λ 0.032 | 0.55 | ENS target U_roof ≤ 1.2 |
| Single glazing, aluminium | | 5.8, g 0.82 | FF 0.8 |
| uPVC double glazing | | 2.8, g 0.70 | |

ENS 2018 sets RETV ≤ 15 W/m² (composite, hot-dry, warm-humid, temperate) and U_roof ≤ 1.2 W/m²K ([ENS 2024 update](https://beeindia.gov.in/sites/default/files/ENS%202024_Buildign%20Code%20for%20Residential%20Buildings.pdf)). Ibasho can compute RETV as a secondary India indicator from the same geometry.

Infiltration defaults India: 1.0 ach (operable windows, poor seals), 0.5 ach (newer uPVC). Thermal mass 250 kJ/m²K.

---

## 6. Retrofit measure catalogue

Cost model: **cost = c_fixed + c_var·quantity**, with a ±range. UK prices 2025/26, include VAT unless zero-rated (energy-saving materials are 0% VAT to March 2027). India in ₹. Lifetimes for annualised cost.

### 6.1 UK

| Measure | Physics effect (parameter deltas) | Applicability rule | Cost model | Life (yr) | Sources |
|---|---|---|---|---|---|
| Loft top-up to 300 mm | U_roof → 0.14 (from Table 16) | Accessible loft, not already ≥200 mm | £300 + £10/m² roof (semi ≈ £930) | 40 | EST via [Rightmove](https://www.rightmove.co.uk/guides/?p=3307): £930, ~£285/yr (2023 prices) |
| Cavity wall fill | U_wall 1.5 → 0.7 (bands A to E); party wall 0.5 → 0.2 | Unfilled cavity, not exposure zone 4 | £500 + £25/m² net wall (semi ≈ £2,700, mid-terrace £1,500, detached £4,600) | 40 | EST via [MoneySuperMarket](https://www.moneysupermarket.com/gas-and-electricity/cavity-wall-insulation/), savings via [Which?](https://www.which.co.uk/reviews/insulation/article/cavity-wall-insulation/cavity-wall-insulation-costs-and-savings) |
| External wall insulation 100 mm | U 1.7 → 0.32 (Table 6); y unchanged; TMP unchanged | Solid wall; planning/conservation area flag | £2,500 + £130/m² (semi ≈ £14k to 18k) | 36 | [EST solid wall](https://energysavingtrust.org.uk/home-insulation/solid-wall): £15k to 18k EWI; [DEEP case](https://assets.publishing.service.gov.uk/media/6717b36de319b91ef09e3848/2.04_DEEP_01BA.pdf) up to £37k incl. remedials |
| Internal wall insulation 100 mm | U 1.7 → 0.32; **TMP 250 → 100**; floor area −0.1 m per m of wall | Solid wall; owner accepts disruption | £2,000 + £95/m² (semi ≈ £7.4k to 12k) | 36 | EST, RICS via MoneySuperMarket |
| Suspended floor insulation | R_f +2.5; floor infiltration term 0.2 → 0.1 | Suspended timber floor, void access | £500 + £35/m² floor | 40 | EST via [Which? floor](https://www.which.co.uk/reviews/insulation/article/floor-insulation): ~£60/yr semi |
| Draught-proofing | f_dp → 1.0 (window term 0.25 → 0.05 ach); block unused chimney (80 → 20 m³/h) | Always; keep ventilation ≥ 0.5 ach | £150 + £15/opening; £50/chimney balloon | 10 to 20 | EST ~£55/yr ([acwhyte summary](https://acwhyte.co.uk/energy-saving-measures-expected-savings-by-the-energy-saving-trust)) |
| Double/triple glazing (A-rated) | U 4.8 → 1.4; g 0.85 → 0.63; f_dp → 1 | Not listed building (secondary glazing instead: U → 2.2) | £450/m² window (secondary £200/m²) | 30 | EST era benchmarks, low payback flagged honestly |
| Smart controls (TRVs, zoning, weather comp.) | Control type 2 → 3 (Th2, off periods), boiler return temp lower (+2% η) | Wet system | £350 + £40/radiator | 15 | SAP Tables 4e, 9 |
| MVHR | n_eff = n_m + 0.5(1 − 0.85·0.8); fan elec = SFP·q·8760/1000 (SFP 0.8 W/(l/s)) | **Only if AP50 ≤ 5 m³/h·m²** (else savings vanish, per [Heriot-Watt](https://researchportal.hw.ac.uk/en/publications/the-potential-for-energy-saving-in-existing-solid-wall-dwellings-/)) | £3,500 + £50/m² TFA (retrofit £5.5k to 12k) | 20 | [Trade2base](https://www.trade2base.com/blog/mvhr-installation-costs-uk), [Deeside 2025](https://www.deeside.com/understanding-mvhr-costs-in-2025-a-comprehensive-guide/) |
| Air source heat pump | Replaces boiler; COP model §3.10; gas standing charge removable if no gas use | Outdoor space; θ_f,d ≤ 55 °C or add radiators+ | £6,500 + £700/kW (8 kW ≈ £12k); BUS grant −£7,500 (England, Wales) | 18 | [Which?](https://www.which.co.uk/reviews/ground-and-air-source-heat-pumps/article/air-source-heat-pump-costs-and-savings-akySY6N5Y6Dd), [EDF](https://www.edfenergy.com/heating/heat-pumps/air-source-heat-pump-costs) |
| Radiators+ (emitter upgrade) | Φ_rad,50 × 1.6 (rooms upgraded to K2/K3) | Only with ASHP | £450/radiator replaced | 30 | installer estimate, flagged |
| Solar PV | E_PV §3.11; β self-use | Roof area, orientation SE to SW or E/W split; not severe shading | £1,000 + £1,550/kWp (DESNZ median £1,876/kW ≤4 kW, £1,780 for 4 to 10 kW, FY24/25) | 25 (inverter £1,000 at yr 12) | [pv magazine on DESNZ MCS data](https://www.pv-magazine.com/2025/06/12/uk-small-scale-solar-costs-tumble-as-competition-heats-up-for-installers/) |
| Battery | C_bat in β; round-trip 0.9 | With PV, or ToU arbitrage plugin | £1,500 + £650/kWh (DESNZ median £900/kWh for 6 to 11 kWh) | 12 | [Solar Power Portal](https://www.solarpowerportal.co.uk/energy-storage/desnz-over-22-000-domestic-batteries-installed-in-past-year) |
| Solar thermal | Q_sol §3.11, cylinder required | Not with combi; competes with PV roof | £3,000 + £700/m² collector | 25 | estimate, low priority |
| Cylinder jacket / pipe lagging | storage loss −50% | Cylinder present | £30 to £150 | 10 | SAP Table 2 |

### 6.2 India (hot climates)

| Measure | Physics effect | Rule | Cost model (₹) | Life | Sources |
|---|---|---|---|---|---|
| Cool roof coating | α 0.75 → 0.25 new, 0.40 aged (use aged) | Top floor or independent house, flat RCC roof | 25 to 50/ft² → 270 to 540/m² | 5 to 10 (recoat) | [DTE](https://www.downtoearth.org.in/amp/story/climate-change/why-cool-roofs-remain-a-missed-opportunity-in-india), [Telangana via PressReader](https://www.pressreader.com/india/deccan-chronicle/20191107/281629602081229); LBNL Hyderabad 13 to 14 kWh/m² roof/yr ([LBNL](https://eta-publications.lbl.gov/publications/using-cool-roofs-reduce-energy-use)) |
| Roof insulation (XPS 50 mm + screed) | U_roof 3.3 → 0.55 | Top floor | 800 to 1,400/m² (estimate) | 30 | ENS U_roof target |
| External shading (chajja, fins, awnings) | Z_cool 0.9 → 0.5 on E/W/S; Z_heat follows | Owner or society approval | 3,000 to 8,000 per window (estimate) | 20 | SAP Z model |
| Solar control film / low-e glass | g 0.82 → 0.45 | Renters can do film | 60 to 150/ft² film (estimate) | 10 | |
| AC upgrade 3★ → 5★ inverter | SEER 3.5 → 5.3·0.85 | Existing AC older than 5 yr | 40,000 to 55,000 per 1.5 TR | 10 | BEE label |
| BLDC ceiling fans | 75 W → 30 W; enables θ_c +2 K (elevated air speed comfort) | Always | 3,000 to 4,500 per fan | 15 | ASHRAE 55 elevated air speed concept |
| Rooftop PV | E_PV §3.11 with PR 0.75 | Roof rights (society for flats) | 50,000 to 60,000/kW gross; PM Surya Ghar subsidy 30,000/kW for 2 kW, 18,000 for 3rd kW, cap 78,000 | 25 | [pv magazine India](https://www.pv-magazine-india.com/2025/09/15/why-every-indian-home-should-consider-solar-in-2025), [CFA structure](https://jbvnl.co.in/SOLAR/CFA_structure%20for%20PM%20Suryaghar.pdf) |
| Solar water heater 100 to 200 l | Q_sol replaces geyser | Roof access | 18,000 to 30,000 (estimate) | 15 | |
| Wall insulation / AAC re-skin | U 2.0 → 0.8 | Rare in retrofit, flagged "major works" | 1,200 to 2,000/m² (estimate) | 40 | |

Estimates marked "estimate" have no primary source yet. The UI must badge them as such, and the content agent should replace them before any public claim.

### 6.3 Interactions the engine must reproduce (test oracles)

1. Fabric first lowers Φ_d → smaller heat pump, lower flow temperature, higher SPF, lower capex.
2. IWI lowers TMP → lower η in shoulder months (slightly less gain use) and higher free-running summer temperature. Visible as a cooling/overheating penalty.
3. Low-g glazing cuts heating-season solar gain (UK south facades) and cuts cooling load (India E/W). Same measure, opposite sign by climate.
4. MVHR on a leaky house: fan energy exceeds heat saved. Engine must return negative net saving.
5. Cool roof in London: tiny heating penalty. In Hyderabad: large cooling saving. Same plugin.
6. Heat pump + PV: β rises because D_m includes heat pump electricity, so PV value rises in winter months.
7. Heat pump alone in UK at Oct 2026 prices: gas falls, electricity rises. Unit-rate break-even is SPF > (26.32/7.97)·η_boiler = 3.30 × 0.84 = 2.77, before counting the £108/yr gas standing charge that disappears if gas is capped off. The engine computes this per home; the narrator only explains it.
8. Slab tariffs: a measure saving the same kWh is worth more in a high-use home.

---

## 7. Fuel prices and carbon factors

### 7.1 UK prices

| Item | Bill mode (Ofgem cap, 1 Oct to 31 Dec 2026, Direct Debit, GB average) | Rating mode (SAP 10.2 Table 12) | RdSAP 10 Table 32 |
|---|---|---|---|
| Electricity unit | **26.32 p/kWh** (VAT 0% until 31 Mar 2027) | 16.49 p/kWh | 13.19 p/kWh |
| Electricity standing | **54.83 p/day** | £81/yr | £54/yr |
| Gas unit | **7.97 p/kWh** (incl. 5% VAT) | 3.64 p/kWh | 3.48 p/kWh |
| Gas standing | **29.68 p/day** | £92/yr | £120/yr |
| Export | SEG: Octopus Outgoing fixed 12 p from 1 Mar 2026; 24 to 25 p with supplier lock-in | 5.59 p/kWh | 13.19 p/kWh |
| Heating oil | user input (plugin) | 4.94 p/kWh | 7.64 p/kWh |

Ofgem TDCV: 2,500 kWh electricity, 9,500 kWh gas, typical dual-fuel £1,723/yr. The Jan to Mar 2027 cap is announced 25 Nov 2026; one forecast expects about +14% ([moneytothemasses](https://moneytothemasses.com/news/energy-bills-to-rise-by-4-from-october-with-14-rise-predicted-for-january)) ([Ofgem](https://ofgem.gov.uk/news/changes-energy-price-cap-between-1-october-and-31-december-2026), [Ofgem letter](https://www.ofgem.gov.uk/sites/default/files/2026-08/Summary-of-changes-to-energy-price-cap-1-October-to-31-December-2026.pdf), [SEG rates](https://reonic.com/en-gb/blog/smart-export-guarantee-rates/)). Prices live in a dated `TariffPack` so the landing page can say "prices as of".

### 7.2 Carbon and primary energy

| Factor | Value | Use | Source |
|---|---|---|---|
| Mains gas | 0.210 kgCO2e/kWh, PEF 1.130 | rating + bill | SAP 10.2 Table 12 |
| Electricity, SAP 10.2 annual | 0.136, PEF 1.501 | rating | SAP 10.2 Table 12 |
| Electricity, SAP 10.2 monthly (Jan..Dec) | 0.163, 0.160, 0.153, 0.143, 0.132, 0.120, 0.111, 0.112, 0.122, 0.136, 0.151, 0.163 | rating, monthly | SAP 10.2 Table 12d |
| PV export (monthly) | 0.196 Jan to 0.092 Jul | rating | SAP 10.2 Table 12d |
| UK grid, DESNZ 2025 | 0.177 kgCO2e/kWh (generation) | "now" mode | [Circular Ecology](https://circularecology.com/news/desnz-defra-2025-ghg-emissions-factors-released) |
| UK grid, DESNZ 2026 | ~0.131 (third-party read, verify in workbook) | "now" mode default | [Circular Ecology 2026](https://circularecology.com/news/desnz-2026-uk-ghg-conversion-factors) |
| Heating oil / LPG | 0.298 / 0.241 | rating | SAP 10.2 |
| India grid (CEA v20, FY2023-24 weighted average, RE-adjusted) | **0.727 tCO2/MWh** | India | [SolarQuarter on CEA database](https://solarquarter.com/2025/01/06/co2-baseline-database-highlights-indias-progress-in-renewable-energy-and-emission-reduction-cea/); v21 (FY24-25) and v22 (Aug 2026) exist but tables were not retrievable; update when read ([CEA](https://cea.nic.in/wp-content/uploads/baseline/2026/09/User_Guide__Version_22.0.pdf)) |
| India LPG | ≈0.214 kgCO2e/kWh (DESNZ LPG, gross CV, verify) | India cooking/DHW | DESNZ factors |

Carbon packs are dated and selectable. Default for user-facing carbon: SAP 10.2 in Standard mode (stable, Lean-pinned), DESNZ latest in Your-home mode. A lifetime grid trajectory plugin (score-finance brief) applies to ΔC over measure life.

### 7.3 India tariffs (residential, monthly telescopic slabs)

| Utility | Slabs (₹/kWh) | Fixed | Notes |
|---|---|---|---|
| TGSPDCL Hyderabad, LT-I(B)(ii) (>200 kWh/month) | 0 to 200: 5.10; 201 to 300: 7.70; 301 to 400: 9.00; 401 to 800: 9.50; >800: 10.00 | ₹10/kW·month (₹50 above 800) | Low-use bands LT-I(A) 1.95/3.10 and (B)(i) 3.40/4.80. Unchanged FY24-25 to FY26-27 ([TGSPDCL schedule](https://www.tgsouthernpower.org/resources/PDF/Tariffs/69tarifffile.pdf)) |
| Delhi (DERC, BRPL/BYPL/TPDDL) | 0 to 200: 3.00; 201 to 400: 4.50; 401 to 800: 6.50; 801 to 1200: 7.00; >1200: 8.00 | load-based | 0 to 200 free and 50% subsidy (cap ₹800) to 400 under state scheme; PPAC surcharge ~36% to 41% on energy charge ([Housing.com](https://housing.com/news/electricity-rates-in-delhi/), [Bridgeway](https://bridgewaypower.in/blog/delhi-electricity-bill-unit-rates-surcharge-impact)) |
| Adani Electricity Mumbai | FY24-25 bill: 0 to 100: 3.15 + 2.60 wheeling; 101 to 300: 5.40 + 2.60; higher slabs higher; FY25-26 average −10% | ₹90 to 135/month | Verify against MERC AEML MYT order (Case 211 of 2024) ([DT Next](https://www.dtnext.in/news/business/merc-approved-tariff-reductions-to-benefit-over-34-lakh-adani-electricity-consumers-828181)) |

The TariffPlugin computes the monthly bill from the slab ladder, then the saving as bill_before − bill_after per month. This makes subsidies (Delhi) visible: a home under 200 kWh/month gets zero bill saving from efficiency, only comfort and carbon. That is a fair and surprising story.

---

## 8. Validation targets

| Target | Value | Engine check |
|---|---|---|
| NEED 2023 median gas, England and Wales | 10,100 kWh; Scotland 10,700 | Median of archetype library in "Your home" mode with calibration prior within ±15% ([NEED 2025](https://assets.publishing.service.gov.uk/media/685bf0d30433072fce0e1000/need-report-june-2025.pdf)) |
| NEED 2023 median electricity | 2,600 kWh (E&W) | Lights + appliances + cooking for N = 2.4 within ±15% |
| NEED houses 51 to 150 m² | "just over 100 kWh/m²" gas | 1930s semi, 85 m², calibrated mode: 90 to 130 kWh/m² |
| NEED measure savings (2022 installs) | SWI median gas −16%; CWI + loft −9% | Same measures on matching archetypes in Your-home mode within ±5 points |
| EPC vs metered gap | Modelled exceeds metered by 8% (C) to 48% (F/G) | Standard mode should over-predict metered by a similar margin (that is SAP fidelity, not error) |
| SAP fidelity | Standard mode within ±5% of SAP 10.2 space heating for BRE/assessor worked examples; band agreement on 500 EPC open-data records ([EPC open data](https://epc.opendatacommunities.org)) | regression suite |
| PV | Within ±5% of PVGIS for UK cities (§4.2) | done |
| Heat pump SPF | EoH ASHP average 2.93; 8% of older installs ≥3.5 | default retrofit SPF 2.6 to 3.4 |
| India AC homes | 4,208 kWh/yr AC homes vs 2,260 non-AC (41 dwellings); AC runtime 6.2 h/night; AC home summer 15.1 kWh/day | Hyderabad 2BHK, 2 ACs, 7 h/night: 3,500 to 5,000 kWh/yr ([Oxford Brookes](https://radar.brookes.ac.uk/radar/items/b4988545-d335-44d7-9129-4216da43a844/1)) |
| India cooling share | ~40% of household electricity (CLASP/BEE 2024) | cooling + fans share 30% to 50% ([DTE](https://www.downtoearth.org.in/amp/story/energy/cooling-appliances-now-drive-indias-household-electricity-use)) |
| Cool roof | 10% to 19% cooling saving, 13 to 14 kWh/m² roof (Hyderabad, LBNL) | top-floor archetype within range |

Property and metamorphic tests (for the testing agent): Q_H non-increasing as any U falls; Q_H non-increasing as G rises; η ∈ [0, 1]; rotating a Hyderabad flat so the long glazed facade faces west raises Q_C; adding a measure and removing it returns the baseline bit-exactly; energy balance closes (Σ losses = Q_H + η·G) every month.

Lean candidates (with the Lean agent): η(γ, a) ∈ [0, 1] for γ ≥ 0, a ≥ 1; L·(1 − γη(γ)) is non-decreasing in L for fixed G (heating demand never falls when losses rise); delivered-energy bookkeeping per fuel. Physics truth stays with tests, per the M1 honest boundary.

---

## 9. Uncertainty

Each parameter carries (default, low, high, source). Ranges: U-values ±20% for as-built defaults, ±10% measured; infiltration ±30%; SPF field factor 0.80 to 1.0; set-point ±1.5 K; cost ±25% (±40% for "estimate" badges); PR ±5%. Run 200 Latin-hypercube samples per package in a worker, report P10/P50/P90. Pareto selection uses P50; the UI shows the band. Rank stability (how often package A beats B across samples) is a cheap, honest "confidence" number for the narrator.

---

## 10. Open questions

1. CEA v21/v22 exact grid factors (site blocks automated download). Read manually and update the pack.
2. DESNZ 2026 UK electricity factor: confirm 0.131 from the official workbook.
3. Adani/BEST/Tata Mumbai FY25-26 slab table from the MERC order.
4. India retrofit costs marked "estimate": source from CPWD Delhi Schedule of Rates or vendor quotes.
5. MIS 3005-D Table 2 design temperatures for Manchester.
6. Hourly 5R1C plugin for overheating hours (CIBSE TM59 style) once the monthly core is stable.
7. Align carbon pack defaults with the score-finance brief, which assumes current DESNZ factors everywhere. Proposal: SAP 10.2 pinned in Standard mode (EPC-comparable, Lean-stable), DESNZ latest in Your-home mode and for the Green Home Score.

## 11. Primary sources

- SAP 10.2 specification (11-04-2023): https://files.bregroup.com/SAP/SAP%2010.2%20-%2011-04-2023.pdf
- RdSAP 10 specification (09-06-2025): https://bregroup.com/documents/d/bre-group/rdsap-10-specification-10-06-2025
- Ofgem price cap Oct to Dec 2026: https://ofgem.gov.uk/news/changes-energy-price-cap-between-1-october-and-31-december-2026
- NEED 2025 report: https://assets.publishing.service.gov.uk/media/685bf0d30433072fce0e1000/need-report-june-2025.pdf
- NASA POWER climatology API: https://power.larc.nasa.gov/docs/services/api/temporal/climatology/
- PVGIS 5.3 API: https://re.jrc.ec.europa.eu/api/v5_3/PVcalc
- Staffell, Brett, Brandon, Hawkes (2012), A review of domestic heat pumps, Energy Environ. Sci. 5, 9291: https://doi.org/10.1039/C2EE22653G
- Few et al. (2023), The over-prediction of energy use by EPCs in Great Britain, Energy and Buildings: https://serl.ac.uk/serl-paper-examines-epc-ratings-gap/
- Electrification of Heat final results: https://hpauk.org.uk/?p=273
- MCS heat load calculator design conditions: https://heatloadcalculator.mcscertified.com/docs/reference-sources/design-conditions
- ISO 13790 opaque gains (LBNL Modelica docs): https://simulationresearch.lbl.gov/modelica/releases/latest/help/Buildings_ThermalZones_ISO13790_BaseClasses.html
- Eco Niwas Samhita 2018: https://policy.asiapacificenergy.org/sites/default/files/Eco-Niwas%20Samhita%202018%20%28Energy%20Conservation%20Building%20Code%20for%20Residential%20Buildings%29.pdf
- CEA CO2 baseline database: https://cea.nic.in/wp-content/uploads/baseline/2026/09/User_Guide__Version_22.0.pdf
- TGSPDCL tariff schedule: https://www.tgsouthernpower.org/resources/PDF/Tariffs/69tarifffile.pdf
- DESNZ MCS solar cost data: https://www.data.gov.uk/dataset/738a7bdb-a533-443d-bd02-69a8dd7fe68d/solar-pv-cost-data
