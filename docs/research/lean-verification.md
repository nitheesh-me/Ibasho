# Ibasho: Lean 4 verification layer

Research brief from the formal verification specialist. Date: 2026-10-10.

Scope: what Lean 4 should prove in Ibasho, how proofs connect to the TypeScript engine, the Lean project layout, and how a normal customer sees the proofs ("proof seals").

Every Lean snippet marked **[compiled]** was type-checked on this machine against `leanprover/lean4:v4.34.0`, core only (no Mathlib), with `#print axioms` showing only `propext`, `Classical.choice`, `Quot.sound` (no `sorryAx`, no `Lean.ofReduceBool`). Snippets marked **[sketch]** are design-level.

---

## 1. Verdict in one paragraph

Lean should not "decorate" the app. It should own three things: (1) the **specification** of every bookkeeping rule (score, per-fuel accounting, feasibility, Pareto selection, interval enclosure), with universally quantified theorems; (2) the **constants** the TS engine uses (weights, emission factors, tariffs, rule catalogue), generated from Lean so the theorems are about the exact numbers shipped; and (3) a **certificate checker** executable, proved sound against the spec, that validates a JSON certificate the TS engine emits for every result. The physics stays in TypeScript (float64, fast, interactive) and is explicitly outside the proof boundary, except for an optional interval enclosure layer that proves "your uncertainty band contains every model outcome consistent with your unknowns". In the UI the result is a vermilion hanko-style **seal** per claim, with three honest levels: *Proved* (theorem), *Checked* (this result's certificate passed), *Modelled* (physics, tested not proved).

---

## 2. Local toolchain findings

| Item | Finding |
|---|---|
| elan | Installed. 12 toolchains, default `leanprover/lean4:v4.34.0`. Also 4.28 to 4.34 rc builds. |
| `lean --version` | `Lean (version 4.34.0, x86_64-unknown-linux-gnu, commit 293d5d0c, Release)` |
| Lake | `5.0.0-src+293d5d0` |
| Mathlib cache | `~/.cache/mathlib` is 4.6 GB (91,719 `.ltar` files). |
| Mathlib checkouts | `lean-diffusion/lean/corpus` (Mathlib `v4.32.2`), `geo-server` (Mathlib `v4.33.0`). **None for v4.34.0.** |
| Other v4.34 projects | `HACKTHONS/codebot/lean` (core only `Spec` lib), `lean_compiler/safelean` (core only, uses `lean_exe` checkers such as `leancheck`; good precedent for "spec lib + checker exes" layout). |
| `lean4-acn-prep`, `lean4-tutorial` | Tutorial / prep material, v4.32.1, no Mathlib relevance. |
| `emcc` | **Not installed.** Needed only for the WASM stretch goal. |
| Core `Rat` | Available with **no imports** in v4.34.0 (`#eval (1/3 : Rat) + 1/6` gives `1/2`). Core ships `Rat.mul_nonneg`, `Rat.mul_le_mul_of_nonneg_left/right`, `Rat.mul_add`, `Rat.le_total`, `Rat.max_def`, ... |
| `grind` over `Rat` | Solves linear goals over `Rat` (ordered field linarith module) and min/max clamping goals. Does **not** solve nonlinear goals such as `0 ≤ w → s ≤ 1 → w*s ≤ w`; supply `Rat.mul_le_mul_of_nonneg_left` by hand. |
| `decide` on `Rat` | Plain `decide` gets stuck on `Rat` equality; **`decide +kernel` works** (`weights_sum_one` proved this way). Avoid `native_decide` (adds `Lean.ofReduceBool`, puts the compiler in the TCB). |
| Prototype build | 5 spec modules + checker exe: full `lake build` in **2.5 s**. Checker run on a 3-candidate certificate: **27 ms** wall time, exit code 0 on valid, 1 on a corrupted front. |
| Binary size | With `import Lean.Data.Json`: 122 MB (82 MB stripped; links all of `libLean`). With **Init-only** imports: **4.5 MB**. This matters for WASM. |

**Decision: core only, pinned to `v4.34.0`.** Mathlib would cost a 5 GB dependency, a toolchain-locked cache (no local v4.34 build), and minutes of CI per bump, for theorems that core `Rat` + `grind` already prove in under a second. Mathlib is reserved for an optional, separate `proofs-extra` package (real analysis of the physics model, LeanCert transcendental bounds) that the checker never imports.

---

## 3. What to prove (the five layers)

| Layer | Claim in plain words | Lean artefact | Kind |
|---|---|---|---|
| (a) Score | Weights sum to 1, are nonnegative; score always in [0, 100]; a home better on every dimension never scores worse | `weights_sum_one`, `weight_nonneg`, `score_nonneg`, `score_le_100`, `score_mono` | Theorem, all inputs **[compiled]** |
| (b) Accounting | Per-fuel saving is exactly before minus after, signed; carbon saved per fuel equals emissions before minus emissions after | `saving_neg_iff`, `saving_add`, `carbonSaving_eq` | Theorem **[compiled]** |
| (c) Feasibility | Every accepted package satisfies every constraint rule; a measure the owner rejected is never offered again | `Rule.sound` per plugin, `feasibleB_sound`, `feasible_respects_memory` | Theorem + per-result check **[compiled]** |
| (d) Pareto | No option on the front is dominated by any feasible option; every nondominated option is on the front; "cheapest" and "lowest carbon" are true minima; a lexicographic cheapest is itself on the front | `checkFront_sound`, `checkFront_complete`, `checkCheapest_sound`, `checkLowestCarbon_sound`, `lexMin_nondominated`, `dominates_trans`, `not_dominates_self` | Theorem + per-result check **[compiled]** |
| (e) Intervals | When inputs are unknown, the shown band contains the model output for every consistent input ("unknown ≠ 0") | `Ival.add_sound`, `Ival.mulNN_sound`, `fabricLoss_enclosed` | Theorem + per-result check **[compiled]** |

What Lean does **not** prove: that the reduced-order physics matches reality, that emission factors are the right ones for the region, that the LLM text is grounded. Those are tested (NEED/EPC ranges, sweeps, grounding matcher), as M1 already states in its "Honest boundary" box. The UI must say this too.

---

## 4. Connecting Lean to TypeScript: options evaluated

| Option | What it gives | Cost | Verdict |
|---|---|---|---|
| A. **Certificate checker exe** (`ibasho-check`), proved sound, validates JSON certificates emitted by the TS engine | Per-result guarantee: *this* answer satisfies the spec. Independent of how TS computed it (McConnell, Mehlhorn, Näher, Schweitzer, "Certifying algorithms", 2011) | Low. Prototype built and runs in 27 ms | **Core. Build first.** |
| B. **Code-generate TS constants from Lean** (weights, emission factors, tariffs, rule ids, normaliser breakpoints) | The theorems are about the exact numbers TS uses. No drift | Very low. Prototype `Gen.lean` emits `WEIGHTS` as bigint rationals | **Core. Build with A.** |
| C. **Differential testing** against a Lean reference evaluator on rationals (`ibasho-ref`) | Catches TS bookkeeping bugs on thousands of random homes before users see them | Low. Reuses spec functions, `fast-check` on TS side | **Core, in CI.** |
| D. **Seal manifest generated from the Lean environment** | UI can only display claims that exist as kernel-checked theorems, with their axioms listed | Low. Prototype `Seals.lean` reads `getConstInfo` + `collectAxioms` | **Core. Unique selling point.** |
| E. **Lean checker compiled to WASM**, runs in the browser | Lean-checked seals fully offline, no companion process | Medium to high, fragile per toolchain bump (see 4.2) | **Stretch (phase 3), behind a capability flag.** |
| F. TS mirror checker (hand written, ~300 lines) differentially tested against `ibasho-check` | Instant seals in any browser; always available | Low | **Core, as the fallback rung.** |
| G. Extract the whole engine from Lean | One language, everything verified | Kills interactivity and the plugin story; physics in `Rat` is slow | Reject. |

### 4.1 The checker ladder (who checks a result in the app)

1. **Lean native** (`ibasho-check`): in CI, in `pnpm verify <cert>`, and at runtime through the optional local companion (the same process that hosts the optional LLM proxy) via `POST /verify`. Seal label: *Checked by Lean*.
2. **Lean WASM** (stretch): same checker code, compiled with Emscripten, in a Web Worker. Seal label: *Checked by Lean (in browser)*.
3. **TS mirror**: always available. Seal label: *Checked (mirror)*, with a tooltip saying the mirror agrees with the Lean checker on N CI certificates and M mutants.

The seal never claims more than the rung that actually ran.

### 4.2 WASM feasibility, researched

- Lean's own CI has a "Web Assembly" job, but it is **commented out** in `.github/workflows/ci.yml` (CMake flags `-DUSE_GMP=OFF -DMMAP=OFF`, Emscripten toolchain file, `-linux_wasm32` suffix). Release `v4.34.0` ships **no wasm assets** (only darwin, linux, linux_aarch64, windows).
- `doc/make/emscripten.md` in the lean4 repo still documents building `lean_js_wasm` (historically for lean-web-editor). The runtime has Emscripten code paths (`src/shell/lean_js.cpp`).
- Community: `T-Brick/lean2wasm` compiles a Lean `Main` to wasm via emcc; self-described experimental, needs `MODULARIZE` to call `main` repeatedly.
- Practical route: keep the checker core **Init-only** (no `import Lean`; measured 4.5 MB native), parse a tiny wire format in Lean itself, take the C files Lake emits under `.lake/build/ir/`, link against a wasm build of `libleanrt` (GMP off, Lean's own bignum fallback), export `check(json: string): string`.
- Risk: every toolchain bump may break the runtime build. Mitigation: pin the toolchain, build wasm only on release tags, fall back to the TS mirror automatically.

### 4.3 Number representation (the crux of "exact")

Floats cannot be checked for exact equality, so the boundary is explicit:

| Stage | Representation | Why |
|---|---|---|
| Physics (TS) | float64 | Speed, interactivity, sweeps |
| Physics output boundary | **Quantised integers**: Wh/yr per fuel, gCO2e, pence | Deterministic, serialisable, exact |
| Bookkeeping (TS) | Exact rationals (`bigint` numerator/denominator; tiny `Q` type in `packages/exact`) | Must equal Lean bit for bit |
| Constants | Generated from Lean as `{ n: 1n, d: 5n }` | Single source of truth |
| Wire format | `{"n": int, "d": nat}` per number, never JSON floats | Lean `FromJson Rat` rejects `d = 0` |
| Display | Rounded at the last step only; theorem that the rounded score stays in [0, 100] | No rounding drift in stored values |

---

## 5. Certificate design

One certificate per computed scenario, stored in IndexedDB next to the twin snapshot, keyed by `hash(snapshot)`. Editing the twin invalidates it; the seal "cracks" and re-presses after recompute (a natural loading state).

```jsonc
{
  "schema": "ibasho.cert/1",
  "specHash": "sha256 of Lean constants + rule ids",   // checker rejects mismatch
  "engine": { "version": "0.4.0", "physics": "rom-degree-day/2" },
  "constants": { "weights": {...}, "emissionFactors": {...}, "tariffs": {...} },
  "context":  { "budget": {...}, "isOwner": true, "roofRights": false,
                "rejected": ["ewi"], "conflicts": [["ashp", "gas-boiler-upgrade"]],
                "rules": ["budget", "tenure", "roof", "memory", "conflicts", "prereq"] },
  "baseline": { "perFuelWh": {...}, "subScoreInputs": {...} },
  "measures": [ { "id": "loft", "capex": {...}, "needsOwner": false, "needsRoof": false } ],
  "packages": [ // ALL 2^n subsets, each exactly once
    { "ids": ["loft","ashp"], "afterWh": {...}, "claimedFeasible": true,
      "claimed": { "savingWh": {...}, "carbonSaving": {...}, "billSaving": {...}, "scoreAfter": {...} } } ],
  "front": ["loft", "loft+ashp", "loft+ashp+pv"],
  "picks": { "cheapest": "loft", "bestReturn": "loft+ashp", "lowestCarbon": "loft+ashp+pv" },
  "intervals": { "UA": {...}, "HDD": {...}, "fabricLossBand": {...} }        // optional
}
```

The checker re-derives everything that is bookkeeping and only trusts `baseline.perFuelWh` and `packages[*].afterWh` (the physics outputs):

| Check id | Re-derivation | Catches (M1 injected bug) |
|---|---|---|
| `constants.match` | Certificate constants equal Lean constants; `specHash` matches | Wrong weight, missing carbon factor |
| `enum.complete` | Lean generates the 2^n subsets itself and matches them one to one | Silently dropped packages |
| `acct.saving` | `savingWh f = before f - after f` for every fuel, signs kept | Flipped sign; savings by adding percentages (claimed savings ≠ whole-package before minus after) |
| `acct.carbon` | `carbonSaving = Σ_f saving f · EF f` (= emissions before minus after by theorem) | Missing or wrong factor |
| `score.recompute` | Sub-scores from inputs via Lean normalisers, then `score` | Wrong weight, unclamped sub-score |
| `feas.recompute` | `claimedFeasible = feasibleB ctx pkg` for every package | Infeasible heat pump accepted, rejected measure re-offered |
| `pareto.front` | `checkFront feasible front` | Dominated option shown |
| `pareto.picks` | `checkCheapest`, `checkLowestCarbon`, best return is a max | Wrong "cheapest" label |
| `ival.enclosure` | Recompute bands with `Ival` ops; claimed band ⊇ proved band | Overconfident uncertainty band |

Output: a JSON list of `{check, ok, path?}`; `path` points at the offending item, so the UI can open the exact evidence row (M1's "click any number to open its evidence").

Scale: with six measures, 64 packages; full enumeration is cheap. Above roughly 14 measures, switch `enum.complete` to "front correct relative to the listed candidates" and say so on the seal; a branch and bound dominance certificate is a later research item.

Top-level soundness statement **[sketch]**:

```lean
structure Cert where
  constants : Constants
  ctx       : Ctx
  baseline  : FuelVec
  packages  : List PkgRecord
  front     : List String
  picks     : Picks

/-- Everything the UI is allowed to claim about this certificate. -/
def Valid (c : Cert) : Prop :=
  c.constants = Spec.constants ∧
  EnumComplete c ∧ AccountingExact c ∧ FeasibilityExact c ∧
  FrontCorrect c ∧ PicksExtremal c

def check (c : Cert) : List Verdict := ...

theorem check_sound (c : Cert) (h : (check c).all (·.ok) = true) : Valid c := ...
```

---

## 6. Lean code (prototype, compiled)

### 6.1 Score **[compiled]**

The seven dimension names and weight values below are placeholders until the score spec is fixed; the proofs do not depend on the particular values beyond `decide +kernel` re-running.

```lean
namespace Ibasho

inductive Dim where
  | fabric | heating | carbon | bills | renewables | comfort | water
  deriving DecidableEq, Repr

def Dim.all : List Dim := [.fabric, .heating, .carbon, .bills, .renewables, .comfort, .water]

/-- Fixed weights as exact rationals. Single source of truth for the TS engine. -/
def weight : Dim → Rat
  | .fabric => 20/100 | .heating => 20/100 | .carbon => 20/100 | .bills => 15/100
  | .renewables => 10/100 | .comfort => 10/100 | .water => 5/100

theorem weights_sum_one : (Dim.all.map weight).sum = 1 := by decide +kernel
theorem weight_nonneg (d : Dim) : 0 ≤ weight d := by cases d <;> decide +kernel

def clamp01 (x : Rat) : Rat := max 0 (min 1 x)
theorem clamp01_nonneg (x : Rat) : 0 ≤ clamp01 x := by unfold clamp01; grind
theorem clamp01_le_one (x : Rat) : clamp01 x ≤ 1 := by unfold clamp01; grind
theorem clamp01_mono {x y : Rat} (h : x ≤ y) : clamp01 x ≤ clamp01 y := by
  unfold clamp01; grind

abbrev SubScores := Dim → Rat
def weightedSum (ds : List Dim) (s : SubScores) : Rat :=
  (ds.map fun d => weight d * clamp01 (s d)).sum
def score (s : SubScores) : Rat := 100 * weightedSum Dim.all s

theorem weightedSum_bounds (ds : List Dim) (s : SubScores) :
    0 ≤ weightedSum ds s ∧ weightedSum ds s ≤ (ds.map weight).sum := by
  induction ds with
  | nil => simp [weightedSum]
  | cons d ds ih =>
    simp only [weightedSum, List.map_cons, List.sum_cons] at *
    have h0 := Rat.mul_nonneg (weight_nonneg d) (clamp01_nonneg (s d))
    have h1 := Rat.mul_le_mul_of_nonneg_left (clamp01_le_one (s d)) (weight_nonneg d)
    rw [Rat.mul_one] at h1
    grind

theorem score_le_100 (s : SubScores) : score s ≤ 100 := by
  have := (weightedSum_bounds Dim.all s).2
  rw [weights_sum_one] at this
  unfold score; grind

theorem weightedSum_mono (ds : List Dim) {s t : SubScores} (h : ∀ d, s d ≤ t d) :
    weightedSum ds s ≤ weightedSum ds t := by
  induction ds with
  | nil => simp [weightedSum]
  | cons d ds ih =>
    simp only [weightedSum, List.map_cons, List.sum_cons] at *
    have := Rat.mul_le_mul_of_nonneg_left (clamp01_mono (h d)) (weight_nonneg d)
    grind

/-- A better home never scores worse. -/
theorem score_mono {s t : SubScores} (h : ∀ d, s d ≤ t d) : score s ≤ score t := by
  have := weightedSum_mono Dim.all h
  unfold score; grind
```

Planned strengthening **[sketch]**: define each sub-score as a piecewise-linear normaliser of a physical quantity (kWh/m²/yr, kgCO2e/m²/yr, ...) with rational breakpoints, prove each normaliser antitone, and derive `score_mono_physical`: lower intensities in every dimension never lower the score. That is the statement a homeowner actually cares about.

### 6.2 Per-fuel accounting **[compiled]**

```lean
inductive Fuel where
  | electricity | gas | oil | lpg | biomass | district
  deriving DecidableEq, Repr
def Fuel.all : List Fuel := [.electricity, .gas, .oil, .lpg, .biomass, .district]
abbrev FuelVec := Fuel → Rat   -- total function: a missing factor is unrepresentable

def saving (before after : FuelVec) : FuelVec := fun f => before f - after f
def emissions (ef e : FuelVec) : Rat := (Fuel.all.map fun f => e f * ef f).sum
def carbonSaving (ef before after : FuelVec) : Rat :=
  (Fuel.all.map fun f => saving before after f * ef f).sum

theorem sum_sub_mul (fs : List Fuel) (ef b a : FuelVec) :
    (fs.map fun f => (b f - a f) * ef f).sum
      = (fs.map fun f => b f * ef f).sum - (fs.map fun f => a f * ef f).sum := by
  induction fs with
  | nil => simp; grind
  | cons f fs ih => simp only [List.map_cons, List.sum_cons, ih]; grind

theorem carbonSaving_eq (ef b a : FuelVec) :
    carbonSaving ef b a = emissions ef b - emissions ef a := by
  simp only [carbonSaving, emissions, saving]; exact sum_sub_mul _ ef b a

/-- Negative saving means the package uses MORE of that fuel (heat pump: gas down, power up). -/
theorem saving_neg_iff (b a : FuelVec) (f : Fuel) : saving b a f < 0 ↔ b f < a f := by
  simp only [saving]; grind
```

### 6.3 Feasibility as proof-carrying plugins **[compiled]**

Each constraint plugin carries its own soundness proof. Adding a rule (listed building, conservation area, party wall, grant eligibility) means adding one file and one list entry; it cannot be registered without a proof.

```lean
structure Measure where
  id : String; capex : Rat; needsOwner : Bool; needsRoof : Bool
  deriving Repr, DecidableEq

structure Ctx where
  budget : Rat; isOwner : Bool; roofRights : Bool
  rejected : List String; conflicts : List (String × String)

abbrev Pkg := List Measure

structure Rule where
  name  : String
  spec  : Ctx → Pkg → Prop
  check : Ctx → Pkg → Bool
  sound : ∀ c p, check c p = true → spec c p

def budgetRule : Rule where
  name  := "budget"
  spec  := fun c p => (p.map (·.capex)).sum ≤ c.budget
  check := fun c p => decide ((p.map (·.capex)).sum ≤ c.budget)
  sound := by intro c p h; simpa using h

def memoryRule : Rule where
  name  := "memory"
  spec  := fun c p => ∀ m ∈ p, m.id ∉ c.rejected
  check := fun c p => p.all fun m => !(c.rejected.contains m.id)
  sound := by intro c p h m hm; simp [List.all_eq_true] at h; grind

-- tenureRule, roofRule, conflictsRule, prereqRule: same shape, one file each
def rules : List Rule := [budgetRule, tenureRule, memoryRule]   -- registry

def Feasible (c : Ctx) (p : Pkg) : Prop := ∀ r ∈ rules, r.spec c p
def feasibleB (c : Ctx) (p : Pkg) : Bool := rules.all fun r => r.check c p

theorem feasibleB_sound (c : Ctx) (p : Pkg) (h : feasibleB c p = true) : Feasible c p := by
  intro r hr
  simp only [feasibleB, List.all_eq_true] at h
  exact r.sound c p (h r hr)

/-- AI memory guarantee: a rejected measure is never offered again. -/
theorem feasible_respects_memory {c : Ctx} {p : Pkg} (h : Feasible c p) :
    ∀ m ∈ p, m.id ∉ c.rejected := h memoryRule (by simp [rules])
```

The TS side mirrors the registry: each TS constraint plugin declares the Lean rule id it implements. The certificate lists rule ids; the checker rejects unknown ids, so a TS plugin without a Lean twin yields an *Unverified rule* seal instead of a silent pass.

### 6.4 Pareto front **[compiled]**

```lean
structure Outcome where
  pkg : String; cost : Rat; carbon : Rat; ret : Rat
  deriving Repr, DecidableEq

def Dominates (a b : Outcome) : Prop :=
  a.cost ≤ b.cost ∧ a.carbon ≤ b.carbon ∧ b.ret ≤ a.ret ∧
  (a.cost < b.cost ∨ a.carbon < b.carbon ∨ b.ret < a.ret)
instance (a b : Outcome) : Decidable (Dominates a b) := by unfold Dominates; infer_instance

def checkFront (cands front : List Outcome) : Bool :=
  front.all (fun p => cands.contains p && cands.all fun q => !decide (Dominates q p)) &&
  cands.all (fun q => front.contains q || cands.any fun r => decide (Dominates r q))

theorem checkFront_sound {cands front : List Outcome} (h : checkFront cands front = true) :
    ∀ p ∈ front, p ∈ cands ∧ ∀ q ∈ cands, ¬ Dominates q p := by
  simp [checkFront, List.all_eq_true] at h
  intro p hp; exact ⟨(h.1 p hp).1, fun q hq => (h.1 p hp).2 q hq⟩

theorem checkFront_complete {cands front : List Outcome} (h : checkFront cands front = true) :
    ∀ q ∈ cands, (∀ r ∈ cands, ¬ Dominates r q) → q ∈ front := by
  simp [checkFront, List.all_eq_true] at h
  intro q hq hnd
  rcases h.2 q hq with hf | ⟨r, hr, hd⟩
  · exact hf
  · exact absurd hd (hnd r hr)

def LexLe (x q : Outcome) : Prop :=
  x.cost < q.cost ∨ (x.cost = q.cost ∧ (x.carbon < q.carbon ∨ (x.carbon = q.carbon ∧ q.ret ≤ x.ret)))

/-- "Cheapest" with a (cost, carbon, -return) tie-break is always on the front. -/
theorem lexMin_nondominated {cands : List Outcome} {x : Outcome}
    (h : ∀ q ∈ cands, LexLe x q) : ∀ q ∈ cands, ¬ Dominates q x := by
  intro q hq hd; have := h q hq; unfold LexLe at this; unfold Dominates at hd; grind

theorem dominates_trans {a b c : Outcome} (h1 : Dominates a b) (h2 : Dominates b c) :
    Dominates a c := by unfold Dominates at *; grind
```

`lexMin_nondominated` fixes a subtle real bug class: a naive "cheapest" can be dominated by an equally cheap, lower-carbon option. The tie-break rule is now a theorem, and the TS engine must implement exactly that ordering.

### 6.5 Interval enclosure for unknown inputs **[compiled]**

```lean
structure Ival where
  lo : Rat
  hi : Rat

instance : Membership Rat Ival := ⟨fun I x => I.lo ≤ x ∧ x ≤ I.hi⟩
@[simp] theorem Ival.mem_def {x : Rat} {I : Ival} : x ∈ I ↔ I.lo ≤ x ∧ x ≤ I.hi := Iff.rfl

def Ival.add (I J : Ival) : Ival := ⟨I.lo + J.lo, I.hi + J.hi⟩
def Ival.mulNN (I J : Ival) : Ival := ⟨I.lo * J.lo, I.hi * J.hi⟩  -- nonneg intervals

theorem Ival.mulNN_sound {x y : Rat} {I J : Ival} (hI : 0 ≤ I.lo) (hJ : 0 ≤ J.lo)
    (hx : x ∈ I) (hy : y ∈ J) : x * y ∈ I.mulNN J := by
  simp only [Ival.mem_def, Ival.mulNN] at *
  obtain ⟨hx1, hx2⟩ := hx; obtain ⟨hy1, hy2⟩ := hy
  have hx0 : 0 ≤ x := by grind
  have hy0 : 0 ≤ y := by grind
  constructor
  · have a := Rat.mul_le_mul_of_nonneg_right hx1 hJ
    have b := Rat.mul_le_mul_of_nonneg_left hy1 hx0
    grind
  · have a := Rat.mul_le_mul_of_nonneg_right hx2 hy0
    have b := Rat.mul_le_mul_of_nonneg_left hy2 (by grind : (0:Rat) ≤ I.hi)
    grind

/-- Steady-state fabric loss, kWh/yr: UA · HDD · 24 / 1000. -/
def fabricLoss (ua hdd : Rat) : Rat := ua * hdd * (24/1000)
def fabricLossI (UA HDD : Ival) : Ival := (UA.mulNN HDD).mulNN ⟨24/1000, 24/1000⟩

theorem fabricLoss_enclosed {ua hdd : Rat} {UA HDD : Ival}
    (h1 : 0 ≤ UA.lo) (h2 : 0 ≤ HDD.lo) (hu : ua ∈ UA) (hh : hdd ∈ HDD) :
    fabricLoss ua hdd ∈ fabricLossI UA HDD := by
  unfold fabricLoss fabricLossI
  exact Ival.mulNN_sound (Rat.mul_nonneg h1 h2) (by decide +kernel)
    (Ival.mulNN_sound h1 h2 hu hh) ⟨Rat.le_refl, Rat.le_refl⟩
```

`#eval fabricLossI ⟨180, 260⟩ ⟨2000, 2400⟩` gives `{ lo := 8640, hi := 14976 }` kWh/yr: "your walls are unknown, so heat loss is somewhere in this band, guaranteed for the model".

Design notes for (e):
- This is the formal version of M1's "unknown ≠ 0". Unknown inputs become intervals, never zeros or silent defaults.
- **Dependency problem:** `before - after` with shared uncertain inputs widens badly under naive interval subtraction. Compute savings symbolically first, for example `ΔQ = (UA_before - UA_after) · HDD · 24/1000`, where the UA change from a measure is known precisely. Then a **robust claim** follows: if the lower bound of the savings band is positive, the package saves energy for every home consistent with what you told us. That sentence is worth a seal.
- Only the reduced-order formulas whose structure is simple enough (degree-day fabric and ventilation loss, fixed efficiencies, PV yield as a product) get interval twins. Everything else is labelled *Modelled*.

### 6.6 Checker entry point **[compiled]**

```lean
import Lean.Data.Json
import IbashoSpec
open Lean Ibasho

/-- Exact rationals on the wire: {"n": int, "d": nat}. Never floats. -/
instance : FromJson Rat where
  fromJson? j := do
    let n ← j.getObjValAs? Int "n"
    let d ← j.getObjValAs? Nat "d"
    if d = 0 then throw "zero denominator" else pure ((n : Rat) / (d : Rat))

deriving instance FromJson for Outcome

structure ParetoCert where
  candidates : List Outcome; front : List Outcome
  cheapest : Outcome; lowestCarbon : Outcome
  deriving FromJson

structure Verdict where
  check : String; ok : Bool
  deriving ToJson

def main (args : List String) : IO UInt32 := do
  let src ← match args with
    | [path] => IO.FS.readFile path
    | _ => (← IO.getStdin).readToEnd
  match Json.parse src >>= fromJson? (α := ParetoCert) with
  | .error e => IO.eprintln s!"malformed certificate: {e}"; return 2
  | .ok c =>
    let vs : List Verdict :=
      [ ⟨"pareto.front", checkFront c.candidates c.front⟩,
        ⟨"pareto.cheapest", checkCheapest c.candidates c.cheapest⟩,
        ⟨"pareto.lowestCarbon", checkLowestCarbon c.candidates c.lowestCarbon⟩ ]
    IO.println (toJson vs).compress
    return if vs.all (·.ok) then 0 else 1
```

Tested: valid certificate prints three `ok: true` and exits 0; appending a dominated option to `front` flips `pareto.front` to false and exits 1. Production version adds `--batch` (NDJSON in, NDJSON out) so CI checks thousands of certificates in one process.

### 6.7 Codegen and seal manifest **[compiled]**

```lean
def ratTs (q : Rat) : String := s!"\{ n: {q.num}n, d: {q.den}n }"
-- emits: export const WEIGHTS = { fabric: { n: 1n, d: 5n }, ..., water: { n: 1n, d: 20n } } as const;
```

```lean
import Lean
import IbashoSpec
open Lean Meta Ibasho

/-- Each seal names a real theorem; a typo or rename is a compile error. -/
def seals : List (Name × String) :=
  [ (``score_le_100, "The Green Home Score is never above 100."),
    (``carbonSaving_eq, "Carbon saved per fuel adds up to before minus after."),
    (``checkFront_sound, "No option shown on the front is beaten on every axis.") ]

-- for each: getConstInfo n, ppExpr ci.type, collectAxioms n  ->  seals.json
```

Real output on this machine:

```
Ibasho.score_le_100 | ... | axioms=[propext, Classical.choice, Quot.sound] | ∀ (s : SubScores), score s ≤ 100
Ibasho.checkFront_sound | ... | axioms=[propext, Quot.sound] | ∀ {cands front : List Outcome}, checkFront cands front = true → ...
```

CI fails if any seal theorem's axioms include `sorryAx` or `Lean.ofReduceBool`, or anything outside the standard three.

---

## 7. Lean project layout

```
proofs/                               lake package "ibasho-proofs" (core only)
  lean-toolchain                      leanprover/lean4:v4.34.0
  lakefile.toml
  Ibasho/Spec/Units.lean              Wh, gCO2e, pence, Q helpers, rounding lemmas
  Ibasho/Spec/Constants.lean          weights, emission factors, tariffs (single source)
  Ibasho/Spec/Score.lean              6.1
  Ibasho/Spec/Normalise.lean          piecewise-linear sub-score curves, antitone proofs
  Ibasho/Spec/Accounting.lean         6.2
  Ibasho/Spec/Rules/Budget.lean       one file per constraint plugin (6.3)
  Ibasho/Spec/Rules/Tenure.lean
  Ibasho/Spec/Rules/Roof.lean
  Ibasho/Spec/Rules/Memory.lean
  Ibasho/Spec/Rules/Conflicts.lean
  Ibasho/Spec/Rules/Prereq.lean       e.g. "heat pump requires fabric first"
  Ibasho/Spec/Rules/Registry.lean
  Ibasho/Spec/Pareto.lean             6.4
  Ibasho/Spec/Interval.lean           6.5
  Ibasho/Cert/Schema.lean             certificate structures (Init only)
  Ibasho/Cert/Check.lean              pure checker (Init only, WASM-ready)
  Ibasho/Cert/Sound.lean              check_sound : all ok → Valid
  Ibasho/Cert/Wire.lean               minimal parser (Init only, for WASM)
  Ibasho/Cert/Json.lean               Lean.Data.Json adapter (native exe)
  Ibasho/Seals.lean                   seal registry (6.7)
  Main/Check.lean                     exe ibasho-check
  Main/Gen.lean                       exe ibasho-gen  -> packages/spec-gen/src/*.generated.ts, seals.json, schema
  Main/Ref.lean                       exe ibasho-ref  -> reference evaluator for differential tests
  Test/Golden/*.json                  valid certificates
  Test/Mutants/*.json                 one per injected bug (M1 table); each must fail the named check
proofs-extra/                         optional, Mathlib + LeanCert, never imported by the checker
```

```toml
name = "ibasho-proofs"
defaultTargets = ["Ibasho", "ibasho-check", "ibasho-gen"]

[[lean_lib]]
name = "Ibasho"

[[lean_exe]]
name = "ibasho-check"
root = "Main.Check"

[[lean_exe]]
name = "ibasho-gen"
root = "Main.Gen"

[[lean_exe]]
name = "ibasho-ref"
root = "Main.Ref"
```

Monorepo wiring: `packages/spec-gen` (generated TS, committed), `packages/certify` (TS certificate emitter + TS mirror checker), `tools/verify` (`pnpm verify` shells to `lake exe ibasho-check`).

---

## 8. CI and testing pipeline

| Step | Command | Fails when |
|---|---|---|
| Build proofs | `lake build` (via `leanprover/lean-action`) | Any proof breaks |
| Axiom audit | `lake exe ibasho-gen --seals --audit` | `sorryAx`, `ofReduceBool`, or unknown axiom in a seal theorem |
| Codegen drift | `lake exe ibasho-gen --check` | Generated TS differs from committed files |
| Property tests | Vitest + `fast-check`: random homes → engine → certificates (NDJSON) | TS throws or emits malformed certificate |
| Lean check | `ibasho-check --batch < certs.ndjson` | Any verdict false |
| Differential | `ibasho-ref` vs TS bookkeeping on the same inputs | Any exact mismatch |
| Mutation suite | Mutants from the M1 table (wrong weight, flipped sign, missing factor, infeasible heat pump, added percentages) | A mutant passes, or fails a different check than expected |
| Mirror parity | TS mirror checker vs `ibasho-check` on all golden, random and mutant certs | Any disagreement |
| E2E | Playwright: edit a terrace, watch seals crack and re-press | Seal state wrong |

Optional Lean-side randomised testing with `leanprover-community/plausible` lives in `Test/`, never in the checker's dependency set.

---

## 9. Showing proofs to a normal customer: proof seals

Metaphor: the Japanese **hanko / shuin** (朱印, vermilion seal). A seal is pressed only by a machine check, never by copy. It fits "Ibasho" (belonging, trust, craft) and is visually distinctive against the usual green checkmarks.

| Seal | Glyph idea | Meaning shown to the user | Backed by |
|---|---|---|---|
| **Proved** (証) | Solid vermilion, crisp edge | "This rule holds for every home, always." | Kernel-checked theorem in `seals.json` |
| **Checked** (検) | Vermilion ring, inner mark | "This exact result was re-checked against the rules." Subtitle names the rung: Lean, Lean in browser, or mirror | Certificate verdicts |
| **Modelled** (模) | Ink outline, no fill | "Estimated by our physics model. Tested, not proved." Shows the uncertainty band | Plausibility tests, interval layer |
| **Cracked** | Split seal | "We could not confirm this. Here is the exact row." | Failed verdict with `path` |
| Pressing (loading) | Seal descends, ink spreads | Recompute and check in progress | Worker state |

Interaction design:
- Every number in the twin carries a small seal. Hover: one plain sentence. Click: an **evidence drawer** with three tabs: *In words* (the plain sentence), *The rule* (pretty-printed Lean statement from `seals.json`, with the theorem name and axioms), *This result* (certificate excerpt and which checker ran, plus timing).
- The score dial gets a ring of seven small seals (one per weight) and a large *Proved* seal for "0 to 100, weights sum to 1". The Pareto chart's front line carries a *Checked* seal; hovering a dominated option draws a dotted line to the option that beats it (the dominance witness), turning a proof into a picture.
- What-if scenarios: dragging a slider cracks the seals; on recompute they re-press in sequence, giving a satisfying, honest loading state.
- Revisit mode: certificates persist in IndexedDB; on reopen, the app re-runs the mirror check instantly, then upgrades seals if a Lean rung is available.
- Copy discipline (honest boundary): never "verified savings". Say "The arithmetic is proved. The physics is a model, tested against UK data." Link to a short "What we prove" page that lists every seal from `seals.json`, generated, not hand written.
- The LLM narrator may only cite seal ids and evidence ids; the grounding matcher (TS) refuses a sentence whose numbers are not in the certificate. Lean does not verify prose; the UI never shows a seal on narration.

---

## 10. Trusted computing base

| Component | Trusted for | Mitigation |
|---|---|---|
| Lean kernel | Theorems | Standard axioms only, audited in CI |
| Lean compiler + runtime | Running `ibasho-check` (compiled code, like any program) | Small checker, golden and mutant suites, no `native_decide` inside proofs |
| JSON adapter | Parsing | Rejects floats and zero denominators; schema version pinned |
| Physics engine (TS) | `perFuelWh` outputs | Out of scope for proofs; NEED/EPC range tests; interval layer for unknowns |
| TS mirror checker | Seals when no Lean rung runs | Parity tests against Lean; seal labels the rung |
| Constants provenance | Emission factors, tariffs are the right ones | Source and date shown in evidence drawer |

---

## 11. Phased plan

1. **Phase 1 (spine):** `proofs/` package with 6.1 to 6.4, `ibasho-gen` for constants and seals, `ibasho-check` for full certificates, TS certificate emitter, mutation suite. Seals: *Proved* + *Checked (Lean in CI / mirror at runtime)*.
2. **Phase 2 (depth):** normalisers and `score_mono_physical`, interval layer with robust savings claims, `check_sound` end to end, local companion `/verify`.
3. **Phase 3 (wow):** WASM checker in a Web Worker; "What we prove" page generated from `seals.json`; optional `proofs-extra` with Mathlib for real-valued model properties (for example monotonicity of heat loss in U-value over reals, LeanCert bounds for solar geometry).

---

## 12. Sources

- McConnell, Mehlhorn, Näher, Schweitzer, "Certifying algorithms", Computer Science Review 5(2), 2011: https://researchportalplus.anu.edu.au/en/publications/certifying-algorithms/ ; slides: https://people.mpi-inf.mpg.de/~mehlhorn/ftp/UVMSept2014.pdf
- Lean 4.12.0 release (`bv_decide`, verified LRAT checking in Lean, `ofReduceBool` trust note), a precedent for "untrusted solver, checked certificate": https://lean-lang.org/blog/2024-10-3-lean-4120
- Lean reference, `grind` linear arithmetic solver: https://lean-lang.org/doc/reference/4.32.0/The--grind--tactic/Linear-Arithmetic-Solver/
- Lean reference (`native_decide` / `ofReduceBool` trust, release notes): https://lean-lang.org/doc/reference/4.34.0/releases/v4.12.0/
- Lean 4 Emscripten notes: https://github.com/leanprover/lean4/blob/master/doc/make/emscripten.md ; disabled wasm CI job: https://github.com/leanprover/lean4/blob/master/.github/workflows/ci.yml
- lean2wasm (experimental Lean to WASM): https://github.com/T-Brick/lean2wasm , https://reservoir.lean-lang.org/@T-Brick/lean2wasm
- LeanCert (verified interval numerics, Mathlib based): https://reservoir.lean-lang.org/@alerad/LeanCert ; `interval` (floating interval arithmetic): https://reservoir.lean-lang.org/@girving/interval
- Plausible (property testing for Lean 4): https://reservoir.lean-lang.org/@leanprover-community/plausible
- Local precedent: `/home/nitheesh/AI_things/lean_compiler/safelean/lakefile.toml` (spec library plus checker executables, core only, v4.34.0).
