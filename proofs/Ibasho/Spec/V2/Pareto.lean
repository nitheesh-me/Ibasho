/-
Ibasho spec V2: Pareto front, dominance witnesses and picks (SPEC R7, R8, 7.3). Owner: WP-04.

Axes (R8), central values, over the target set: net upfront cost N0 (micro-pence, lower is
better), lifetime operational carbon saved (gCO2e, higher is better) and NPV (micro-pence,
higher is better). `Outcome` uses exactly these fields.

Picks (R7), each the lexicographic optimum over the target set with stated tie-breaks:
* Least upfront: min N0, then more carbon saved, then higher NPV.
* Best return: max NPV, then lower N0, then more carbon saved.
* Lowest running carbon: max carbon saved, then higher NPV, then lower N0.
* Final tie-break for all three (added here so a pick is unique): lower package index.
The empty package is never a pick; the caller passes the target set without it.

Main results: no front member is dominated (`checkFront_sound`), every nondominated option is on
the front (`checkFront_complete`), a valid witness proves an option is beaten
(`witness_sound`), every option off the front is beaten by an option on it
(`front_dominates_rest`: nothing better is hidden), and each pick is optimal, unique and
nondominated (`lexMin_nondominated`, `checkPicks_sound`, `pick_unique`, `pick_on_front`).
-/

namespace Ibasho.Spec.V2

/-- One package on the R8 axes. `pkg` is the package index in the certificate. -/
structure Outcome where
  pkg : Nat
  n0 : Int
  carbon : Int
  npv : Int
  deriving DecidableEq, Repr

/-- `a` dominates `b`: no worse on every axis and strictly better on one. -/
def Dominates (a b : Outcome) : Prop :=
  a.n0 ≤ b.n0 ∧ b.carbon ≤ a.carbon ∧ b.npv ≤ a.npv ∧
  (a.n0 < b.n0 ∨ b.carbon < a.carbon ∨ b.npv < a.npv)

instance (a b : Outcome) : Decidable (Dominates a b) := by unfold Dominates; infer_instance

theorem not_dominates_self (a : Outcome) : ¬ Dominates a a := by unfold Dominates; omega

theorem dominates_trans {a b c : Outcome} (h₁ : Dominates a b) (h₂ : Dominates b c) :
    Dominates a c := by unfold Dominates at *; omega

theorem dominates_asymm {a b : Outcome} (h : Dominates a b) : ¬ Dominates b a := by
  unfold Dominates at *; omega

/-- `p` is not dominated by any candidate. -/
def NonDominated (cands : List Outcome) (p : Outcome) : Prop := ∀ q ∈ cands, ¬ Dominates q p

/-! ## Front check -/

/-- Certificate check `pareto.front`: every front member is a candidate that no candidate
dominates, and every candidate is on the front or dominated by some candidate. -/
def checkFront (cands front : List Outcome) : Bool :=
  front.all (fun p => cands.contains p && cands.all fun q => !decide (Dominates q p)) &&
  cands.all (fun q => front.contains q || cands.any fun r => decide (Dominates r q))

/-- No option on the front is beaten on every axis by any candidate. -/
theorem checkFront_sound {cands front : List Outcome} (h : checkFront cands front = true) :
    ∀ p ∈ front, p ∈ cands ∧ NonDominated cands p := by
  simp only [checkFront, Bool.and_eq_true, List.all_eq_true, List.contains_iff_mem,
    Bool.not_eq_true', decide_eq_false_iff_not] at h
  intro p hp
  exact ⟨(h.1 p hp).1, fun q hq => (h.1 p hp).2 q hq⟩

/-- Every candidate that nothing dominates is on the front. -/
theorem checkFront_complete {cands front : List Outcome} (h : checkFront cands front = true) :
    ∀ q ∈ cands, NonDominated cands q → q ∈ front := by
  simp only [checkFront, Bool.and_eq_true, List.all_eq_true, List.contains_iff_mem,
    Bool.or_eq_true, List.any_eq_true, decide_eq_true_eq] at h
  intro q hq hnd
  rcases h.2 q hq with hf | ⟨r, hr, hd⟩
  · exact hf
  · exact absurd hd (hnd r hr)

/-! ## Witnesses (`pareto.witness`) -/

/-- A witness for an option off the front: a candidate that dominates it. -/
def checkWitness (cands : List Outcome) (q w : Outcome) : Bool :=
  cands.contains w && decide (Dominates w q)

/-- A valid witness proves the option is beaten, so leaving it off the front is justified. -/
theorem witness_sound {cands : List Outcome} {q w : Outcome} (h : checkWitness cands q w = true) :
    w ∈ cands ∧ Dominates w q ∧ ¬ NonDominated cands q := by
  simp only [checkWitness, Bool.and_eq_true, List.contains_iff_mem, decide_eq_true_eq] at h
  exact ⟨h.1, h.2, fun hnd => hnd w h.1 h.2⟩

/-- The certificate form: the front is nondominated and every other candidate carries a
witness. Checking it is linear in the number of witnesses. -/
def checkFrontWitnessed (cands front : List Outcome) (wit : Outcome → Option Outcome) : Bool :=
  front.all (fun p => cands.contains p && cands.all fun q => !decide (Dominates q p)) &&
  cands.all (fun q => front.contains q ||
    match wit q with
    | some w => checkWitness cands q w
    | none => false)

/-- The witnessed form implies the plain front check, so both theorems above apply. -/
theorem checkFrontWitnessed_sound {cands front : List Outcome} {wit : Outcome → Option Outcome}
    (h : checkFrontWitnessed cands front wit = true) : checkFront cands front = true := by
  simp only [checkFrontWitnessed, checkFront, Bool.and_eq_true, List.all_eq_true,
    Bool.or_eq_true, List.any_eq_true, decide_eq_true_eq] at h ⊢
  refine ⟨h.1, fun q hq => ?_⟩
  rcases h.2 q hq with hf | hw
  · exact Or.inl hf
  · split at hw
    · rename_i w _
      have := witness_sound hw
      exact Or.inr ⟨w, this.1, this.2.1⟩
    · cases hw

/-! ## Nothing better is hidden -/

/-- Number of candidates dominating `q`. -/
def domCount (cands : List Outcome) (q : Outcome) : Nat :=
  cands.countP fun r => decide (Dominates r q)

private theorem countP_le_of_imp {α : Type} (l : List α) (p q : α → Bool)
    (h : ∀ x ∈ l, p x = true → q x = true) : l.countP p ≤ l.countP q := by
  induction l with
  | nil => simp
  | cons x xs ih =>
    simp only [List.countP_cons]
    have := ih (fun y hy => h y (List.mem_cons_of_mem _ hy))
    have hx := h x (List.mem_cons_self ..)
    cases hp : p x <;> cases hq : q x <;> simp_all <;> omega

private theorem countP_lt_of_imp {α : Type} (l : List α) (p q : α → Bool)
    (h : ∀ x ∈ l, p x = true → q x = true) (a : α) (ha : a ∈ l) (hpa : p a = false)
    (hqa : q a = true) : l.countP p < l.countP q := by
  induction l with
  | nil => cases ha
  | cons x xs ih =>
    simp only [List.countP_cons]
    have hle := countP_le_of_imp xs p q (fun y hy => h y (List.mem_cons_of_mem _ hy))
    rcases List.mem_cons.mp ha with rfl | ha'
    · rw [hpa, hqa]; simp; omega
    · have := ih (fun y hy => h y (List.mem_cons_of_mem _ hy)) ha'
      have hx := h x (List.mem_cons_self ..)
      cases hp : p x <;> cases hq : q x <;> simp_all <;> omega

/-- If `p` dominates `q`, strictly fewer candidates dominate `p` than `q`. -/
theorem domCount_lt {cands : List Outcome} {p q : Outcome} (hp : p ∈ cands) (h : Dominates p q) :
    domCount cands p < domCount cands q := by
  unfold domCount
  apply countP_lt_of_imp cands _ _ _ p hp
  · exact decide_eq_false (not_dominates_self p)
  · exact decide_eq_true h
  · intro r _ hr
    exact decide_eq_true (dominates_trans (of_decide_eq_true hr) h)

/-- Every candidate is either nondominated itself or dominated by a nondominated candidate. -/
theorem exists_nondominated_dominator (cands : List Outcome) (q : Outcome) :
    NonDominated cands q ∨ ∃ p ∈ cands, NonDominated cands p ∧ Dominates p q := by
  by_cases hnd : NonDominated cands q
  · exact Or.inl hnd
  · right
    simp only [NonDominated, Classical.not_forall, Classical.not_not] at hnd
    obtain ⟨r, hr, hd⟩ := hnd
    have hlt := domCount_lt hr hd
    rcases exists_nondominated_dominator cands r with h1 | ⟨p, hp, hpn, hpd⟩
    · exact ⟨r, hr, h1, hd⟩
    · exact ⟨p, hp, hpn, dominates_trans hpd hd⟩
termination_by domCount cands q

/-- Nothing better is hidden: with a checked front, every candidate off the front is beaten on
every axis by an option shown on the front. -/
theorem front_dominates_rest {cands front : List Outcome} (h : checkFront cands front = true) :
    ∀ q ∈ cands, q ∉ front → ∃ p ∈ front, Dominates p q := by
  intro q hq hnf
  rcases exists_nondominated_dominator cands q with hnd | ⟨p, hp, hpn, hpd⟩
  · exact absurd (checkFront_complete h q hq hnd) hnf
  · exact ⟨p, checkFront_complete h p hp hpn, hpd⟩

/-! ## Picks (R7) -/

/-- The three named futures. -/
inductive PickKind where
  | leastUpfront | bestReturn | lowestCarbon
  deriving DecidableEq, Repr

/-- Lexicographic key, smaller is better. -/
structure Key where
  k1 : Int
  k2 : Int
  k3 : Int
  k4 : Int
  deriving DecidableEq, Repr

/-- Lexicographic `≤` on keys. -/
def Key.Le (a b : Key) : Prop :=
  a.k1 < b.k1 ∨ (a.k1 = b.k1 ∧ (a.k2 < b.k2 ∨ (a.k2 = b.k2 ∧
    (a.k3 < b.k3 ∨ (a.k3 = b.k3 ∧ a.k4 ≤ b.k4)))))

instance (a b : Key) : Decidable (a.Le b) := by unfold Key.Le; infer_instance

/-- The R7 objective and tie-breaks of each pick, then the package index. -/
def pickKey : PickKind → Outcome → Key
  | .leastUpfront, o => ⟨o.n0, -o.carbon, -o.npv, o.pkg⟩
  | .bestReturn, o => ⟨-o.npv, o.n0, -o.carbon, o.pkg⟩
  | .lowestCarbon, o => ⟨-o.carbon, -o.npv, o.n0, o.pkg⟩

/-- Every pick order refines dominance: a dominating option has a strictly better key. -/
theorem dominates_key {k : PickKind} {q x : Outcome} (h : Dominates q x) :
    ¬ (pickKey k x).Le (pickKey k q) := by
  unfold Dominates at h
  cases k <;> simp only [pickKey, Key.Le] <;> omega

/-- A lexicographic optimum is never dominated (the tie-break bug class of LV 6.4). -/
theorem lexMin_nondominated {k : PickKind} {cands : List Outcome} {x : Outcome}
    (h : ∀ q ∈ cands, (pickKey k x).Le (pickKey k q)) : NonDominated cands x :=
  fun q hq hd => dominates_key hd (h q hq)

/-- Certificate check `pareto.picks` for one pick: a candidate, not the empty package, and
optimal for its key over the candidates. -/
def checkPick (k : PickKind) (cands : List Outcome) (emptyPkg : Nat) (pick : Outcome) : Bool :=
  cands.contains pick && pick.pkg != emptyPkg &&
  cands.all fun q => decide ((pickKey k pick).Le (pickKey k q))

/-- What a checked pick guarantees. -/
structure PickValid (k : PickKind) (cands : List Outcome) (emptyPkg : Nat) (pick : Outcome) :
    Prop where
  mem : pick ∈ cands
  notEmpty : pick.pkg ≠ emptyPkg
  optimal : ∀ q ∈ cands, (pickKey k pick).Le (pickKey k q)
  nondominated : NonDominated cands pick

theorem checkPick_sound {k : PickKind} {cands : List Outcome} {emptyPkg : Nat} {pick : Outcome}
    (h : checkPick k cands emptyPkg pick = true) : PickValid k cands emptyPkg pick := by
  simp only [checkPick, Bool.and_eq_true, List.contains_iff_mem, bne_iff_ne, ne_eq,
    List.all_eq_true, decide_eq_true_eq] at h
  exact ⟨h.1.1, h.1.2, h.2, lexMin_nondominated h.2⟩

/-- The three picks of a certificate (`none` when the target set is empty). -/
structure Picks where
  leastUpfront : Option Outcome
  bestReturn : Option Outcome
  lowestCarbon : Option Outcome

def Picks.get (p : Picks) : PickKind → Option Outcome
  | .leastUpfront => p.leastUpfront
  | .bestReturn => p.bestReturn
  | .lowestCarbon => p.lowestCarbon

/-- Check one optional pick: absent only when there is no candidate. -/
def checkPickOpt (k : PickKind) (cands : List Outcome) (emptyPkg : Nat) : Option Outcome → Bool
  | some p => checkPick k cands emptyPkg p
  | none => cands.isEmpty

/-- Check all three picks. -/
def checkPicks (cands : List Outcome) (emptyPkg : Nat) (p : Picks) : Bool :=
  checkPickOpt .leastUpfront cands emptyPkg p.leastUpfront &&
  checkPickOpt .bestReturn cands emptyPkg p.bestReturn &&
  checkPickOpt .lowestCarbon cands emptyPkg p.lowestCarbon

/-- The three picks are what their names say. -/
theorem checkPicks_sound {cands : List Outcome} {emptyPkg : Nat} {p : Picks}
    (h : checkPicks cands emptyPkg p = true) (k : PickKind) :
    (∀ x, p.get k = some x → PickValid k cands emptyPkg x) ∧ (p.get k = none → cands = []) := by
  simp only [checkPicks, Bool.and_eq_true] at h
  have hk : checkPickOpt k cands emptyPkg (p.get k) = true := by
    cases k
    · exact h.1.1
    · exact h.1.2
    · exact h.2
  refine ⟨fun x hx => ?_, fun hx => ?_⟩
  · rw [hx] at hk; exact checkPick_sound hk
  · rw [hx] at hk; simpa [checkPickOpt] using hk

/-- Key order is antisymmetric. -/
theorem Key.le_antisymm {a b : Key} (h₁ : a.Le b) (h₂ : b.Le a) : a = b := by
  cases a; cases b
  simp only [Key.Le, Key.mk.injEq] at *
  refine ⟨?_, ?_, ?_, ?_⟩ <;> omega

/-- A pick is unique: two valid picks of the same kind are the same package. -/
theorem pick_unique {k : PickKind} {cands : List Outcome} {e : Nat} {x y : Outcome}
    (hx : PickValid k cands e x) (hy : PickValid k cands e y) : x.pkg = y.pkg := by
  have := Key.le_antisymm (hx.optimal y hy.mem) (hy.optimal x hx.mem)
  cases k <;> simp only [pickKey, Key.mk.injEq] at this <;> exact Int.ofNat_inj.mp this.2.2.2

/-- Every pick sits on the checked front. -/
theorem pick_on_front {k : PickKind} {cands front : List Outcome} {e : Nat} {x : Outcome}
    (hf : checkFront cands front = true) (hx : PickValid k cands e x) : x ∈ front :=
  checkFront_complete hf x hx.mem hx.nondominated

/-! ## Spot checks -/

private def o1 : Outcome := ⟨1, 100, 10, 5⟩
private def o2 : Outcome := ⟨2, 100, 20, 5⟩   -- same cost, more carbon: dominates o1
private def o3 : Outcome := ⟨3, 900, 50, 40⟩

#guard checkFront [o1, o2, o3] [o2, o3]
#guard !checkFront [o1, o2, o3] [o1, o2, o3]
#guard checkPick .leastUpfront [o1, o2, o3] 0 o2 && !checkPick .leastUpfront [o1, o2, o3] 0 o1
#guard checkPick .bestReturn [o1, o2, o3] 0 o3 && checkPick .lowestCarbon [o1, o2, o3] 0 o3
#guard checkWitness [o1, o2, o3] o1 o2

end Ibasho.Spec.V2
