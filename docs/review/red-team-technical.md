# Red team: technical review

Reviewer: skeptical principal engineer. Inputs: all `docs/*.md` and `docs/research/*.md`. Date: 2026-10-10.

## Verdict

The plan is rigorous on paper, but it gets scale wrong. The hero home already exceeds the search, certificate and evidence budgets. Lean is aimed at definitional arithmetic and misses the parts that can actually be wrong. The plugin contracts have bugs that will surface on day one. Fix these before WP-00 freezes `core`.

## Prioritised fixes

### 1. GH1 breaks the "≤ 4,096" search (P0)

SPEC §9 groups for GH1, after applicability (no cavity, combi so no cylinder or solar thermal, battery needs PV): 3·3·2·2·3·2·3·10 = **12,960** packages. The hero therefore lands in branch and bound, and the completeness seal is weakened. At 2 ms per simulation that is 26 s against AC-W2's 1 s. LV §5 also enumerates `2^n` subsets, while SPEC uses choice groups.

Fix:
- **Factorise the physics.** Demand depends only on the fabric and ventilation groups: 216 heavy simulations. Heat source, controls, PV and battery are cheap post-processing on cached monthly demand. Exhaustive enumeration then stays complete and takes < 100 ms.
- Lean `enum.complete` generates the choice-group product.
- **Lazy evidence graph.** Build full nodes only for the baseline, the front and the picks, and rebuild the rest on demand. Eagerly building ~13k × 200 hashed nodes costs seconds.
- **Columnar, sparse certificate** with one dominance witness index per package. Today's shape is ~20 MB of JSON, stored 20 times per home.
- Generate `gh1.search.json` at the real scale, not 64 packages.

### 2. "Lean owns constants" contradicts plugin packs (P0)

Tariffs, grants and carbon factors change quarterly. Today each bump needs a Lean rebuild, and third-party packs are impossible. After an update, old certificates fail `constants.match`, so Okaeri shows Cracked seals everywhere.

Fix:
- Lean owns formulas, weights, anchors and **well-formedness predicates** (slabs monotone, factors ≥ 0, dates ordered).
- Pack data travels in the certificate and is checked against those predicates, not for equality.
- `specHash` covers the spec only. The checker accepts the historical specs it ships with.
- Score indicator A uses fixed SAP 10.2 reference prices, so an unchanged house keeps its score.

### 3. Point Lean at what can be wrong (P0)

`weights_sum_one`, `N0 ≥ 0` and `saving = before − after` hold by definition. The planning rules are TS-only `Expr` ASTs, and the Lean `Ctx` knows only the six built-in rules. So `feas.recompute` cannot catch M1's "infeasible heat pump accepted" when the noise rule is the cause.

Fix:
- **Kleene `Expr` evaluator in Lean** with a monotonicity theorem: "unknown never yields feasible", for every completion of the unknowns. Certificates carry each package's fact table.
- **MCS 020 noise** uses `log10` and π, so it cannot be done in plain `Rat`. Use rational enclosures (tabulated 10^(k/10) and bounds on π). A result whose enclosure straddles 37.0 becomes `needs-check`.
- **Slab marginal pricing** and a **robust saving** lower bound, enclosed on the monthly model actually shown, not on LV §6.5's separate degree-day formula.
- Proved never sits on a number. Numbers carry at most Checked.

### 4. Exact arithmetic is too slow, and determinism is overstated (P1)

NPV in bigint rationals has denominators near 200^25. Run that across 13k packages, the sensitivity strip, flip-point bisection and LHS sampling, and it takes seconds. Separately, `Math.exp`, `pow` and `log` differ between JavaScript engines, so results quantised to Wh can differ by 1. The "byte-identical" claim then fails, and snapshots show false diffs.

Fix:
- Use spec-defined **fixed point** (micro-pence, Wh) with round-half-even per year step, identical in Lean.
- Add a deterministic fdlibm-style math module and lint `Math.*` out of `engine`.
- Run the mirror checker in the worker. The browser spot-checks the front, the picks and a hash-seeded sample. Lean CI and the companion check everything, and the seal says which ran.

### 5. Physics credibility (P1)

- **T-lite** is a synthetic sinusoid, yet it drives 10% of the score, the comfort figures and GH2's win moment ("afternoon heat hits the roof"). A monthly model has no roof time lag. Bring **hourly 5R1C** into T1 for comfort, on the baseline, front and picks only (~1 ms each). Add daily min and max temperatures to `ClimatePack`.
- **ASHP COP** from the monthly mean ΔT ignores cold spells and defrost. Use the EN 14825 bin method.
- **Standard mode** claims ±5% SAP fidelity while heating all 12 months on NASA POWER climate. Use Appendix U climate and SAP seasons, or drop the claim.
- Validation datasets (EPC open data, BRE examples, NEED) are unowned. Make them WP-01's first deliverable.

### 6. Plugin contract bugs (P1)

- The UI and engine registries load different manifests, so `fingerprint()` always mismatches. Compare only `side: 'both'` plugins.
- `MeasurePlugin` mixes engine (`apply`), AI (`opSchema`) and UI (`mon`, `fold`) concerns. Split it into model and presentation, joined by id. Give packs separate `./engine` and `./ui` exports.
- `PhysicsStage<unknown, unknown>` loses typing. Use `StageIO[S]`. An hourly model replaces three stages and needs hourly climate, so add a `thermal-model` kind. The "same interface" promise is false today.
- `AbortSignal` is not cloneable, and a synchronous loop never sees a cancel message. Search must yield in slices or poll a `SharedArrayBuffer` flag.
- 37 kinds is too many. Make sound, panel, chapter, onboarding-step and migration static typed modules.

### 7. Work packages overlap; integration is big bang (P1)

- One measure file is needed by WP-01, WP-02, WP-03, WP-05 and WP-07.
- `fixtures` is written by four WPs.
- `Certificate` exists twice, in `core` and in `cert.schema.json`.
- No one owns `simulate` orchestration (stage order, quantisation, id assignment).

Fix:
- Per-owner fixture folders.
- A Lean-generated `Certificate` type.
- WP-01 owns the pipeline runner.
- Add **M-0 Walking skeleton** before fan-out, on real code: GH1 → 3 measures → search → certificate → Lean check → one chapter.
- Contract tests at every gate, not in P2.

### 8. 3D will not hold 60 fps on Iris Xe (P1)

The design stacks a lot of GPU work:
- Washi: PBR + N8AO + accumulative shadows + Kuwahara.
- Sobel edges and bloom.
- Three live byōbu `View`s.
- A portal that renders a second scene.
- A 30 fps loop that never idles.
- WebLLM taking ~2 GB of the same iGPU's memory.

CI has no GPU, so the fps budgets cannot be tested as written.

Fix:
- **Still-life rendering.** On camera rest, bake one high-quality frame. Motes and people animate on a cheap overlay.
- Bake the miniatures per result hash.
- Use a scissor split instead of the portal.
- Lower the render tier during LLM generation.
- Gate CI on `renderer.info` counts. Measure fps manually per milestone.
- Use three font families.

## T1 scope

- Render styles: Washi, Yoru and SVG.
- Layers: heat-flow, lens, ghost and noise.
- Narrators: template plus one local LLM.

Everything else ships as a stub. Spend the time saved on fixes 1 to 3.
