/-
Ibasho checker: re-derive every bookkeeping claim of a certificate (ARCH 8.3, LV 5). Owner: WP-04
(checker half). Init plus the spec, so it is WASM-ready.

Each check is a Boolean function over the decoded certificate and the per-row derivation
`derive`, which is built only from trusted inputs (physics, twin facts, pack data) and the spec
definitions: `Accounting.saving` and `carbonSavingG`, `Finance`, `Kleene.status`,
`Memory.respectsMemory`, `Pareto.checkFrontWitnessed`, `checkPicks` and `Score.score`. `Sound.lean` proves
that all checks passing implies `Valid`.

The TS mirror (`packages/verify/src/mirror`) implements the same checks with the same ids.
-/
import Ibasho.Spec.V2.Fixed
import Ibasho.Spec.V2.Units
import Ibasho.Spec.V2.Accounting
import Ibasho.Spec.V2.Rules.Kleene
import Ibasho.Spec.V2.Pareto
import Ibasho.Spec.V2.Memory
import Ibasho.Spec.V2.Score
import Ibasho.Check.Schema
import Ibasho.Check.Finance
import Ibasho.Check.Ids
import Ibasho.Check.Manifest
import Ibasho.Check.Wire

namespace Ibasho.Check
open Ibasho.Spec.V2

/-! ## Enumeration -/

/-- Number of packages: the product of the group sizes (SPEC R9). -/
def productCount (gs : List Group) : Nat := gs.foldl (fun acc g => acc * g.options.length) 1

/-- Chosen option of every group for row `r`, mixed radix, last group fastest (engine
`rowChoice`), so row 0 is the empty package. -/
def rowChoice (gs : List Group) (r : Nat) : List String :=
  (gs.foldr (fun g (acc : List String × Nat) =>
    let n := g.options.length
    (g.options.getD (if n = 0 then 0 else acc.2 % n) "none" :: acc.1,
     if n = 0 then acc.2 else acc.2 / n)) ([], r)).1

/-- Option ids of row `r` (no `none`). -/
def rowOptions (c : Cert) (r : Nat) : List String := (rowChoice c.groups r).filter (· != "none")

def Cert.option? (c : Cert) (id : String) : Option OptionInfo := c.options.find? (·.id == id)

def Cert.rows (c : Cert) : Nat := c.light.size

/-! ## Physics vectors (trusted) -/

/-- your-home delivered energy of row `r`: its heavy key's vector plus the row's deltas. -/
def delivered (c : Cert) (r : Nat) : Array Int :=
  let (k, pairs) := c.light.getD r (0, [])
  let base := (Array.range 72).map fun s => c.heavy.getD (k * 72 + s) 0
  pairs.foldl (fun acc (slot, d) =>
    if yourHomeMode * slotsPerMode ≤ slot && slot < (yourHomeMode + 1) * slotsPerMode then
      acc.modify (slot - yourHomeMode * slotsPerMode) (· + d)
    else acc) base

/-- A fuel-major 72-vector as a spec `FuelMonthVec`. -/
def vec (a : Array Int) : FuelMonthVec := fun f m => a.getD (fuelIdx f * 12 + m.val) 0

def fuelRow (rows : List (Fuel × Array Int)) (f : Fuel) : Option (Array Int) :=
  (rows.find? (·.1 == f)).map (·.2)

/-- Monthly emission factors; a fuel without a row is 0 here and `packs.wellformed` fails when
such a fuel is used, so a missing factor never passes as zero. -/
def factors (c : Cert) : FactorVec := fun f m => ((fuelRow c.carbon f).bind (·[m.val]?)).getD 0

def trajectory (c : Cert) (f : Fuel) (t : Nat) : Int :=
  ((fuelRow c.trajectory f).bind (·[t]?)).getD 0

def monthly (a : Array Int) (f : Fuel) : List Int := Month.all.map fun m => vec a f m

def Cert.tariffFor (c : Cert) (f : Fuel) : Option Tariff := c.tariffs.find? (·.fuel == f)

def billOf (c : Cert) (a : Array Int) (f : Fuel) : Int :=
  match c.tariffFor f with
  | some t => annualBill t.yearly t.slabs t.standingPerDay t.standingWhenUnused (monthly a f)
  | none => 0

/-! ## Rules -/

def regionContains (outer inner : String) : Bool := outer == inner || inner.startsWith (outer ++ "-")

def Cert.jurisdictionOk (c : Cert) (pr : PackRule) : Bool :=
  pr.jurisdiction != "CITY" &&
  match c.region with
  | some reg => regionContains pr.jurisdiction reg
  | none => true

/-- A measure filter applies when the kind matches; an unknown kind is treated as matching,
which can only make a status more cautious. -/
def kindMatch (pr : PackRule) (kind : Option String) : Bool :=
  match pr.measures, kind with
  | none, _ => true
  | some ms, some k => ms.contains k
  | some _, none => true

def factEnv (t : FactTable) : Env := t.get

/-- Latest recorded result per check kind (TS `latestCheck`: a later record wins a tie). -/
def Cert.checkTable (c : Cert) : Checks := fun k =>
  (c.checks.foldl (fun (best : Option CheckRec) rec =>
    if rec.kind == k && (match best with | some b => b.atDate ≤ rec.atDate | none => true)
    then some rec else best) none).map (·.result)

/-- Every rule application of row `r` (ARCH 5.4): built-ins by date, pack rules by date and
jurisdiction; measure rules once per matching option, package rules once. -/
def apps (c : Cert) (r : Nat) (gross : Int) : List App :=
  let opts := (rowOptions c r).filterMap c.option?
  let pkg : FactTable := [("p.count", some (.num opts.length)), ("p.capex", some (.num gross))]
  let rules := builtinRules.filter (·.rule.inForce c.asOf) ++
    c.rules.filter fun pr => pr.rule.inForce c.asOf && c.jurisdictionOk pr
  rules.flatMap fun pr =>
    if pr.packageScope then
      if pr.measures.isNone || opts.any (kindMatch pr ·.kind) then
        [⟨pr.rule, factEnv (c.homeFacts ++ c.ownerFacts ++ pkg)⟩]
      else []
    else
      opts.filterMap fun o =>
        if kindMatch pr o.kind then some ⟨pr.rule, factEnv (c.homeFacts ++ c.ownerFacts ++ o.facts)⟩
        else none

/-- Insertion sort on strings (code-unit order, TS `compareStrings`). -/
def sortStrings (xs : List String) : List String :=
  xs.foldl (fun acc x =>
    let (lo, hi) := acc.span (fun y => decide (y < x))
    lo ++ x :: hi) []

def dedupSorted : List String → List String
  | a :: b :: rest => if a == b then dedupSorted (b :: rest) else a :: dedupSorted (b :: rest)
  | xs => xs

/-! ## Per-row derivation -/

structure RowD where
  delivered : Array Int
  /-- Annual your-home bill per fuel, certificate order (`money.bills`). -/
  bills : List Int
  /-- Annual saving per fuel, certificate order. -/
  saving : List Int
  carbonAnnual : Int
  lifetimeCarbon : Int
  gross : Int
  grants : Int
  n0 : Int
  npv : Int
  b1 : Int
  rules : Status
  reasons : List String
  rejected : Bool
  meets : Bool
  /-- Expected status code (core `PACKAGE_STATUS`). -/
  expected : Nat
  /-- Expected rule ids, sorted. -/
  expectedIds : List String

def meetsTarget (t : Target) (b1 carbon : Int) : Bool :=
  match t with
  | .default => decide (0 < b1) && decide (0 < carbon)
  | .custom save cut => (!save || decide (0 < b1)) && (!cut || decide (0 < carbon))
  | .epcBand _ => false

/-- What the memory built-in excludes: ruled out and done measures (SPEC AC-P1), both matched
on option ids and measure ids. -/
def memoryExcluded (c : Cert) : List String := c.rejected ++ c.completed

def deriveRow (c : Cert) (base : Array Int) (r : Nat) : RowD :=
  let d := delivered c r
  let sav := saving (vec base) (vec d)
  let opts := (rowOptions c r).filterMap c.option?
  let gross := (opts.map (·.costMid)).sum
  let grants := (c.grants.map fun g => ((g.applied.filter (·.1 == r)).map (·.2)).sum).sum
  let n0 := netUpfront gross grants
  let billSaving := Fuel.all.map fun f => billOf c base f - billOf c d f
  let carbon := carbonSavingG (factors c) (vec base) (vec d)
  let as := apps c r gross
  let st := status fnTable c.checkTable as
  let reasons := (as.filter fun a => a.blocks fnTable c.checkTable || a.undecided fnTable c.checkTable).map
    (·.rule.id)
  let ids := (rowOptions c r) ++ opts.filterMap (·.measure)
  let rejected := !respectsMemory (memoryExcluded c) ⟨r, ids⟩
  let b1 := firstYearSaving billSaving c.horizon
  let meets := meetsTarget c.target b1 carbon
  let expected :=
    if rejected || st == .blocked then stBlocked
    else if st == .needsCheck then stNeedsCheck
    else if meets then stFeasible else stTargetMiss
  let extra := (if rejected then [builtinMemory] else []) ++
    (if expected == stTargetMiss then [builtinTarget] else [])
  { delivered := d
    bills := Fuel.all.map (billOf c d)
    saving := Fuel.all.map sav.annual
    carbonAnnual := carbon
    lifetimeCarbon := lifetimeCarbonG sav.annual (trajectory c) c.horizon
    gross, grants, n0
    npv := npv n0 billSaving (opts.map fun o => (o.costMid, o.lifetimeYears)) c.discountRatePpb c.horizon
    b1, rules := st, reasons, rejected, meets, expected
    expectedIds := dedupSorted (sortStrings (reasons ++ extra)) }

/-- The derivation of every row, from trusted inputs only. -/
def derive (c : Cert) : Array RowD := (Array.range c.rows).map (deriveRow c c.baseline)

/-! ## Checks -/

def allRows (c : Cert) (p : Nat → Bool) : Bool := (List.range c.rows).all p

/-- First failing row, for the verdict `path` (not part of the proof). -/
def firstBad (c : Cert) (p : Nat → Bool) : Option String :=
  ((List.range c.rows).find? (!p ·)).map fun r => s!"row/{r}"

def chkSpecKnown (c : Cert) : Bool := knownSpecHashes.contains c.specHash

def slabsOk (slabs : List (Option Int × Int)) : Bool :=
  let rec go : List (Option Int × Int) → Int → Bool
    | [], _ => false
    | [(none, p)], _ => decide (0 ≤ p)
    | (some u, p) :: rest, lo => decide (lo < u) && decide (0 ≤ p) && go rest u
    | (none, _) :: _ :: _, _ => false
  go slabs 0

/-- Fuels used by the baseline or by any row (your-home). -/
def usedFuels (c : Cert) (D : Array RowD) : List Fuel :=
  Fuel.all.filter fun f =>
    (monthly c.baseline f).any (· != 0) || D.any fun d => (monthly d.delivered f).any (· != 0)

def chkPacks (c : Cert) (D : Array RowD) : Bool :=
  let tariffsOk := c.tariffs.all fun t =>
    slabsOk t.slabs && decide (0 ≤ t.standingPerDay) && decide (t.validFrom ≤ c.asOf) &&
      decide (c.asOf ≤ t.validTo) && (c.tariffs.filter (·.fuel == t.fuel)).length == 1
  let carbonOk := c.carbon.all fun (_, xs) => xs.size == 12 && xs.all (0 ≤ ·)
  let trajOk := c.trajFirstYear == c.asOfYear && decide (c.horizon ≤ c.trajYears) &&
    c.trajectory.all fun (_, xs) => xs.size == c.trajYears && xs.all (0 ≤ ·)
  let used := usedFuels c D
  let coverOk := used.all fun f =>
    (c.tariffFor f).isSome && (fuelRow c.carbon f).isSome && (fuelRow c.trajectory f).isSome
  let grantsOk := c.grants.all fun g =>
    (match g.validFrom with | some v => decide (v ≤ c.asOf) | none => true) &&
    (match g.validTo with | some v => decide (c.asOf ≤ v) | none => true) &&
    g.applied.all fun (r, a) => decide (r < c.rows) && decide (0 < a)
  let grantsLeCost := allRows c fun r => match D[r]? with
    | some d => decide (d.grants ≤ d.gross)
    | none => false
  let optionsOk := c.options.all fun o => decide (0 < o.lifetimeYears) && decide (0 ≤ o.costMid)
  tariffsOk && carbonOk && trajOk && coverOk && grantsOk && grantsLeCost && optionsOk &&
    decide (0 < c.horizon)

/-- The option ids a heavy key names (`a+b|dhw=...`, `baseline` is none). -/
def keyOptions (key : String) : List String :=
  match key.splitOn "|" with
  | head :: _ => if head == "baseline" then [] else head.splitOn "+"
  | [] => []

def chkEnum (c : Cert) : Bool :=
  let n := c.rows
  let allOpts := c.groups.flatMap fun g => g.options.filter (· != "none")
  c.groups.all (fun g => !g.options.isEmpty) &&
  n == productCount c.groups && decide (n ≤ searchLimitPackages) &&
  c.status.size == n && c.n0.size == n && c.npv.size == n && c.carbonSaved.size == n &&
  c.witness.size == n && c.ruleIds.size == n &&
  c.baseline.size == 72 && c.heavy.size == c.heavyKeys.size * 72 &&
  allOpts.all (fun o => (c.option? o).isSome && (allOpts.filter (· == o)).length == 1) &&
  allRows c fun r =>
    let (k, _) := c.light.getD r (0, [])
    decide (k < c.heavyKeys.size) &&
      (keyOptions (c.heavyKeys.getD k "")).all (rowOptions c r).contains

def chkAcctSaving (c : Cert) (D : Array RowD) : Bool :=
  match c.saving with
  | none => false
  | some s =>
    s.size == c.rows * 6 &&
    (c.rows == 0 || (D[0]?.map (·.delivered == c.baseline)).getD false) &&
    allRows c fun r => match D[r]? with
      | some d => (List.range 6).all fun i => s.getD (r * 6 + i) 0 == d.saving.getD i 0
      | none => false

def chkAcctCarbon (c : Cert) (D : Array RowD) : Bool :=
  match c.carbonAnnual with
  | none => false
  | some a =>
    a.size == c.rows && allRows c fun r => match D[r]? with
      | some d => a.getD r 0 == d.carbonAnnual
      | none => false

def billRowOk (D : Array RowD) (b : Array Int) (r : Nat) : Bool :=
  match D[r]? with
  | some d => (List.range 6).all fun i => b.getD (r * 6 + i) 0 == d.bills.getD i 0
  | none => false

/-- `money.bills`: every claimed annual bill is the slab-exact bill of the row's delivered
energy under its fuel's tariff. -/
def chkBills (c : Cert) (D : Array RowD) : Bool :=
  match c.bills with
  | none => false
  | some b => b.size == c.rows * 6 && allRows c (billRowOk D b)

def chkFin (c : Cert) (D : Array RowD) : Bool :=
  allRows c fun r => match D[r]? with
    | some d => c.n0.getD r 0 == d.n0 && c.npv.getD r 0 == d.npv &&
        c.carbonSaved.getD r 0 == d.lifetimeCarbon
    | none => false

/-- Status class without the target: blocked, needs check, or rules passed (0 and 3). -/
def statusClass (s : Nat) : Nat := if s == stTargetMiss then stFeasible else s

def withoutTarget (ids : List String) : List String := ids.filter (· != builtinTarget)

def metaPresent (c : Cert) : Bool := c.options.all fun o => o.kind.isSome && o.measure.isSome

def chkFeas (c : Cert) (D : Array RowD) : Bool :=
  metaPresent c && allRows c fun r => match D[r]? with
    | some d => statusClass (c.status.getD r 99) == statusClass d.expected &&
        withoutTarget (c.ruleIds.getD r []) == withoutTarget d.expectedIds
    | none => false

def needsCheckRows (c : Cert) (D : Array RowD) : List Nat :=
  (List.range c.rows).filter fun r =>
    c.status.getD r 99 == stNeedsCheck && (D[r]?.map (·.meets)).getD false

def chkTarget (c : Cert) (D : Array RowD) : Bool :=
  (match c.target with | .epcBand _ => false | _ => true) &&
  (allRows c fun r => match D[r]? with
    | some d => (statusClass d.expected != stFeasible || c.status.getD r 99 == d.expected) &&
        ((c.ruleIds.getD r []).contains builtinTarget == (c.status.getD r 99 == stTargetMiss))
    | none => false) &&
  c.needsCheck == needsCheckRows c D

/-! ## Pareto (on claimed axes, which `fin.recompute` ties to the derivation) -/

def outcome (c : Cert) (r : Nat) : Outcome :=
  ⟨r, c.n0.getD r 0, c.carbonSaved.getD r 0, c.npv.getD r 0⟩

/-- The target set: rows claimed feasible (status 0). -/
def cands (c : Cert) : List Outcome :=
  ((List.range c.rows).filter fun r => c.status.getD r 99 == stFeasible).map (outcome c)

def frontOutcomes (c : Cert) : List Outcome := c.front.map (outcome c)

def strictlySorted : List Nat → Bool
  | a :: b :: rest => decide (a < b) && strictlySorted (b :: rest)
  | _ => true

def wit (c : Cert) (q : Outcome) : Option Outcome :=
  let w := c.witness.getD q.pkg noWitness
  if w == noWitness then none else some (outcome c w)

def chkFront (c : Cert) : Bool :=
  strictlySorted c.front && checkFront (cands c) (frontOutcomes c)

def chkWitness (c : Cert) : Bool :=
  checkFrontWitnessed (cands c) (frontOutcomes c) (wit c) &&
  allRows c fun r =>
    let w := c.witness.getD r noWitness
    let offFront := c.status.getD r 99 == stFeasible && !c.front.contains r
    if offFront then c.front.contains w else w == noWitness

/-- Pick candidates: the target set without the empty package (row 0). -/
def pickCands (c : Cert) : List Outcome := (cands c).filter (·.pkg != 0)

def claimedPicks (c : Cert) : Ibasho.Spec.V2.Picks :=
  { leastUpfront := c.picks.leastUpfront.map (outcome c)
    bestReturn := c.picks.bestReturn.map (outcome c)
    lowestCarbon := c.picks.lowestCarbon.map (outcome c) }

def chkPicks (c : Cert) : Bool := checkPicks (pickCands c) 0 (claimedPicks c)

/-! ## Score (exact rationals, SPEC 8, R20) -/

def dimIdx : Dim → Nat
  | .F => 0 | .C => 1 | .E => 2 | .A => 3 | .H => 4 | .R => 5 | .T => 6

/-- Indicators of a score row, in dimension order. -/
def indOf (xs : List Rat) : Indicators := fun d => xs.getD (dimIdx d) 0

def anchorsOf (s : ScoreClaim) : Anchors :=
  match s.zone with
  | .uk => ukAnchors s.mode
  | .india => inAnchors s.mode

/-- One scored package: seven indicators, and the claimed sub-scores, group scores and total
equal the spec definitions exactly. -/
def scoreRowOk (an : Anchors) (e : ScoreRow) : Bool :=
  e.ind.length == 7 && e.sub == Dim.all.map (subScore an (indOf e.ind)) &&
  e.groups == Ibasho.Spec.V2.Group.all.map (groupScore an (indOf e.ind)) &&
  e.total == score an (indOf e.ind)

/-- The packages the UI displays: the front and the three picks. -/
def displayedRows (c : Cert) : List Nat :=
  c.front ++ [c.picks.leastUpfront, c.picks.bestReturn, c.picks.lowestCarbon].filterMap id

/-- `score.recompute`: rows in order and in range, every displayed package scored, every score
exact. Vacuous when the certificate claims no score (the check is then reported as skipped). -/
def chkScore (c : Cert) : Bool :=
  match c.score with
  | none => true
  | some s =>
    strictlySorted (s.rows.map (·.row)) &&
    s.rows.all (fun e => decide (e.row < c.rows) && scoreRowOk (anchorsOf s) e) &&
    (displayedRows c).all fun r => s.rows.any (·.row == r)

/-! ## Verdicts -/

structure Verdict where
  id : CheckId
  ok : Bool
  path : Option String := none
  detail : Option String := none

/-- Checks skipped when the certificate does not claim what they check, with the reason. -/
def skipReasons : List (CheckId × String) :=
  [(.scoreRecompute, "the certificate claims no score")]

/-- Checks that do not apply to this certificate, with the reason (never shown as passed). -/
def skipped (c : Cert) : List (CheckId × String) :=
  if c.score.isSome then [] else skipReasons

/-- A score row out of range or not exact (for the verdict `path`). -/
def scoreRowBad (c : Cert) (s : ScoreClaim) (e : ScoreRow) : Bool :=
  !(decide (e.row < c.rows) && scoreRowOk (anchorsOf s) e)

/-- The `score.recompute` verdict, present only when the certificate claims a score. -/
def scoreVerdicts (c : Cert) : List Verdict :=
  match c.score with
  | some s =>
    [ { id := .scoreRecompute, ok := chkScore c,
        path := (s.rows.find? (scoreRowBad c s)).map fun e => s!"row/{e.row}" } ]
  | none => []

def check (c : Cert) : List Verdict :=
  let D := derive c
  [ { id := .specKnown, ok := chkSpecKnown c,
      detail := if chkSpecKnown c then none else some s!"specHash {c.specHash} is not known" },
    { id := .packsWellformed, ok := chkPacks c D },
    { id := .enumComplete, ok := chkEnum c },
    { id := .acctSaving, ok := chkAcctSaving c D,
      detail := if c.saving.isNone then some "claimed.saving is missing" else none,
      path := match c.saving with
        | some s => firstBad c fun r => (List.range 6).all fun i =>
            s.getD (r * 6 + i) 0 == ((D[r]?.map (·.saving)).getD []).getD i 0
        | none => none },
    { id := .acctCarbon, ok := chkAcctCarbon c D,
      detail := if c.carbonAnnual.isNone then some "claimed.carbonAnnual is missing" else none },
    { id := .moneyBills, ok := chkBills c D,
      detail := if c.bills.isNone then some "claimed.bills is missing" else none,
      path := match c.bills with
        | some b => firstBad c (billRowOk D b)
        | none => none },
    { id := .finRecompute, ok := chkFin c D,
      path := firstBad c fun r => match D[r]? with
        | some d => c.n0.getD r 0 == d.n0 && c.npv.getD r 0 == d.npv &&
            c.carbonSaved.getD r 0 == d.lifetimeCarbon
        | none => false },
    { id := .feasRecompute, ok := chkFeas c D,
      detail := if metaPresent c then none else some "groups[].optionMeta (measure, kind) is missing",
      path := firstBad c fun r => match D[r]? with
        | some d => statusClass (c.status.getD r 99) == statusClass d.expected &&
            withoutTarget (c.ruleIds.getD r []) == withoutTarget d.expectedIds
        | none => false },
    { id := .targetRecompute, ok := chkTarget c D },
    { id := .paretoFront, ok := chkFront c },
    { id := .paretoWitness, ok := chkWitness c },
    { id := .paretoPicks, ok := chkPicks c } ] ++ scoreVerdicts c

/-- Every check that ran passed. -/
def checkAll (c : Cert) : Bool := (check c).all (·.ok)

end Ibasho.Check
