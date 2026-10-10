/-
Ibasho checker: the spec manifest and `specHash` (DEC TE-2, ARCH 8.2). Owner: WP-04 (checker
half). Init plus the spec.

`specHash` is the SHA-256 of a canonical text listing every normative constant the TS side
consumes (weights, groups, anchors, R and T parameters, bands, fixed-point scales, search limits,
named functions, check ids, built-in rule ids) plus `specVersion`. Formula changes bump
`specVersion`, so they change the hash too. Pack data is not covered: it travels in the
certificate and is checked by `packs.wellformed`.
-/
import Ibasho.Spec.V2.Fixed
import Ibasho.Spec.V2.Score
import Ibasho.Check.Ids
import Ibasho.Check.Sha256

namespace Ibasho.Check
open Ibasho.Spec.V2

def ratWire (q : Rat) : String := s!"{q.num}/{q.den}"

def Dim.name : Dim → String
  | .F => "F" | .C => "C" | .E => "E" | .A => "A" | .H => "H" | .R => "R" | .T => "T"

def Group.name : Ibasho.Spec.V2.Group → String
  | .fabricHeating => "fabric-heating" | .runningCost => "running-cost"
  | .carbon => "carbon" | .comfort => "comfort"

def anchorLines (pack : String) (an : AMode → Anchors) : List String :=
  [AMode.burden, AMode.perArea].flatMap fun mode =>
    let m := match mode with | .burden => "burden" | .perArea => "per-area"
    Dim.all.map fun d =>
      s!"anchor {pack} {m} {Dim.name d} best={ratWire (an mode d).best} worst={ratWire (an mode d).worst}"

/-- The canonical spec manifest, one fact per line. -/
def specManifest : String :=
  String.intercalate "\n" (
    [s!"version {specVersion}"] ++
    Dim.all.map (fun d => s!"weight {Dim.name d} {ratWire (weight d)}") ++
    Ibasho.Spec.V2.Group.all.map (fun g =>
      s!"group {Group.name g} {String.intercalate "," (g.dims.map Dim.name)}") ++
    anchorLines "uk" ukAnchors ++ anchorLines "in" inAnchors ++
    [s!"rTarget uk {ratWire ukRTarget}", s!"rTarget in {ratWire inRTarget}",
     s!"tCaps uk {ratWire ukTCaps.1},{ratWire ukTCaps.2}",
     s!"tCaps in {ratWire inTCaps.1},{ratWire inTCaps.2}"] ++
    bandThresholds.map (fun (b, t) => s!"band {b} {t}") ++
    [s!"fixed dfScale {dfScale}", s!"fixed ppb {ppb}", s!"fixed microPencePerPound {microPencePerPound}",
     s!"fixed ugPerG {ugPerG}",
     s!"limit heavy {searchLimitHeavy}", s!"limit packages {searchLimitPackages}"] ++
    namedFns.map (fun (f, impl) => s!"fn {f} {impl}") ++
    CheckId.all.map (fun c => s!"check {c.name}") ++
    builtinRules.map (fun r => s!"builtin {r.rule.id}") ++
    [s!"builtin {builtinMemory}", s!"builtin {builtinTarget}"]) ++ "\n"

/-- The current spec hash. -/
def specHash : String := Sha256.hex specManifest

/-- Older spec hashes whose certificates this checker still accepts (DEC TE-2). The V1
placeholder never shipped a real hash, so the list starts empty. -/
def historicalSpecHashes : List String := []

def knownSpecHashes : List String := specHash :: historicalSpecHashes

end Ibasho.Check
