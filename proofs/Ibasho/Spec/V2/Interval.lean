/-
Ibasho spec V2: interval enclosure, worked surrogate (LV 6.5, DEC SC-7). Owner: WP-04.

Shown on `/app/proofs` only. Displayed ranges in the app stay Modelled: enclosing the real
monthly chain needs transcendental bounds that core `Rat` cannot give (T5 research item). The
surrogate is steady-state fabric loss, `UA · HDD · 24 / 1000` kWh per year, with unknown inputs
entered as intervals, never as zero ("unknown is not 0").
-/

namespace Ibasho.Spec.V2

/-- A closed rational interval. -/
structure Ival where
  lo : Rat
  hi : Rat
  deriving DecidableEq, Repr

instance : Membership Rat Ival := ⟨fun I x => I.lo ≤ x ∧ x ≤ I.hi⟩

@[simp] theorem Ival.mem_def {x : Rat} {I : Ival} : x ∈ I ↔ I.lo ≤ x ∧ x ≤ I.hi := Iff.rfl

def Ival.add (I J : Ival) : Ival := ⟨I.lo + J.lo, I.hi + J.hi⟩

/-- Product of nonnegative intervals. -/
def Ival.mulNN (I J : Ival) : Ival := ⟨I.lo * J.lo, I.hi * J.hi⟩

theorem Ival.add_sound {x y : Rat} {I J : Ival} (hx : x ∈ I) (hy : y ∈ J) : x + y ∈ I.add J := by
  simp only [Ival.mem_def, Ival.add] at *
  grind

theorem Ival.mulNN_sound {x y : Rat} {I J : Ival} (hI : 0 ≤ I.lo) (hJ : 0 ≤ J.lo)
    (hx : x ∈ I) (hy : y ∈ J) : x * y ∈ I.mulNN J := by
  simp only [Ival.mem_def, Ival.mulNN] at *
  obtain ⟨hx1, hx2⟩ := hx
  obtain ⟨hy1, hy2⟩ := hy
  have hx0 : 0 ≤ x := by grind
  have hy0 : 0 ≤ y := by grind
  constructor
  · have a := Rat.mul_le_mul_of_nonneg_right hx1 hJ
    have b := Rat.mul_le_mul_of_nonneg_left hy1 hx0
    grind
  · have a := Rat.mul_le_mul_of_nonneg_right hx2 hy0
    have b := Rat.mul_le_mul_of_nonneg_left hy2 (by grind : (0 : Rat) ≤ I.hi)
    grind

/-- Steady-state fabric loss in kWh per year. -/
def fabricLoss (ua hdd : Rat) : Rat := ua * hdd * (24 / 1000)

def fabricLossI (UA HDD : Ival) : Ival := (UA.mulNN HDD).mulNN ⟨24 / 1000, 24 / 1000⟩

/-- The band contains the model output for every input consistent with what the owner told us. -/
theorem fabricLoss_enclosed {ua hdd : Rat} {UA HDD : Ival}
    (h1 : 0 ≤ UA.lo) (h2 : 0 ≤ HDD.lo) (hu : ua ∈ UA) (hh : hdd ∈ HDD) :
    fabricLoss ua hdd ∈ fabricLossI UA HDD := by
  unfold fabricLoss fabricLossI
  exact Ival.mulNN_sound (Rat.mul_nonneg h1 h2) (by decide +kernel)
    (Ival.mulNN_sound h1 h2 hu hh) ⟨Rat.le_refl, Rat.le_refl⟩

#guard fabricLossI ⟨180, 260⟩ ⟨2000, 2400⟩ == ⟨8640, 14976⟩

end Ibasho.Spec.V2
