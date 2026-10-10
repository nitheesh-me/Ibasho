/-
Ibasho spec V2: MCS 020 a) heat pump noise by rational enclosure (RP 6.1, SPEC 9, ARCH 8.1,
DEC TE-3). Owner: WP-04. Named function `mcs020a_Lp_le`.

For each unit at one assessment position (RP 6.1):
  `Lp = LwA + 10 log10(Q / (4 π r²)) - A_B`
with `Q ∈ {2, 4, 8}` for 1, 2 or 3 reflecting surfaces (more than 3 fails outright), `r` to
0.1 m, and `A_B` from the barrier matrix. Several units add on the energy scale:
`Lp,total = 10 log10(Σ 10^(Lp_i / 10))`. The result is rounded to 0.1 dB and passes iff it is
at most 37.0 dB(A) at every position, so the pass test is `Lp,total < 37.05`, that is
`Σ E_i < 10^3.705` with `E_i = 10^(Lp_i / 10)`.

Logarithms and π are not rational, so Lean never computes them. Instead, with sound units
(deci-decibels and decimetres), `E_i = 10^((LwA - A_B) / 100) · 25 Q / (π r_dm²)`, and the
checker encloses every transcendental constant in a rational interval:
* `10^(k/100)` for `k = 0..99` from `pow10LoTable` (lower bound, nine decimals; upper bound one
  unit above), checked by `pow10Table_correct`: `lo^100 ≤ 10^k ≤ hi^100`, scaled;
* `10^0.705` (the 37.05 threshold) from `thrLoN`, checked by `thr_correct`;
* `1/π` within `[113/355, 106/333]`, from `333/106 < π < 355/113` (classical bounds, the one
  external fact this file relies on, stated as admissibility, never as an axiom).

The decision is three-valued: pass when the upper energy bound is below the lower threshold
bound, fail when the lower energy bound reaches the upper threshold bound, and unknown in
between. So the noise test is decided only when rounding cannot change it
(`noise_enclosure_sound`), and adding a unit never helps a failing site (`noise_sum_ge_max`).
-/
import Ibasho.Spec.V2.Rules.Kleene

namespace Ibasho.Spec.V2

namespace Noise

/-- Fixed-point scale of the tables: `10^9`. -/
def tableScale : Nat := 1000000000

/-- `⌊10^(k/100) · 10^9⌋` for `k = 0..99`. The upper bound is the next integer. -/
def pow10LoTable : List Nat := [
  1000000000, 1023292992, 1047128548, 1071519305, 1096478196, 1122018454,
  1148153621, 1174897554, 1202264434, 1230268770, 1258925411, 1288249551,
  1318256738, 1348962882, 1380384264, 1412537544, 1445439770, 1479108388,
  1513561248, 1548816618, 1584893192, 1621810097, 1659586907, 1698243652,
  1737800828, 1778279410, 1819700858, 1862087136, 1905460717, 1949844599,
  1995262314, 2041737944, 2089296130, 2137962089, 2187761623, 2238721138,
  2290867652, 2344228815, 2398832919, 2454708915, 2511886431, 2570395782,
  2630267991, 2691534803, 2754228703, 2818382931, 2884031503, 2951209226,
  3019951720, 3090295432, 3162277660, 3235936569, 3311311214, 3388441561,
  3467368504, 3548133892, 3630780547, 3715352290, 3801893963, 3890451449,
  3981071705, 4073802778, 4168693834, 4265795188, 4365158322, 4466835921,
  4570881896, 4677351412, 4786300923, 4897788193, 5011872336, 5128613839,
  5248074602, 5370317963, 5495408738, 5623413251, 5754399373, 5888436553,
  6025595860, 6165950018, 6309573444, 6456542290, 6606934480, 6760829753,
  6918309709, 7079457843, 7244359600, 7413102413, 7585775750, 7762471166,
  7943282347, 8128305161, 8317637711, 8511380382, 8709635899, 8912509381,
  9120108393, 9332543007, 9549925860, 9772372209]

/-- `⌊10^0.705 · 10^9⌋`: the threshold `10^3.705 = 1000 · 10^0.705` (37.05 dB). -/
def thrLoN : Nat := 5069907082

/-- Every table entry brackets its root: `lo^100 ≤ 10^(k + 900) ≤ (lo + 1)^100`. -/
theorem pow10Table_correct :
    (List.range 100).all (fun k =>
      decide (pow10LoTable.getD k 0 ^ 100 ≤ 10 ^ (k + 900)) &&
      decide (10 ^ (k + 900) ≤ (pow10LoTable.getD k 0 + 1) ^ 100)) = true := by
  decide +kernel

theorem pow10Table_length : pow10LoTable.length = 100 := by decide +kernel

/-- The threshold brackets its root: `lo^200 ≤ 10^(141 + 1800) ≤ (lo + 1)^200`. -/
theorem thr_correct : thrLoN ^ 200 ≤ 10 ^ (141 + 1800) ∧ 10 ^ (141 + 1800) ≤ (thrLoN + 1) ^ 200 := by
  constructor <;> decide +kernel

/-! ## Rational enclosures -/

/-- `10^a` for an integer exponent, exact. -/
def pow10Int (a : Int) : Rat :=
  if 0 ≤ a then (10 : Rat) ^ a.toNat else 1 / (10 : Rat) ^ (-a).toNat

/-- Lower bound of `10^(m/100)`: `10^(m div 100) · lo(m mod 100) / 10^9`. -/
def p10Lo (m : Int) : Rat :=
  pow10Int (m / 100) * ((pow10LoTable.getD (m % 100).toNat 0 : Nat) : Rat) / (tableScale : Rat)

/-- Upper bound of `10^(m/100)`. -/
def p10Hi (m : Int) : Rat :=
  pow10Int (m / 100) * ((pow10LoTable.getD (m % 100).toNat 0 + 1 : Nat) : Rat) / (tableScale : Rat)

/-- `1/π` bounds from `333/106 < π < 355/113`. -/
def piInvLo : Rat := 113/355
def piInvHi : Rat := 106/333

/-- Bounds of the energy threshold `10^3.705`. -/
def thrLo : Rat := 1000 * (thrLoN : Rat) / (tableScale : Rat)
def thrHi : Rat := 1000 * ((thrLoN + 1 : Nat) : Rat) / (tableScale : Rat)

/-! ## Inputs -/

/-- How much of the unit the assessment position can see past a barrier. -/
inductive View where
  | hidden | partly | full
  deriving DecidableEq, Repr

/-- Barrier between unit and position (RP 6.1). -/
inductive Barrier where
  /-- No barrier. -/
  | none
  /-- Masonry or solid fence of at least 18 mm. -/
  | type1 (v : View)
  /-- Thinner solid fence. -/
  | type2 (v : View)
  deriving DecidableEq, Repr

/-- Barrier attenuation `A_B` in deci-decibels: type 1 is 10 / 5 / 0 dB, type 2 is 5 / 2.5 / 0. -/
def Barrier.attenuationDdB : Barrier → Int
  | .none => 0
  | .type1 .hidden => 100 | .type1 .partly => 50 | .type1 .full => 0
  | .type2 .hidden => 50 | .type2 .partly => 25 | .type2 .full => 0

/-- Directivity `Q` from the count of reflecting surfaces within 1 m; more than 3 fails. -/
def directivity : Nat → Option Nat
  | 1 => some 2
  | 2 => some 4
  | 3 => some 8
  | _ => none

/-- One unit seen from one assessment position. -/
structure UnitAt where
  /-- Sound power `LwA` in deci-decibels (60.0 dB is 600). -/
  lwaDdB : Int
  /-- Reflecting surfaces within 1 m of the unit. -/
  surfaces : Nat
  /-- Distance in decimetres, rounded to 0.1 m (8.0 m is 80); must be positive. -/
  rDm : Nat
  barrier : Barrier
  deriving DecidableEq, Repr

/-- Exponent of the energy term in hundredths of a decade: `LwA - A_B` in deci-decibels. -/
def UnitAt.expo (u : UnitAt) : Int := u.lwaDdB - u.barrier.attenuationDdB

/-- Exact rational geometric factor `25 Q / r_dm²` (the `Q / (4 r²)` part without `π`). -/
def UnitAt.geom (u : UnitAt) (q : Nat) : Rat := 25 * (q : Rat) / ((u.rDm * u.rDm : Nat) : Rat)

/-- Lower energy bound of one unit (zero when the input is outside the domain). -/
def UnitAt.eLo (u : UnitAt) : Rat :=
  match directivity u.surfaces with
  | some q => p10Lo u.expo * piInvLo * u.geom q
  | none => 0

/-- Upper energy bound of one unit. -/
def UnitAt.eHi (u : UnitAt) : Rat :=
  match directivity u.surfaces with
  | some q => p10Hi u.expo * piInvHi * u.geom q
  | none => 0

/-- Inputs the rule can judge: known directivity and a positive distance. -/
def UnitAt.inDomain (u : UnitAt) : Bool := (directivity u.surfaces).isSome && 0 < u.rDm

/-! ## The decision -/

/-- Three-valued test `Lp,total ≤ 37.0 dB(A)` after rounding, at one position. -/
def decidePosition (us : List UnitAt) : Tri :=
  if us.all UnitAt.inDomain then
    if (us.map UnitAt.eHi).sum < thrLo then .yes
    else if thrHi ≤ (us.map UnitAt.eLo).sum then .no
    else .unknown
  else .no

/-- The named function `mcs020a_Lp_le`: every assessment position passes. -/
def mcs020aLpLe (positions : List (List UnitAt)) : Tri :=
  positions.foldr (fun us acc => (decidePosition us).and acc) .yes

/-! ## Soundness -/

/-- Real values standing in for the transcendental constants. Over the reals the intended
valuation (`10^(m/100)`, `1/π`, `10^3.705`) is admissible by `pow10Table_correct`,
`thr_correct`, `root_enclosed` and `333/106 < π < 355/113`. -/
structure Valuation where
  pow10 : Int → Rat
  piInv : Rat
  thr : Rat

/-- The valuation lies inside every enclosure used by the checker. -/
structure Valuation.Admissible (V : Valuation) : Prop where
  pow10 : ∀ m, p10Lo m ≤ V.pow10 m ∧ V.pow10 m ≤ p10Hi m
  piInv : piInvLo ≤ V.piInv ∧ V.piInv ≤ piInvHi
  thr : thrLo ≤ V.thr ∧ V.thr ≤ thrHi

/-- The model energy of one unit under a valuation. -/
def UnitAt.energy (V : Valuation) (u : UnitAt) : Rat :=
  match directivity u.surfaces with
  | some q => V.pow10 u.expo * V.piInv * u.geom q
  | none => 0

private theorem inv_nonneg' {y : Rat} (hy : 0 ≤ y) : 0 ≤ y⁻¹ := by
  by_cases h0 : y = 0
  · rw [h0, Rat.inv_zero]; exact Rat.le_refl
  · exact Rat.le_of_lt (Rat.inv_pos.mpr (by grind))

private theorem div_nonneg' {x y : Rat} (hx : 0 ≤ x) (hy : 0 ≤ y) : 0 ≤ x / y := by
  rw [Rat.div_def]; exact Rat.mul_nonneg hx (inv_nonneg' hy)

private theorem div_le_div_right' {x x' y : Rat} (hy : 0 ≤ y) (h : x ≤ x') : x / y ≤ x' / y := by
  rw [Rat.div_def, Rat.div_def]; exact Rat.mul_le_mul_of_nonneg_right h (inv_nonneg' hy)

theorem pow10Int_nonneg (a : Int) : 0 ≤ pow10Int a := by
  unfold pow10Int
  split
  · exact Rat.pow_nonneg (by decide +kernel)
  · exact div_nonneg' (by decide +kernel) (Rat.pow_nonneg (by decide +kernel))

theorem p10Lo_nonneg (m : Int) : 0 ≤ p10Lo m := by
  unfold p10Lo
  refine div_nonneg' (Rat.mul_nonneg (pow10Int_nonneg _) ?_) (by decide +kernel)
  exact Rat.natCast_nonneg

theorem geom_nonneg (u : UnitAt) (q : Nat) : 0 ≤ u.geom q := by
  unfold UnitAt.geom
  exact div_nonneg' (Rat.mul_nonneg (by decide +kernel) Rat.natCast_nonneg) Rat.natCast_nonneg

private theorem mul_le_mul_nonneg {a a' b b' : Rat} (ha : 0 ≤ a) (hb : 0 ≤ b)
    (h₁ : a ≤ a') (h₂ : b ≤ b') : a * b ≤ a' * b' :=
  Rat.le_trans (Rat.mul_le_mul_of_nonneg_right h₁ hb)
    (Rat.mul_le_mul_of_nonneg_left h₂ (Rat.le_trans ha h₁))

theorem p10Lo_le_p10Hi (m : Int) : p10Lo m ≤ p10Hi m := by
  unfold p10Lo p10Hi
  apply div_le_div_right' (by decide +kernel)
  apply Rat.mul_le_mul_of_nonneg_left _ (pow10Int_nonneg _)
  generalize pow10LoTable.getD (m % 100).toNat 0 = k
  have : ((k + 1 : Nat) : Rat) = (k : Rat) + 1 := by simp
  rw [this]; grind

theorem eLo_le_eHi (u : UnitAt) : u.eLo ≤ u.eHi := by
  unfold UnitAt.eLo UnitAt.eHi
  split
  · exact Rat.mul_le_mul_of_nonneg_right
      (mul_le_mul_nonneg (p10Lo_nonneg _) (by decide +kernel) (p10Lo_le_p10Hi _) (by decide +kernel))
      (geom_nonneg _ _)
  · exact Rat.le_refl

/-- The admissibility hypothesis is satisfiable, so `noise_enclosure_sound` is not vacuous: the
valuation that takes every lower bound is admissible. -/
theorem Valuation.admissible_nonempty : ∃ V : Valuation, V.Admissible :=
  ⟨⟨p10Lo, piInvLo, thrLo⟩,
    ⟨fun m => ⟨Rat.le_refl, p10Lo_le_p10Hi m⟩, ⟨Rat.le_refl, by decide +kernel⟩,
      ⟨Rat.le_refl, by decide +kernel⟩⟩⟩

/-- Each unit's model energy lies inside its enclosure. -/
theorem energy_enclosed {V : Valuation} (hV : V.Admissible) (u : UnitAt) :
    u.eLo ≤ u.energy V ∧ u.energy V ≤ u.eHi := by
  unfold UnitAt.eLo UnitAt.eHi UnitAt.energy
  split
  · rename_i q _
    have hp := hV.pow10 u.expo
    have hpi := hV.piInv
    have h0 := p10Lo_nonneg u.expo
    have hpl : (0 : Rat) ≤ piInvLo := by decide +kernel
    have hg := geom_nonneg u q
    constructor
    · exact Rat.mul_le_mul_of_nonneg_right (mul_le_mul_nonneg h0 hpl hp.1 hpi.1) hg
    · exact Rat.mul_le_mul_of_nonneg_right
        (mul_le_mul_nonneg (Rat.le_trans h0 hp.1) (Rat.le_trans hpl hpi.1) hp.2 hpi.2) hg
  · exact ⟨Rat.le_refl, Rat.le_refl⟩

theorem energy_nonneg {V : Valuation} (hV : V.Admissible) (u : UnitAt) : 0 ≤ u.energy V := by
  have := (energy_enclosed hV u).1
  refine Rat.le_trans ?_ this
  unfold UnitAt.eLo
  split
  · exact Rat.mul_nonneg (Rat.mul_nonneg (p10Lo_nonneg _) (by decide +kernel)) (geom_nonneg _ _)
  · exact Rat.le_refl

private theorem sum_le_sum {us : List UnitAt} {f g : UnitAt → Rat} (h : ∀ u, f u ≤ g u) :
    (us.map f).sum ≤ (us.map g).sum := by
  induction us with
  | nil => exact Rat.le_refl
  | cons u us ih =>
    simp only [List.map_cons, List.sum_cons]
    have := h u
    grind

private theorem sum_nonneg' {us : List UnitAt} {f : UnitAt → Rat} (h : ∀ u, 0 ≤ f u) :
    0 ≤ (us.map f).sum := by
  induction us with
  | nil => exact Rat.le_refl
  | cons u us ih =>
    simp only [List.map_cons, List.sum_cons]
    have := h u
    grind

/-- Decided only when rounding cannot change it: a `yes` means the rounded level is at most
37.0 dB(A) for every admissible valuation, a `no` means it is above for every one. -/
theorem noise_enclosure_sound (us : List UnitAt) :
    (decidePosition us = .yes → ∀ V : Valuation, V.Admissible → (us.map (UnitAt.energy V)).sum < V.thr) ∧
    (decidePosition us = .no → us.all UnitAt.inDomain = true →
      ∀ V : Valuation, V.Admissible → V.thr ≤ (us.map (UnitAt.energy V)).sum) := by
  constructor
  · intro h V hV
    unfold decidePosition at h
    split at h
    · split at h
      · rename_i hlt
        have := sum_le_sum (us := us) (fun u => (energy_enclosed hV u).2)
        have := hV.thr.1
        grind
      · split at h <;> cases h
    · cases h
  · intro h hdom V hV
    unfold decidePosition at h
    rw [ite_eq_left hdom] at h
    split at h
    · cases h
    · split at h
      · rename_i hge
        have := sum_le_sum (us := us) (fun u => (energy_enclosed hV u).1)
        have := hV.thr.2
        grind
      · cases h

private theorem sum_mono_cons {u : UnitAt} {us : List UnitAt} {f : UnitAt → Rat} (h : 0 ≤ f u) :
    (us.map f).sum ≤ ((u :: us).map f).sum := by
  simp only [List.map_cons, List.sum_cons]
  grind

theorem eLo_nonneg (u : UnitAt) : 0 ≤ u.eLo := by
  unfold UnitAt.eLo
  split
  · exact Rat.mul_nonneg (Rat.mul_nonneg (p10Lo_nonneg _) (by decide +kernel)) (geom_nonneg _ _)
  · exact Rat.le_refl

/-- `Lp,total ≥ max(Lp1, Lp2)` on the energy scale: the total is at least every unit. -/
theorem noise_sum_ge_max {V : Valuation} (hV : V.Admissible) (us : List UnitAt) :
    ∀ u ∈ us, u.energy V ≤ (us.map (UnitAt.energy V)).sum := by
  induction us with
  | nil => intro u hu; cases hu
  | cons x xs ih =>
    intro u hu
    simp only [List.map_cons, List.sum_cons]
    have hx := energy_nonneg hV x
    have hs : 0 ≤ (xs.map (UnitAt.energy V)).sum := sum_nonneg' (energy_nonneg hV)
    rcases List.mem_cons.mp hu with rfl | hu
    · grind
    · have := ih u hu; grind

/-- Adding a unit never helps a failing position. -/
theorem noise_add_unit_fails (u : UnitAt) (us : List UnitAt) (h : decidePosition us = .no) :
    decidePosition (u :: us) = .no := by
  unfold decidePosition at h ⊢
  by_cases hd : (u :: us).all UnitAt.inDomain = true
  · rw [ite_eq_left hd]
    have hd' : us.all UnitAt.inDomain = true := by
      simp only [List.all_cons, Bool.and_eq_true] at hd; exact hd.2
    rw [ite_eq_left hd'] at h
    split at h
    · cases h
    · split at h
      · rename_i _ h2
        have hm := sum_mono_cons (us := us) (f := UnitAt.eLo) (eLo_nonneg u)
        have hle := sum_le_sum (us := u :: us) (f := UnitAt.eLo) (g := UnitAt.eHi) eLo_le_eHi
        have ht : thrLo < thrHi := by decide +kernel
        have hnot : ¬ ((u :: us).map UnitAt.eHi).sum < thrLo := by grind
        have hyes : thrHi ≤ ((u :: us).map UnitAt.eLo).sum := Rat.le_trans h2 hm
        simp only [hnot, hyes, ↓reduceIte]
      · cases h
  · simp only [hd, Bool.false_eq_true, ↓reduceIte]

/-- A failing position fails the whole site. -/
theorem mcs020a_fails_of_position (ps : List (List UnitAt)) (us : List UnitAt) (hm : us ∈ ps)
    (h : decidePosition us = .no) : mcs020aLpLe ps = .no := by
  induction ps with
  | nil => cases hm
  | cons p ps ih =>
    simp only [mcs020aLpLe, List.foldr_cons] at ih ⊢
    rcases List.mem_cons.mp hm with rfl | hm
    · rw [h]; rfl
    · rw [ih hm]; cases decidePosition p <;> rfl

/-! ## Roots are pinned by their powers -/

private theorem pow_lt_pow_of_lt {a b : Rat} (ha : 0 ≤ a) (h : a < b) :
    ∀ n : Nat, 0 < n → a ^ n < b ^ n
  | 0, hn => absurd hn (Nat.lt_irrefl 0)
  | 1, _ => by simpa using h
  | n + 2, _ => by
    have ih := pow_lt_pow_of_lt ha h (n + 1) (by omega)
    rw [Rat.pow_succ a (n + 1), Rat.pow_succ b (n + 1)]
    have hbn : 0 < b ^ (n + 1) := by have := Rat.pow_nonneg (n := n + 1) ha; grind
    have h1 := Rat.mul_le_mul_of_nonneg_right (Rat.le_of_lt ih) ha
    have h2 := Rat.mul_lt_mul_of_pos_left h hbn
    grind

/-- A nonnegative number whose `n`-th power lies between `lo^n` and `hi^n` lies between `lo` and
`hi`. Applied to the tables, the root `10^(k/100)` lies inside its enclosure. -/
theorem root_enclosed {lo hi x : Rat} {n : Nat} (hn : 0 < n) (hhi : 0 ≤ hi) (hx : 0 ≤ x)
    (h₁ : lo ^ n ≤ x ^ n) (h₂ : x ^ n ≤ hi ^ n) : lo ≤ x ∧ x ≤ hi := by
  constructor
  · apply Rat.not_lt.mp
    intro hlt
    exact absurd h₁ (Rat.not_le.mpr (pow_lt_pow_of_lt hx hlt n hn))
  · apply Rat.not_lt.mp
    intro hlt
    exact absurd h₂ (Rat.not_le.mpr (pow_lt_pow_of_lt hhi hlt n hn))

/-! ## Golden test (RP 6.1 worked example) -/

-- `LwA 60, Q 4, r 8.0 m, brick wall partial view` gives 32.0 dB(A): a clear pass.
#guard decidePosition [⟨600, 2, 80, .type1 .partly⟩] == .yes
-- `LwA 45.0, Q 2, r 1.0 m`: 37.02 dB(A), rounds to 37.0, passes.
#guard decidePosition [⟨450, 1, 10, .none⟩] == .yes
-- `LwA 45.1, Q 2, r 1.0 m`: 37.12 dB(A), rounds to 37.1, fails.
#guard decidePosition [⟨451, 1, 10, .none⟩] == .no
-- Four reflecting surfaces fail outright.
#guard decidePosition [⟨300, 4, 80, .none⟩] == .no
-- Two quiet units can fail together where each alone passes.
#guard decidePosition [⟨440, 1, 10, .none⟩] == .yes && decidePosition [⟨440, 1, 10, .none⟩, ⟨440, 1, 10, .none⟩] == .no

end Noise

end Ibasho.Spec.V2
