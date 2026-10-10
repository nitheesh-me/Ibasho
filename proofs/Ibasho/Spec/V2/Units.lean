/-
Ibasho spec V2: units, fuels and months (ARCH 4.3, SPEC R6, R20). Owner: WP-04.

TS mirror: `packages/core/src/units.ts`. The fuel order is normative: certificate vectors are
fuel-major in this order, then month 0 (January) to 11 (December).

Quantised units are plain integers: `Wh` (energy), `GCO2e` (carbon), `MicroPence` (money,
micro-paise for INR). Emission factors are integer micrograms CO2e per Wh, so one Wh times one
factor is micrograms, and `10^6` micrograms are one gram.
-/

namespace Ibasho.Spec.V2

/-- Integer watt hours. -/
abbrev Wh := Int
/-- Integer grams of CO2 equivalent. -/
abbrev GCO2e := Int
/-- Integer micrograms of CO2 equivalent (exact intermediate, never stored). -/
abbrev UgCO2e := Int
/-- Integer micro-pence (micro-paise for INR). -/
abbrev MicroPence := Int

/-- Micrograms per gram: the scale of the carbon rounding point. -/
def ugPerG : Int := 1000000

/-- Delivered fuels. The constructor order is the certificate order (TS `FUELS`). -/
inductive Fuel where
  | electricity | gas | oil | lpg | biomass | district
  deriving DecidableEq, Repr

/-- Every fuel, in certificate order. -/
def Fuel.all : List Fuel := [.electricity, .gas, .oil, .lpg, .biomass, .district]

theorem Fuel.mem_all (f : Fuel) : f ∈ Fuel.all := by cases f <;> decide
theorem Fuel.all_nodup : Fuel.all.Nodup := by decide

/-- Wire name of a fuel (TS `Fuel`). -/
def Fuel.name : Fuel → String
  | .electricity => "electricity" | .gas => "gas" | .oil => "oil"
  | .lpg => "lpg" | .biomass => "biomass" | .district => "district"

/-- Month of the year, `0` is January (TS `Month`). -/
abbrev Month := Fin 12

/-- Every month, January first. -/
def Month.all : List Month := List.finRange 12

theorem Month.mem_all (m : Month) : m ∈ Month.all := List.mem_finRange m
theorem Month.all_length : Month.all.length = 12 := List.length_finRange

/-- Days per month in a non-leap year (SAP Table 1a, TS `DAYS_IN_MONTH`). -/
def Month.days (m : Month) : Nat := [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m]

theorem Month.days_sum : (Month.all.map Month.days).sum = 365 := by decide

/-- A total vector indexed by fuel and month. A missing entry cannot be represented, so a missing
emission factor is a type error, not a silent zero. -/
abbrev FuelMonthVec := Fuel → Month → Int

/-- Sum over every fuel and month. -/
def FuelMonthVec.total (v : FuelMonthVec) : Int :=
  (Fuel.all.map fun f => (Month.all.map fun m => v f m).sum).sum

/-- Annual sum for one fuel. -/
def FuelMonthVec.annual (v : FuelMonthVec) (f : Fuel) : Int :=
  (Month.all.map fun m => v f m).sum

/-! ## Finite sums -/

theorem sum_map_sub {α : Type} (xs : List α) (f g : α → Int) :
    (xs.map fun x => f x - g x).sum = (xs.map f).sum - (xs.map g).sum := by
  induction xs with
  | nil => rfl
  | cons x xs ih => simp only [List.map_cons, List.sum_cons, ih]; omega

theorem sum_map_add {α : Type} (xs : List α) (f g : α → Int) :
    (xs.map fun x => f x + g x).sum = (xs.map f).sum + (xs.map g).sum := by
  induction xs with
  | nil => rfl
  | cons x xs ih => simp only [List.map_cons, List.sum_cons, ih]; omega

theorem sum_map_nonneg {α : Type} (xs : List α) (f : α → Int) (h : ∀ x ∈ xs, 0 ≤ f x) :
    0 ≤ (xs.map f).sum := by
  induction xs with
  | nil => exact Int.le_refl 0
  | cons x xs ih =>
    simp only [List.map_cons, List.sum_cons]
    have := h x (List.mem_cons_self ..)
    have := ih (fun y hy => h y (List.mem_cons_of_mem _ hy))
    omega

theorem sum_map_mono {α : Type} (xs : List α) (f g : α → Int) (h : ∀ x ∈ xs, f x ≤ g x) :
    (xs.map f).sum ≤ (xs.map g).sum := by
  have := sum_map_nonneg xs (fun x => g x - f x) (fun x hx => by have := h x hx; omega)
  rw [sum_map_sub] at this
  omega

theorem sum_map_congr {α : Type} (xs : List α) (f g : α → Int) (h : ∀ x ∈ xs, f x = g x) :
    (xs.map f).sum = (xs.map g).sum := by
  rw [List.map_congr_left h]

end Ibasho.Spec.V2
