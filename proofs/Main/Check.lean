/-
`lake exe ibasho-check [--batch] [file]` (ARCH 8.1, LV 6.6). Owner: WP-04.

Reads one `ibasho.cert/2` certificate (a file, or stdin) and prints one JSON line:
`{"schema":"ibasho.verdicts/1","ok":bool,"specHash":...,"verdicts":[{"check","ok","path"?,"detail"?}],
"skipped":[{"check","reason"}]}`. Exit 0 when every check that ran passed, 1 when one failed,
2 when the certificate is malformed.

`--batch`: NDJSON in (one certificate per line), NDJSON out (one verdict line per input line);
exit 0 only when every certificate passed, 1 when any failed, 2 when any was malformed.
-/
import Lean.Data.Json
import Ibasho.Check

open Lean Ibasho.Check

def verdictJson (v : Verdict) : Lean.Json :=
  Lean.Json.mkObj ([("check", Lean.Json.str v.id.name), ("ok", Lean.Json.bool v.ok)] ++
    (match v.path with | some p => [("path", Lean.Json.str p)] | none => []) ++
    (match v.detail with | some d => [("detail", Lean.Json.str d)] | none => []))

def report (c : Cert) : Lean.Json × Bool :=
  let vs := check c
  let ok := vs.all (·.ok)
  (Lean.Json.mkObj [("schema", "ibasho.verdicts/1"), ("ok", ok), ("specHash", c.specHash),
    ("rows", c.rows), ("verdicts", Lean.Json.arr (vs.map verdictJson).toArray),
    ("skipped", Lean.Json.arr ((skipped c).map fun (id, why) =>
      Lean.Json.mkObj [("check", id.name), ("reason", why)]).toArray)], ok)

def malformed (e : String) : Lean.Json :=
  Lean.Json.mkObj [("schema", "ibasho.verdicts/1"), ("ok", false), ("error", s!"malformed certificate: {e}")]

/-- 0 ok, 1 a check failed, 2 malformed. -/
def runOne (src : String) : IO UInt32 := do
  match Json.parseCert src with
  | .error e =>
    IO.println (malformed e).compress
    return 2
  | .ok c =>
    let (j, ok) := report c
    IO.println j.compress
    return if ok then 0 else 1

def main (args : List String) : IO UInt32 := do
  let batch := args.contains "--batch"
  let files := args.filter (· != "--batch")
  if files.length > 1 then
    IO.eprintln "usage: ibasho-check [--batch] [certificate.json]"
    return 2
  let src ← match files with
    | [path] => IO.FS.readFile path
    | _ => (← IO.getStdin).readToEnd
  if batch then
    let mut worst : UInt32 := 0
    for line in src.splitOn "\n" do
      if line.trimAscii.isEmpty then continue
      let code ← runOne line
      worst := max worst code
    return worst
  else
    runOne src
