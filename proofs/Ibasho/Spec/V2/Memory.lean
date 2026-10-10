/-
Ibasho spec V2: memory guarantees of the search (AM 7.2, SPEC 7.3, R11). Owner: WP-04.

The claim "What you ruled out never came back" is a property of the search, not of the
narrator. The owner's memory is an append-only event log; the rejected set is its replay, latest
explicit owner action wins. The search offers only packages that pass the other rules (`ok`,
abstract here, the Kleene status in practice) and contain no rejected measure.

Main results: a rejected measure is never offered (`rejected_never_offered`), even across later
sessions until the owner restores it (`rejection_persists`); adding a rejection never adds
options (`rejection_antitone`); restoring never removes options (`restore_monotone`); a snooze
that expires only restores (`snooze_expiry_monotone`); and the front and picks are drawn from the
offered set (`pareto_subset_feasible`).
-/
import Ibasho.Spec.V2.Pareto

namespace Ibasho.Spec.V2

/-- Stable measure option id. -/
abbrev MeasureId := String

/-- A candidate package: its index and the measure options it contains. -/
structure Package where
  id : Nat
  measures : List MeasureId
  deriving DecidableEq, Repr

/-- The package contains no rejected measure (the `memory` built-in rule). -/
def respectsMemory (rejected : List MeasureId) (p : Package) : Bool :=
  p.measures.all fun m => !rejected.contains m

/-- The search: every package that passes the other rules and the memory rule. -/
def offered (ok : Package → Bool) (rejected : List MeasureId) (all : List Package) : List Package :=
  all.filter fun p => ok p && respectsMemory rejected p

theorem mem_offered {ok : Package → Bool} {rejected : List MeasureId} {all : List Package}
    {p : Package} : p ∈ offered ok rejected all ↔
      p ∈ all ∧ ok p = true ∧ ∀ m ∈ p.measures, m ∉ rejected := by
  simp [offered, respectsMemory, List.mem_filter, List.all_eq_true]

/-- A measure the owner rejected is never offered. -/
theorem rejected_never_offered {ok : Package → Bool} {rejected : List MeasureId}
    {all : List Package} {p : Package} (hp : p ∈ offered ok rejected all) :
    ∀ m ∈ rejected, m ∉ p.measures := fun m hm hmem => (mem_offered.mp hp).2.2 m hmem hm

private theorem filter_sublist_of_imp {α : Type} (p q : α → Bool) :
    ∀ l : List α, (∀ x ∈ l, p x = true → q x = true) → (l.filter p).Sublist (l.filter q)
  | [], _ => List.Sublist.slnil
  | x :: xs, h => by
    have ih := filter_sublist_of_imp p q xs (fun y hy => h y (List.mem_cons_of_mem _ hy))
    have hx := h x (List.mem_cons_self ..)
    cases hp : p x <;> cases hq : q x <;> simp only [List.filter_cons, hp, hq] <;> simp_all <;>
      first | exact ih.cons x | exact ih.cons_cons x

/-- More rejections never add options (the offered list only shrinks, order kept). -/
theorem rejection_monotone {ok : Package → Bool} {r r' : List MeasureId} (h : ∀ m ∈ r, m ∈ r')
    (all : List Package) : (offered ok r' all).Sublist (offered ok r all) := by
  apply filter_sublist_of_imp
  intro p _ hp
  simp only [respectsMemory, Bool.and_eq_true, List.all_eq_true] at hp ⊢
  refine ⟨hp.1, fun m hm => ?_⟩
  have := hp.2 m hm
  have hn : m ∉ r' := by simpa using this
  have : m ∉ r := fun hr => hn (h m hr)
  simpa using this

/-- Adding a rejection never adds options. -/
theorem rejection_antitone (ok : Package → Bool) (rejected : List MeasureId) (m : MeasureId)
    (all : List Package) : (offered ok (m :: rejected) all).Sublist (offered ok rejected all) :=
  rejection_monotone (fun _ hx => List.mem_cons_of_mem m hx) all

/-- Restoring a measure never removes options. -/
theorem restore_monotone (ok : Package → Bool) (rejected : List MeasureId) (m : MeasureId)
    (all : List Package) :
    (offered ok rejected all).Sublist (offered ok (rejected.filter (· != m)) all) :=
  rejection_monotone (fun _ hx => (List.mem_filter.mp hx).1) all

/-! ## The event log -/

/-- Memory events that change the rejected set; anything else is `other`. -/
inductive MemEvent where
  | rejected (m : MeasureId)
  | restored (m : MeasureId)
  | other
  deriving DecidableEq, Repr

/-- Apply one event. A repeated rejection is an update, not a duplicate. -/
def applyEvent (rejected : List MeasureId) : MemEvent → List MeasureId
  | .rejected m => m :: rejected.filter (· != m)
  | .restored m => rejected.filter (· != m)
  | .other => rejected

/-- The rejected set: replay of the log from empty. -/
def replay (log : List MemEvent) : List MeasureId := log.foldl applyEvent []

private theorem mem_foldl_of_no_restore (m : MeasureId) :
    ∀ (later : List MemEvent) (r : List MeasureId), m ∈ r → MemEvent.restored m ∉ later →
      m ∈ later.foldl applyEvent r
  | [], _, h, _ => h
  | e :: es, r, h, hn => by
    simp only [List.foldl_cons]
    apply mem_foldl_of_no_restore m es
    · cases e with
      | rejected x =>
        simp only [applyEvent, List.mem_cons, List.mem_filter, bne_iff_ne, ne_eq]
        by_cases hx : m = x
        · exact Or.inl hx
        · exact Or.inr ⟨h, hx⟩
      | restored x =>
        simp only [applyEvent, List.mem_filter, bne_iff_ne, ne_eq]
        refine ⟨h, fun hx => hn ?_⟩
        rw [hx]; exact List.mem_cons_self ..
      | other => exact h
    · exact fun he => hn (List.mem_cons_of_mem _ he)

/-- A rejection persists across every later session until the owner restores the measure. -/
theorem rejection_persists (before later : List MemEvent) (m : MeasureId)
    (hn : MemEvent.restored m ∉ later) : m ∈ replay (before ++ MemEvent.rejected m :: later) := by
  unfold replay
  rw [List.foldl_append, List.foldl_cons]
  apply mem_foldl_of_no_restore m later _ _ hn
  simp [applyEvent]

/-- Hence a rejected measure never comes back in any later search. -/
theorem rejected_never_returns (ok : Package → Bool) (all : List Package)
    (before later : List MemEvent) (m : MeasureId) (hn : MemEvent.restored m ∉ later)
    (p : Package) (hp : p ∈ offered ok (replay (before ++ MemEvent.rejected m :: later)) all) :
    m ∉ p.measures :=
  rejected_never_offered hp m (rejection_persists before later m hn)

/-! ## Snoozes -/

/-- A rejection entry: `never`, or snoozed until a date (`yyyymmdd`, exclusive). -/
structure Rejection where
  measure : MeasureId
  snoozeUntil : Option Nat
  deriving DecidableEq, Repr

/-- Rejections in force on `now`: `never`, or a snooze with `now < until`. -/
def activeRejections (now : Nat) (rs : List Rejection) : List MeasureId :=
  (rs.filter fun r => match r.snoozeUntil with | some u => decide (now < u) | none => true).map
    (·.measure)

/-- As time passes, snoozes only expire, so options only come back, never disappear. -/
theorem snooze_expiry_monotone (ok : Package → Bool) (rs : List Rejection) (all : List Package)
    {now now' : Nat} (h : now ≤ now') :
    (offered ok (activeRejections now rs) all).Sublist
      (offered ok (activeRejections now' rs) all) := by
  apply rejection_monotone
  intro m hm
  simp only [activeRejections, List.mem_map, List.mem_filter] at hm ⊢
  obtain ⟨r, ⟨hr, ha⟩, rfl⟩ := hm
  refine ⟨r, ⟨hr, ?_⟩, rfl⟩
  cases hu : r.snoozeUntil with
  | none => rfl
  | some u =>
    rw [hu] at ha
    simp only [decide_eq_true_eq] at ha ⊢
    omega

/-! ## Front and picks come from the offered set -/

/-- The three highlighted futures and the whole front are drawn from offered packages, so
none contains a rejected measure. `outcome` maps a package to its R8 axes. -/
theorem pareto_subset_feasible {ok : Package → Bool} {rejected : List MeasureId}
    {all : List Package} (outcome : Package → Outcome) {front : List Outcome}
    (hf : checkFront ((offered ok rejected all).map outcome) front = true) :
    ∀ o ∈ front, ∃ p ∈ offered ok rejected all, outcome p = o ∧ ok p = true ∧
      ∀ m ∈ rejected, m ∉ p.measures := by
  intro o ho
  obtain ⟨hm, _⟩ := checkFront_sound hf o ho
  obtain ⟨p, hp, rfl⟩ := List.mem_map.mp hm
  exact ⟨p, hp, rfl, (mem_offered.mp hp).2.1, rejected_never_offered hp⟩

/-- The same for each checked pick. -/
theorem picks_subset_feasible {ok : Package → Bool} {rejected : List MeasureId}
    {all : List Package} (outcome : Package → Outcome) {k : PickKind} {e : Nat} {x : Outcome}
    (hx : PickValid k ((offered ok rejected all).map outcome) e x) :
    ∃ p ∈ offered ok rejected all, outcome p = x ∧ ∀ m ∈ rejected, m ∉ p.measures := by
  obtain ⟨p, hp, rfl⟩ := List.mem_map.mp hx.mem
  exact ⟨p, hp, rfl, rejected_never_offered hp⟩

/-! ## Spot checks -/

#guard replay [.rejected "ewi", .other, .rejected "ashp", .restored "ewi"] == ["ashp"]
#guard (offered (fun _ => true) ["ewi"] [⟨0, []⟩, ⟨1, ["ewi", "loft"]⟩, ⟨2, ["loft"]⟩]).map (·.id)
  == [0, 2]

end Ibasho.Spec.V2
