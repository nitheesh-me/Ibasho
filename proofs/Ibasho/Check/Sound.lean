/-
Ibasho checker: soundness (SPEC 7.3 `check_sound`, LV 5). Owner: WP-04 (checker half). Init plus
the spec.

`Valid c` states, in the spec's own terms, what a certificate that passes every check
guarantees: the enumeration is complete, every claimed saving, carbon figure, upfront cost and NPV
equals the spec definition applied to the trusted inputs, every package shown as feasible passes
every rule we encoded and respects memory and the target, the front is exactly the nondominated
set with a dominating witness for every other candidate, and the three picks are what their names
say. `check_sound` proves `checkAll c = true → Valid c` by composing the spec theorems
`feasibleB_sound`, `checkFront_sound`, `checkFront_complete`, `front_dominates_rest`,
`witness_sound` and `checkPicks_sound`. No `sorry`, no `native_decide`: the axiom audit at the
end fails the build otherwise.

Trusted, not proved (LV 10): physics outputs, the JSON parser in `Json.lean`, and the Lean
compiler and runtime of the native exe.
-/
import Ibasho.Check.Check

namespace Ibasho.Check
open Ibasho.Spec.V2

/-! ## Helpers -/

theorem derive_getElem? (c : Cert) {r : Nat} (h : r < c.rows) :
    (derive c)[r]? = some (deriveRow c c.baseline r) := by
  simp [derive, h]

theorem allRows_spec {c : Cert} {p : Nat → Bool} (h : allRows c p = true) :
    ∀ r < c.rows, p r = true := by
  intro r hr
  simp only [allRows, List.all_eq_true, List.mem_range] at h
  exact h r hr

theorem fuelIdx_lt (f : Fuel) : fuelIdx f < 6 := by cases f <;> decide

theorem getD_fuel_map {α : Type} (g : Fuel → α) (d : α) (f : Fuel) :
    (Fuel.all.map g).getD (fuelIdx f) d = g f := by
  cases f <;> rfl

/-! ## What a passing certificate guarantees -/

/-- The meaning of a certificate that passes every check. `D r` abbreviates the spec
derivation of row `r` from trusted inputs only. -/
structure Valid (c : Cert) : Prop where
  /-- The certificate was made under a spec this checker knows. -/
  specKnown : c.specHash ∈ knownSpecHashes
  /-- Every package of the choice groups is in the certificate, within the R9 limit. -/
  enumComplete : c.rows = productCount c.groups ∧ c.rows ≤ searchLimitPackages
  /-- `acct.saving`: the claimed annual saving per fuel is baseline minus package. -/
  saving : ∀ r < c.rows, ∀ f : Fuel, ∃ s, c.saving = some s ∧
    s.getD (r * 6 + fuelIdx f) 0 = (Ibasho.Spec.V2.saving (vec c.baseline) (vec (delivered c r))).annual f
  /-- The empty package is the baseline. -/
  rowZeroBaseline : 0 < c.rows → delivered c 0 = c.baseline
  /-- `acct.carbon`: the claimed annual carbon saving is `carbonSavingG`, rounded once. -/
  carbon : ∀ r < c.rows, ∃ a, c.carbonAnnual = some a ∧
    a.getD r 0 = carbonSavingG (factors c) (vec c.baseline) (vec (delivered c r))
  /-- `fin.recompute`: claimed N0, NPV and lifetime carbon equal the spec finance. -/
  finance : ∀ r < c.rows,
    c.n0.getD r 0 = (deriveRow c c.baseline r).n0 ∧
    c.npv.getD r 0 = (deriveRow c c.baseline r).npv ∧
    c.carbonSaved.getD r 0 = (deriveRow c c.baseline r).lifetimeCarbon
  /-- `feas.recompute`: blocked, needs-check and passed agree with the rules and memory. -/
  statusFaithful : ∀ r < c.rows,
    statusClass (c.status.getD r 99) = statusClass (deriveRow c c.baseline r).expected
  /-- Every option shown passes every rule we encoded (Kleene, unknown never feasible). -/
  everyRulePassed : ∀ r < c.rows, c.status.getD r 99 = stFeasible →
    Feasible fnTable c.checkTable (apps c r (deriveRow c c.baseline r).gross)
  /-- What you ruled out never came back: a package shown as feasible contains no rejected
  option id and no option of a rejected measure. -/
  memoryRespected : ∀ r < c.rows, c.status.getD r 99 = stFeasible →
    ∀ m ∈ c.rejected, m ∉ rowOptions c r ++
      ((rowOptions c r).filterMap c.option?).filterMap (·.measure)
  /-- A package shown as feasible meets the owner's target. -/
  targetMet : ∀ r < c.rows, c.status.getD r 99 = stFeasible → (deriveRow c c.baseline r).meets = true
  /-- The needs-check lane is exactly the needs-check packages that meet the target. -/
  needsCheckLane : c.needsCheck = needsCheckRows c (derive c)
  /-- Every front member is a feasible package that no feasible package dominates. -/
  frontSound : ∀ p ∈ frontOutcomes c, p ∈ cands c ∧ NonDominated (cands c) p
  /-- Every nondominated feasible package is on the front. -/
  frontComplete : ∀ q ∈ cands c, NonDominated (cands c) q → q ∈ frontOutcomes c
  /-- Nothing better is hidden: every feasible package off the front is dominated by a front
  member. -/
  nothingHidden : ∀ q ∈ cands c, q ∉ frontOutcomes c → ∃ p ∈ frontOutcomes c, Dominates p q
  /-- Every feasible package off the front names a feasible witness that dominates it. -/
  witnessed : ∀ q ∈ cands c, q ∈ frontOutcomes c ∨
    ∃ w, wit c q = some w ∧ w ∈ cands c ∧ Dominates w q
  /-- The three picks are what their names say (never the empty package). -/
  picks : ∀ k : PickKind,
    (∀ x, (claimedPicks c).get k = some x → PickValid k (pickCands c) 0 x) ∧
    ((claimedPicks c).get k = none → pickCands c = [])

/-! ## Each check, sound on its own -/

theorem chkSpecKnown_sound {c : Cert} (h : chkSpecKnown c = true) : c.specHash ∈ knownSpecHashes := by
  simpa [chkSpecKnown] using h

theorem chkEnum_sound {c : Cert} (h : chkEnum c = true) :
    c.rows = productCount c.groups ∧ c.rows ≤ searchLimitPackages := by
  simp only [chkEnum, Bool.and_eq_true, beq_iff_eq, decide_eq_true_eq] at h
  exact ⟨h.1.1.1.1.1.1.1.1.1.1.1.2, h.1.1.1.1.1.1.1.1.1.1.2⟩

theorem chkAcctSaving_sound {c : Cert} (h : chkAcctSaving c (derive c) = true) :
    (∀ r < c.rows, ∀ f : Fuel, ∃ s, c.saving = some s ∧
      s.getD (r * 6 + fuelIdx f) 0 =
        (Ibasho.Spec.V2.saving (vec c.baseline) (vec (delivered c r))).annual f) ∧
    (0 < c.rows → delivered c 0 = c.baseline) := by
  unfold chkAcctSaving at h
  split at h
  · cases h
  · rename_i s hs
    simp only [Bool.and_eq_true, Bool.or_eq_true, beq_iff_eq] at h
    obtain ⟨⟨_, h0⟩, hall⟩ := h
    refine ⟨fun r hr f => ⟨s, hs, ?_⟩, fun hpos => ?_⟩
    · have hr' := allRows_spec hall r hr
      rw [derive_getElem? c hr] at hr'
      simp only [List.all_eq_true, List.mem_range, beq_iff_eq] at hr'
      have := hr' (fuelIdx f) (fuelIdx_lt f)
      rw [this]
      simp only [deriveRow]
      exact getD_fuel_map _ 0 f
    · rcases h0 with h0 | h0
      · omega
      · rw [derive_getElem? c hpos] at h0
        simpa [deriveRow] using h0

theorem chkAcctCarbon_sound {c : Cert} (h : chkAcctCarbon c (derive c) = true) :
    ∀ r < c.rows, ∃ a, c.carbonAnnual = some a ∧
      a.getD r 0 = carbonSavingG (factors c) (vec c.baseline) (vec (delivered c r)) := by
  unfold chkAcctCarbon at h
  split at h
  · cases h
  · rename_i a ha
    simp only [Bool.and_eq_true] at h
    intro r hr
    have hr' := allRows_spec h.2 r hr
    rw [derive_getElem? c hr] at hr'
    simp only [beq_iff_eq] at hr'
    exact ⟨a, ha, by rw [hr']; rfl⟩

theorem chkFin_sound {c : Cert} (h : chkFin c (derive c) = true) : ∀ r < c.rows,
    c.n0.getD r 0 = (deriveRow c c.baseline r).n0 ∧
    c.npv.getD r 0 = (deriveRow c c.baseline r).npv ∧
    c.carbonSaved.getD r 0 = (deriveRow c c.baseline r).lifetimeCarbon := by
  intro r hr
  have hr' := allRows_spec h r hr
  rw [derive_getElem? c hr] at hr'
  simp only [Bool.and_eq_true, beq_iff_eq] at hr'
  exact ⟨hr'.1.1, hr'.1.2, hr'.2⟩

theorem chkFeas_class {c : Cert} (h : chkFeas c (derive c) = true) : ∀ r < c.rows,
    statusClass (c.status.getD r 99) = statusClass (deriveRow c c.baseline r).expected := by
  intro r hr
  simp only [chkFeas, Bool.and_eq_true] at h
  have hr' := allRows_spec h.2 r hr
  rw [derive_getElem? c hr] at hr'
  simp only [Bool.and_eq_true, beq_iff_eq] at hr'
  exact hr'.1

/-- A row whose expected status is in the passed class was not rejected and its rules gave
`feasible`. -/
theorem expected_passed {c : Cert} {r : Nat}
    (h : statusClass (deriveRow c c.baseline r).expected = stFeasible) :
    (deriveRow c c.baseline r).rejected = false ∧ (deriveRow c c.baseline r).rules = .feasible := by
  revert h
  generalize hd : deriveRow c c.baseline r = d
  intro h
  have hexp : d.expected = (if d.rejected || d.rules == .blocked then stBlocked
      else if d.rules == .needsCheck then stNeedsCheck
      else if d.meets then stFeasible else stTargetMiss) := by
    subst hd; rfl
  rw [hexp] at h
  cases hrej : d.rejected <;> cases hst : d.rules <;> cases hm : d.meets <;>
    simp_all [statusClass, stBlocked, stNeedsCheck, stFeasible, stTargetMiss]

theorem chkTarget_feasible {c : Cert} (h : chkTarget c (derive c) = true) {r : Nat} (hr : r < c.rows)
    (hcls : statusClass (deriveRow c c.baseline r).expected = stFeasible) :
    c.status.getD r 99 = (deriveRow c c.baseline r).expected := by
  simp only [chkTarget, Bool.and_eq_true] at h
  have hr' := allRows_spec h.1.2 r hr
  rw [derive_getElem? c hr] at hr'
  simp only [Bool.and_eq_true, Bool.or_eq_true, bne_iff_ne, ne_eq, beq_iff_eq] at hr'
  rcases hr'.1 with h1 | h1
  · exact absurd hcls h1
  · exact h1

theorem meets_of_expected {c : Cert} {r : Nat}
    (h : (deriveRow c c.baseline r).expected = stFeasible) : (deriveRow c c.baseline r).meets = true := by
  revert h
  generalize hd : deriveRow c c.baseline r = d
  intro h
  have hexp : d.expected = (if d.rejected || d.rules == .blocked then stBlocked
      else if d.rules == .needsCheck then stNeedsCheck
      else if d.meets then stFeasible else stTargetMiss) := by
    subst hd; rfl
  rw [hexp] at h
  cases hrej : d.rejected <;> cases hst : d.rules <;> cases hm : d.meets <;>
    simp_all [stBlocked, stNeedsCheck, stFeasible, stTargetMiss]

/-- A row claimed feasible: its rules passed, memory holds and the target is met. -/
theorem feasible_row {c : Cert} (hF : chkFeas c (derive c) = true) (hT : chkTarget c (derive c) = true)
    {r : Nat} (hr : r < c.rows) (hs : c.status.getD r 99 = stFeasible) :
    (deriveRow c c.baseline r).rejected = false ∧ (deriveRow c c.baseline r).rules = .feasible ∧
      (deriveRow c c.baseline r).meets = true := by
  have hcls := chkFeas_class hF r hr
  rw [hs] at hcls
  have hcls' : statusClass (deriveRow c c.baseline r).expected = stFeasible := by
    rw [← hcls]; rfl
  have ⟨hrej, hst⟩ := expected_passed hcls'
  have heq := chkTarget_feasible hT hr hcls'
  rw [hs] at heq
  exact ⟨hrej, hst, meets_of_expected heq.symm⟩

theorem rules_feasible_sound {c : Cert} {r : Nat}
    (h : (deriveRow c c.baseline r).rules = .feasible) :
    Feasible fnTable c.checkTable (apps c r (deriveRow c c.baseline r).gross) := by
  apply feasibleB_sound
  unfold feasibleB
  have : (deriveRow c c.baseline r).rules =
      status fnTable c.checkTable (apps c r (deriveRow c c.baseline r).gross) := rfl
  rw [← this, h]
  rfl

theorem memory_sound {c : Cert} {r : Nat} (h : (deriveRow c c.baseline r).rejected = false) :
    ∀ m ∈ c.rejected, m ∉ rowOptions c r ++
      ((rowOptions c r).filterMap c.option?).filterMap (·.measure) := by
  have h' : respectsMemory c.rejected
      ⟨r, rowOptions c r ++ ((rowOptions c r).filterMap c.option?).filterMap (·.measure)⟩ = true := by
    have : (deriveRow c c.baseline r).rejected = !respectsMemory c.rejected
        ⟨r, rowOptions c r ++ ((rowOptions c r).filterMap c.option?).filterMap (·.measure)⟩ := rfl
    rw [this] at h
    simpa using h
  intro m hm hmem
  simp only [respectsMemory, List.all_eq_true, Bool.not_eq_true', List.contains_eq_mem,
    decide_eq_false_iff_not] at h'
  exact h' m hmem hm

theorem chkTarget_lane {c : Cert} (h : chkTarget c (derive c) = true) :
    c.needsCheck = needsCheckRows c (derive c) := by
  simp only [chkTarget, Bool.and_eq_true, beq_iff_eq] at h
  exact h.2

theorem chkWitness_witnessed {c : Cert} (h : chkWitness c = true) : ∀ q ∈ cands c,
    q ∈ frontOutcomes c ∨ ∃ w, wit c q = some w ∧ w ∈ cands c ∧ Dominates w q := by
  simp only [chkWitness, Bool.and_eq_true] at h
  have h1 := h.1
  simp only [checkFrontWitnessed, Bool.and_eq_true, List.all_eq_true, Bool.or_eq_true,
    List.contains_iff_mem] at h1
  intro q hq
  rcases h1.2 q hq with hf | hw
  · exact Or.inl hf
  · right
    split at hw
    · rename_i w hw'
      have := witness_sound hw
      exact ⟨w, hw', this.1, this.2.1⟩
    · cases hw

/-! ## The soundness theorem -/

theorem checkAll_iff (c : Cert) : checkAll c = true ↔
    chkSpecKnown c = true ∧ chkPacks c (derive c) = true ∧ chkEnum c = true ∧
    chkAcctSaving c (derive c) = true ∧ chkAcctCarbon c (derive c) = true ∧
    chkFin c (derive c) = true ∧ chkFeas c (derive c) = true ∧ chkTarget c (derive c) = true ∧
    chkFront c = true ∧ chkWitness c = true ∧ chkPicks c = true := by
  simp only [checkAll, check, List.all_cons, List.all_nil, Bool.and_true, Bool.and_eq_true]

/-- SPEC 7.3 `check_sound`: a certificate that passes every check is valid. -/
theorem check_sound (c : Cert) (h : checkAll c = true) : Valid c := by
  obtain ⟨hSpec, _, hEnum, hSav, hCarb, hFin, hFeas, hTgt, hFront, hWit, hPicks⟩ :=
    (checkAll_iff c).mp h
  have hF : checkFront (cands c) (frontOutcomes c) = true := by
    simp only [chkFront, Bool.and_eq_true] at hFront; exact hFront.2
  exact {
    specKnown := chkSpecKnown_sound hSpec
    enumComplete := chkEnum_sound hEnum
    saving := (chkAcctSaving_sound hSav).1
    rowZeroBaseline := (chkAcctSaving_sound hSav).2
    carbon := chkAcctCarbon_sound hCarb
    finance := chkFin_sound hFin
    statusFaithful := chkFeas_class hFeas
    everyRulePassed := fun r hr hs => rules_feasible_sound (feasible_row hFeas hTgt hr hs).2.1
    memoryRespected := fun r hr hs => memory_sound (feasible_row hFeas hTgt hr hs).1
    targetMet := fun r hr hs => (feasible_row hFeas hTgt hr hs).2.2
    needsCheckLane := chkTarget_lane hTgt
    frontSound := checkFront_sound hF
    frontComplete := checkFront_complete hF
    nothingHidden := front_dominates_rest hF
    witnessed := chkWitness_witnessed hWit
    picks := checkPicks_sound hPicks }

end Ibasho.Check
