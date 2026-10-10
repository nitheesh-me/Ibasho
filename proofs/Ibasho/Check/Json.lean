/-
Ibasho checker: JSON adapter for the native exe (ARCH 8.1 `Cert/Json.lean`). Owner: WP-04
(checker half). Parses `ibasho.cert/2` into `Cert`. Exact numbers only: integers travel as decimal
strings or base64 int64, fact numbers as JSON decimals read exactly as rationals.

The parser is part of the trusted base (LV 10). It never fills a missing value with a default
that could make a check pass: an absent optional field becomes `none` and the check that needs it
fails or treats it as unknown.
-/
import Lean.Data.Json
import Ibasho.Check.Schema
import Ibasho.Check.Wire

namespace Ibasho.Check.Json
open Lean Ibasho.Spec.V2

abbrev P := Except String

def field (j : Json) (k : String) : P Json :=
  match j.getObjVal? k with
  | .ok v => .ok v
  | .error _ => .error s!"missing field {k}"

/-- An optional field; `null` counts as absent. -/
def opt (j : Json) (k : String) : Option Json :=
  match j.getObjVal? k with
  | .ok Json.null => none
  | .ok v => some v
  | .error _ => none

def str (j : Json) (what : String) : P String :=
  match j with
  | .str s => .ok s
  | _ => .error s!"{what}: expected a string"

def strField (j : Json) (k : String) : P String := do str (← field j k) k

def arr (j : Json) (what : String) : P (Array Json) :=
  match j with
  | .arr a => .ok a
  | _ => .error s!"{what}: expected an array"

def obj (j : Json) (what : String) : P (List (String × Json)) :=
  match j with
  | .obj o => .ok o.toList
  | _ => .error s!"{what}: expected an object"

def ratOf (n : JsonNumber) : Rat := (n.mantissa : Rat) / ((10 ^ n.exponent : Nat) : Rat)

/-- A JSON integer (number with no fractional part). -/
def natOf (j : Json) (what : String) : P Nat :=
  match j with
  | .num n =>
    let q := ratOf n
    if q.den == 1 && 0 ≤ q.num then .ok q.num.toNat else .error s!"{what}: expected a natural number"
  | _ => .error s!"{what}: expected a number"

/-- A decimal integer string (micro-pence, Wh, µg/Wh). -/
def decInt (j : Json) (what : String) : P Int := do
  let s ← str j what
  match s.toInt? with
  | some n => .ok n
  | none => .error s!"{what}: expected a decimal integer string, got {s}"

def boolOf (j : Json) (what : String) : P Bool :=
  match j with
  | .bool b => .ok b
  | _ => .error s!"{what}: expected a boolean"

/-- `yyyy-mm-dd` as the number `yyyymmdd`. -/
def date (s : String) : P Nat :=
  match s.splitOn "-" with
  | [y, m, d] =>
    match y.toNat?, m.toNat?, d.toNat? with
    | some y, some m, some d =>
      if s.length == 10 then .ok (y * 10000 + m * 100 + d)
      else .error s!"bad date {s}"
    | _, _, _ => .error s!"bad date {s}"
  | _ => .error s!"bad date {s}"

/-- A fact value: numbers exact, booleans as 1 and 0, `"unknown"` and `null` unknown. -/
def fact (j : Json) : Fact :=
  match j with
  | .num n => some (.num (ratOf n))
  | .bool true => some (.num 1)
  | .bool false => some (.num 0)
  | .str "unknown" => none
  | .str s => some (.str s)
  | _ => none

def factTable (j : Json) (what : String) : P FactTable := do
  return (← obj j what).map fun (k, v) => (k, fact v)

def tri (j : Json) : P Tri :=
  match j with
  | .bool true => .ok .yes
  | .bool false => .ok .no
  | .str "unknown" => .ok .unknown
  | _ => .error "expected true, false or \"unknown\""

def cmpOp : String → P CmpOp
  | "<" => .ok .lt | "<=" => .ok .le | "=" => .ok .eq | ">=" => .ok .ge | ">" => .ok .gt
  | "!=" => .ok .ne | o => .error s!"unknown comparison {o}"

def factRef (j : Json) : P String := strField j "fact"

def literal (j : Json) : P Val :=
  match j with
  | .num n => .ok (.num (ratOf n))
  | .str s => .ok (.str s)
  | .bool b => .ok (.num (if b then 1 else 0))
  | _ => .error "bad literal"

partial def expr (j : Json) : P Expr := do
  if let some a := opt j "and" then return .and ((← (← arr a "and").toList.mapM expr))
  if let some a := opt j "or" then return .or ((← (← arr a "or").toList.mapM expr))
  if let some e := opt j "not" then return .not (← expr e)
  if let some c := opt j "const" then return .const (← tri c)
  if let some op := opt j "cmp" then
    let r ← field j "right"
    let right ← match r with
      | .obj _ => pure (Operand.fact (← factRef r))
      | _ => pure (Operand.lit (← literal r))
    return .cmp (← cmpOp (← str op "cmp")) (← factRef (← field j "left")) right
  if let some x := opt j "in" then
    return .mem (← factRef x) ((← (← arr (← field j "set") "set").toList.mapM literal))
  if let some f := opt j "fn" then
    return .fn (← str f "fn") ((← (← arr (← field j "args") "args").toList.mapM factRef))
  throw "unknown expression shape"

def effect (j : Json) : P Effect := do
  match ← strField j "kind" with
  | "block" => return .block
  | "check" => return .check (← strField j "check")
  | "consent" => return .consent (← strField j "authority")
  | "oblige" => return .oblige (← field j "spec").compress
  | "warn" => return .warn (← strField j "risk")
  | "info" => return .info
  | k => throw s!"unknown effect {k}"

def packRule (j : Json) : P PackRule := do
  let id ← strField j "id"
  let measures ← match ← field j "measures" with
    | .str "*" => pure none
    | m => pure (some ((← (← arr m "measures").toList.mapM (str · "measure"))))
  let effectiveTo ← match opt j "effectiveTo" with
    | some d => pure (some (← date (← str d "effectiveTo")))
    | none => pure none
  return {
    rule := { id, when := ← expr (← field j "when"), effect := ← effect (← field j "effect"),
              effectiveFrom := ← date (← strField j "effectiveFrom"), effectiveTo }
    jurisdiction := ← strField j "jurisdiction"
    measures
    packageScope := (← strField j "scope") == "package" }

def checkResult : String → P CheckResult
  | "pass" => .ok .pass | "conditional" => .ok .conditional | "fail" => .ok .fail
  | r => .error s!"unknown check result {r}"

def fuelOf (s : String) : P Fuel :=
  match Fuel.ofName s with
  | some f => .ok f
  | none => .error s!"unknown fuel {s}"

def fuelRows (j : Json) (what : String) : P (List (Fuel × Array Int)) := do
  (← obj j what).mapM fun (k, v) => do
    let xs ← (← arr v k).mapM (decInt · k)
    return (← fuelOf k, xs)

def tariff (j : Json) : P Tariff := do
  let d ← field j "data"
  let slabs ← (← arr (← field d "slabs") "slabs").toList.mapM fun s => do
    let upto ← match opt s "uptoWh" with
      | some u => pure (some (← decInt u "uptoWh"))
      | none => pure none
    return (upto, ← decInt (← field s "price") "price")
  return {
    id := ← strField j "id", fuel := ← fuelOf (← strField d "fuel"),
    yearly := (← strField d "period") == "year", slabs,
    standingPerDay := ← decInt (← field d "standingPerDay") "standingPerDay",
    standingWhenUnused := ← boolOf (← field d "standingWhenUnused") "standingWhenUnused",
    validFrom := ← date (← strField d "validFrom"), validTo := ← date (← strField d "validTo") }

def grant (j : Json) : P Grant := do
  let d ← field j "data"
  let od (k : String) : P (Option Nat) := match opt d k with
    | some v => do pure (some (← date (← str v k)))
    | none => pure none
  let applied ← (← arr (← field d "applied") "applied").toList.mapM fun a => do
    match (← arr a "applied row").toList with
    | [r, amt] => do
      let row ← decInt r "row"
      if row < 0 then throw "applied row must be a natural number"
      return (row.toNat, ← decInt amt "amount")
    | _ => throw "applied entries are [row, amount]"
  return { id := ← strField j "id", validFrom := ← od "validFrom", validTo := ← od "validTo",
           applied }

def target (j : Json) : P Target := do
  match ← strField j "kind" with
  | "default" => return .default
  | "custom" =>
    let save ← boolOf (← field j "saveMoneyYear1") "saveMoneyYear1"
    let cut ← boolOf (← field j "cutRunningCarbon") "cutRunningCarbon"
    return .custom save cut
  | "epc-band-at-least" => return .epcBand (← strField j "band")
  | k => throw s!"unknown target {k}"

def ownerFacts (o : Json) : P (FactTable × Option Int) := do
  let tenure ← strField o "tenure"
  let budget ← match opt o "budget" with
    | some b => pure (some (← decInt b "budget"))
    | none => pure none
  let mut t : FactTable :=
    [("o.tenure", if tenure == "unknown" then none else some (.str tenure)),
     ("o.budget.set", some (.num (if budget.isSome then 1 else 0)))]
  if let some b := budget then t := t ++ [("o.budget", some (.num b))]
  if let some r := opt o "rights" then
    for k in ["roof", "externalWalls", "windows"] do
      t := t ++ [(s!"o.rights.{k}", match opt r k with | some v => fact v | none => none)]
  return (t, budget)

/-- Sparse light records: `heavyIdx, n, n x (slot, delta)` per row. -/
def lightRecords (xs : Array Int) : P (Array (Nat × List (Nat × Int))) := do
  let mut out := #[]
  let mut i := 0
  for _ in [0:xs.size] do
    if i ≥ xs.size then break
    if i + 1 ≥ xs.size then throw "truncated light record"
    let k := xs[i]!
    let n := xs[i + 1]!
    if k < 0 || n < 0 || i + 2 + 2 * n.toNat > xs.size then throw "bad light record"
    let pairs := (List.range n.toNat).map fun p =>
      (xs[i + 2 + 2 * p]!.toNat, xs[i + 3 + 2 * p]!)
    if (List.range n.toNat).any fun p =>
        xs[i + 2 + 2 * p]! < 0 || xs[i + 2 + 2 * p]! ≥ ((3 * slotsPerMode : Nat) : Int) then
      throw "light slot out of range"
    out := out.push (k.toNat, pairs)
    i := i + 2 + 2 * n.toNat
  return out

def optB64I64 (j : Json) (k : String) : P (Option (Array Int)) :=
  match opt j k with
  | some v => do pure (some (← decodeI64 (← str v k)))
  | none => pure none

/-- An exact rational in wire form, `"n"` or `"n/d"` with `d > 0` (TS `Q.toWire`). Digits only,
an optional leading minus on `n`; not required to be reduced. -/
def ratWireOf (j : Json) (what : String) : P Rat := do
  let s ← str j what
  let digits (t : String) : Bool := !t.isEmpty && t.all Char.isDigit
  let intOf (t : String) : Option Int :=
    if t.startsWith "-" then
      let u := String.ofList (t.toList.drop 1)
      if digits u then u.toNat?.map fun n => -(n : Int) else none
    else if digits t then t.toNat?.map Int.ofNat else none
  match s.splitOn "/" with
  | [n] => match intOf n with
    | some n => .ok n
    | none => .error s!"{what}: bad rational {s}"
  | [n, d] => match intOf n, (if digits d then d.toNat? else none) with
    | some n, some d => if d == 0 then .error s!"{what}: zero denominator" else .ok ((n : Rat) / (d : Rat))
    | _, _ => .error s!"{what}: bad rational {s}"
  | _ => .error s!"{what}: bad rational {s}"

def ratList (j : Json) (what : String) : P (List Rat) := do
  (← arr j what).toList.mapM (ratWireOf · what)

def scoreClaim (j : Json) : P ScoreClaim := do
  let zone ← match ← strField j "zone" with
    | "uk" => pure Zone.uk
    | "in" => pure Zone.india
    | z => throw s!"unknown score zone {z}"
  let mode ← match ← strField j "mode" with
    | "burden" => pure AMode.burden
    | "per-area" => pure AMode.perArea
    | m => throw s!"unknown score mode {m}"
  let rows ← (← arr (← field j "rows") "score rows").toList.mapM fun e => do
    return { row := ← natOf (← field e "row") "row",
             ind := ← ratList (← field e "indicators") "indicators",
             sub := ← ratList (← field e "sub") "sub",
             groups := ← ratList (← field e "groups") "groups",
             total := ← ratWireOf (← field e "total") "total" : ScoreRow }
  return { zone, mode, rows }

def options (groups : Array Json) : P (List OptionInfo) := do
  let mut out := []
  for g in groups do
    let facts ← obj (← field g "facts") "facts"
    let meta? := opt g "optionMeta"
    for o in (← arr (← field g "options") "options") do
      let id ← str o "option"
      if id == "none" then continue
      let f ← match facts.find? (·.1 == id) with
        | some (_, f) => pure f
        | none => throw s!"no facts for option {id}"
      let ft ← factTable f id
      let m := meta?.bind fun m => opt m id
      let measure := m.bind fun m => (opt m "measure").bind fun v => (str v "measure").toOption
      let kind := m.bind fun m => (opt m "kind").bind fun v => (str v "kind").toOption
      out := out ++ [{
        id, measure, kind,
        facts := ft.filter fun (k, _) => !k.startsWith "c.",
        costMid := ← decInt (← field f "c.mid") s!"{id} c.mid",
        lifetimeYears := ← natOf (← field f "c.lifetimeYears") s!"{id} c.lifetimeYears" }]
  return out

def cert (j : Json) : P Cert := do
  if (← strField j "schema") != "ibasho.cert/2" then throw "schema must be ibasho.cert/2"
  let ctx ← field j "context"
  let asOfS ← strField ctx "asOf"
  let asOf ← date asOfS
  let owner ← field ctx "owner"
  let (oFacts, budget) ← ownerFacts owner
  let home := opt ctx "home"
  let packs ← field j "packs"
  let groupsJ ← arr (← field j "groups") "groups"
  let groups ← groupsJ.toList.mapM fun g => do
    return { id := ← strField g "id",
             options := (← (← arr (← field g "options") "options").toList.mapM (str · "option")) : Group }
  let traj ← field (← field packs "trajectory") "data"
  let rulePacks ← arr (← field packs "rules") "rules"
  let rules ← rulePacks.toList.mapM fun p => do
    (← arr (← field (← field p "data") "rules") "rules").toList.mapM packRule
  let claimed ← field j "claimed"
  let picks ← field j "picks"
  let pick (k : String) : P (Option Nat) := match opt picks k with
    | some v => do pure (some (← natOf v k))
    | none => pure none
  let heavy ← field j "heavy"
  return {
    specHash := ← strField j "specHash"
    asOf, asOfYear := asOf / 10000
    ownerFacts := oFacts, budget
    discountRatePpb := ← decInt (← field owner "discountRatePpb") "discountRatePpb"
    horizon := ← natOf (← field owner "horizonYears") "horizonYears"
    target := ← target (← field ctx "target")
    rejected := (← (← arr (← field (← field ctx "memory") "rejected") "rejected").toList.mapM
      (str · "rejected"))
    completed := (← (← arr (← field (← field ctx "memory") "completed") "completed").toList.mapM
      (str · "completed"))
    region := home.bind fun h => (opt h "region").bind fun r => (str r "region").toOption
    homeFacts := ← match home.bind (opt · "facts") with
      | some f => factTable f "home facts"
      | none => pure []
    checks := ← match home.bind (opt · "checks") with
      | some cs => (← arr cs "checks").toList.mapM fun c => do
          return { kind := ← strField c "kind", atDate := ← date (← strField c "at"),
                   result := ← checkResult (← strField c "result") : CheckRec }
      | none => pure []
    groups
    options := ← options groupsJ
    tariffs := ← (← arr (← field packs "tariffs") "tariffs").toList.mapM tariff
    carbon := ← fuelRows (← field (← field (← field packs "carbon") "data") "factors") "carbon"
    trajFirstYear := ← natOf (← field traj "firstYear") "firstYear"
    trajYears := ← natOf (← field traj "years") "years"
    trajectory := ← fuelRows (← field traj "factors") "trajectory"
    grants := ← (← arr (← field packs "grants") "grants").toList.mapM grant
    rules := rules.flatten
    baseline := ← decodeI64 (← strField (← field j "baseline") "your-home")
    heavyKeys := (← (← arr (← field heavy "keys") "keys").mapM (str · "key"))
    heavy := ← decodeI64 (← strField (← field heavy "delivered") "your-home")
    light := ← lightRecords (← decodeI64 (← strField (← field j "light") "delivered"))
    status := ← decodeU8 (← strField claimed "status")
    n0 := ← decodeI64 (← strField claimed "n0")
    npv := ← decodeI64 (← strField claimed "npv")
    carbonSaved := ← decodeI64 (← strField claimed "carbonSaved")
    witness := ← decodeU32 (← strField claimed "witness")
    ruleIds := (← (← arr (← field claimed "ruleIds") "ruleIds").mapM (fun r => do
      (← arr r "ruleIds").toList.mapM (str · "ruleId")))
    saving := ← optB64I64 claimed "saving"
    carbonAnnual := ← optB64I64 claimed "carbonAnnual"
    bills := ← optB64I64 claimed "bills"
    score := ← match opt claimed "score" with
      | some v => pure (some (← scoreClaim v))
      | none => pure none
    front := (← decodeU32 (← strField j "front")).toList
    picks := { leastUpfront := ← pick "leastUpfront", bestReturn := ← pick "bestReturn",
               lowestCarbon := ← pick "lowestRunningCarbon" }
    needsCheck := (← decodeU32 (← strField j "needsCheck")).toList }

/-- Parse a certificate from JSON text. -/
def parseCert (src : String) : P Cert := do
  cert (← Lean.Json.parse src)

end Ibasho.Check.Json
