# Review decisions

Director ruling on every point in the three red-team critiques. Date: 2026-10-10. Applies to plan v2 (`VISION.md`, `SPEC.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `BUILD_PLAN.md`).

Keys: **PR** = `red-team-product.md`, **SC** = `red-team-science.md`, **TE** = `red-team-technical.md`.

Verdicts:
- **Accept**: applied as proposed.
- **Partial**: the problem is real, and the fix is applied with a stated change. The rejected part has a one-line reason.
- **Reject**: not applied, with a one-line reason.
- **Check**: a claim made from memory; we treat it as a verification task, not a ruling.

## Product and homeowner (PR)

| Id | Critique | Verdict | Where applied, or why not |
|---|---|---|---|
| PR-1 | Visuals the engine cannot back (room colours, lintel line, seams) | Partial | Accepted: explicit ψ junctions (SAP Table K1 defaults) for every junction the scene draws, plus an evidence node for every highlighted element (SPEC R19, AC-V1). **Rejected: a per-room thermal split in T1.** The SAP two-zone model, run hourly as 5R1C, covers room tints at zone level (living area, rest of home) without the room geometry and room-to-room coupling a per-room model needs. A per-room model is a T5 `thermal-model` plugin. |
| PR-2 | Rewrite the 90 s hero; drop Machi | Accept | VISION §5, SPEC §5.4. Machi moves to T4. |
| PR-3 | Seals must mean something to an owner | Accept | SPEC R11: claim seals lead ("Nothing better is hidden", "What you ruled out never came back"). Bookkeeping theorems move to `/app/proofs`. Every seal says what is not proved. Hallway test is AC-Q1. |
| PR-4 | One letter scale | Partial | Accepted: letters belong to the EPC estimate only. The Ibasho score is a number with four groups at first glance and seven on tap. **Changed: the groups are Fabric and heating, Running cost, Carbon, Comfort.** We compute no health indicator, so "health" would be an unbacked label. |
| PR-5 | Plain English first | Accept | User-facing labels are English. Japanese appears only as decorative glyphs and internal code names. The futures are now Least upfront, Best return and Lowest running carbon. The season ring has 12 months. DS §1, §9. |
| PR-6 | Disruption, quote check, boiler broke, next step | Partial | Accepted in T1: disruption and next step, both pure data. **Deferred to T2: "check my quote" and "my boiler just broke".** Both are new flows, and PR-7 caps T1. |
| PR-7 | Cut T1 hard; stranger-homes gate | Accept | SPEC §1: Story has 5 chapters (about 3 min). The garden, sound, extra render styles, snapshots, WebLLM, Chrome AI, compare mode and robustness LHS are deferred. Stranger-homes gate AC-SG1 runs before M-D. |
| PR-8 | Accept the bill data people actually have | Partial | Accepted: kWh, £ per bill, direct debit (weak) and meter CSV, with the fit weighted by data quality. Budget is asked after the first futures. A fixture has bills higher than the model. **Changed: EPC lookup is the default first step only when an API key is configured.** The register needs a registered key, and the app works offline without one. |
| PR-H1 | Personas disagree | Accept | The canonical Margaret is in London, in a conservation area, with no budget set at Reveal. The demo sets £15,000 after the futures appear. |
| PR-H2 | "Losing this much right now" | Accept | The copy now reads "On a typical January night (outdoor X °C)". |
| PR-H3 | "4,096 ways" | Accept | The copy now reads "Three stand out". |

## Building science and regulation (SC)

| Id | Critique | Verdict | Where applied, or why not |
|---|---|---|---|
| SC-1 | The carbon seal covers a different number; T&D; trajectory; embodied | Partial | Accepted: (fuel, month) vectors run through the engine, the certificate and Lean. T&D losses are added, with values pending a primary read. Lifetime carbon uses the DESNZ Green Book long-run marginal factors by year. **Rejected: counting embodied carbon in T1.** We have no sourced embodied data, so the pick is renamed "Lowest running carbon" and embodied carbon is a T5 plugin. |
| SC-2 | Heat pump chain (cylinder, hob, gas disconnect, citation, bins, k_os) | Accept | SPEC §9 sub-measures. The COP fit is cited as Ruhnau et al. 2019. COP uses EN 14825 temperature bins. k_os prior 1.0 to 1.8, central 1.3. |
| SC-3 | GH1 rules wrong (PV, A.2(a) cladding, consent not block, 0.70, DNO, PAS 2035) | Accept | SPEC §9 rule list, one golden test per rule. Rules resting on reviewer memory are graded `secondary` until the consolidated GPDO, AD L and ENA G98/G99 are read. |
| SC-4 | IWI passes as safe; the seams mislead | Accept | IWI on solid masonry is `needs-check` until a moisture assessment is recorded. The assessment and PAS 2035 are costed. The default is vapour-open wood fibre. Seams appear only where ψ falls, and IWI junctions are marked as a new risk (SPEC R19, R22). |
| SC-5 | Estimated EPC band not SAP-conformant | Accept | New `rating` run mode (SPEC R3). A band confusion matrix gates any "compliant" label (AC-R1). Until it passes, the band always shows ±1. |
| SC-6 | Cooling NaN in hot months | Accept | η_c = 1 when L_c ≤ 0. Daily max and min temperatures go in climate packs. AC-7 checks Q_C is finite and ≥ 0 for every pack and month. |
| SC-7 | Interval seal covers a surrogate | Partial | **Rejected for T1: enclosing the real monthly chain.** γ^a with non-integer a needs transcendental enclosures, which core `Rat` cannot provide (T5 research item). Accepted alternative: the interval theorem is shown as a worked surrogate on `/app/proofs` only, and displayed ranges are Modelled. |
| SC-8 | Calibration cannot separate fabric from behaviour | Accept | Bills are weather-normalised. The fit covers θ, n_inf and U_wall with priors, and the result is a posterior range. Comfort take-back is in the central case. The Best return pick is gated on the NEED SWI and CWI targets (SPEC R21, AC-5b). |
| SC-F1 | T-lite artefacts | Accept | Replaced by hourly 5R1C (SPEC R5). |
| SC-F2 | PV β transcription | Check | Re-read SAP 10.2 Appendix M. A validation test covers β as R tends to 0. |
| SC-F3 | Electricity VAT 5%; RdSAP export equals import | Check | The tariff pack stays graded `secondary` until the Ofgem letter's VAT basis and RdSAP 10 Table 32 are re-read. |
| SC-F4 | ISEER × 0.85 is a field derate | Accept | Labelled as a field derate in the measure data and the evidence. |
| SC-F5 | NPV counterfactual boiler | Accept | A_cf comes from a boiler-age prior, and the owner can confirm. |
| SC-F6 | Flip points are piecewise | Accept | Every crossing is reported, not one point found by bisection. |
| SC-F7 | Gentle lost its target | Accept | The target set is restored. The front is computed over feasible packages that meet the target, so `lexMin_nondominated` still applies (SPEC R7). |
| SC-F8 | Score drifts with tariffs | Accept | The A indicator uses a pinned reference price pack (SPEC R4). |
| SC-W1 to W3 | Claims to reword | Accept | The wording is now "at least as good on all seven indicators", "passes every encoded rule", and the January night copy names its temperature. |

## Technical (TE)

| Id | Critique | Verdict | Where applied, or why not |
|---|---|---|---|
| TE-1 | GH1 breaks the search budget | Accept | Factorised search: GH1 runs 432 heavy simulations and 10,800 packages. Lean generates the choice-group product. The evidence graph is lazy. The certificate is columnar with witnesses. The GH1 fixture is built at real scale (SPEC R9, ARCH §6, §8). |
| TE-2 | Lean owning constants contradicts plugin packs | Accept | Lean owns formulas, weights, anchors, reference prices and well-formedness predicates. Pack data travels in the certificate. `specHash` covers the spec only, and the checker accepts the historical specs it ships with (ARCH §8). |
| TE-3 | Point Lean at what can be wrong | Partial | Accepted: a Kleene rule evaluator, MCS 020 noise with rational enclosures, slab marginal pricing, and Proved never sitting on a number. **Rejected for T1: a robust saving lower bound on the monthly model.** Same reason as SC-7. |
| TE-4 | Exact rationals too slow; determinism overstated | Accept | Fixed point (Wh, gCO2e, micro-pence) with half-even rounding per year step, identical in Lean. A `dmath` module, with `Math.*` linted out of the engine. The mirror checker runs in the worker (SPEC R20, ARCH §4.3). |
| TE-5 | Physics credibility | Partial | Accepted: 5R1C in T1, EN 14825 bins, and validation datasets as WP-01's first deliverable. **Changed: Standard mode drops the ±5% SAP claim** instead of adopting Appendix U. SAP fidelity moves to the new `rating` mode, so Standard stays climate-true and works in India. |
| TE-6 | Plugin contract bugs | Partial | Accepted: shared-only fingerprint, MeasureModel and MeasureUi split, `./engine` and `./ui` exports, `StageIO`, a `thermal-model` kind, and fewer kinds. **Changed: cancellation uses a sliced search with a cancel message between slices, not a SharedArrayBuffer flag.** A SharedArrayBuffer needs cross-origin isolation, which blocks opt-in third-party fetches. |
| TE-7 | Work package overlap; integration all at the end | Accept | BUILD_PLAN rewritten: per-owner subdirectories in packs and fixtures, a Lean-generated `Certificate`, WP-01 owns the pipeline runner, an M-0 walking skeleton, and contract tests at every gate. |
| TE-8 | 3D frame rate | Accept | Still-life rendering, baked miniatures, a scissor split instead of the portal, a lower render tier during LLM generation, a `renderer.info` CI gate, and three font families (DS §3, §10). |
| TE-S | T1 scope (3 styles, 4 layers, template plus one local LLM) | Accept | The one local LLM in T1 is **Ollama**: it runs off the GPU the scene uses, needs no 2 GB in-browser download, and is easy to test. WebLLM and Claude move to T2. |

## Rulings that change the founding plan (M1)

1. The **"recompute, never add"** rule now says the search is factorised. Packages are still recomputed whole, but cached demand is reused when the heat source changes. The one approximation this adds (heat source does not change space demand, except through DHW system class and controls) is documented and property-tested.
2. **Calibration** may adjust the wall U-value, within published in-situ priors. M1 said "never U-values". We changed it because SC-8 showed that a single behavioural parameter hides fabric error.
3. **"A better home never scores worse"** becomes "a home at least as good on all seven indicators never scores lower".
4. **"Every accepted package is feasible"** becomes "every package shown passes every rule we encoded". Packages that need a check go in a separate lane.
