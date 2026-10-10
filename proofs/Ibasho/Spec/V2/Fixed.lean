/-
Ibasho spec V2: fixed-point bookkeeping (SPEC 7.4, R20, DEC TE-4). Owner: WP-04.

Normative text. The TypeScript mirror is `packages/core/src/fixed/index.ts`; every function
here has a TS twin with the same name, and the two must agree bit for bit.

Units after quantisation: energy in integer Wh, carbon in integer gCO2e, money in integer
micro-pence (micro-paise for INR). Rates are integer parts per billion (ppb): 3.5% is
35_000_000. Discount and growth factors are integers scaled by 10^12.

Named rounding points (each one is a call to `roundHalfEven` or `divRound`):
* `discountStep`  D_t = roundHalfEven(D_{t-1} * 10^9, 10^9 + r)
* `growthStep`    G_t = roundHalfEven(G_{t-1} * (10^9 + g), 10^9)
* `applyFactor`   roundHalfEven(amount * factor, 10^12)
* `mulDiv`        roundHalfEven(a * b, d), one rounding at the end
-/

namespace Ibasho.Spec.V2

/-- Scale of discount and growth factors: `10^12` means 1. -/
def dfScale : Int := 1000000000000

/-- One whole in parts per billion. -/
def ppb : Int := 1000000000

theorem dfScale_pos : 0 < dfScale := by decide
theorem ppb_pos : 0 < ppb := by decide

/-! ## Rounding -/

/--
`n / d` rounded to the nearest integer, ties to even (banker's rounding). Defined for every
sign of `n` and `d`. The value at `d = 0` is `0`; that point is outside the domain and the TS
twin throws there.
-/
def roundHalfEven (n d : Int) : Int :=
  if d = 0 then 0
  else if d < 0 then roundHalfEvenPos (-n) (-d)
  else roundHalfEvenPos n d
where
  /-- The positive-divisor case. `/` and `%` on `Int` are Euclidean, so with `d > 0` the
  quotient is the floor and `0 ≤ r < d`. -/
  roundHalfEvenPos (n d : Int) : Int :=
    let q := n / d
    let r := n % d
    if d < 2 * r then q + 1
    else if 2 * r < d then q
    else if q % 2 = 0 then q else q + 1

/-- Rounding modes of `divRound` (TS `RoundingMode`). -/
inductive RoundingMode where
  | halfEven | floor | ceil | trunc
  deriving DecidableEq, Repr

/-- Floor division for any nonzero divisor sign (TS `floorDiv`). -/
def floorDiv (n d : Int) : Int :=
  if d < 0 then (-n) / (-d) else n / d

/-- `n / d` with an explicit rounding mode (TS `divRound`). -/
def divRound (n d : Int) : RoundingMode → Int
  | .halfEven => roundHalfEven n d
  | .floor => floorDiv n d
  | .ceil => -floorDiv (-n) d
  | .trunc => n.tdiv d

/-- `a * b / d`, rounded once at the end; the product is exact (TS `mulDiv`). -/
def mulDiv (a b d : Int) (mode : RoundingMode := .halfEven) : Int :=
  divRound (a * b) d mode

/-- Apply a `10^12`-scaled factor to an amount (TS `applyFactor`). -/
def applyFactor (amount factor : Int) : Int :=
  roundHalfEven (amount * factor) dfScale

/-! ## The rounding specification

For `d > 0`, `q = roundHalfEven n d` is the unique integer with
`-d ≤ 2 (n - q d) ≤ d` (nearest) that is even whenever `2 (n - q d) = ± d` (ties to even).
-/

/-- The normative property of half-even rounding for a positive divisor. -/
def IsHalfEven (n d q : Int) : Prop :=
  -d ≤ 2 * (n - q * d) ∧ 2 * (n - q * d) ≤ d ∧
  ((2 * (n - q * d) = d ∨ 2 * (n - q * d) = -d) → q % 2 = 0)

private theorem div_mod_facts (n d : Int) (hd : 0 < d) :
    n = d * (n / d) + n % d ∧ 0 ≤ n % d ∧ n % d < d :=
  ⟨(Int.mul_ediv_add_emod n d).symm, Int.emod_nonneg n (by omega), Int.emod_lt_of_pos n hd⟩

theorem roundHalfEvenPos_spec (n d : Int) (hd : 0 < d) :
    IsHalfEven n d (roundHalfEven.roundHalfEvenPos n d) := by
  obtain ⟨h1, h2, h3⟩ := div_mod_facts n d hd
  unfold roundHalfEven.roundHalfEvenPos IsHalfEven
  generalize n / d = q at *
  generalize n % d = r at *
  have e1 : n - (q + 1) * d = r - d := by rw [Int.add_mul, Int.one_mul, Int.mul_comm q d]; omega
  have e0 : n - q * d = r := by rw [Int.mul_comm q d]; omega
  simp only
  split
  · rw [e1]; exact ⟨by omega, by omega, fun h => by omega⟩
  · split
    · rw [e0]; exact ⟨by omega, by omega, fun h => by omega⟩
    · split
      · rw [e0]; exact ⟨by omega, by omega, fun _ => by assumption⟩
      · rw [e1]
        refine ⟨by omega, by omega, fun _ => ?_⟩
        omega

/-- Rounding meets its specification for every positive divisor. -/
theorem roundHalfEven_spec (n d : Int) (hd : 0 < d) : IsHalfEven n d (roundHalfEven n d) := by
  unfold roundHalfEven
  simp only [show ¬ d = 0 by omega, show ¬ d < 0 by omega, ↓reduceIte]
  exact roundHalfEvenPos_spec n d hd

private theorem mul_step {a b d : Int} (hd : 0 < d) (h : a + 1 ≤ b) : a * d + d ≤ b * d := by
  have := Int.mul_le_mul_of_nonneg_right h (Int.le_of_lt hd)
  rw [Int.add_mul, Int.one_mul] at this
  exact this

private theorem unique_aux {n d q₁ q₂ : Int} (hd : 0 < d)
    (h₁ : IsHalfEven n d q₁) (h₂ : IsHalfEven n d q₂) (h : q₁ < q₂) : False := by
  obtain ⟨a1, b1, c1⟩ := h₁
  obtain ⟨a2, b2, c2⟩ := h₂
  by_cases h2 : q₁ + 2 ≤ q₂
  · have s2 := mul_step hd (show q₁ + 1 + 1 ≤ q₂ by omega)
    rw [Int.add_mul, Int.one_mul] at s2
    generalize q₁ * d = X1 at *
    generalize q₂ * d = X2 at *
    omega
  · have hq : q₂ = q₁ + 1 := by omega
    subst hq
    rw [Int.add_mul, Int.one_mul] at a2 b2 c2
    generalize q₁ * d = X1 at *
    have e1 := c1 (by omega)
    have e2 := c2 (by omega)
    omega

/-- The specification has exactly one solution, so it fully determines the rounding. -/
theorem IsHalfEven.unique {n d q₁ q₂ : Int} (hd : 0 < d)
    (h₁ : IsHalfEven n d q₁) (h₂ : IsHalfEven n d q₂) : q₁ = q₂ := by
  rcases Int.lt_trichotomy q₁ q₂ with h | h | h
  · exact (unique_aux hd h₁ h₂ h).elim
  · exact h
  · exact (unique_aux hd h₂ h₁ h).elim

/-- Characterisation: for `d > 0`, `q = roundHalfEven n d` iff `q` meets the specification. -/
theorem roundHalfEven_eq_iff (n d q : Int) (hd : 0 < d) :
    roundHalfEven n d = q ↔ IsHalfEven n d q :=
  ⟨fun h => h ▸ roundHalfEven_spec n d hd,
   fun h => IsHalfEven.unique hd (roundHalfEven_spec n d hd) h⟩

/-- Exact division is not rounded. -/
theorem roundHalfEven_mul (k d : Int) (hd : 0 < d) : roundHalfEven (k * d) d = k := by
  rw [roundHalfEven_eq_iff _ _ _ hd]
  simp only [IsHalfEven, Int.sub_self]
  omega

theorem roundHalfEven_zero (d : Int) : roundHalfEven 0 d = 0 := by
  unfold roundHalfEven
  by_cases h0 : d = 0
  · simp [h0]
  · simp only [h0, ↓reduceIte]
    split
    · exact IsHalfEven.unique (by omega) (roundHalfEvenPos_spec _ _ (by omega))
        (by simp only [IsHalfEven]; omega)
    · exact IsHalfEven.unique (by omega) (roundHalfEvenPos_spec _ _ (by omega))
        (by simp only [IsHalfEven]; omega)

/-- Rounding is monotone in the numerator. -/
theorem roundHalfEven_mono {n₁ n₂ : Int} (d : Int) (hd : 0 < d) (h : n₁ ≤ n₂) :
    roundHalfEven n₁ d ≤ roundHalfEven n₂ d := by
  have h₁ := roundHalfEven_spec n₁ d hd
  have h₂ := roundHalfEven_spec n₂ d hd
  generalize roundHalfEven n₁ d = q₁ at *
  generalize roundHalfEven n₂ d = q₂ at *
  apply Int.not_lt.mp
  intro hlt
  by_cases hn : n₁ = n₂
  · subst hn
    have := IsHalfEven.unique hd h₁ h₂
    omega
  · have s1 := mul_step hd hlt
    obtain ⟨a1, b1, c1⟩ := h₁
    obtain ⟨a2, b2, c2⟩ := h₂
    generalize q₁ * d = X1 at *
    generalize q₂ * d = X2 at *
    omega

/-- Rounding error is at most one half: `|n - q d| ≤ d / 2`, stated without division. -/
theorem roundHalfEven_error (n d : Int) (hd : 0 < d) :
    -d ≤ 2 * (n - roundHalfEven n d * d) ∧ 2 * (n - roundHalfEven n d * d) ≤ d :=
  ⟨(roundHalfEven_spec n d hd).1, (roundHalfEven_spec n d hd).2.1⟩

/-- Half-even rounding is symmetric about zero (unlike half-up). -/
theorem roundHalfEven_neg (n d : Int) (hd : 0 < d) :
    roundHalfEven (-n) d = -roundHalfEven n d := by
  rw [roundHalfEven_eq_iff _ _ _ hd]
  obtain ⟨a, b, c⟩ := roundHalfEven_spec n d hd
  generalize roundHalfEven n d = q at *
  unfold IsHalfEven
  rw [Int.neg_mul]
  generalize q * d = X at *
  refine ⟨by omega, by omega, fun h => ?_⟩
  have := c (by omega)
  omega

/-- An upper bound on the numerator gives an upper bound on the rounded quotient. -/
theorem roundHalfEven_le_of_le_mul {n m d : Int} (hd : 0 < d) (h : n ≤ m * d) :
    roundHalfEven n d ≤ m := by
  have := roundHalfEven_mono d hd h
  rwa [roundHalfEven_mul m d hd] at this

/-- A lower bound on the numerator gives a lower bound on the rounded quotient. -/
theorem le_roundHalfEven_of_mul_le {n m d : Int} (hd : 0 < d) (h : m * d ≤ n) :
    m ≤ roundHalfEven n d := by
  have := roundHalfEven_mono d hd h
  rwa [roundHalfEven_mul m d hd] at this

/-! ## Discount and growth recurrences (SPEC 7.4) -/

/-- One discount year: `D_t = roundHalfEven(D_{t-1} * 10^9, 10^9 + r)`, `r` in ppb. -/
def discountStep (r D : Int) : Int := roundHalfEven (D * ppb) (ppb + r)

/-- One growth year (escalation `g > 0`, degradation `g < 0`):
`G_t = roundHalfEven(G_{t-1} * (10^9 + g), 10^9)`. -/
def growthStep (g G : Int) : Int := roundHalfEven (G * (ppb + g)) ppb

/-- `[x, f x, f (f x), ...]` with `n + 1` entries. -/
def iterList (f : Int → Int) : Nat → Int → List Int
  | 0, x => [x]
  | n + 1, x => x :: iterList f n (f x)

theorem iterList_length (f : Int → Int) (n : Nat) (x : Int) : (iterList f n x).length = n + 1 := by
  induction n generalizing x with
  | zero => rfl
  | succ n ih => simp [iterList, ih]

/-- `D_0 .. D_years`, scaled by `10^12` (TS `discountFactors`). -/
def discountFactors (r : Int) (years : Nat) : List Int := iterList (discountStep r) years dfScale

/-- `G_0 .. G_years`, scaled by `10^12` (TS `growthFactors`). -/
def growthFactors (g : Int) (years : Nat) : List Int := iterList (growthStep g) years dfScale

theorem discountFactors_length (r : Int) (years : Nat) :
    (discountFactors r years).length = years + 1 := iterList_length _ _ _

theorem growthFactors_length (g : Int) (years : Nat) :
    (growthFactors g years).length = years + 1 := iterList_length _ _ _

/-- A discount factor never goes negative while the rate is above -100%. -/
theorem discountStep_nonneg {r D : Int} (hr : 0 < ppb + r) (hD : 0 ≤ D) : 0 ≤ discountStep r D := by
  unfold discountStep
  have := roundHalfEven_mono (ppb + r) hr (Int.mul_nonneg hD (Int.le_of_lt ppb_pos))
  rwa [roundHalfEven_zero] at this

/-- With a nonnegative rate, discounting never increases a factor. -/
theorem discountStep_le {r D : Int} (hr : 0 ≤ r) (hD : 0 ≤ D) : discountStep r D ≤ D := by
  unfold discountStep
  apply roundHalfEven_le_of_le_mul (by have := ppb_pos; omega)
  rw [Int.mul_add]
  have : 0 ≤ D * r := Int.mul_nonneg hD hr
  omega

/-- Discounting is monotone in the amount carried forward. -/
theorem discountStep_mono {r D₁ D₂ : Int} (hr : 0 < ppb + r) (h : D₁ ≤ D₂) :
    discountStep r D₁ ≤ discountStep r D₂ :=
  roundHalfEven_mono _ hr (Int.mul_le_mul_of_nonneg_right h (Int.le_of_lt ppb_pos))

/-- With a nonnegative growth rate, escalation never decreases a factor. -/
theorem growthStep_ge {g G : Int} (hg : 0 ≤ g) (hG : 0 ≤ G) : G ≤ growthStep g G := by
  unfold growthStep
  apply le_roundHalfEven_of_mul_le ppb_pos
  rw [Int.mul_add]
  have : 0 ≤ G * g := Int.mul_nonneg hG hg
  omega

/-- With a nonpositive growth rate (degradation above -100%), a factor never increases. -/
theorem growthStep_le {g G : Int} (hg : g ≤ 0) (hG : 0 ≤ G) : growthStep g G ≤ G := by
  unfold growthStep
  apply roundHalfEven_le_of_le_mul ppb_pos
  rw [Int.mul_add]
  have : G * g ≤ 0 := Int.mul_nonpos_of_nonneg_of_nonpos hG hg
  omega

/-- Every listed factor is nonnegative and the list never increases (rate ≥ 0). -/
theorem discountFactors_sorted (r : Int) (hr : 0 ≤ r) (years : Nat) :
    (discountFactors r years).Pairwise (fun a b => b ≤ a) ∧ ∀ x ∈ discountFactors r years, 0 ≤ x := by
  unfold discountFactors
  suffices ∀ n (x : Int), 0 ≤ x →
      (iterList (discountStep r) n x).Pairwise (fun a b => b ≤ a) ∧
      ∀ y ∈ iterList (discountStep r) n x, 0 ≤ y ∧ y ≤ x from
    let h := this years dfScale (Int.le_of_lt dfScale_pos)
    ⟨h.1, fun y hy => (h.2 y hy).1⟩
  intro n
  induction n with
  | zero => intro x hx; simp [iterList]; omega
  | succ n ih =>
    intro x hx
    have h0 := discountStep_nonneg (r := r) (by have := ppb_pos; omega) hx
    have h1 := discountStep_le (r := r) hr hx
    obtain ⟨p, q⟩ := ih _ h0
    refine ⟨List.pairwise_cons.mpr ⟨fun y hy => Int.le_trans (q y hy).2 h1, p⟩, ?_⟩
    intro y hy
    simp only [iterList, List.mem_cons] at hy
    rcases hy with rfl | hy
    · exact ⟨hx, Int.le_refl _⟩
    · exact ⟨(q y hy).1, Int.le_trans (q y hy).2 h1⟩

/-! ## Test vectors (G0-5, `packages/core/test/vectors/discount.json`) -/

#guard discountFactors 35000000 3 = [1000000000000, 966183574879, 933510700366, 901942705668]
#guard (discountFactors 35000000 25).getLast? = some 423146989271
#guard (discountFactors 30000000 25).getLast? = some 477605569262
#guard (discountFactors 70000000 25).getLast? = some 184249177522
#guard roundHalfEven 5 2 = 2 && roundHalfEven 7 2 = 4 && roundHalfEven (-5) 2 = -2
#guard roundHalfEven 5 (-2) = -2 && roundHalfEven 1 3 = 0 && roundHalfEven 2 3 = 1
#guard divRound (-7) 2 .floor = -4 && divRound (-7) 2 .ceil = -3 && divRound (-7) 2 .trunc = -3

end Ibasho.Spec.V2
