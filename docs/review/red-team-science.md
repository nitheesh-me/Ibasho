# Red team: building science and regulation

Reviewer stance: skeptical building physicist and planning or building control officer. Inputs: `report/M1.typ`, `docs/*.md`, `docs/research/*.md` as of 2026-10-10.

**Verdict.** The SAP 10.2 core is transcribed with care. The problems an expert would reject are elsewhere. Some seals and pictures claim more than the model computes. The GH1 hero path leaves out the cylinder, moisture, junctions and the electrical supply. Fixes are ranked by damage to the hero demo and to the "proved" promise.

## Top 8 fixes

**1. The carbon seal certifies a number nobody sees.** BP §3.12 computes C with monthly electricity factors, but ΔC = Σ_f ΔE_f·EF_f and Lean `carbonSaving_eq` use annual fuel vectors. So the Proved ΔC is not the C_base − C_after on screen. DESNZ 0.177 is generation only and leaves out T&D losses. CEA 0.727 is generation side, so the consumption value is roughly 0.8 to 0.9. A flat factor over 25 years undervalues heat pumps and overvalues PV. *Fix:* index vectors by (fuel, month) in the engine, certificate and Lean. Add T&D. Use the DESNZ Green Book long-run marginal factors by year for lifetime carbon. Count embodied carbon, or rename Bold "lowest operational carbon".

**2. The heat pump chain leaves out what decides GH1.** GH1 has a combi. A heat pump needs a cylinder (about £1.5k to £2.5k and 0.5 to 0.7 m²), with standing losses and a legionella cycle. None of this is costed or modelled. The gas standing charge goes only if the hob is replaced and the meter is capped. The COP fit is Ruhnau 2019, not Staffell 2012 (Staffell's ASHP fit is 6.81 − 0.121ΔT + 0.00063ΔT²). A monthly mean COP hides cold spells and defrost. A default k_os of 1.0 is pessimistic: UK radiators were sized at ΔT60 with margins. *Fix:* add `cylinder`, `hob` and `gas-disconnect` sub-measures. Compute COP over temperature bins from a TMY. Use a k_os prior of 1.0 to 1.8 (central 1.3). Fix the citation.

**3. Wrong GH1 rules make "proved feasible" false.** (a) Under GPDO Part 14 Class A, only *walls* fronting a highway are restricted on Article 2(3) land. So SPEC §9's front-roof PV rule belongs under `ENG.PD.ART4`. (b) Class A.2(a) excludes render, stone, timber, plastic and tile cladding on *any* elevation there. "Rear EWI allowed" is wrong; the default is `consent(LPA)`. (c) The front is `consent`, not `block`. (d) In Part L, 0.70 is the threshold that triggers an upgrade, not a fallback floor. Traditional buildings get relaxations. (e) Rules are missing for DNO connection (G98 at 3.68 kW per phase, G99 for PV plus battery, heat pump notification, looped supplies) and for PAS 2035 on funded work. *Fix:* correct these rules and add one golden test for each.

**4. IWI passes as safe, and the gold seam misleads.** DEEP ranks solid-wall IWI as the riskiest measure. Here it only `warn`s, and only if `historicVapourOpen` is known. IWI also *worsens* the thermal bridges at joist ends and party-wall returns. The engine uses a single global y, so it finds no junctions. The demo still has "loft plus draught-proofing, gold seams trace the lintel", though neither measure touches a lintel. *Fix:* on solid masonry, make IWI `needs-check` until there is a BS 5250 or BS EN 15026 assessment, and cost that plus PAS 2035. Default to vapour-open wood fibre at U about 0.5 to 0.6. Use SAP Table K1 ψ defaults. Draw seams only where ψ changes, and mark the IWI junctions as new risk.

**5. The estimated EPC band is not SAP-conformant.** MEES compliance and the value range depend on it. SAP ratings use UK-average weather, heating from October to May, no opaque gains, RdSAP 10 Table 32 prices with deflator 0.42, and standing charges. Standard mode differs on all of these. Pairing 0.42 with SAP 10.2 prices shifts the result by about one band. *Fix:* add a separate `rating` sub-mode. Publish a band confusion matrix against EPC open data before any "compliant" label, and until then always show ±1 band.

**6. Cooling demand is NaN in Hyderabad's hottest months.** L_c = H(θ_c − θ_e) is negative from March to June, when θ_e exceeds θ_c. So γ_c < 0, and γ_c^(−a) is NaN in JavaScript. Heating has an η = 1 branch; cooling has none. Night-only AC is also priced at the 24 h mean temperature. *Fix:* when L_c ≤ 0, set η_c = 1 so that Q_C = G + |L_c|. Add T2M_MAX and T2M_MIN to the climate pack. Run hourly 5R1C for the front and the picks. Test that Q_C is finite and ≥ 0 for every pack and month.

**7. The interval seal covers a different model.** `fabricLoss_enclosed` encloses UA·HDD at a fixed base temperature, but the engine is a SAP monthly model with gain utilisation. Fixed-base degree days *overstate* fabric savings, because the balance point drops after insulation. So "saves energy for every home consistent with your answers" is unsound for the displayed number. *Fix:* enclose the real monthly chain (η(γ) is monotone), or say the seal covers a surrogate and keep it off displayed savings.

**8. Calibration cannot separate fabric from behaviour.** One free Δθ absorbs U-value error. In-situ 9-inch brick often measures 1.2 to 1.5, against the 1.7 default. Wall savings therefore stay overstated after "correction". Bills are not weather-normalised. Take-back is sampled only for robustness, never in the central case. *Fix:* weather-normalise to actual-year degree days. Calibrate θ, n_inf and U_wall with priors and report the posterior. Put take-back in the central case, saturating near 21 °C. Gate Wise on the NEED SWI and CWI targets passing.

## Further corrections

- **T-lite:** a ±3 K sinusoid on a *heated* mean creates cold hours the thermostat prevents. The 6 K clamp after IWI decides IWI vs EWI through an invented amplitude. Use 5R1C, or show a risk class.
- **PV β:** as transcribed, β is about 0.36 as R approaches 0 with no battery, so a tiny array would export most of its output. Verify against SAP 10.2 Appendix M.
- **Prices:** electricity is listed "VAT 0%"; domestic energy VAT is 5%. RdSAP export at 13.19p equals import; verify.
- **ISEER × 0.85** is a field derate, not a conversion. Label it.
- **NPV:** model counterfactual boiler replacements from boiler age.
- **Flip points** are piecewise under slab tariffs, and there can be several.
- **Gentle:** R7 dropped SF's target floor; restore it.
- **Score A** uses the live tariff, so the score drifts every quarter. Pin the tariff pack per score version.

## Claims to reword

- "A better home never scores worse" becomes "at least as good on all seven indicators never scores lower". IWI raises hot hours, and a heat pump can raise cost.
- "Every shown package is feasible" becomes "passes every encoded rule".
- "Your house is losing this much right now" must name the outdoor temperature used.
