/-
Ibasho checker: bills, net upfront cost, NPV and lifetime carbon in fixed point (SPEC 7.2, 7.4,
SF 5.2). Owner: WP-04 (checker half). Init plus the spec.

Normative for `money.bills` and `fin.recompute`; the engine twin is
`packages/engine/src/finance/money.ts` and `accounting.ts` (WP-02). Named rounding points:
`applyFactor` once per year term, the residual value `cost * remaining / lifetime` (half even),
and lifetime carbon rounded once from micrograms to grams.

PLACEHOLDER until M-B: real fuel price escalation (growth is 0 at M-0, so `G_t = 1`), O and M
deltas, explicit replacement schedules from cost plugins and the avoided-replacement credit.
-/
import Ibasho.Spec.V2.Fixed
import Ibasho.Spec.V2.Units
import Ibasho.Spec.V2.Accounting

namespace Ibasho.Check
open Ibasho.Spec.V2

/-! ## Bills -/

/-- Telescopic slab charge for `wh` from `lower` up: each slab's price applies only to the
energy inside it. Exact. The list must end with the unbounded slab (`packs.wellformed`). -/
def slabCharge (wh : Int) : List (Option Int × Int) → Int → Int
  | [], _ => 0
  | (none, price) :: _, lower => if lower < wh then (wh - lower) * price else 0
  | (some upto, price) :: rest, lower =>
    let top := if wh < upto then wh else upto
    let here := if lower < top then (top - lower) * price else 0
    if wh ≤ upto then here else here + slabCharge wh rest upto

/-- Energy charge for twelve months: annual slabs apply to the year's cumulative use (the
monthly differences telescope to the charge of the total), monthly slabs to each month. -/
def energyCharge (yearly : Bool) (slabs : List (Option Int × Int)) (whByMonth : List Int) : Int :=
  if yearly then slabCharge whByMonth.sum slabs 0
  else (whByMonth.map fun w => slabCharge w slabs 0).sum

/-- Annual bill: energy plus `days * standingPerDay`, the standing charge dropped for a fuel
unused all year when the tariff allows it (SPEC 9 gas disconnect). -/
def annualBill (yearly : Bool) (slabs : List (Option Int × Int)) (standingPerDay : Int)
    (standingWhenUnused : Bool) (whByMonth : List Int) : Int :=
  let used := whByMonth.any (· != 0)
  energyCharge yearly slabs whByMonth +
    (if used || standingWhenUnused then (Month.all.map Month.days).sum * standingPerDay else 0)

theorem slabCharge_flat (wh price lower : Int) (h : lower ≤ wh) :
    slabCharge wh [(none, price)] lower = (wh - lower) * price := by
  simp only [slabCharge]
  split
  · rfl
  · have : wh = lower := by omega
    subst this; simp

/-! ## Upfront cost and NPV -/

/-- `N0 = max(0, C0 - G)` (SF 5.2). -/
def netUpfront (gross grants : Int) : Int := max 0 (gross - grants)

theorem net_cost_nonneg (gross grants : Int) : 0 ≤ netUpfront gross grants := by
  unfold netUpfront; omega

/-- Grants never make the upfront cost exceed the gross cost. -/
theorem netUpfront_le (gross grants : Int) (hg : 0 ≤ grants) (hc : 0 ≤ gross) :
    netUpfront gross grants ≤ gross := by
  unfold netUpfront; omega

/-- Replacement years of an option with lifetime `T` inside a horizon `H`: `T, 2T, ...` below `H`. -/
def replacementYears (T H : Nat) : List Nat :=
  if T = 0 then [] else (List.range ((H - 1) / T)).map fun k => (k + 1) * T

/-- Residual value at `H` of the last install: `cost * (end - H) / T`, half even. -/
def residualValue (cost : Int) (T H : Nat) : Int :=
  if T = 0 then 0 else
    let last := (H - 1) / T * T
    let stop := last + T
    if H < stop then roundHalfEven (cost * ((stop - H : Nat) : Int)) T else 0

/-- Bill saving in year `t` (1-based): `Σ_f applyFactor(saving_f, G_t)`. -/
def yearSaving (billSaving : List Int) (G : List Int) (t : Nat) : Int :=
  (billSaving.map fun s => applyFactor s (G.getD t dfScale)).sum

/-- NPV = -N0 + Σ_t B_t D_t - Σ replacements cost D_y + RV D_H (SF 5.2). `installed` lists each
option's central cost and lifetime. Value uplift is never part of it (SF D6). -/
def npv (n0 : Int) (billSaving : List Int) (installed : List (Int × Nat)) (ratePpb : Int)
    (H : Nat) : Int :=
  let D := discountFactors ratePpb H
  let G := growthFactors 0 H
  let flows := ((List.range H).map fun i => applyFactor (yearSaving billSaving G (i + 1))
    (D.getD (i + 1) 0)).sum
  let repl := (installed.map fun (c, T) =>
    ((replacementYears T H).map fun y => applyFactor c (D.getD y 0)).sum).sum
  let rv := (installed.map fun (c, T) => residualValue c T H).sum
  flows - repl + applyFactor rv (D.getD H 0) - n0

/-- Year-one saving `B_1` (the default target's money test). -/
def firstYearSaving (billSaving : List Int) (H : Nat) : Int :=
  if H = 0 then 0 else yearSaving billSaving (growthFactors 0 H) 1

/-! ## Lifetime carbon -/

/-- Lifetime operational carbon saved, grams: `Σ_f Σ_{t<H} annual_f · traj(f, t)`, exact in
micrograms, rounded once (fin.lifetime_tco2e, R6). -/
def lifetimeCarbonG (annual : Fuel → Int) (traj : Fuel → Nat → Int) (H : Nat) : Int :=
  roundHalfEven
    ((Fuel.all.map fun f => ((List.range H).map fun t => annual f * traj f t).sum).sum) ugPerG

private theorem sum_map_zero {α : Type} (l : List α) : (l.map fun _ => (0 : Int)).sum = 0 := by
  induction l with
  | nil => rfl
  | cons _ _ ih => simp only [List.map_cons, List.sum_cons, ih]; rfl

/-- A package that saves nothing has no lifetime carbon saving. -/
theorem lifetimeCarbonG_zero (traj : Fuel → Nat → Int) (H : Nat) :
    lifetimeCarbonG (fun _ => 0) traj H = 0 := by
  unfold lifetimeCarbonG
  simp only [Int.zero_mul, sum_map_zero]
  exact roundHalfEven_zero _

#guard slabCharge 1000 [(some 100, 5), (none, 7)] 0 == 100 * 5 + 900 * 7
#guard slabCharge 50 [(some 100, 5), (none, 7)] 0 == 250
#guard replacementYears 15 25 == [15] && replacementYears 18 25 == [18] &&
  replacementYears 40 25 == [] && replacementYears 5 25 == [5, 10, 15, 20]
#guard residualValue 29000 15 25 == 9667 && residualValue 100 5 25 == 0

end Ibasho.Check
