/-
Ibasho spec V2: per-fuel, per-month accounting (SPEC R6, 7.2, BP 3.12, DEC SC-1). Owner: WP-04.

Normative definitions of the certificate checks `acct.saving` and `acct.carbon`:
* the saving of a package is the whole-package baseline minus the whole-package result, for
  every fuel and every month, signs kept (a heat pump saves gas and uses more electricity);
* carbon uses monthly factors per fuel: `Σ_f Σ_m ΔE(f, m) · EF(f, m)`, exact in micrograms,
  then rounded once, half even, to grams (the named rounding point `carbonSavingG`).
Inputs are quantised physics outputs (integer Wh), trusted by the checker.
-/
import Ibasho.Spec.V2.Fixed
import Ibasho.Spec.V2.Units

namespace Ibasho.Spec.V2

/-- Emission factors in integer micrograms CO2e per Wh, by fuel and month (SPEC 7.4). -/
abbrev FactorVec := FuelMonthVec

/-- Signed saving per fuel and month: before minus after. -/
def saving (before after : FuelMonthVec) : FuelMonthVec := fun f m => before f m - after f m

/-- Operational emissions in micrograms: `Σ_f Σ_m E(f, m) · EF(f, m)`. -/
def emissionsUg (ef e : FactorVec) : UgCO2e := FuelMonthVec.total fun f m => e f m * ef f m

/-- Carbon saved in micrograms, from the per-fuel, per-month savings. -/
def carbonSavingUg (ef before after : FuelMonthVec) : UgCO2e :=
  FuelMonthVec.total fun f m => saving before after f m * ef f m

/-- Carbon saved in grams. The only rounding point of carbon accounting. -/
def carbonSavingG (ef before after : FuelMonthVec) : GCO2e :=
  roundHalfEven (carbonSavingUg ef before after) ugPerG

/-! ## Theorems -/

private theorem total_sub (v w : FuelMonthVec) :
    FuelMonthVec.total (fun f m => v f m - w f m) = v.total - w.total := by
  unfold FuelMonthVec.total
  rw [← sum_map_sub]
  apply sum_map_congr
  intro f _
  exact sum_map_sub _ _ _

private theorem total_add (v w : FuelMonthVec) :
    FuelMonthVec.total (fun f m => v f m + w f m) = v.total + w.total := by
  unfold FuelMonthVec.total
  rw [← sum_map_add]
  apply sum_map_congr
  intro f _
  exact sum_map_add _ _ _

private theorem total_nonneg (v : FuelMonthVec) (h : ∀ f m, 0 ≤ v f m) : 0 ≤ v.total :=
  sum_map_nonneg _ _ fun f _ => sum_map_nonneg _ _ fun m _ => h f m

/-- Carbon saved is exactly emissions before minus emissions after (exact, in micrograms). -/
theorem carbonSaving_eq (ef before after : FuelMonthVec) :
    carbonSavingUg ef before after = emissionsUg ef before - emissionsUg ef after := by
  unfold carbonSavingUg emissionsUg saving
  rw [← total_sub]
  congr 1
  funext f m
  rw [Int.sub_mul]

/-- The total saving over every fuel and month is total before minus total after. -/
theorem saving_total (before after : FuelMonthVec) :
    (saving before after).total = before.total - after.total := total_sub before after

/-- Per fuel and per month, the saving is exactly before minus after (the `acct.saving` check). -/
theorem saving_apply (before after : FuelMonthVec) (f : Fuel) (m : Month) :
    saving before after f m = before f m - after f m := rfl

/-- A negative saving means the package uses more of that fuel in that month. -/
theorem saving_neg_iff (before after : FuelMonthVec) (f : Fuel) (m : Month) :
    saving before after f m < 0 ↔ before f m < after f m := by
  simp only [saving]; omega

/-- Savings chain: going from `a` to `c` through `b` saves the sum of both steps. -/
theorem saving_add (a b c : FuelMonthVec) (f : Fuel) (m : Month) :
    saving a c f m = saving a b f m + saving b c f m := by
  simp only [saving]; omega

theorem saving_self (a : FuelMonthVec) (f : Fuel) (m : Month) : saving a a f m = 0 := by
  simp only [saving]; omega

/-- Carbon savings chain exactly, so a package cannot gain carbon by being split into steps. -/
theorem carbonSaving_add (ef a b c : FuelMonthVec) :
    carbonSavingUg ef a c = carbonSavingUg ef a b + carbonSavingUg ef b c := by
  rw [carbonSaving_eq, carbonSaving_eq, carbonSaving_eq]
  exact (fun x y z : Int => show x - z = (x - y) + (y - z) by omega) _ _ _

/-- With nonnegative factors, using no more of any fuel in any month never adds carbon. -/
theorem carbonSaving_nonneg (ef before after : FuelMonthVec) (hef : ∀ f m, 0 ≤ ef f m)
    (h : ∀ f m, after f m ≤ before f m) : 0 ≤ carbonSavingUg ef before after := by
  apply total_nonneg
  intro f m
  exact Int.mul_nonneg (by simp only [saving]; have := h f m; omega) (hef f m)

/-- The rounded carbon saving is within half a gram of the exact value. -/
theorem carbonSavingG_error (ef before after : FuelMonthVec) :
    -ugPerG ≤ 2 * (carbonSavingUg ef before after - carbonSavingG ef before after * ugPerG) ∧
    2 * (carbonSavingUg ef before after - carbonSavingG ef before after * ugPerG) ≤ ugPerG :=
  roundHalfEven_error _ _ (by decide)

/-- Rounding the saving once is sign-correct: no rounding flips a positive saving negative. -/
theorem carbonSavingG_nonneg (ef before after : FuelMonthVec)
    (h : 0 ≤ carbonSavingUg ef before after) : 0 ≤ carbonSavingG ef before after :=
  le_roundHalfEven_of_mul_le (by decide) (by rw [Int.zero_mul]; exact h)

/-- Annual saving of one fuel equals annual before minus annual after. -/
theorem saving_annual (before after : FuelMonthVec) (f : Fuel) :
    (saving before after).annual f = before.annual f - after.annual f := by
  unfold FuelMonthVec.annual saving
  exact sum_map_sub _ _ _

/-! ## Lifetime carbon (R6 trajectory, WP-02 certificate input) -/

/-- Lifetime operational carbon saved, exact in micrograms: for each year `t < H`, the annual
saving of each fuel times that fuel's trajectory factor for year `asOfYear + t` (µg per Wh). -/
def lifetimeCarbonUg (before after : FuelMonthVec) (traj : Nat → Fuel → Int)
    (asOfYear horizon : Nat) : UgCO2e :=
  ((List.range horizon).map fun t =>
    (Fuel.all.map fun f => (saving before after).annual f * traj (asOfYear + t) f).sum).sum

/-- Lifetime carbon saved in grams (`claimed.carbonSaved`): one rounding at the end. -/
def lifetimeCarbonG (before after : FuelMonthVec) (traj : Nat → Fuel → Int)
    (asOfYear horizon : Nat) : GCO2e :=
  roundHalfEven (lifetimeCarbonUg before after traj asOfYear horizon) ugPerG

/-- Lifetime emissions of one energy vector under the trajectory. -/
def lifetimeEmissionsUg (e : FuelMonthVec) (traj : Nat → Fuel → Int) (asOfYear horizon : Nat) :
    UgCO2e :=
  ((List.range horizon).map fun t =>
    (Fuel.all.map fun f => e.annual f * traj (asOfYear + t) f).sum).sum

/-- Lifetime carbon saved is exactly lifetime emissions before minus after. -/
theorem lifetimeCarbon_eq (before after : FuelMonthVec) (traj : Nat → Fuel → Int)
    (asOfYear horizon : Nat) :
    lifetimeCarbonUg before after traj asOfYear horizon =
      lifetimeEmissionsUg before traj asOfYear horizon -
        lifetimeEmissionsUg after traj asOfYear horizon := by
  unfold lifetimeCarbonUg lifetimeEmissionsUg
  rw [← sum_map_sub]
  apply sum_map_congr
  intro t _
  rw [← sum_map_sub]
  apply sum_map_congr
  intro f _
  rw [saving_annual, Int.sub_mul]

end Ibasho.Spec.V2
