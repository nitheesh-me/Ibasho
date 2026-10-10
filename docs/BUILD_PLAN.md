# Ibasho: Build Plan

Status: director synthesis v2, 2026-10-10. v2 applies `review/DECISIONS.md`, TE-7 in particular. Read with `SPEC.md` (what), `ARCHITECTURE.md` (how) and `DESIGN_SYSTEM.md` (look).

Coordination happens on `docs/BLACKBOARD.typ` under its protocol:
- append only
- claim directories before editing them
- never wait or poll
- record a BLOCKER and return
- no em or en dashes.

---

## 1. Shape of the work

```
P0   G0   Scaffold            WP-00 alone. Monorepo, contracts, skeletons, CI.
P0.5 M-0  Walking skeleton    Serial chain on real code: WP-01 → WP-03 → WP-02 → WP-04 → WP-06 → WP-08 → WP-10.
                              GH1, 3 measures, 8 packages, certificate, Lean check, one screen.
P1   M-A  First light         Physics, scene, shell, tokens, hero assets.
     M-B  Three futures       Search, finance, rules, futures and what-if screens.
     M-C  Sealed              Lean spec v2, checker, mirror, claim seals.
     SG   Stranger gate       3 untuned homes plus NEED SWI/CWI (AC-SG1, AC-5b).
     M-D  Story               Narrator, memory, calibration UI, 5 chapters, revisit, offline.
     M-E  T1 release          Landing, demo, a11y, perf, copy.
P2+  M-F to M-I               Tiers T2 to T5 (§7).
```

Integration is continuous. M-0 puts real code in every layer before work fans out, and the contract tests (`pnpm contracts`) run at every gate.

## 2. Ownership (edit rights)

Every path belongs to exactly one work package. A WP may read anything but edits only what it owns. A cross-WP change is requested on the blackboard (INTERFACES) and made by the owner. `tests/contracts/ownership.test.ts` fails CI if a commit touches paths outside the committing WP's set (commit trailer `WP: WP-xx`).

| WP | Role | Owns |
|---|---|---|
| WP-00 | Architect | Root files (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `biome.json`, `.npmrc`, `.nvmrc`, `.gitignore`, `.dependency-cruiser.cjs`), `packages/core/**`. **Until G0 only**: skeletons of every package, pack and app, `packages/spec-gen/**` placeholder, `tools/lint/**`, `.github/**`, `tests/smoke/**` |
| WP-01 | Physics | `packages/dmath/**`, `packages/engine/src/{pipeline,physics,thermal,calibration,validation}/**`, `packs/climate/**`, `packs/home-uk/{package.json,tsconfig.json,README.md,src/ids.ts,src/engine/**}`, `packs/home-in/{same}`, `packages/fixtures/src/{homes,bills,validation}/**` |
| WP-02 | Search, finance, score | `packages/engine/{package.json,tsconfig.json,README.md}`, `packages/engine/src/{index.ts,api.ts,worker.ts}`, `packages/engine/src/{search,finance,score,uncertainty,flips,evidence,street}/**`, `packs/money-uk/**`, `packs/money-in/**`, `packages/fixtures/src/results/**` |
| WP-03 | Rules | `packages/engine/src/rules/**`, `packs/rules-uk/**`, `packs/rules-in/**`, `packages/fixtures/src/rules/**` |
| WP-04 | Lean and verify | `proofs/**`, `packages/spec-gen/**` (from G0), `packages/verify/**`, `tools/verify/**`, `packages/fixtures/src/certs/**` |
| WP-05 | AI and memory | `packages/ai/**`, `apps/companion/**`, `packages/fixtures/src/{injection,utterances,narration}/**` |
| WP-06 | UI kit | `packages/ui/**` |
| WP-07 | Scene | `packages/scene/**`, `packs/home-uk/src/ui/**`, `packs/home-in/src/ui/**` |
| WP-08 | App shell and store | `apps/web/**` except `apps/web/public/assets/**`, `packages/store/**` |
| WP-09 | Content and landing | `apps/landing/**`, `packages/content/**` |
| WP-10 | QA | `tests/**` (`tests/smoke/**` from G0), `tools/lint/**` (from G0), `.github/**` (from G0), `packages/fixtures/{package.json,tsconfig.json,README.md}`, `packages/fixtures/src/stranger/**` |
| WP-11 | Assets | `apps/web/public/assets/**`, `tools/assets/**` |
| WP-12 | Agent link (MCP + Claude Code) | `packages/agent-bridge/**`, `apps/mcp/**`, `integrations/claude-code/**`, `tools/agent-install/**`, `packages/fixtures/src/agent/**` |

**How the split avoids overlap (DEC TE-7):**

- **One measure, five owners, one id.** `packs/home-uk/src/ids.ts` (WP-01) defines the measure and option ids. WP-00 creates it in G0, and it is frozen at M-0 (changes go through INTERFACES). The ids are joined like this:

  | Part | Owner | Location |
  |---|---|---|
  | Physics model (`measure`) | WP-01 | `src/engine/measures/` |
  | Cost (`measure-cost`) | WP-02 | `packs/money-uk/src/costs/` |
  | Applicability and regulatory facts (`APPL.*` rules) | WP-03 | `packs/rules-uk/src/` |
  | Presentation (`measure-ui`) | WP-07 | `src/ui/` |
  | Disruption and next step | WP-09 | `packages/content/measures/` |
  | Op parameter ranges | none (derived from the model's `params`) | |

  `tests/contracts/measures.test.ts` checks that every id has all five parts.
- **Fixtures have per-owner folders.** `packages/fixtures/package.json` exports `"./*": "./src/*"`, so no shared index file exists.
- **`Certificate` is defined once**, generated from Lean into `packages/spec-gen`. `core` re-exports the type only.
- **WP-01 owns the pipeline runner**: stage order, light path, quantisation, evidence id assignment. WP-02 calls it and never reorders stages.
- **Root files stay with WP-00.** Each package's own `package.json` belongs to its owner.

## 3. Order and dependencies

```
G0 ──► M-0 ──┬─► M-A ──┬─► M-B ──┬─► M-C ──► SG ──► M-D ──► M-E (T1 release)
             │         │         │
 WP-01 ──────┤ physics ┤ calib.  │                      AC-5b ─┘
 WP-06 ──────┤ tokens  ┤ futures ┤ seals UI
 WP-07 ──────┤ house   ┤ ghost, noise, fold, split ─────────── polish ─┐
 WP-08 ──────┤ shell   ┤ what-if, futures ┤ seals ─► story, revisit ───┤
 WP-11 ──────┤ hero assets ─────────────────────────────── lazy sets ──┤
 WP-03 ──────────────── rules ┤                                        │
 WP-02 ──────────────── search, finance ┤ uncertainty, flips           │
 WP-04 ── spec-gen (first) ─── Lean spec v2, checker ┤                 │
 WP-05 ── validator, template ───────────── Ollama, memory ┤           │
 WP-09 ── measure content ─────────────────────── landing ─────────────┤
 WP-12 ──────────────── headless MCP ┤ bridge, live tools, plugin ┤      │
 WP-10 ── CI, contracts, determinism ── stranger generator ── demo, a11y, visual
```

Rules for agents:
- From M-0 on, code against the real thin implementations and `core` contracts. Use fixtures only where a dependency's milestone has not landed.
- Need a contract change? Write an INTERFACES entry with the proposed diff, continue with a local adapter, and let WP-00 apply it.
- **Done** means: acceptance tests green in CI, `pnpm contracts` green, README updated, a STATUS "Features" row added in `docs/STATUS.typ`, and a HANDOFF entry on the blackboard.

## 4. Work packages

Format: **Goal**, **Inputs**, **Outputs**, **Acceptance** (each line is one named test or a recorded manual check, with its pass condition), **Gate**.

### WP-00 Architect (P0)

- **Goal:** a buildable monorepo whose contracts let eleven agents work in parallel.
- **Inputs:** ARCH §2 to §13, SPEC §0, §7.
- **Outputs:**
  1. Root config and `.dependency-cruiser.cjs` encoding ARCH §3.
  2. T1 dependencies at exact versions (ARCH §13).
  3. `packages/core`: every contract in ARCH §4 and §5, plus working `PluginRegistry`, `EventBus`, `Fixed`, `Q`, `Ival`, units, canonical hashing, PRNG and LHS, and the `EvidenceGraph` builder.
  4. A skeleton for every package, pack and app (`package.json`, `tsconfig.json`, `src/index.ts`, `README.md` naming the owner WP). `packs/home-uk/src/ids.ts` lists the SPEC §9 ids.
  5. A `packages/spec-gen` placeholder marked `PLACEHOLDER: replaced by ibasho-gen`.
  6. `tools/lint/{no-dash,no-math,legend}.ts`.
  7. CI: install, lint, typecheck, test, build, plus a Lean job that runs when `proofs/lakefile.toml` exists.
- **Acceptance:**
  - G0-1 `pnpm install --frozen-lockfile && pnpm lint && pnpm -r typecheck && pnpm test && pnpm build` exits 0.
  - G0-2 dependency-cruiser reports the fixture `tools/lint/__fixtures__/ui-imports-engine.ts`.
  - G0-3 `no-math` reports `Math.exp` in a fixture under `packages/engine/`.
  - G0-4 `packages/core` line coverage ≥ 95% for `fixed/`, `exact/`, `plugin/`, `hash`.
  - G0-5 `Fixed.discountFactors` equals the hand-computed vectors in `packages/core/test/vectors/discount.json` (3.5%, 3.0%, 7.0%; 25 years) exactly.
  - G0-6 Playwright smoke: `apps/web` and `apps/landing` boot to a blank Andon page.
- **Gate:** G0. Then ownership transfers per §2.

### M-0 Walking skeleton (serial, before fan-out)

Each owner writes thin real code in its own directories, in this order. The slice:

1. GH1 twin with 3 measure groups (loft 300, draught-proofing, ASHP).
2. Steady monthly heat balance (fabric plus ventilation, η = 1, boiler efficiency, fixed COP).
3. Two rules: budget, plus one Kleene `Expr` rule with an unknown fact.
4. 8 packages.
5. Fixed-point savings, monthly carbon, N0, NPV.
6. Front, witnesses, picks.
7. `ibasho.cert/2`.
8. A Lean checker extended from the LV §6 prototype, and the TS mirror.
9. `/app/home/gh1` showing an SVG house, `Num` chips, one Checked seal and one claim seal.

| Step | WP | Writes |
|---|---|---|
| 1 | WP-01 | `pipeline` thin, `fixtures/src/homes/gh1.twin.json`, `fixtures/src/bills/gh1-bills-{low,high}.json` |
| 2 | WP-03 | `rules` Kleene evaluator, two rules |
| 3 | WP-02 | `search`, `finance`, emitter input, `api`, `worker` |
| 4 | WP-04 | `proofs/` (Fixed, Accounting monthly, Kleene, Pareto witnesses, Memory), `ibasho-check`, `ibasho-gen`, mirror, real `spec-gen` |
| 5 | WP-06 | tokens, `Num`, `Seal`, `ClaimSeal` (minimal) |
| 6 | WP-08 | route, worker wiring, minimal SVG house (temporary, replaced by WP-07 at M-A) |
| 7 | WP-10 | `tests/m0`, the three mutants, CI job, `tests/contracts/ownership.test.ts` |

- **Acceptance:**
  - M0-1 `pnpm m0` (`tests/m0/`, owned by WP-10) runs the slice in CI in < 60 s. `ibasho-check` exits 0 and the mirror agrees.
  - M0-2 Mutant: a flipped saving sign fails `acct.saving` in both checkers (exit 1).
  - M0-3 Mutant: a rejected measure placed in the front fails `feas.recompute` in both checkers.
  - M0-4 Mutant: an unknown blocking fact marked feasible fails `feas.recompute`.
  - M0-5 Playwright: the GH1 page shows ≥ 3 `Num` chips, one Checked seal and the claim "What you ruled out never came back". No bare digits appear in `[data-numeric]`.
  - M0-6 The result hash is equal in Node and Chromium.
- **Gate:** M-0.

### WP-01 Physics

- **Goal:** the documented model in three run modes, plus 5R1C, junctions, heat pump bins, calibration and validation.
- **Inputs:** BP §2 to §9, SPEC R3, R5, R6, R19, R20, R21, §7.1, §9; DEC SC-2, SC-4, SC-6, SC-8, TE-5.
- **Outputs:**
  - **First deliverable:** validation datasets in `fixtures/src/validation/`: NEED 2023 medians and measure savings, 500 EPC open-data records for AC-R1, PVGIS references, EoH and HeatpumpMonitor SPF ranges, India AC homes, LBNL cool roof.
  - `dmath`.
  - Typed physics stages and the pipeline runner (heavy path and light path, quantisation, evidence ids).
  - `rating`, `standard` and `your-home` modes.
  - Opaque gains with η_c = 1 when L_c ≤ 0.
  - Explicit ψ junctions (SAP K1) and y for the remaining area.
  - EN 14825 bin SCOP (Ruhnau 2019 fit).
  - Cylinder, hob and gas-disconnect effects.
  - 5R1C `thermal-model` per zone.
  - Calibration posterior (θ, n_inf, U_wall) with weather normalisation.
  - `valueOfInformation`.
  - Packs: `climate` (six cities with daily max and min, the London TMY from PVGIS, Appendix U for rating), `home-uk/src/engine` (RdSAP 10 constructions, K1 defaults, archetypes with `seed()`, systems, measure models incl. `junctionEffects` and `facts`), `home-in/src/engine` (stub until T3).
- **Acceptance:**
  - A1 `validation/datasets.test.ts`: every dataset is present, schema-valid and has a source and date.
  - A2 AC-5: BP §8 targets within the stated tolerances.
  - A3 AC-7: property suite, including Q_C finite and ≥ 0 for 6 packs × 12 months × 3 modes.
  - A4 AC-6: oracles 1 to 6 and 9.
  - A5 `dmath` vectors within 1 ulp of reference, with identical bits in Node, Chromium and Firefox.
  - A6 Light path equals full simulation within 1 Wh on 200 random GH1 packages.
  - A7 GH1 Σψ·L + y·A_rest is within ±15% of y_RdSAP·A_exposed. Every drawn junction has an evidence node (AC-V1, engine half).
  - A8 Bin SCOP reproduces BP §3.10's worked example within ±0.15 (about 2.65 before, about 3.1 after fabric). The bin hours sum to 8,760.
  - A9 5R1C: the GH1 January zone mean is within ±1 K of the monthly θ_i. Each run takes ≤ 2 ms (Node, warm).
  - A10 One heavy simulation takes ≤ 0.3 ms per mode. GH1's 432 × 3 heavy simulations take ≤ 400 ms (Node, warm).
  - A11 (M-B) AC-C1, AC-C2, AC-C3.
  - A12 (M-B) The AC-R1 report is generated and published on the blackboard. Passing is required only before any "compliant" label.
  - A13 (SG) AC-5b: NEED SWI and CWI plus loft medians within ±5 points.
- **Gate:** M-A (A1 to A10), M-B (A11, A12), SG (A13).

### WP-02 Search, finance, score

- **Goal:** the worker API, the factorised exhaustive search, fixed-point bookkeeping, score, picks, witnesses, flips, uncertainty, lazy evidence and certificate inputs.
- **Inputs:** SF (all), SPEC R2, R4, R6 to R9, R20, R22, R24, §7.2 to §7.4, §8; ARCH §5.5, §6, §8.3; AM §7.2.
- **Outputs:**
  - `api.ts`, `worker.ts` (sliced jobs, cancel).
  - Search: plan, heavy and light enumeration, rule hook, obligations re-keying heavy, target set, needs-check lane.
  - Finance in fixed point:
    - bills with slab-exact tariffs and standing charges, including gas disconnect
    - grants with stacking and expiry
    - N0 with counterfactual boiler, B_t, NPV with replacements and residual value
    - paybacks, IRR (single sign change only)
    - lifetime carbon by year via `carbon-trajectory`
    - loan and cash-positive flag
    - landlord ledger (stub until T4)
    - value range.
  - Score with exact Q from `spec-gen`, plus groups.
  - EPC band from the rating-mode proxy.
  - Front, witnesses, picks with the Lean tie-breaks.
  - Flips: every crossing.
  - Uncertainty: LHS 200 for baseline and picks, after first paint.
  - Evidence: eager for baseline, front and picks; `evidence()` on demand.
  - Packs: `money-uk` (Ofgem cap Q4 2026 graded per DEC SC-F3, SEG, carbon SAP 10.2 monthly and DESNZ with T&D, Green Book trajectory, BUS, WH:LG, loan stub, ECO4 and GBIS closed, Halifax reward, 0% VAT with `validTo`, value evidence v1, `measure-cost` for every SPEC §9 option incl. cylinder, moisture assessment and PAS 2035, `epc-proxy/rating`) and `money-in` (stub until T3).
  - `fixtures/src/results/gh1.search.json` at real scale, regenerated by script.
- **Acceptance:**
  - B1 The GH1 plan counts 432 heavy and 10,800 packages.
  - B2 AC-W2: full GH1 search ≤ 700 ms in Node (CI proxy) and < 1 s in the Chromium worker on the reference laptop (recorded).
  - B3 GH1 NPV for the three picks matches WP-10's hand spreadsheet `tests/golden/gh1-npv.csv` to £0.01.
  - B4 SF §10 injections (weight 0.21, flipped anchor, expired grant applied, IRR on two sign changes, value added into NPV) are each caught by an engine test.
  - B5 Oracles 7 and 8. Properties: random dominance pairs never lower the score; picks lie on the front and inside the target set; the empty package is never a pick; no needs-check package is in the front.
  - B6 Determinism: the same request twice gives identical `hash` and certificate bytes, and the hashes match across Node, Chromium and Firefox.
  - B7 Fast path p95 < 100 ms engine side (AC-W1 engine half).
  - B8 AC-W4: cancel returns within 50 ms.
  - B9 A slab-tariff fixture with exactly two known flip points returns both.
  - B10 Eager graph ≤ 5,000 nodes for GH1. `evidence()` returns any node in < 20 ms.
  - B11 AC-S3: a NEED-median archetype scores 40 to 60.
- **Gate:** M-B.

### WP-03 Rules

- **Goal:** the Kleene evaluator, the noise enclosure and the corrected UK pack.
- **Inputs:** RP (all), SPEC R19, R22, §9; ARCH §5.4; DEC SC-3, SC-4.
- **Outputs:**
  - The `Expr` evaluator (Tri) over option and package facts, a sentence renderer, the `asOf` filter, idempotent obligations, and `check` effects.
  - Named functions: `mcs020a_Lp_le` (Q table, barrier matrix, two-unit sum, 0.1 dB rounding, rational enclosure mirroring Lean), `adf_category`, `ens_retv`, `mees_cap`, `dt_hosting`.
  - `noise()` fast path.
  - `rules-uk`: RP §5.1 to §5.4 with the SPEC §9 corrections, `APPL.*` applicability rules, `UK.DNO.*`, `UK.PAS2035`, `ENG.MOIST.IWI`, built-ins. Every rule has `source.grade`. Rules from reviewer memory cite their DEC row.
  - `rules-in`: stub until T3.
- **Acceptance:**
  - C1 AC-8: golden 32.0 dB(A), with the enclosure inside [31.95, 32.05).
  - C2 One golden test per SPEC §9 rule, including:
    - rear rendered EWI on Article 2(3) land gives consent (LPA)
    - front EWI gives consent, not block
    - roof PV without an Article 4 direction gives no LPA consent; with one it gives consent
    - Part L 0.70 acts as a trigger, not a floor
    - PV export 3.68 kW per phase gives G98 notify; above that, G99 consent
    - IWI on solid masonry gives `needs-check`; once the check is recorded it gives `feasible`.
  - C3 Properties: an unknown block is never `feasible`. Kleene results equal the result under every completion of up to 6 unknown facts.
  - C4 `adf_category` is monotone, and obligations are idempotent.
  - C5 The ASHP boundary rule is active on 2025-05-28 and retired on 2025-05-29.
  - C6 `noise()` p95 < 5 ms for 2 units × 6 positions.
  - C7 A lint confirms every rule has a grade and a source URL.
- **Gate:** M-B.

### WP-04 Lean and verify

- **Goal:** the Lean spec v2, generated artefacts, the checker proved sound, the mirror, seals and claims.
- **Inputs:** LV (all), SPEC R7, R8, R11, R12, R20, R22, §7.3, §7.4; ARCH §8; AM §7.2; RP §8; DEC TE-2, TE-3, SC-1, SC-7.
- **Outputs:**
  - The `proofs/` tree per ARCH §8.1, with V1 kept for history.
  - Exes `ibasho-check --batch`, `ibasho-gen --check --audit` and `ibasho-ref`.
  - `spec-gen` generated files (**first P1 deliverable**, replacing any placeholder).
  - `packages/verify`: emitter from `SearchResult`, the mirror (same check ids, worker-safe, coverage modes), the seal and claim resolver, `checker-rung` plugins (`mirror`, `lean-native` via the companion), and the `POST /verify` handler.
  - `tools/verify`.
  - Golden and mutant certificates in `fixtures/src/certs/`.
- **Acceptance:**
  - D1 AC-1: every M1 and SF mutant fails its named check in both checkers, including "infeasible heat pump accepted via the noise rule".
  - D2 AC-2: the axiom audit shows only the three standard axioms.
  - D3 AC-3: differential 10k cases equal (nightly; 1k in PR CI).
  - D4 AC-4: mirror parity on golden, random and mutant certificates.
  - D5 `check_sound` and every theorem in SPEC §7.3 are proved, with no `sorry`.
  - D6 `ibasho-gen --check` is clean on main.
  - D7 The mirror checks the GH1 certificate in the Chromium worker: full coverage in ≤ 200 ms, or the seal records `sample`.
  - D8 A V1-spec certificate fixture still checks after the V2 bump (AC-O2 support).
  - D9 A clean `lake build` takes ≤ 90 s in CI. `ibasho-check --batch` handles 1,000 certificates in ≤ 30 s.
- **Gate:** M-C. D6 is required at M-0 exit.

### WP-05 AI and memory

- **Goal:** grounded local-first narration, typed ops and the memory domain.
- **Inputs:** AM (all), SPEC R10, R11, §5.6, §5.12, §5.13, §10; UX §14; DEC TE-S.
- **Outputs:**
  - Evidence bundle builder.
  - Slot tokenizer and renderer.
  - Validator G1 to G8 with one structured repair.
  - Template narrator for 5 chapters, overview, package, trade-off, answer, welcome-back recap and why-not, en-GB, with seeded variants.
  - Router with locality badges and the outbound ledger.
  - **Ollama provider**.
  - Offline intent parser and `OpValidator`.
  - Notes quarantine extractor (rules-based in T1).
  - Memory event log, views, seeds, forget and export, behind a `MemoryRepo` interface from `core` that `store` implements.
  - `apps/companion`: `/verify` mount, `/health`, the optional Ollama CORS pass-through.
- **Acceptance:**
  - E1 AC-N1, AC-N2 (60 notes) and AC-N3.
  - E2 AC-M1 (500 replayed sessions), AC-M2, AC-M3.
  - E3 The intent parser scores ≥ 70% exact ops on its 120-utterance gold set.
  - E4 GH1 template narration is byte-identical across two runs and across Node, Chromium and Firefox.
  - E5 Each of G1 to G8 rejects its seeded violation fixture.
  - E6 The Ollama adapter passes its contract test against a mock `/api/chat`.
  - E7 No outbound payload contains raw note text (payload inspection test).
- **Gate:** M-D.

### WP-06 UI kit

- **Goal:** Andon in code.
- **Inputs:** DESIGN_SYSTEM (all), UX §11, §15.
- **Outputs:**
  - Token sources and `tokens.css`.
  - Three font families.
  - `scripts/bake-glyphs.ts` (Yuji Syuku glyphs to SVG paths).
  - Grain and brush frames.
  - Every T1 component in DS §8, with stories.
  - The mon icon set.
  - Motion presets.
  - `Num`.
  - Chart primitives with `TableAlt`.
- **Acceptance:**
  - F1 AC-14 ramp test.
  - F2 Every text token pair in DS §2.1 has contrast ≥ 4.5:1.
  - F3 `tools/lint/mon` passes on every icon.
  - F4 axe is clean on every story, with visual snapshots in Hiru and Yoru.
  - F5 `--seal` and `--gold` are used only in allowed components (lint).
  - F6 Type test: `Num` cannot take `seal="proved"`.
  - F7 `ScoreGroups` never renders a letter. `EpcChip` always renders ±1 until a prop `bandValidated` is set.
  - F8 No story loads more than three font families (network audit).
  - F9 Baked glyphs exist for every kanji listed in DS §3.
- **Gate:** M-A (tokens, `Num`, `Seal`, `ClaimSeal`, `Sheet`, `NarratorStrip`, `ScoreGroups`, `EpcChip`), M-B (`Futures`, `MeasureCard`, `FuelBars`, `Slider`, `WhyNot`, `CheckLane`, `MonthRing`), M-D (the rest).

### WP-07 Scene

- **Goal:** the living drawing.
- **Inputs:** SV §3, §4.4; DS §10; SPEC R19, §5.3 to §5.8; ARCH §10.
- **Outputs:**
  - The stage.
  - Procedural house from elements and junctions.
  - Props from the archetype.
  - Still-life `Bake` and `Live` passes for Washi and Yoru.
  - The SVG renderer (fallback and Pencil stage).
  - T1 layers: heat-flow, thermal-lens, ghost, noise-rings with draggable unit, fold-assembly with seams and new-risk hatches, zone-tint, people.
  - Scissor before/after split.
  - Baked miniatures.
  - Roof-lift camera sequence.
  - Quality ladder with the LLM tier drop.
  - `a11y-scene`.
  - Picking to `elementId` and `junctionId`.
  - `packs/home-uk/src/ui` (`measure-ui` for every id, archetype thumbnails).
- **Acceptance:**
  - G1 AC-15. AC-PERF counts under SwiftShader on 6 GH1 key frames.
  - G2 AC-H1 outline parity.
  - G3 AC-K1, AC-K3 and AC-V1 (scene half).
  - G4 SVG and WebGL cameras match within 2 px at the Pencil to Ink handover.
  - G5 Still-life: after a bake with an idle camera, the `Live` pass renders 0 frames; only overlays draw.
  - G6 Every layer has a reduced-motion variant. Context-loss recovery test.
  - G7 Manual: frame rate on Iris Xe recorded on the blackboard at M-A, M-B, M-D and M-E (≥ 30 fps floor).
- **Gate:** M-A (house, bake, Yoru, SVG, heat-flow, lens, zone-tint), M-B (ghost, noise, fold, split, miniatures), M-D (people, roof-lift polish).

### WP-08 App shell and store

- **Goal:** the product a normal person uses.
- **Inputs:** SPEC §3 to §6, §11; UX §3 to §10, §12, §13; ARCH §4.1, §6, §9.
- **Outputs:**
  - Routes (SPEC §4) and the module manifest.
  - Worker wiring.
  - Layout zones.
  - Onboarding (5 typed steps, no budget).
  - Home stage.
  - Story controller (5 chapters, timeline, gold mist).
  - Studio views: what-if with levers and noise drag, futures with budget prompt, check lane and why not, after, plan with disruption and next step, evidence ledger and drawer, sharpen, things you told us, welcome back, settings, `/app/proofs`.
  - Bill input flow.
  - PWA, storage persistence and status, export and import.
  - `packages/store`: Dexie schema, repositories including the `MemoryRepo`, migrations, `.ibasho` codec.
- **Acceptance:**
  - H1 AC-G1 to AC-G3, AC-H2, AC-E1, AC-E2, AC-E3, AC-P1, AC-O1, AC-O2, AC-S1, AC-S2, AC-S4, AC-W1 end to end, AC-W3, AC-F1 to AC-F3 (UI half).
  - H2 The full app works offline after first load (Playwright offline).
  - H3 Migration test from a v0 fixture DB.
  - H4 Safari storage-status logic is unit-tested.
  - H5 e2e: no budget question before the futures appear.
  - H6 AC-11 tatami lint passes on every route at 360, 768 and 1440 px.
- **Gate:** M-A (shell, onboarding, Reveal), M-B (what-if, futures, after), M-C (seals, proofs page), M-D (story, told, welcome back, settings, offline).

### WP-09 Content and landing

- **Goal:** the words, and the "Ibasho no kōjō" landing that updates as features land.
- **Inputs:** UX §15, §16; SV §7; VISION; DS §9.
- **Outputs:**
  - `packages/content`: measure guidance (disruption, installer type, accreditation, three questions) for every T1 id, glossary, voice guide, landing chapters with `requires`, and "What we prove" intro copy.
  - `apps/landing`: static HTML first paint, 5 chapters, posters, one live miniature at most.
- **Acceptance:**
  - I1 AC-L1 to AC-L3.
  - I2 AC-P2: every T1 measure id has complete guidance (contract test).
  - I3 The landing page is axe-clean and passes the no-dash lint.
  - I4 A chapter hides when its required plugin is absent.
  - I5 Every term marked for the glossary in UI copy has a plain definition.
- **Gate:** M-D (content), M-E (landing).

### WP-10 QA

- **Goal:** prove continuously that the product does what the spec says.
- **Inputs:** SPEC §12 and every AC id, the M1 testing table, BP §8, SF §10, RP §6, LV §8, AM §8.
- **Outputs:**
  - CI workflows: PR, nightly, determinism matrix.
  - `tests/contracts` (ownership, measures, layers, fingerprint, StageIO).
  - `tests/m0`.
  - `tests/e2e`, `tests/demo.spec.ts` (VISION §5 with timings), `tests/a11y`, `tests/visual`, `tests/layout/tatami.spec.ts`.
  - `tests/mutation`, `tests/differential` (shared generators with WP-04).
  - `tests/stranger` (seeded generator of 3 random UK archetype homes).
  - `tests/golden/gh1-npv.csv` (hand spreadsheet, independent of WP-02).
  - The cultural review checklist and the hallway-test protocol.
- **Acceptance:**
  - J1 `tests/ac-map.json` maps every AC id in SPEC to ≥ 1 test or a documented manual check. CI fails on any unmapped id.
  - J2 PR CI runs in < 15 min. Nightly runs the full 10k differential and the matrix.
  - J3 AC-SG1 gate run with the seed logged on the blackboard.
  - J4 AC-10 demo passes offline.
  - J5 AC-Q1 hallway test recorded at M-E.
- **Gate:** sign-off entry on the blackboard at every gate.

### WP-11 Assets

- **Goal:** every external asset downloaded, processed, licensed and listed.
- **Inputs:** SV §6; DS §10.
- **Outputs:**
  - `tools/assets/fetch.ts`: Poly Haven API, Kenney and Quaternius zips.
  - `tools/assets/process.ts`: textures to WebP or KTX2, HDRIs at 1k plus a preview, glTF via gltf-transform with meshopt.
  - `apps/web/public/assets/manifest.json`.
  - An attribution page source.
- **Hero set:**

  | Kind | Assets |
  |---|---|
  | HDRIs | `qwantani_dusk_2`, `qwantani_noon`, `qwantani_late_afternoon`, `kloofendal_overcast_puresky` |
  | Textures | `red_brick_03`, `roof_slates_02`, `white_stucco`, `pavement_02` |
  | Models | the GH1 subset of Kenney Furniture and Quaternius Ultimate Home Interior |

  Lazy sets follow SV §6. Sound assets are T5.
- **Acceptance:**
  - K1 Every file in `public/assets` is in the manifest with licence and sha256.
  - K2 The hero tier is ≤ 8 MB.
  - K3 No hero entry is `pending-manual`.
  - K4 The attribution page is generated from the manifest.
- **Gate:** M-A (hero), M-D (lazy sets).

### WP-12 Agent link: MCP server and Claude Code plugin

- **Goal:** let an AI agent explore a home headless or live in the open app, installed into Claude Code in one command (ARCH 14).
- **Inputs:** ARCH 5.5, 14; SPEC 5.14, 10; AM (all); the tldraw offline skill as a pattern (`~/skills/tldraw-offline`, `~/.claude/agents/tldraw-offline.md`).
- **Outputs:** `packages/agent-bridge`, `apps/mcp`, `integrations/claude-code`, `tools/agent-install`, agent fixtures, plus INTERFACES requests for the two mount points (companion, web).
- **Acceptance:**
  - L1 MCP contract test with the SDK in-memory transport: every tool in ARCH 14 lists, validates input with zod, and returns evidence ids for every number.
  - L2 Headless parity: `ibasho_search_futures` on GH1 returns the same result hash as the worker API.
  - L3 `ibasho_what_if` rejects any op outside the typed `Op` schema; no code execution path exists (grep and test).
  - L4 Bridge: no token gives 401; wrong pairing code is refused; binds 127.0.0.1 only.
  - L5 Live e2e (Playwright + MCP client): `ibasho_live_apply` adds loft insulation in the open app, the stage updates, the change carries the agent mark and undoes cleanly; `ibasho_live_screenshot` returns a non-blank PNG.
  - L6 `ibasho_live_say` with a raw digit is rejected by the validator; with slots it renders grounded values.
  - L7 Installer: `--dry-run` prints the plan and writes nothing; install then `--uninstall` against a temp HOME leaves it byte-identical to before; `claude plugin validate` (or `details`) passes on `integrations/claude-code`.
  - L8 `claude plugin eval` runs the plugin evals (explore GH1, find the biggest heat leak, explain why inside insulation is absent) and records scores on the blackboard (manual gate).
- **Gate:** M-B (headless MCP, L1 to L3), M-D (bridge, live tools, plugin, installer, L4 to L8).

## 5. Gates

| Gate | Definition of done | Must be green |
|---|---|---|
| G0 | Scaffold | G0-1 to G0-6 |
| M-0 | Walking skeleton | M0-1 to M0-6, D6 |
| M-A | **First light.** GH1 baseline in three modes. The house is drawn in Washi and Yoru with motes, lens, junction lines and zone tints. Every number is a `Num` chip. Hero assets load. | A1 to A10, F (M-A set), G (M-A set), H (M-A set), K1 to K3, `pnpm contracts` |
| M-B | **Three futures.** The factorised search with rules and finance. Futures with why not, the check lane and budget. What-if levers and noise drag. Fold and split. | A11, A12, B1 to B11, C1 to C7, F, G and H (M-B sets), contracts |
| M-C | **Sealed.** The Lean V2 spec and checker. The mirror in the worker. Claim seals, crack and re-press. `/app/proofs`. | D1 to D9, H (M-C set), contracts |
| SG | **Stranger gate.** The product is not overfit to GH1. | AC-SG1 (J3), AC-5b (A13) |
| M-D | **Story.** 5 chapters, template narrator plus Ollama, calibration moment, memory list, welcome back, offline. | E1 to E7, I2, I5, F, G and H (M-D sets), contracts |
| M-E | **T1 release.** Landing, demo, a11y, visual, perf, copy. | I1, I3, I4, J1, J2, J4, J5, AC-12, AC-13, G7, `docs/STATUS.typ` walkthrough written |

After each gate, WP-10 signs off on the blackboard and WP-09 updates any landing chapters whose `requires` are now met.

## 6. T1 release checklist (director, at M-E)

1. The real worker is in the manifest and no mock path is reachable (grep and e2e).
2. AC-10 demo offline on the reference laptop. Fix the chapter beat timings.
3. Performance pass: frame time (manual), recompute, search, bundle limits (`size-limit`).
4. Accessibility pass: keyboard-only Story, screen reader outline, reduced motion.
5. Copy pass with the voice guide and glossary. No-dash lint. Every seal's "not proved" line is read aloud in the hallway test.
6. Red team: injection corpus, mutation suite, cultural checklist, R17 badges on every flagged value.
7. Update `docs/STATUS.typ` and the landing page.

## 7. Later tiers

Ownership stays as in §2, and each tier opens with a blackboard CLAIM entry.

| Gate | Tier | Work by owner |
|---|---|---|
| M-F | T2 Owner tools and voices | WP-08: boiler-broke flow, quote check, compare, snapshot (AC-SN1). WP-02: staged pathway, quote cost bands. WP-05: WebLLM and Claude providers, outbound ledger for cloud. WP-07: sun ring layer. WP-09: content |
| M-G | T3 India | WP-01: `home-in`, India climate TMY. WP-02: `money-in` slab tariffs and subsidies. WP-03: `rules-in`. WP-05: en-IN, te and hi templates and letters. WP-07: `home-in/src/ui`. WP-09: content and the landing "two homes" chapter |
| M-H | T4 Landlord and city | WP-02: landlord ledger, street aggregate (AC-ST1). WP-03: MEES and city rules. WP-07: street layer. WP-08: portfolio and evidence export |
| M-I | T5 Depth | WP-01: per-room `thermal-model`, embodied carbon. WP-04: Lean WASM rung, `proofs-extra` monthly-chain enclosure research. WP-05: Chrome AI. WP-06 and WP-07: Sumi, Netsu and Shita-e styles, sound, garden skin. WP-02: robustness sampling |

Each later gate passes only if T1's acceptance suite is still green.

## 8. Global definition of done

- The feature's spec acceptance criteria pass in CI and are mapped in `tests/ac-map.json`.
- Every displayed number is a `Num` chip with evidence and the correct seal level. Proved seals appear only on claims.
- Hiru, Yoru, reduced motion and no-WebGL paths all work.
- Offline works.
- Determinism holds across Node, Chromium and Firefox.
- No em or en dashes in copy or docs.
- README, STATUS and the blackboard are updated.
