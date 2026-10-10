/-
Ibasho checker: the decoded certificate `ibasho.cert/2` (ARCH 8.3). Owner: WP-04 (checker
half). Init plus the spec; no JSON here (`Json.lean` builds it), so this file is WASM-ready.

Trusted inputs: physics outputs (`baseline`, `heavy`, `light`), twin facts and pack data (pack
data only after `packs.wellformed`). Everything under `claimed`, `front`, `picks` and
`needsCheck` is re-derived by `Check.lean`.
-/
import Ibasho.Spec.V2.Units
import Ibasho.Spec.V2.Rules.Kleene

namespace Ibasho.Check
open Ibasho.Spec.V2

/-- A fact value; `none` is unknown (a missing fact is unknown too). -/
abbrev Fact := Option Val

/-- A fact table, in insertion order. Lookup takes the last binding (TS object spread). -/
abbrev FactTable := List (String × Fact)

def FactTable.get (t : FactTable) (x : String) : Fact :=
  match t.reverse.find? (·.1 == x) with
  | some (_, v) => v
  | none => none

/-- One option of a choice group, with what the checker needs about it. -/
structure OptionInfo where
  id : String
  /-- Measure model id (memory matches option ids and measure ids); `none` when the
  certificate omits `optionMeta`. -/
  measure : Option String
  /-- Measure kind (rule `measures` filter); `none` when the certificate omits it. -/
  kind : Option String
  /-- `m.*` facts (cost keys `c.*` removed). -/
  facts : FactTable
  /-- Central capital cost, micro-pence (`c.mid`). -/
  costMid : Int
  lifetimeYears : Nat

/-- A choice group: option ids in order, `none` included when the group may be left out. -/
structure Group where
  id : String
  options : List String

/-- A slab tariff (exact bills, SPEC 7.2). `upto = none` is the unbounded last slab. -/
structure Tariff where
  id : String
  fuel : Fuel
  yearly : Bool
  slabs : List (Option Int × Int)
  standingPerDay : Int
  standingWhenUnused : Bool
  validFrom : Nat
  validTo : Nat

/-- A grant pack entry and its per-row applied amounts. -/
structure Grant where
  id : String
  validFrom : Option Nat
  validTo : Option Nat
  applied : List (Nat × Int)

/-- A rule with the filters the evaluator applies before Kleene evaluation. -/
structure PackRule where
  rule : Rule
  jurisdiction : String
  /-- `none` is `'*'`. -/
  measures : Option (List String)
  packageScope : Bool

/-- A recorded check (`twin.checks`). -/
structure CheckRec where
  kind : String
  atDate : Nat
  result : CheckResult

inductive Target where
  | default
  | custom (saveMoneyYear1 cutRunningCarbon : Bool)
  | epcBand (band : String)
  deriving Repr, DecidableEq

structure Picks where
  leastUpfront : Option Nat
  bestReturn : Option Nat
  lowestCarbon : Option Nat
  deriving Repr, DecidableEq

/-- The decoded certificate. Arrays are row-major; `n` rows. -/
structure Cert where
  specHash : String
  asOf : Nat
  asOfYear : Nat
  -- context
  ownerFacts : FactTable
  budget : Option Int
  discountRatePpb : Int
  horizon : Nat
  target : Target
  rejected : List String
  /-- `context.home` present: region, `h.*` facts, recorded checks. -/
  region : Option String
  homeFacts : FactTable
  checks : List CheckRec
  -- choice groups
  groups : List Group
  options : List OptionInfo
  -- packs
  tariffs : List Tariff
  carbon : List (Fuel × Array Int)
  trajFirstYear : Nat
  trajYears : Nat
  trajectory : List (Fuel × Array Int)
  grants : List Grant
  rules : List PackRule
  -- trusted physics, your-home mode (fuel-major, 72 values)
  baseline : Array Int
  heavyKeys : Array String
  /-- your-home delivered per heavy key, `[key][fuel][month]`. -/
  heavy : Array Int
  /-- Per row: heavy key index and sparse `(slot, delta)` pairs over all three modes. -/
  light : Array (Nat × List (Nat × Int))
  -- claimed
  status : Array Nat
  n0 : Array Int
  npv : Array Int
  carbonSaved : Array Int
  witness : Array Nat
  ruleIds : Array (List String)
  /-- Annual saving per row and fuel (`[row][fuel]`, Wh), when the emitter includes it. -/
  saving : Option (Array Int)
  /-- Annual operational carbon saved per row (g), when the emitter includes it. -/
  carbonAnnual : Option (Array Int)
  front : List Nat
  picks : Picks
  needsCheck : List Nat

/-- Index of a fuel in certificate order. -/
def fuelIdx : Fuel → Nat
  | .electricity => 0 | .gas => 1 | .oil => 2 | .lpg => 3 | .biomass => 4 | .district => 5

def Fuel.ofName : String → Option Fuel
  | "electricity" => some .electricity | "gas" => some .gas | "oil" => some .oil
  | "lpg" => some .lpg | "biomass" => some .biomass | "district" => some .district
  | _ => none

/-- Run modes in core `RUN_MODES` order; your-home is index 2. -/
def yourHomeMode : Nat := 2
def slotsPerMode : Nat := 72

/-- Package status codes (core `PACKAGE_STATUS`). -/
def stFeasible : Nat := 0
def stNeedsCheck : Nat := 1
def stBlocked : Nat := 2
def stTargetMiss : Nat := 3

end Ibasho.Check
