/-
Ibasho checker: check ids, built-in rules and the constants `ibasho-gen` writes into
`@ibasho/spec-gen` beside the spec values. Owner: WP-04 (checker half). Init plus the spec.
-/
import Ibasho.Spec.V2.Score
import Ibasho.Spec.V2.Rules.Kleene
import Ibasho.Check.Schema

namespace Ibasho.Check
open Ibasho.Spec.V2

/-- Spec version. Bump it whenever a normative formula changes; `specHash` covers it. -/
def specVersion : String := "2.0.0-m0"

/-- Certificate checks (ARCH 8.3). The TS mirror uses the same ids. -/
inductive CheckId where
  | specKnown | packsWellformed | enumComplete | acctSaving | acctCarbon | moneyBills
  | finRecompute | feasRecompute | targetRecompute | paretoFront | paretoWitness | paretoPicks
  | scoreRecompute
  deriving DecidableEq, Repr

def CheckId.all : List CheckId :=
  [.specKnown, .packsWellformed, .enumComplete, .acctSaving, .acctCarbon, .moneyBills,
   .finRecompute, .feasRecompute, .targetRecompute, .paretoFront, .paretoWitness, .paretoPicks,
   .scoreRecompute]

def CheckId.name : CheckId → String
  | .specKnown => "spec.known" | .packsWellformed => "packs.wellformed"
  | .enumComplete => "enum.complete" | .acctSaving => "acct.saving"
  | .acctCarbon => "acct.carbon" | .moneyBills => "money.bills"
  | .finRecompute => "fin.recompute" | .feasRecompute => "feas.recompute"
  | .targetRecompute => "target.recompute" | .paretoFront => "pareto.front"
  | .paretoWitness => "pareto.witness" | .paretoPicks => "pareto.picks"
  | .scoreRecompute => "score.recompute"

/-- Built-in rule ids the search adds itself (SPEC 9 built-ins). -/
def builtinMemory : String := "BUILTIN.MEMORY"
def builtinTarget : String := "BUILTIN.TARGET"

/-- Budget built-in (LV 6.3 `budgetRule`, TS `BUDGET_RULE`): block a package whose central
capital cost is above a set budget. With no budget `o.budget.set` is 0, so it never blocks
(SPEC R24); with a budget and an unknown cost it is unknown, so the package needs a check. -/
def budgetRule : PackRule where
  rule := { id := "BUILTIN.BUDGET",
            when := .and [.cmp .eq "o.budget.set" (.lit (.num 1)),
                          .cmp .gt "p.capex" (.fact "o.budget")],
            effect := .block, effectiveFrom := 20000101 }
  jurisdiction := "GB"
  measures := none
  packageScope := true

/-- Built-ins apply in every jurisdiction, filtered by date only. -/
def builtinRules : List PackRule := [budgetRule]

/-- Named rule functions (ARCH 5.4). Ids are spec; `implemented` is true once the Lean
definition is wired into the checker's function table. PLACEHOLDER until M-B: none is wired,
so a rule using one evaluates to unknown (never feasible by accident). -/
def namedFns : List (String × Bool) :=
  [("adf_category", false), ("dt_hosting", false), ("ens_retv", false),
   ("mcs020a_Lp_le", false), ("mees_cap", false)]

/-- The checker's named function table: every function is unknown until wired. -/
def fnTable : Fns := fun _ _ => .unknown

/-- SPEC R9 completeness limits of the exhaustive search. -/
def searchLimitHeavy : Nat := 1024
def searchLimitPackages : Nat := 65536

/-- Micro-pence per pound. -/
def microPencePerPound : Int := 100000000

/-- SAP band thresholds, highest first (agrees with `sapBand`, see the guards). -/
def bandThresholds : List (String × Nat) :=
  [("A", 92), ("B", 81), ("C", 69), ("D", 55), ("E", 39), ("F", 21)]

def bandName : Band → String
  | .A => "A" | .B => "B" | .C => "C" | .D => "D" | .E => "E" | .F => "F" | .G => "G"

-- Each threshold is the exact edge of its band in `sapBand`.
#guard bandThresholds.all fun (b, t) =>
  bandName (sapBand (t : Rat)) == b && bandName (sapBand ((t : Rat) - 1/1000)) != b

end Ibasho.Check
