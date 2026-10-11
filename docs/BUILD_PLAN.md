# Ibasho: Build Plan

Status: director synthesis v2, 2026-10-10. v2 applies `review/DECISIONS.md`, TE-7 in particular. Read with `SPEC.md` (what), `ARCHITECTURE.md` (how) and `DESIGN_SYSTEM.md` (look).

**v3 (2026-10-11).** §9 to §12 add the v3 work: waves, ownership for WP-13 to WP-24, v3 scopes for existing WPs, and the light testing policy (`PLAN-V3.md`). The owner direction (prototype first, outside in) overrides any v2 sequencing it conflicts with. §1 to §8 still govern the home track (M-A to M-C).

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

### Bad outcomes (SPEC 14), cross-WP

| Part | Owner | Gate |
|---|---|---|
| `maintenance` plugin kind and contract | WP-00 (steward) | M-B |
| Decay models (boiler, seals, heat pump servicing) in `packs/home-uk/src/engine/maintenance/` | WP-01 | M-B |
| "If nothing is done" run, negatives list per package | WP-02 | M-B |
| Custom request parsing to `Op`s, "can't model that yet" | WP-05 | M-D |
| Fourth line beside the futures, negatives on every card | WP-08 | M-B to M-D |
| Plain copy for each negative and decay effect | WP-09 | M-D |
| AC-B1 to AC-B3 | WP-10 | M-D |

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

---

# Part II: v3

## 9. Shape of the v3 work

```
V-0  Contracts v3       WP-00 core v3 types and schemas, layer rules, installs; WP-10 ownership map. Short and serial.
V-P  Prototype          WAVE 1, parallel. Every flow at full fidelity on Preview data.
                          Design:     WP-06 UI kit v3
                          Developers: WP-08 studio shell and five flows, WP-15 editor, WP-07 city scene,
                                      WP-13 Preview data and staged progress, WP-14 plan helpers and building fixtures,
                                      WP-17 city pack v0
                          QA:         WP-22 product, WP-23 UX, WP-24 content (review based)
V-1..V-6  Real stages   WAVE 2, in progress-bar order. Each swaps one stage from preview to real:
                          V-1 geometry (WP-14, WP-21 PDF trace)   V-2 sun and radiation (WP-16, WP-17, WP-01 dmath)
                          V-3 daylight (WP-16)                    V-4 energy (WP-18, WP-02 money-in)
                          V-5 codes and ratings (WP-19, WP-03)    V-6 optimisation (WP-20, WP-04 proofs)
V-7  Partner, memory    WAVE 3: WP-05 scoped memory, RecSet, why it changed, partner; WP-12 DesignOp tools
V-H  Hyderabad hero     WAVE 3: the Vindhya demo end to end; WP-09 content and landing; WP-11 Hyderabad assets
```

The M-A to M-C home work in flight finishes in parallel; it is the base WP-18 and WP-20 extend.

Rules of the road:
- Every stage keeps the same contract in Preview and real; swapping is one line in `apps/web/src/manifest.ts`.
- No flow may break during a swap. A Preview stamp disappears only when its stage is real.
- Need a contract change? INTERFACES entry on the blackboard, local adapter, WP-00 applies it.

## 10. Ownership (v3)

New work packages. Paths are disjoint from each other and from §2; WP-10 encodes them in `tools/lint/ownership.ts` at V-0, including the exclusions noted.

| WP | Role | Owns |
|---|---|---|
| WP-13 | Preview data and stage providers | `packages/preview/**`, `packages/fixtures/src/preview/**` |
| WP-14 | Building model and plan kernel | `packages/plan/**`, `packages/fixtures/src/buildings/**` |
| WP-15 | Editor (Make) | `packages/editor/**` |
| WP-16 | Site and daylight | `packages/site/**`, `packages/fixtures/src/site/**` |
| WP-17 | City data | `packs/city-hyderabad/**`, `packs/city-london/**`, `tools/city/**` |
| WP-18 | Multi-zone energy and building types | `packages/engine/src/{zones,systems,enduse}/**`, `packs/types-global/**` and `packs/types-in/**` except `src/ui/**`, `packs/benchmarks/**`, `packages/fixtures/src/energy/**` |
| WP-19 | Codes, baselines and ratings | `packages/engine/src/codes/**`, `packs/codes-in/**`, `packs/codes-global/**`, `packs/ratings/**`, `packages/fixtures/src/codes/**` |
| WP-20 | Optimiser | `packages/engine/src/optimise/**`, `packages/fixtures/src/optimise/**` |
| WP-21 | Interop and reference runners | `packages/interop/**`, `apps/companion/src/runners/**`, `packages/fixtures/src/interop/**` |
| WP-22 | Product QA | `docs/qa/product/**` |
| WP-23 | UX QA | `docs/qa/ux/**` |
| WP-24 | Content QA | `docs/qa/content/**` |

Changes to §2 ownership:
- WP-02 keeps `packages/engine/**` minus the WP-01, WP-03, WP-18, WP-19 and WP-20 directories.
- WP-05 keeps `apps/companion/**` minus `src/runners/**`.
- WP-07 also owns `packs/types-global/src/ui/**` and `packs/types-in/src/ui/**` (type mons, thumbnails, preset drawings), as it does for the home packs.

v3 scope of existing WPs (same paths as §2):

| WP | v3 scope | Gate |
|---|---|---|
| WP-00 | Core v3 contracts (ARCH §15.4), schemas, layer rules (ARCH §15.2), installs (ARCH §15.9) | V-0 |
| WP-01 | dmath `atan2`, `asin`, `acos`, `tan` for the SPA port; `climate` EPW for Hyderabad TMYx with monthly tables derived from it | V-2 |
| WP-02 | `money-in`: TGSPDCL FY 2026-27 (LT-I, LT-II, HT-II, ToD, kVA demand, cliffs, Gruha Jyothi), HMWSSB water, diesel, CEA factors, India cost table with source rows; fair split | V-4 |
| WP-03 | `rules-in`: roof rights (association consent for rooftop PV), tenure rules for rentals and apartments | V-5 |
| WP-04 | Lean v3: N-axis Pareto, geometry sums, ledger identity, rating monotone and nesting, Shapley sum, memory scopes; `cert/3`; mirror | V-1 to V-6 |
| WP-05 | Scoped bi-temporal memory, typed goals, `RecSet` tiers, why it changed, offline and Ollama partner, narrator slots and G9, G10 | V-7 |
| WP-06 | UI kit v3 (§11.1) | V-P |
| WP-07 | City scene, lenses, editor 3D view (§11.2) | V-P, then each real stage |
| WP-08 | Studio shell, five flows, settings ledger, store v2 (§11.3) | V-P |
| WP-09 | Copy for types, codes, ratings, lenses, settings; glossary; landing v3 chapters | V-P (copy), V-H |
| WP-10 | Ownership map, layer rules tests, stage-provider contract tests | V-0, then each swap |
| WP-11 | Hyderabad materials (RCC, plaster, laterite, jaali), trees, a Hyderabad sky set | V-H |
| WP-12 | MCP tools for places, buildings and `DesignOp`s | V-7 |

## 11. Work packages (v3)

Format as §4. Acceptance in wave 1 is light and review based (§12).

### 11.0 WP-00 Contracts v3 (V-0)

- **Outputs:** `packages/core/src/v3/**` per ARCH §15.4 with zod schemas; `comply` effect, metric registry, `b.*` and `z.*` facts; `preview` seal level and provenance; new plugin kinds (ARCH §15.3); dependency-cruiser rules (ARCH §15.2); skeletons for the new packages and packs with READMEs naming their owners; installs (ARCH §15.9, V-0 rows).
- **Acceptance:** `pnpm -r typecheck` green; schema round-trip tests for every v3 contract; a fixture importing `three` from `plan` is reported; the GH1 twin still validates.

### 11.1 WP-06 UI kit v3 (design, wave 1)

- **Goal:** Andon for the studio, city, editor and analysis (DESIGN_SYSTEM §13).
- **Outputs:** tokens for the new ramps and states; components `StageBar`, `PreviewStamp`, `ScaleLadder`, `ModeTabs`, `LensPanel`, `AnalysisLegend`, `Histogram`, `TypeCard` (mon and schedule strip), `PlaceCard`, `EuiGauge`, `EndUseBar`, `RatingLadder`, `CodeRow`, `GoalChip`, `SettingRow`, `DiffCard`, `WelcomeBack`, `FilmStrip`, `CompareGrid`, `ParallelCoords`, `ProposalCard`, `ToolRail`, `DimensionTag`, `PropertiesSheet`, `Breadcrumb`; eight building-type mons; stories in Hiru and Yoru at 360, 768, 1280 and 1600 px.
- **Acceptance:** U1 new ramps pass AC-14; U2 text pairs ≥ 4.5:1; U3 `PreviewStamp` and stale states never use `--seal` or `--gold` (F5 lint extended); U4 every chart has `TableAlt`; U5 every story renders at the four widths without horizontal scroll (UX QA review).

### 11.2 WP-07 City scene (developer, wave 1)

- **Goal:** the paper city and the building in it (UV §2, §10; DESIGN_SYSTEM §13).
- **Outputs:** context layer from city tiles (instanced LoD1, estimated tops hatched, honesty chip on hover); building meshes from `SurfaceSet`; scale ladder camera moves; time strip binding and sun from the place; lens painting from `SiteResult` and daylight results; the eight signature moments as layers with reduced-motion variants; the daylight drawer and exploded floor stack; night lanterns; compare (scissor 2 and 4); editor 3D view; device quality tiers.
- **Acceptance:** S1 city level on the Hyderabad preview pack within ARCH budgets (≤ 150 draw calls, ≤ 400k triangles) from `renderer.info` in a unit test; S2 every analysis layer has a legend and `evidenceAt` (AC-15); S3 penumbra drawn for every estimated height; S4 each moment has a reduced-motion variant.

### 11.3 WP-08 Studio shell and five flows (developer, wave 1)

- **Goal:** the five flows end to end (SPEC §17 to §19, §24).
- **Outputs:** routes; top bar (place, building, scenario, modes); zones per breakpoint; engawa with narrator strip and `StageBar`; `StudioClient` (jobs, generations, cancel, stale marking); manifest stage mapping; New, Revisit, Restart, Current plus what-if, Update; settings ledger; Prove and Tell screens on preview results; store v2 with the v1 migration.
- **Acceptance:** H7 each flow reaches its end state on GB1 and GB3 with Preview providers at 360, 768, 1280 and 1600 px (product QA review); H8 changing a setting marks its `affects` stale before recompute (unit test); H9 a newer generation always wins (unit test); H10 migration from a v1 fixture DB.

### 11.4 WP-13 Preview data and stage providers (developer, wave 1)

- **Goal:** realistic results, shaped exactly like real outputs, with honest timings.
- **Outputs:** seven preview stage providers; a deterministic generator (`packages/preview/scripts/`) that builds fixtures for GB1 to GB4 and GH1 from the briefs' benchmarks and plant data, so totals add up exactly (EUI equals the end-use sum over area, bills follow the slab tables); recorded stage timings scaled by a device factor; rough, refined and final tiers.
- **Acceptance:** P1 every fixture validates against the core schemas; P2 arithmetic identities hold in every fixture (sums, ratios, ladder lookups); P3 every value has `provenance.kind = 'preview'`; P4 a stage-provider contract test passes for all seven.

### 11.5 WP-14 Building model and plan kernel (developer, wave 1 support, then V-1)

- **Goal:** the building document and its geometry (BE §2).
- **Outputs (wave 1):** pure helpers for the editor (polygon area in bigint mm², point in polygon, snapping, rectangle and polygon room ops, split, massing auto-zoning to core plus four perimeter zones); `BuildingDoc` fixtures for GB1 to GB4 (from RB tables, unknowns as ranges) and GH1. **(V-1):** `compile()` with Clipper2, adjacency, quantities, plan checks, PF, daylight extent, RETV, the phototropic massing operator.
- **Acceptance:** B12 AC-ED1 (PF 0.345); B13 AC-ED2 (exact areas, zero overlap); B14 adjacency symmetric on all fixtures; B15 GH1 compiles to within 1% of the hand twin per element area (R27); B16 `compile()` is byte-deterministic across Node and Chromium.

### 11.6 WP-15 Editor (developer, wave 1)

- **Goal:** Make mode (SPEC §20, BE §3, UV §5).
- **Outputs:** tool rail and tools; SVG plan with architectural drawing conventions (DESIGN_SYSTEM §13.4); snapping and typed dimensions; storeys; room function painter; window and shading rules with presets; inspector and properties sheet; command history with film strip; keyboard map; touch and pen; PDF underlay display; plan outline as a non-visual editor.
- **Acceptance:** E8 every tool has a key and an outline path (AC-ED3); E9 phone has a button for every drag (AC-ED4); E10 undo then redo restores the document byte for byte (unit test); E11 a three minute New-flow build of GB3 is possible on desktop and tablet (UX QA review).

### 11.7 WP-17 City data (developer, wave 1 slice, then V-2)

- **Outputs:** `tools/city` with cached Overpass fetches; `city-hyderabad` v0 (IIIT campus and 2 km of Gachibowli: footprints, OSM levels, height ranges with sources, unknown flagged); v1 adds Overture, Open Buildings 2.5D heights, trees and terrain; `city-london` around GH1.
- **Acceptance:** Y1 every building has a height source and range; Y2 pack ≤ 5 MB; Y3 the pack rebuilds byte-identically from the cached sources.

### 11.8 WP-16 Site and daylight (V-2, V-3)

- **Outputs:** SPA port on dmath; EPW parse and hash; Perez sky and patch matrices; CPU visibility kernel; sun hours, radiation, SVF, ASE, ECBC manual daylight method, sDA tier T1, views, shading ledger, monthly shading factors for the engine; the real `sun`, `radiation` and `daylight` stage providers.
- **Acceptance:** AC-LK1, AC-LK3, AC-LK4; SD §7 tests V1 to V12 recorded with their error bands; determinism across Node and Chromium.

### 11.9 WP-18 Multi-zone energy and building types (V-4)

- **Outputs:** N-zone 5R1C with cooling, latent and capacity; monthly ISO 52016-1 rung fitted to hourly; systems (VRF, split, chiller with total system efficiency, DOAS with ERV, fans, pumps, DHW, PV with site shading, diesel); end uses and EUI; fan-first comfort; `types-global`, `types-in`, `benchmarks`; the real `energy` stage provider.
- **Acceptance:** AC-X3 (BESTEST 600 and 900); AC-BR1; end-use sums close exactly after quantisation; GB1 EUI lies inside the benchmark range or the result says why.

### 11.10 WP-19 Codes, baselines and ratings (V-5)

- **Outputs:** `comply` evaluation with margins; applicability ladder; baseline builder (ECSBC standard design, Appendix G); `codes-in`, `codes-global`, `ratings` packs per EC §5; rating ladder data; the real `codes` stage provider; a manual task list to upgrade `estimate` rows from the code PDFs.
- **Acceptance:** AC-CD1 to AC-CD4; one golden test per rule; GHMC star bands from GHMC FAQ Q7 reproduced.

### 11.11 WP-20 Optimiser (V-6)

- **Outputs:** Morris screening; factorised exhaustive search over v3 groups; deterministic NSGA-II on the core PRNG with exact light completion; N-axis front, witnesses and picks per R37; sweeps; phototropic search driver; certificate inputs for `objectives`; the real `optimise` stage provider.
- **Acceptance:** AC-OP1, AC-OP2; the front on GB1 within the 1 s budget below the cap; the seal text lists the options tried.

### 11.12 WP-21 Interop and reference runners (V-1, then later)

- **Outputs:** PDF underlay and trace assist (scale from dimension labels by least squares, walls from paired lines, rooms from loops, storeys from sheet titles; person confirms each room); OSM and GeoJSON footprint import; gbXML, epJSON and Dragonfly export; companion EnergyPlus runner adding a "reference agrees within x%" evidence row; IFC later.
- **Acceptance:** I6 Vindhya first floor traces to rooms the person can confirm, with scale error ≤ 1%; I7 the epJSON of GB3 runs in EnergyPlus when installed (manual).

### 11.13 QA agents WP-22, WP-23, WP-24 (wave 1 onward, review based)

| WP | Reviews | Method | Output |
|---|---|---|---|
| WP-22 Product | Each flow against PLAN-V3 and SPEC §17 to §25: reaches its end state, nothing missing, Preview honestly labelled, a normal person and a professional can each finish | Code reading plus one screenshot pass per breakpoint (360, 768, 1280, 1600) with one guarded headless browser | `docs/qa/product/<gate>.md`: findings with severity, flow, step, file |
| WP-23 UX | Heuristics, responsiveness, Andon rules (seal and gold scarcity, one ramp, every mark a measurement), WCAG 2.2 AA spot checks, reduced motion, touch targets, keyboard paths | Same pass, plus axe on each route once per gate | `docs/qa/ux/<gate>.md` |
| WP-24 Content | Voice, plain English, units, en-IN numbers, banned words ("compliant", "certified", "guaranteed", "save up to"), no dashes, Preview and pre-check wording, glossary coverage | Copy lint plus reading every screen's strings | `docs/qa/content/<gate>.md` |

Each QA WP posts a short HANDOFF with its top five findings, and the owning WPs fix them. QA never edits product code.

## 12. Gates and testing policy (v3)

**Testing is light for now** (owner direction):
- Each WP runs only its own package tests (Vitest `--maxWorkers=2`), following any machine rules in `CLAUDE.local.md`.
- No repo-wide suite except at a gate the owner calls. Never run a full suite and a Lean build together.
- Browsers: only the QA WPs, one guarded headless browser at a time, closed in `finally`.
- Wave 1 acceptance is review based: QA sign-off plus each WP's own unit tests for pure logic.

| Gate | Definition of done | Must be green |
|---|---|---|
| V-0 | Contracts v3 | §11.0 acceptance, ownership map updated, installs done |
| V-P | **Prototype.** All five flows at full fidelity on four widths, Preview labelled, staged progress with cancel | U1 to U5, S1 to S4, H7 to H10, P1 to P4, E8 to E11, Y1 to Y2, B14; QA sign-off from WP-22, WP-23 and WP-24 with no open severity-1 finding |
| V-1 | Real geometry | B12 to B16, I6, geometry stage swapped |
| V-2 | Real sun and radiation | AC-LK1, AC-LK3, Y3, sun and radiation stages swapped |
| V-3 | Real daylight | AC-LK4, tier bands recorded, daylight stage swapped |
| V-4 | Real energy | §11.9 acceptance, energy stage swapped |
| V-5 | Real codes and ratings | §11.10 acceptance, codes stage swapped |
| V-6 | Real optimisation | §11.11 acceptance, optimise stage swapped, Lean v3 theorems proved with no `sorry` |
| V-7 | Partner and memory | AC-OP3 to AC-OP5 |
| V-H | Hyderabad hero | AC-X5, AC-X6, QA sign-off, STATUS walkthrough written |
