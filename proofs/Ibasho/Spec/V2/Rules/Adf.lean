/-
Ibasho spec V2: Approved Document F ventilation category (RP 6.2, BUILD_PLAN C4). Owner: WP-04.
Named function `adf_category`, from AD F Diagram 3.1: rows are major measures (saturating at 4),
columns minor measures (saturating at 6). Past measures count too. Category A asks least.
-/

namespace Ibasho.Spec.V2

/-- AD F ventilation categories, A asks least. -/
inductive AdfCategory where
  | A | B | C
  deriving DecidableEq, Repr

def AdfCategory.rank : AdfCategory → Nat
  | .A => 0 | .B => 1 | .C => 2

/-- Diagram 3.1, saturated: `major ≥ 4` is row 4, `minor ≥ 6` is column 6. -/
def adfTable : List (List AdfCategory) :=
  [ [.A, .A, .A, .B, .B, .B, .B],
    [.B, .B, .B, .B, .B, .B, .C],
    [.B, .B, .B, .B, .C, .C, .C],
    [.B, .C, .C, .C, .C, .C, .C],
    [.C, .C, .C, .C, .C, .C, .C] ]

/-- `adf_category(major, minor)`. -/
def adfCategory (major minor : Nat) : AdfCategory :=
  (adfTable.getD (min major 4) []).getD (min minor 6) .C

/-- More measures never lower the category (checked on the saturated 5 × 7 domain). -/
private theorem adf_table_check :
    (List.range 5).all (fun i => (List.range 7).all fun j => (List.range 5).all fun i' =>
      (List.range 7).all fun j' =>
        !(decide (i ≤ i') && decide (j ≤ j')) ||
          decide ((adfCategory i j).rank ≤ (adfCategory i' j').rank)) = true := by
  decide +kernel

private theorem adf_table_monotone :
    ∀ i < 5, ∀ j < 7, ∀ i' < 5, ∀ j' < 7, i ≤ i' → j ≤ j' →
      (adfCategory i j).rank ≤ (adfCategory i' j').rank := by
  intro i hi j hj i' hi' j' hj' h1 h2
  have := adf_table_check
  simp only [List.all_eq_true, List.mem_range] at this
  have := this i hi j hj i' hi' j' hj'
  simp only [Bool.or_eq_true, Bool.not_eq_true', Bool.and_eq_false_iff, decide_eq_false_iff_not,
    decide_eq_true_eq] at this
  omega

theorem adf_category_monotone {major minor major' minor' : Nat} (h₁ : major ≤ major')
    (h₂ : minor ≤ minor') :
    (adfCategory major minor).rank ≤ (adfCategory major' minor').rank := by
  have e : ∀ a b, adfCategory a b = adfCategory (min a 4) (min b 6) := by
    intro a b; simp [adfCategory, Nat.min_assoc]
  rw [e major minor, e major' minor']
  exact adf_table_monotone _ (by omega) _ (by omega) _ (by omega) _ (by omega) (by omega) (by omega)

#guard adfCategory 0 0 == .A && adfCategory 0 3 == .B && adfCategory 1 6 == .C
#guard adfCategory 9 0 == .C && adfCategory 2 40 == .C

end Ibasho.Spec.V2
