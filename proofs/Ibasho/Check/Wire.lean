/-
Ibasho checker: certificate wire decoding (ARCH 8.3). Owner: WP-04 (checker half). Init only.

Columnar fields travel as base64 of little-endian typed arrays: int64 (two's complement), u32
and u8. TS twin: `packages/verify/src/wire.ts` (and the engine emitter's `wire.ts`).
-/

namespace Ibasho.Check

/-- Value of one base64 digit (standard alphabet). -/
def b64Digit (c : Char) : Option Nat :=
  if 'A' ≤ c && c ≤ 'Z' then some (c.toNat - 'A'.toNat)
  else if 'a' ≤ c && c ≤ 'z' then some (c.toNat - 'a'.toNat + 26)
  else if '0' ≤ c && c ≤ '9' then some (c.toNat - '0'.toNat + 52)
  else if c == '+' then some 62
  else if c == '/' then some 63
  else none

/-- Decode standard padded base64. Padding is allowed only at the end. -/
def decodeB64 (s : String) : Except String (Array UInt8) := do
  let cs := s.toList.toArray
  if cs.size % 4 != 0 then throw "base64 length must be a multiple of 4"
  let pad := if s.endsWith "==" then 2 else if s.endsWith "=" then 1 else 0
  let mut out : Array UInt8 := Array.mkEmpty (cs.size / 4 * 3)
  for q in [0:cs.size / 4] do
    let mut n : Nat := 0
    for k in [0:4] do
      let i := 4 * q + k
      let ch := cs[i]!
      let v ← if ch == '=' then
          if i + pad < cs.size then throw "base64 padding inside the payload" else pure 0
        else match b64Digit ch with
          | some v => pure v
          | none => throw s!"bad base64 character {ch}"
      n := n * 64 + v
    out := out.push (n / 65536 % 256).toUInt8
    out := out.push (n / 256 % 256).toUInt8
    out := out.push (n % 256).toUInt8
  return out.extract 0 (out.size - pad)

/-- Little-endian unsigned value of `w` bytes starting at `i`. -/
def leNat (b : Array UInt8) (i w : Nat) : Nat :=
  (List.range w).foldr (fun k acc => acc * 256 + (b[i + k]!).toNat) 0

/-- int64 array (two's complement). -/
def decodeI64 (s : String) : Except String (Array Int) := do
  let b ← decodeB64 s
  if b.size % 8 != 0 then throw "int64 payload length must be a multiple of 8"
  return (Array.range (b.size / 8)).map fun k =>
    let n := leNat b (8 * k) 8
    if n ≥ 2 ^ 63 then (n : Int) - 2 ^ 64 else (n : Int)

/-- u32 array. -/
def decodeU32 (s : String) : Except String (Array Nat) := do
  let b ← decodeB64 s
  if b.size % 4 != 0 then throw "u32 payload length must be a multiple of 4"
  return (Array.range (b.size / 4)).map fun k => leNat b (4 * k) 4

/-- u8 array. -/
def decodeU8 (s : String) : Except String (Array Nat) := do
  let b ← decodeB64 s
  return b.map (·.toNat)

/-- The "no witness" marker of `claimed.witness` (u32 all ones). -/
def noWitness : Nat := 0xffffffff

#guard (decodeU8 "AwABAQAAAQE=").toOption == some #[3, 0, 1, 1, 0, 0, 1, 1]
#guard (decodeU32 "AQAAAAQAAAAFAAAA").toOption == some #[1, 4, 5]
#guard (decodeI64 "//////////8=").toOption == some #[-1]
#guard (decodeI64 "AAAAAAAAAIA=").toOption == some #[-(2 ^ 63)]

end Ibasho.Check
