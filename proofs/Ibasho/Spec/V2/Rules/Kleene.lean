/-
Ibasho spec V2: three-valued rule semantics (SPEC R22, ARCH 5.4, RP 3, DEC TE-3). Owner: WP-04.

Normative semantics of rule conditions and package status, mirrored by the WP-03 evaluator
`packages/engine/src/rules/expr.ts` and `evaluate.ts` (see the WP-03 INTERFACES entry):
* a missing fact, or one recorded as unknown, is unknown; unknown is never read as false or 0;
* `and`, `or`, `not` are the strong Kleene connectives; empty `and` is true, empty `or` false;
* `cmp` and `in` are unknown when any operand is unknown, else two-valued;
* booleans compare as numbers (true 1, false 0), so they are `Val.num` here;
* strings support only `=` and `!=`; a number never equals a string; ordering a string is a
  malformed rule (TS throws). Lean, being total, reads a malformed comparison as unknown, which
  can only make a status more cautious, never feasible;
* a named function receives its arguments only when all are known; a function missing from the
  table is unknown.

Status of a package, from every rule application (rule, subject environment):
* `blocked` if a block condition is true, or a needed check is recorded `fail`;
* else `needsCheck` if a block condition is unknown, or a check condition is true or unknown
  with no recorded result;
* else `feasible`.
`consent`, `oblige`, `warn` and `info` effects never change the status.

Main results: Kleene evaluation is monotone in information (`eval_refines`), so a decided value
holds under every completion of the unknown facts (`kleene_sound`); an unknown block is never
feasible (`unknown_never_feasible`); the Boolean status check is exactly the feasibility
predicate (`feasibleB_sound`, `feasibleB_complete`); and a feasible status survives every
completion (`feasible_stable`).
-/

namespace Ibasho.Spec.V2

/-- Three-valued truth (TS `Tri`: `true`, `false`, `'unknown'`). -/
inductive Tri where
  | yes | no | unknown
  deriving DecidableEq, Repr

namespace Tri

/-- Strong Kleene negation. -/
def not : Tri → Tri
  | yes => no | no => yes | unknown => unknown

/-- Strong Kleene conjunction: false wins, then unknown. -/
def and : Tri → Tri → Tri
  | no, _ => no
  | _, no => no
  | yes, yes => yes
  | _, _ => unknown

/-- Strong Kleene disjunction: true wins, then unknown. -/
def or : Tri → Tri → Tri
  | yes, _ => yes
  | _, yes => yes
  | no, no => no
  | _, _ => unknown

/-- Embed a decided Boolean. -/
def ofBool (b : Bool) : Tri := if b then yes else no

/-- Information order: `a ⊑ b` when `b` is `a` with possibly more known. -/
def Le (a b : Tri) : Prop := a = unknown ∨ a = b

instance (a b : Tri) : Decidable (Le a b) := by unfold Le; infer_instance

theorem Le.refl (a : Tri) : Le a a := Or.inr rfl
theorem Le.unknown_le (a : Tri) : Le unknown a := Or.inl rfl

theorem Le.decided {a b : Tri} (h : Le a b) (ha : a ≠ unknown) : a = b := h.resolve_left ha

private theorem not_mono' : ∀ a a' : Tri, Le a a' → Le a.not a'.not := by
  intro a a'; cases a <;> cases a' <;> decide
private theorem and_mono' : ∀ a a' b b' : Tri, Le a a' → Le b b' → Le (a.and b) (a'.and b') := by
  intro a a' b b'; cases a <;> cases a' <;> cases b <;> cases b' <;> decide
private theorem or_mono' : ∀ a a' b b' : Tri, Le a a' → Le b b' → Le (a.or b) (a'.or b') := by
  intro a a' b b'; cases a <;> cases a' <;> cases b <;> cases b' <;> decide

theorem not_mono {a a' : Tri} (h : Le a a') : Le a.not a'.not := not_mono' a a' h
theorem and_mono {a a' b b' : Tri} (h₁ : Le a a') (h₂ : Le b b') : Le (a.and b) (a'.and b') :=
  and_mono' a a' b b' h₁ h₂
theorem or_mono {a a' b b' : Tri} (h₁ : Le a a') (h₂ : Le b b') : Le (a.or b) (a'.or b') :=
  or_mono' a a' b b' h₁ h₂

/-- On decided values the connectives are the Boolean ones. -/
theorem and_ofBool (a b : Bool) : (ofBool a).and (ofBool b) = ofBool (a && b) := by
  cases a <;> cases b <;> rfl
theorem or_ofBool (a b : Bool) : (ofBool a).or (ofBool b) = ofBool (a || b) := by
  cases a <;> cases b <;> rfl
theorem not_ofBool (a : Bool) : (ofBool a).not = ofBool (!a) := by cases a <;> rfl

end Tri

/-- A known fact value: a number (booleans as 1 and 0) or a string. -/
inductive Val where
  | num (q : Rat)
  | str (s : String)
  deriving DecidableEq, Repr

/-- Fact ids are namespaced strings: `h.*`, `m.*`, `p.*`, `o.*`. -/
abbrev FactId := String

/-- Facts visible to one evaluation. `none` is unknown or missing. -/
abbrev Env := FactId → Option Val

/-- `ρ'` completes `ρ`: every fact known in `ρ` has the same value in `ρ'`. -/
def Env.Refines (ρ ρ' : Env) : Prop := ∀ x v, ρ x = some v → ρ' x = some v

theorem Env.Refines.refl (ρ : Env) : ρ.Refines ρ := fun _ _ h => h

theorem Env.Refines.trans {ρ₁ ρ₂ ρ₃ : Env} (h₁ : ρ₁.Refines ρ₂) (h₂ : ρ₂.Refines ρ₃) :
    ρ₁.Refines ρ₃ := fun x v h => h₂ x v (h₁ x v h)

/-- Comparison operators (TS `CmpOp`). -/
inductive CmpOp where
  | lt | le | eq | ge | gt | ne
  deriving DecidableEq, Repr

/-- Right operand of a comparison: a fact or a literal. -/
inductive Operand where
  | fact (x : FactId)
  | lit (v : Val)
  deriving DecidableEq, Repr

/-- Rule condition AST (TS `Expr`). -/
inductive Expr where
  | and (es : List Expr)
  | or (es : List Expr)
  | not (e : Expr)
  | cmp (op : CmpOp) (left : FactId) (right : Operand)
  | mem (x : FactId) (set : List Val)
  | fn (name : String) (args : List FactId)
  | const (t : Tri)
  deriving Repr

/-- Named functions (`mcs020a_Lp_le`, `adf_category`, ...): receive known arguments only. -/
abbrev Fns := String → List Val → Tri

/-- Two known values compared. Malformed comparisons are unknown (see the module header). -/
def compare (op : CmpOp) : Val → Val → Tri
  | .num a, .num b => Tri.ofBool <| match op with
    | .lt => decide (a < b) | .le => decide (a ≤ b) | .eq => decide (a = b)
    | .ge => decide (b ≤ a) | .gt => decide (b < a) | .ne => decide (a ≠ b)
  | a, b => match op with
    | .eq => Tri.ofBool (decide (a = b))
    | .ne => Tri.ofBool (decide (a ≠ b))
    | _ => .unknown

def Operand.resolve (ρ : Env) : Operand → Option Val
  | .fact x => ρ x
  | .lit v => some v

/-- All arguments, or `none` if any is unknown. -/
def resolveAll (ρ : Env) : List FactId → Option (List Val)
  | [] => some []
  | x :: xs => match ρ x, resolveAll ρ xs with
    | some v, some vs => some (v :: vs)
    | _, _ => none

mutual
/-- Strong Kleene evaluation of a condition. -/
def eval (fns : Fns) (ρ : Env) : Expr → Tri
  | .and es => evalAll fns ρ es
  | .or es => evalAny fns ρ es
  | .not e => (eval fns ρ e).not
  | .cmp op l r => match ρ l, r.resolve ρ with
    | some a, some b => compare op a b
    | _, _ => .unknown
  | .mem x set => match ρ x with
    | some a => Tri.ofBool (decide (a ∈ set))
    | none => .unknown
  | .fn name args => match resolveAll ρ args with
    | some vs => fns name vs
    | none => .unknown
  | .const t => t

/-- Conjunction of a list; empty is true. -/
def evalAll (fns : Fns) (ρ : Env) : List Expr → Tri
  | [] => .yes
  | e :: es => (eval fns ρ e).and (evalAll fns ρ es)

/-- Disjunction of a list; empty is false. -/
def evalAny (fns : Fns) (ρ : Env) : List Expr → Tri
  | [] => .no
  | e :: es => (eval fns ρ e).or (evalAny fns ρ es)
end

/-! ## Monotonicity in information -/

theorem resolveAll_refines {ρ ρ' : Env} (h : ρ.Refines ρ') :
    ∀ (xs : List FactId) (vs : List Val), resolveAll ρ xs = some vs → resolveAll ρ' xs = some vs
  | [], _, hv => hv
  | x :: xs, vs, hv => by
    simp only [resolveAll] at hv ⊢
    split at hv
    · rename_i v ws h1 h2
      rw [h x v h1, resolveAll_refines h xs ws h2]
      exact hv
    · cases hv

mutual
/-- Kleene evaluation is monotone: completing unknown facts can only decide an unknown. -/
theorem eval_refines (fns : Fns) {ρ ρ' : Env} (h : ρ.Refines ρ') :
    ∀ e : Expr, Tri.Le (eval fns ρ e) (eval fns ρ' e)
  | .and es => by simp only [eval]; exact evalAll_refines fns h es
  | .or es => by simp only [eval]; exact evalAny_refines fns h es
  | .not e => by simp only [eval]; exact Tri.not_mono (eval_refines fns h e)
  | .cmp op l r => by
    simp only [eval]
    split
    · rename_i a b h1 h2
      have h1' := h l a h1
      have h2' : r.resolve ρ' = some b := by
        cases r with
        | fact y => exact h y b h2
        | lit v => exact h2
      rw [h1', h2']
      exact Tri.Le.refl _
    · exact Tri.Le.unknown_le _
  | .mem x set => by
    simp only [eval]
    split
    · rename_i a h1
      rw [h x a h1]
      exact Tri.Le.refl _
    · exact Tri.Le.unknown_le _
  | .fn name args => by
    simp only [eval]
    split
    · rename_i vs h1
      rw [resolveAll_refines h args vs h1]
      exact Tri.Le.refl _
    · exact Tri.Le.unknown_le _
  | .const t => Tri.Le.refl _

theorem evalAll_refines (fns : Fns) {ρ ρ' : Env} (h : ρ.Refines ρ') :
    ∀ es : List Expr, Tri.Le (evalAll fns ρ es) (evalAll fns ρ' es)
  | [] => Tri.Le.refl _
  | e :: es => Tri.and_mono (eval_refines fns h e) (evalAll_refines fns h es)

theorem evalAny_refines (fns : Fns) {ρ ρ' : Env} (h : ρ.Refines ρ') :
    ∀ es : List Expr, Tri.Le (evalAny fns ρ es) (evalAny fns ρ' es)
  | [] => Tri.Le.refl _
  | e :: es => Tri.or_mono (eval_refines fns h e) (evalAny_refines fns h es)
end

/-- Completion soundness (BUILD_PLAN C3): a decided Kleene value is the value under every
completion of the unknown facts. In particular an unknown fact can never make a block false. -/
theorem kleene_sound (fns : Fns) {ρ : Env} {e : Expr} {t : Tri} (ht : t ≠ .unknown)
    (h : eval fns ρ e = t) : ∀ ρ', ρ.Refines ρ' → eval fns ρ' e = t := by
  intro ρ' hr
  have := eval_refines fns hr e
  rw [h] at this
  exact (this.decided ht).symm

/-! ## Rules, effects and package status -/

/-- Rule effects (TS `Effect`); payloads are ids, the Lean status needs only the kind. -/
inductive Effect where
  | block
  | check (kind : String)
  | consent (authority : String)
  | oblige (spec : String)
  | warn (risk : String)
  | info
  deriving DecidableEq, Repr

/-- A rule: a condition and one effect, in force between two dates. -/
structure Rule where
  id : String
  when : Expr
  effect : Effect
  /-- Dates as `yyyymmdd` numbers; both ends inclusive. -/
  effectiveFrom : Nat
  effectiveTo : Option Nat := none

/-- In force on `asOf`, both ends inclusive (TS `isInForce`). -/
def Rule.inForce (r : Rule) (asOf : Nat) : Bool :=
  r.effectiveFrom ≤ asOf && (match r.effectiveTo with | some t => asOf ≤ t | none => true)

theorem Rule.inForce_iff (r : Rule) (asOf : Nat) :
    r.inForce asOf = true ↔ r.effectiveFrom ≤ asOf ∧ ∀ t, r.effectiveTo = some t → asOf ≤ t := by
  unfold Rule.inForce
  cases h : r.effectiveTo <;> simp

/-- Recorded result of a check (latest record wins, TS `latestCheck`). -/
inductive CheckResult where
  | pass | conditional | fail
  deriving DecidableEq, Repr

/-- Latest recorded check result by check kind. -/
abbrev Checks := String → Option CheckResult

/-- A check is satisfied by a recorded `pass` or `conditional`. -/
def CheckResult.satisfies : CheckResult → Bool
  | .pass | .conditional => true
  | .fail => false

/-- One rule evaluated on one subject (an option or the package) with its environment. -/
structure App where
  rule : Rule
  env : Env

/-- Package status (TS `Feasibility.status`). -/
inductive Status where
  | feasible | needsCheck | blocked
  deriving DecidableEq, Repr

section Status
variable (fns : Fns) (checks : Checks)

/-- Value of an application's condition. -/
def App.value (a : App) : Tri := eval fns a.env a.rule.when

/-- This application blocks the package. -/
def App.blocks (a : App) : Bool :=
  match a.rule.effect with
  | .block => a.value fns = .yes
  | .check k => a.value fns ≠ .no && checks k = some .fail
  | _ => false

/-- This application leaves the package undecided. -/
def App.undecided (a : App) : Bool :=
  match a.rule.effect with
  | .block => a.value fns = .unknown
  | .check k => a.value fns ≠ .no && checks k = none
  | _ => false

/-- Status of a package from all its rule applications. -/
def status (apps : List App) : Status :=
  if apps.any (App.blocks fns checks) then .blocked
  else if apps.any (App.undecided fns checks) then .needsCheck
  else .feasible

/-- Boolean feasibility check used by `feas.recompute`. -/
def feasibleB (apps : List App) : Bool := status fns checks apps == .feasible

/-- The feasibility predicate: every block is definitely false and every check that may apply
has a satisfying record. -/
def Feasible (apps : List App) : Prop :=
  ∀ a ∈ apps,
    (a.rule.effect = .block → a.value fns = .no) ∧
    (∀ k, a.rule.effect = .check k →
      a.value fns = .no ∨ ∃ r, checks k = some r ∧ r.satisfies = true)

end Status

/-- Applications `as'` are `as` with every environment completed. -/
def AppsRefine : List App → List App → Prop
  | [], [] => True
  | a :: as, a' :: as' => a.rule = a'.rule ∧ a.env.Refines a'.env ∧ AppsRefine as as'
  | _, _ => False

theorem AppsRefine.refl : ∀ as : List App, AppsRefine as as
  | [] => trivial
  | _ :: as => ⟨rfl, Env.Refines.refl _, AppsRefine.refl as⟩

private theorem app_ok_iff (fns : Fns) (checks : Checks) (a : App) :
    (a.blocks fns checks = false ∧ a.undecided fns checks = false) ↔
    ((a.rule.effect = .block → a.value fns = .no) ∧
     (∀ k, a.rule.effect = .check k →
        a.value fns = .no ∨ ∃ r, checks k = some r ∧ r.satisfies = true)) := by
  unfold App.blocks App.undecided
  generalize a.value fns = v
  cases a.rule.effect with
  | block => cases v <;> simp
  | check k =>
    cases hk : checks k with
    | none => cases v <;> simp [hk]
    | some r => cases r <;> cases v <;> simp [hk, CheckResult.satisfies]
  | consent _ | oblige _ | warn _ | info => simp

/-- `feasibleB` is sound: a `true` answer means every encoded rule is passed. -/
theorem feasibleB_sound (fns : Fns) (checks : Checks) (apps : List App)
    (h : feasibleB fns checks apps = true) : Feasible fns checks apps := by
  intro a ha
  unfold feasibleB status at h
  split at h
  · simp at h
  · split at h
    · simp at h
    · rename_i h1 h2
      simp only [List.any_eq_true, not_exists, not_and, Bool.not_eq_true] at h1 h2
      exact (app_ok_iff fns checks a).mp ⟨h1 a ha, h2 a ha⟩

/-- `feasibleB` is complete: a package passing every rule is reported feasible. -/
theorem feasibleB_complete (fns : Fns) (checks : Checks) (apps : List App)
    (h : Feasible fns checks apps) : feasibleB fns checks apps = true := by
  have ok := fun a ha => (app_ok_iff fns checks a).mpr (h a ha)
  have h1 : apps.any (App.blocks fns checks) = false := by
    simp only [List.any_eq_false, Bool.not_eq_true]
    exact fun a ha => (ok a ha).1
  have h2 : apps.any (App.undecided fns checks) = false := by
    simp only [List.any_eq_false, Bool.not_eq_true]
    exact fun a ha => (ok a ha).2
  simp [feasibleB, status, h1, h2]

/-- An unknown block is never feasible (BUILD_PLAN C3, SPEC R22). -/
theorem unknown_never_feasible (fns : Fns) (checks : Checks) (apps : List App) (a : App)
    (ha : a ∈ apps) (hb : a.rule.effect = .block) (hu : a.value fns = .unknown) :
    status fns checks apps ≠ .feasible := by
  intro hs
  have := feasibleB_sound fns checks apps (by simp [feasibleB, hs])
  have := (this a ha).1 hb
  rw [hu] at this
  cases this

private theorem feasible_refine (fns : Fns) (checks : Checks) :
    ∀ (apps apps' : List App), AppsRefine apps apps' →
      Feasible fns checks apps → Feasible fns checks apps'
  | [], [], _, _ => fun _ ha => by cases ha
  | [], _ :: _, h, _ => h.elim
  | _ :: _, [], h, _ => h.elim
  | a :: as, a' :: as', ⟨hrule, henv, hrest⟩, hF => by
    intro b hb
    rcases List.mem_cons.mp hb with rfl | hb
    · have hv : ∀ t, t ≠ .unknown → a.value fns = t → b.value fns = t := by
        intro t ht h
        unfold App.value at h ⊢
        rw [← hrule]
        exact kleene_sound fns ht h _ henv
      obtain ⟨h1, h2⟩ := hF a (List.mem_cons_self ..)
      refine ⟨fun he => hv .no (by decide) (h1 (hrule ▸ he)), fun k hk => ?_⟩
      rcases h2 k (hrule ▸ hk) with h | h
      · exact Or.inl (hv .no (by decide) h)
      · exact Or.inr h
    · exact feasible_refine fns checks as as' hrest
        (fun c hc => hF c (List.mem_cons_of_mem _ hc)) b hb

/-- A feasible package stays feasible under every completion of its unknown facts: whatever
the unknowns turn out to be, every encoded rule is still passed. -/
theorem feasible_stable (fns : Fns) (checks : Checks) (apps apps' : List App)
    (hr : AppsRefine apps apps') (hs : status fns checks apps = .feasible) :
    status fns checks apps' = .feasible := by
  have hF := feasibleB_sound fns checks apps (by simp [feasibleB, hs])
  have := feasibleB_complete fns checks apps' (feasible_refine fns checks apps apps' hr hF)
  simpa [feasibleB] using this

private theorem any_blocks_refine (fns : Fns) (checks : Checks) :
    ∀ (apps apps' : List App), AppsRefine apps apps' → ∀ a ∈ apps,
      a.rule.effect = .block → a.value fns = .yes → apps'.any (App.blocks fns checks) = true
  | [], _, _, _, ha, _, _ => by cases ha
  | _ :: _, [], h, _, _, _, _ => h.elim
  | c :: cs, c' :: cs', ⟨hrule, henv, hrest⟩, a, ha, hb, hy => by
    rw [List.any_cons, Bool.or_eq_true]
    rcases List.mem_cons.mp ha with rfl | ha
    · left
      have hv : c'.value fns = .yes := by
        unfold App.value at hy ⊢
        rw [← hrule]
        exact kleene_sound fns (by decide) hy _ henv
      unfold App.blocks
      rw [← hrule, hb, hv]
      rfl
    · exact Or.inr (any_blocks_refine fns checks cs cs' hrest a ha hb hy)

/-- A block decided true stays blocked under every completion. -/
theorem blocked_stable (fns : Fns) (checks : Checks) (apps apps' : List App)
    (hr : AppsRefine apps apps') (a : App) (ha : a ∈ apps) (hb : a.rule.effect = .block)
    (hy : a.value fns = .yes) : status fns checks apps' = .blocked := by
  simp [status, any_blocks_refine fns checks apps apps' hr a ha hb hy]

/-! ## Spot checks (the M0-4 mutant shape: looped supply unknown gives needs-check) -/

private def loopedRule : Rule :=
  { id := "UK.DNO.HP.LOOPED", when := .cmp .eq "h.supply.looped" (.lit (.num 1)),
    effect := .block, effectiveFrom := 20250101 }

private def noFns : Fns := fun _ _ => .unknown
private def noChecks : Checks := fun _ => none

#guard status noFns noChecks [⟨loopedRule, fun _ => none⟩] == .needsCheck
#guard status noFns noChecks [⟨loopedRule, fun x => if x == "h.supply.looped" then some (.num 0) else none⟩]
  == .feasible
#guard status noFns noChecks [⟨loopedRule, fun x => if x == "h.supply.looped" then some (.num 1) else none⟩]
  == .blocked
#guard eval noFns (fun _ => none) (.or [.const .yes, .cmp .lt "x" (.lit (.num 1))]) == .yes
#guard eval noFns (fun _ => none) (.and [.const .no, .cmp .lt "x" (.lit (.num 1))]) == .no
#guard eval noFns (fun _ => none) (.and []) == .yes && eval noFns (fun _ => none) (.or []) == .no

end Ibasho.Spec.V2
