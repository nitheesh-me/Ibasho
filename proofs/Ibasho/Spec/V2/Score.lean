/-
Ibasho spec V2: the Green Home Score (SPEC R2, R4, R5, section 8; SF 2.1 to 2.4). Owner: WP-04.

Normative definitions of `score.sub.<dim>`, `score.group.<g>` and `score.total`, in exact
rationals (SPEC R20: the score uses exact rationals, seven terms). The TS engine computes the
same values with `Q` from `@ibasho/core`; the certificate check `score.recompute` compares them.

* Seven dimensions F, C, E, A, H, R, T with weights 1/5, 1/5, 3/20, 3/20, 1/10, 1/10, 1/10.
* Four display groups: Fabric and heating (F, H), Running cost (A, E), Carbon (C, R),
  Comfort (T).
* Normaliser, lower is better: `s = 100 · clamp((worst - x) / (worst - best), 0, 1)`; higher is
  better is mirrored. Anchors come per climate pack and must pass `AnchorsValid`.
* R and T are composites built from the same clamp, so the same lemmas apply.

What is proved: weights sum to one, every sub-score, group and total lies in [0, 100], and a
home that is at least as good on every indicator never scores lower. What is not proved: that
any particular measure improves every indicator (a heat pump can raise cost and cut carbon).
-/

namespace Ibasho.Spec.V2

/-- Score dimensions, in TS `SCORE_DIMS` order. -/
inductive Dim where
  | F | C | E | A | H | R | T
  deriving DecidableEq, Repr

/-- Every dimension, in wire order. -/
def Dim.all : List Dim := [.F, .C, .E, .A, .H, .R, .T]

theorem Dim.mem_all (d : Dim) : d ∈ Dim.all := by cases d <;> decide

/-- SPEC R2 weights, exact. Single source of truth for `SCORE_WEIGHTS`. -/
def weight : Dim → Rat
  | .F => 1/5 | .C => 1/5 | .E => 3/20 | .A => 3/20 | .H => 1/10 | .R => 1/10 | .T => 1/10

theorem weights_sum_one : (Dim.all.map weight).sum = 1 := by decide +kernel

theorem weight_nonneg (d : Dim) : 0 ≤ weight d := by cases d <;> decide +kernel

/-- Display groups (TS `SCORE_GROUPS`). -/
inductive Group where
  | fabricHeating | runningCost | carbon | comfort
  deriving DecidableEq, Repr

def Group.all : List Group := [.fabricHeating, .runningCost, .carbon, .comfort]

/-- The dimensions of each group, in TS order. -/
def Group.dims : Group → List Dim
  | .fabricHeating => [.F, .H]
  | .runningCost => [.A, .E]
  | .carbon => [.C, .R]
  | .comfort => [.T]

/-- The group of a dimension. -/
def Dim.group : Dim → Group
  | .F | .H => .fabricHeating
  | .A | .E => .runningCost
  | .C | .R => .carbon
  | .T => .comfort

/-- Groups partition the dimensions: each dimension sits in exactly its own group. -/
theorem group_partition (d : Dim) (g : Group) : d ∈ g.dims ↔ d.group = g := by
  cases d <;> cases g <;> decide

/-- Weight of a group: the sum of its dimension weights. -/
def groupWeight (g : Group) : Rat := (g.dims.map weight).sum

theorem groupWeight_values :
    groupWeight .fabricHeating = 3/10 ∧ groupWeight .runningCost = 3/10 ∧
    groupWeight .carbon = 3/10 ∧ groupWeight .comfort = 1/10 := by
  refine ⟨?_, ?_, ?_, ?_⟩ <;> decide +kernel

theorem groupWeights_sum_one : (Group.all.map groupWeight).sum = 1 := by decide +kernel

theorem groupWeight_pos (g : Group) : 0 < groupWeight g := by cases g <;> decide +kernel

/-! ## Clamp -/

/-- `clamp(x, 0, 1)`. -/
def clamp01 (x : Rat) : Rat := max 0 (min 1 x)

theorem clamp01_nonneg (x : Rat) : 0 ≤ clamp01 x := by unfold clamp01; grind
theorem clamp01_le_one (x : Rat) : clamp01 x ≤ 1 := by unfold clamp01; grind
theorem clamp01_mono {x y : Rat} (h : x ≤ y) : clamp01 x ≤ clamp01 y := by unfold clamp01; grind

/-! ## Anchors and normalisers -/

/-- Whether a lower indicator value is better (F, C, E, A, T) or a higher one (H, R). T is
entered as hours-based composite `tComposite`, which is higher-is-better, so see `Dim.dir`. -/
inductive Dir where
  | lower | higher
  deriving DecidableEq, Repr

/-- Direction of each indicator as stored in `Indicators`. R and T are stored as their
composites (`rComposite`, `tComposite`), both higher-is-better with anchors worst 0, best 1. -/
def Dim.dir : Dim → Dir
  | .F | .C | .E | .A => .lower
  | .H | .R | .T => .higher

/-- Climate-pack anchors for one indicator. -/
structure Anchor where
  best : Rat
  worst : Rat
  deriving DecidableEq, Repr

/-- An anchor is valid when `best` is strictly better than `worst` in the indicator's
direction (SF 2.4 `anchors_valid`): the normaliser then divides by a positive span. -/
def Anchor.Valid (dir : Dir) (a : Anchor) : Prop :=
  match dir with
  | .lower => a.best < a.worst
  | .higher => a.worst < a.best

instance (dir : Dir) (a : Anchor) : Decidable (a.Valid dir) := by
  cases dir <;> unfold Anchor.Valid <;> infer_instance

/-- Positive distance from worst to best. -/
def Anchor.span (dir : Dir) (a : Anchor) : Rat :=
  match dir with
  | .lower => a.worst - a.best
  | .higher => a.best - a.worst

/-- How far `x` is from worst towards best. -/
def Anchor.gain (dir : Dir) (a : Anchor) (x : Rat) : Rat :=
  match dir with
  | .lower => a.worst - x
  | .higher => x - a.worst

/-- The normaliser on [0, 1]: `clamp(gain / span, 0, 1)`. -/
def Anchor.unit (dir : Dir) (a : Anchor) (x : Rat) : Rat :=
  clamp01 (a.gain dir x * (a.span dir)⁻¹)

theorem Anchor.span_pos {dir : Dir} {a : Anchor} (h : a.Valid dir) : 0 < a.span dir := by
  cases dir <;> simp only [Anchor.Valid, Anchor.span] at * <;> grind

/-- `x'` is at least as good as `x` in direction `dir`. -/
def Dir.AtLeastAsGood (dir : Dir) (x x' : Rat) : Prop :=
  match dir with
  | .lower => x' ≤ x
  | .higher => x ≤ x'

/-- A normaliser never lowers a sub-score when the indicator improves. -/
theorem Anchor.unit_mono {dir : Dir} {a : Anchor} (hv : a.Valid dir) {x x' : Rat}
    (h : dir.AtLeastAsGood x x') : a.unit dir x ≤ a.unit dir x' := by
  unfold Anchor.unit
  apply clamp01_mono
  have hs := Rat.le_of_lt (Rat.inv_pos.mpr (Anchor.span_pos hv))
  apply Rat.mul_le_mul_of_nonneg_right _ hs
  cases dir <;> simp only [Dir.AtLeastAsGood, Anchor.gain] at * <;> grind

/-- Lower-is-better normaliser: `subscore_antitone` of SF 2.4. -/
theorem subscore_antitone {a : Anchor} (hv : a.Valid .lower) {x x' : Rat} (h : x ≤ x') :
    a.unit .lower x' ≤ a.unit .lower x :=
  Anchor.unit_mono hv h

/-- The normaliser reaches 100 at the best anchor and 0 at the worst. -/
theorem Anchor.unit_best {dir : Dir} {a : Anchor} (hv : a.Valid dir) : a.unit dir a.best = 1 := by
  unfold Anchor.unit
  have hne : a.span dir ≠ 0 := Rat.ne_of_gt (Anchor.span_pos hv)
  have : a.gain dir a.best = a.span dir := by cases dir <;> rfl
  rw [this, Rat.mul_inv_cancel _ hne]
  decide +kernel

theorem Anchor.unit_worst (dir : Dir) (a : Anchor) : a.unit dir a.worst = 0 := by
  unfold Anchor.unit
  have : a.gain dir a.worst = 0 := by cases dir <;> exact Rat.sub_self
  rw [this, Rat.zero_mul]
  decide +kernel

/-! ## Composite indicators R and T (SF 2.2) -/

/-- R: `0.75 · min(1, f_ren / f_target) + 0.25 · k_smart / 4`, with `k_smart` clamped to 0..4. -/
def rComposite (fRen fTarget kSmart : Rat) : Rat :=
  3/4 * min 1 (fRen * fTarget⁻¹) + 1/16 * max 0 (min kSmart 4)

/-- T: `1 - 0.6 · h_hot / H_hot - 0.4 · h_cold / H_cold` (hours; lower hours are better). -/
def tComposite (hHot hCold capHot capCold : Rat) : Rat :=
  1 - 3/5 * (hHot * capHot⁻¹) - 2/5 * (hCold * capCold⁻¹)

/-- More renewables or more smart-readiness points never lower R. -/
theorem rComposite_mono {fRen fRen' fTarget k k' : Rat} (ht : 0 < fTarget)
    (hf : fRen ≤ fRen') (hk : k ≤ k') : rComposite fRen fTarget k ≤ rComposite fRen' fTarget k' := by
  unfold rComposite
  have hi := Rat.le_of_lt (Rat.inv_pos.mpr ht)
  have h1 := Rat.mul_le_mul_of_nonneg_right hf hi
  grind

/-- Fewer overheating or cold hours never lower T. -/
theorem tComposite_mono {hHot hHot' hCold hCold' capHot capCold : Rat}
    (hcH : 0 < capHot) (hcC : 0 < capCold) (h1 : hHot' ≤ hHot) (h2 : hCold' ≤ hCold) :
    tComposite hHot hCold capHot capCold ≤ tComposite hHot' hCold' capHot capCold := by
  unfold tComposite
  have a := Rat.mul_le_mul_of_nonneg_right h1 (Rat.le_of_lt (Rat.inv_pos.mpr hcH))
  have b := Rat.mul_le_mul_of_nonneg_right h2 (Rat.le_of_lt (Rat.inv_pos.mpr hcC))
  grind

/-! ## Sub-scores, groups and total -/

/-- Indicator values of one home, after quantisation to milli-units (SPEC 8). -/
abbrev Indicators := Dim → Rat

/-- Anchors of one climate pack (with the A mode fixed per home, SF 2.2). -/
abbrev Anchors := Dim → Anchor

/-- Every anchor of a pack is valid in its dimension's direction. -/
def AnchorsValid (an : Anchors) : Prop := ∀ d, (an d).Valid d.dir

instance (an : Anchors) : Decidable (AnchorsValid an) :=
  decidable_of_iff (∀ d ∈ Dim.all, (an d).Valid d.dir)
    ⟨fun h d => h d (Dim.mem_all d), fun h d _ => h d⟩

/-- Unit sub-score in [0, 1]. -/
def unitScore (an : Anchors) (ind : Indicators) (d : Dim) : Rat := (an d).unit d.dir (ind d)

/-- `score.sub.<dim>` on 0 to 100. -/
def subScore (an : Anchors) (ind : Indicators) (d : Dim) : Rat := 100 * unitScore an ind d

/-- Weighted sum of unit sub-scores over a list of dimensions. -/
def weightedSum (an : Anchors) (ind : Indicators) (ds : List Dim) : Rat :=
  (ds.map fun d => weight d * unitScore an ind d).sum

/-- `score.total` on 0 to 100. -/
def score (an : Anchors) (ind : Indicators) : Rat := 100 * weightedSum an ind Dim.all

/-- `score.group.<g>` on 0 to 100: the weighted mean of the group's sub-scores. -/
def groupScore (an : Anchors) (ind : Indicators) (g : Group) : Rat :=
  100 * (weightedSum an ind g.dims * (groupWeight g)⁻¹)

theorem unitScore_bounds (an : Anchors) (ind : Indicators) (d : Dim) :
    0 ≤ unitScore an ind d ∧ unitScore an ind d ≤ 1 :=
  ⟨clamp01_nonneg _, clamp01_le_one _⟩

theorem subscore_bounds (an : Anchors) (ind : Indicators) (d : Dim) :
    0 ≤ subScore an ind d ∧ subScore an ind d ≤ 100 := by
  have := unitScore_bounds an ind d
  unfold subScore; grind

theorem weightedSum_bounds (an : Anchors) (ind : Indicators) (ds : List Dim) :
    0 ≤ weightedSum an ind ds ∧ weightedSum an ind ds ≤ (ds.map weight).sum := by
  induction ds with
  | nil => simp [weightedSum]
  | cons d ds ih =>
    simp only [weightedSum, List.map_cons, List.sum_cons] at *
    have hb := unitScore_bounds an ind d
    have h0 := Rat.mul_nonneg (weight_nonneg d) hb.1
    have h1 := Rat.mul_le_mul_of_nonneg_left hb.2 (weight_nonneg d)
    rw [Rat.mul_one] at h1
    grind

/-- The total score is always between 0 and 100. -/
theorem score_bounds (an : Anchors) (ind : Indicators) : 0 ≤ score an ind ∧ score an ind ≤ 100 := by
  have := weightedSum_bounds an ind Dim.all
  rw [weights_sum_one] at this
  unfold score; grind

theorem score_nonneg (an : Anchors) (ind : Indicators) : 0 ≤ score an ind := (score_bounds an ind).1
theorem score_le_100 (an : Anchors) (ind : Indicators) : score an ind ≤ 100 := (score_bounds an ind).2

/-- Each group score is between 0 and 100. -/
theorem groupScore_bounds (an : Anchors) (ind : Indicators) (g : Group) :
    0 ≤ groupScore an ind g ∧ groupScore an ind g ≤ 100 := by
  have hb := weightedSum_bounds an ind g.dims
  have hp := groupWeight_pos g
  have hi := Rat.le_of_lt (Rat.inv_pos.mpr hp)
  have h0 := Rat.mul_nonneg hb.1 hi
  have h1 := Rat.mul_le_mul_of_nonneg_right hb.2 hi
  have e : (g.dims.map weight).sum * (groupWeight g)⁻¹ = 1 :=
    Rat.mul_inv_cancel _ (Rat.ne_of_gt hp)
  rw [e] at h1
  unfold groupScore; grind

/-- The total is the group-weighted mean of the four group scores. -/
theorem score_eq_groups (an : Anchors) (ind : Indicators) :
    score an ind = (Group.all.map fun g => groupWeight g * groupScore an ind g).sum := by
  have h : ∀ g, groupWeight g * groupScore an ind g = 100 * weightedSum an ind g.dims := by
    intro g
    unfold groupScore
    have e : groupWeight g * (groupWeight g)⁻¹ = 1 :=
      Rat.mul_inv_cancel _ (Rat.ne_of_gt (groupWeight_pos g))
    grind
  simp only [Group.all, List.map_cons, List.map_nil, List.sum_cons, List.sum_nil, h]
  simp only [score, weightedSum, Dim.all, Group.dims, List.map_cons, List.map_nil,
    List.sum_cons, List.sum_nil]
  grind

/-- Indicator dominance: `ind'` is at least as good as `ind` on every dimension. -/
def Dominated (ind ind' : Indicators) : Prop := ∀ d : Dim, d.dir.AtLeastAsGood (ind d) (ind' d)

theorem weightedSum_mono {an : Anchors} (hv : AnchorsValid an) (ds : List Dim)
    {ind ind' : Indicators} (h : Dominated ind ind') :
    weightedSum an ind ds ≤ weightedSum an ind' ds := by
  induction ds with
  | nil => simp [weightedSum]
  | cons d ds ih =>
    simp only [weightedSum, List.map_cons, List.sum_cons] at *
    have := Rat.mul_le_mul_of_nonneg_left (Anchor.unit_mono (hv d) (h d)) (weight_nonneg d)
    simp only [unitScore] at *
    grind

/-- A home at least as good on every indicator never scores lower (SF 2.4 `score_monotone`). -/
theorem score_monotone {an : Anchors} (hv : AnchorsValid an) {ind ind' : Indicators}
    (h : Dominated ind ind') : score an ind ≤ score an ind' := by
  have := weightedSum_mono hv Dim.all h
  unfold score; grind

/-- The same holds for every group score. -/
theorem groupScore_monotone {an : Anchors} (hv : AnchorsValid an) {ind ind' : Indicators}
    (h : Dominated ind ind') (g : Group) : groupScore an ind g ≤ groupScore an ind' g := by
  have a := weightedSum_mono hv g.dims h
  have b := Rat.mul_le_mul_of_nonneg_right a (Rat.le_of_lt (Rat.inv_pos.mpr (groupWeight_pos g)))
  unfold groupScore; grind

/-! ## Climate-pack anchors (SF 2.3, v1 defaults) -/

/-- Mode of the A indicator, fixed per home (SF 2.2). -/
inductive AMode where
  /-- Net energy cost as a share of net household income. -/
  | burden
  /-- Net energy cost per m² per year, in pounds or rupees. -/
  | perArea
  deriving DecidableEq, Repr

/-- UK pack anchors. F in W/m²K, C in kgCO2e/m²yr, E in kWh/m²yr, H as primary efficiency. -/
def ukAnchors (mode : AMode) : Anchors
  | .F => ⟨4/5, 4⟩
  | .C => ⟨0, 80⟩
  | .E => ⟨40, 400⟩
  | .A => match mode with
    | .burden => ⟨1/50, 3/25⟩
    | .perArea => ⟨6, 40⟩
  | .H => ⟨5/2, 2/5⟩
  | .R => ⟨1, 0⟩
  | .T => ⟨1, 0⟩

/-- India pack anchors (warm-humid and composite zones). -/
def inAnchors (mode : AMode) : Anchors
  | .F => ⟨3/5, 3⟩
  | .C => ⟨0, 60⟩
  | .E => ⟨10, 120⟩
  | .A => match mode with
    | .burden => ⟨1/50, 3/25⟩
    | .perArea => ⟨40, 400⟩
  | .H => ⟨5/2, 2/5⟩
  | .R => ⟨1, 0⟩
  | .T => ⟨1, 0⟩

/-- Every shipped anchor set is valid (SF 2.4 `anchors_valid`). -/
theorem anchors_valid :
    AnchorsValid (ukAnchors .burden) ∧ AnchorsValid (ukAnchors .perArea) ∧
    AnchorsValid (inAnchors .burden) ∧ AnchorsValid (inAnchors .perArea) := by
  refine ⟨?_, ?_, ?_, ?_⟩ <;> decide +kernel

/-- R targets and T caps per pack (SF 2.3). -/
def ukRTarget : Rat := 1/2
def inRTarget : Rat := 4/5
def ukTCaps : Rat × Rat := (300, 1000)
def inTCaps : Rat × Rat := (600, 200)

/-! ## Estimated EPC band (SPEC 8, R3) -/

/-- SAP bands. `A` threshold 92 is flagged in SPEC 8. -/
inductive Band where
  | G | F | E | D | C | B | A
  deriving DecidableEq, Repr

/-- Rank of a band: G is 0, A is 6. -/
def Band.rank : Band → Nat
  | .G => 0 | .F => 1 | .E => 2 | .D => 3 | .C => 4 | .B => 5 | .A => 6

/-- Band from a SAP rating: A ≥ 92, B ≥ 81, C ≥ 69, D ≥ 55, E ≥ 39, F ≥ 21, else G. -/
def sapBand (sap : Rat) : Band :=
  if 92 ≤ sap then .A else if 81 ≤ sap then .B else if 69 ≤ sap then .C
  else if 55 ≤ sap then .D else if 39 ≤ sap then .E else if 21 ≤ sap then .F else .G

/-- A higher SAP rating never gives a worse band. -/
theorem band_monotone {s s' : Rat} (h : s ≤ s') : (sapBand s).rank ≤ (sapBand s').rank := by
  unfold sapBand
  repeat' split
  all_goals first | decide | (exfalso; grind)

/-! ## Spot checks -/

#guard weight .F + weight .C + weight .E + weight .A + weight .H + weight .R + weight .T == 1
#guard (ukAnchors .burden .F).unit .lower 4 == 0 && (ukAnchors .burden .F).unit .lower (4/5) == 1
#guard (ukAnchors .burden .F).unit .lower (12/5) == 1/2
#guard sapBand 68 == .D && sapBand 69 == .C && sapBand 92 == .A && sapBand 20 == .G

end Ibasho.Spec.V2
