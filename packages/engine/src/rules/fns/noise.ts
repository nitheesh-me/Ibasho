/**
 * MCS 020 a) heat pump noise by rational enclosure (RP 6.1, SPEC 9, DEC TE-3). Owner: WP-03.
 *
 * A line-for-line mirror of Lean `Ibasho.Spec.V2.Noise` (`proofs/Ibasho/Spec/V2/Rules/Noise.lean`):
 * same tables, same bounds, same three-valued decision. Per unit at one assessment position
 *   Lp = LwA + 10 log10(Q / (4 pi r^2)) - A_B,
 * units add on the energy scale, the total is rounded to 0.1 dB and passes iff it is at most
 * 37.0 dB(A). With deci-decibels and decimetres the energy of one unit is
 *   E = 10^((LwA - A_B) / 100) * 25 Q / (pi r_dm^2),
 * and the pass test is sum E < 10^3.705. Every transcendental constant is enclosed in a rational
 * interval, so the decision is `true` only when every admissible value passes, `false` only when
 * every one fails, and `'unknown'` in between (Lean `noise_enclosure_sound`).
 *
 * All arithmetic here is exact (bigint rationals). Floats appear only in `lpDisplay`, which is
 * for the UI and never decides anything.
 */
import { Q, type Tri, triAnd } from '@ibasho/core';
import { log10 } from '@ibasho/dmath';

/** Fixed-point scale of the tables: 10^9. */
const SCALE = 1_000_000_000n;

/** `floor(10^(k/100) * 10^9)` for k = 0..99 (Lean `pow10LoTable`). The upper bound is the next integer. */
export const POW10_LO_TABLE: readonly bigint[] = [
  1000000000n,
  1023292992n,
  1047128548n,
  1071519305n,
  1096478196n,
  1122018454n,
  1148153621n,
  1174897554n,
  1202264434n,
  1230268770n,
  1258925411n,
  1288249551n,
  1318256738n,
  1348962882n,
  1380384264n,
  1412537544n,
  1445439770n,
  1479108388n,
  1513561248n,
  1548816618n,
  1584893192n,
  1621810097n,
  1659586907n,
  1698243652n,
  1737800828n,
  1778279410n,
  1819700858n,
  1862087136n,
  1905460717n,
  1949844599n,
  1995262314n,
  2041737944n,
  2089296130n,
  2137962089n,
  2187761623n,
  2238721138n,
  2290867652n,
  2344228815n,
  2398832919n,
  2454708915n,
  2511886431n,
  2570395782n,
  2630267991n,
  2691534803n,
  2754228703n,
  2818382931n,
  2884031503n,
  2951209226n,
  3019951720n,
  3090295432n,
  3162277660n,
  3235936569n,
  3311311214n,
  3388441561n,
  3467368504n,
  3548133892n,
  3630780547n,
  3715352290n,
  3801893963n,
  3890451449n,
  3981071705n,
  4073802778n,
  4168693834n,
  4265795188n,
  4365158322n,
  4466835921n,
  4570881896n,
  4677351412n,
  4786300923n,
  4897788193n,
  5011872336n,
  5128613839n,
  5248074602n,
  5370317963n,
  5495408738n,
  5623413251n,
  5754399373n,
  5888436553n,
  6025595860n,
  6165950018n,
  6309573444n,
  6456542290n,
  6606934480n,
  6760829753n,
  6918309709n,
  7079457843n,
  7244359600n,
  7413102413n,
  7585775750n,
  7762471166n,
  7943282347n,
  8128305161n,
  8317637711n,
  8511380382n,
  8709635899n,
  8912509381n,
  9120108393n,
  9332543007n,
  9549925860n,
  9772372209n,
];

/** `floor(10^0.705 * 10^9)`: the threshold 10^3.705 = 1000 * 10^0.705 (37.05 dB). Lean `thrLoN`. */
export const THR_LO_N = 5069907082n;

/** 1/pi bounds from 333/106 < pi < 355/113 (Lean `piInvLo`, `piInvHi`). */
export const PI_INV_LO: Q = Q.of(113n, 355n);
export const PI_INV_HI: Q = Q.of(106n, 333n);

/** Bounds of the energy threshold 10^3.705 (Lean `thrLo`, `thrHi`). */
export const THR_LO: Q = Q.of(1000n * THR_LO_N, SCALE);
export const THR_HI: Q = Q.of(1000n * (THR_LO_N + 1n), SCALE);

/** Euclidean division by a positive divisor (Lean `Int` `/` and `%`). */
function ediv(a: bigint, b: bigint): [bigint, bigint] {
  let q = a / b;
  let r = a - q * b;
  if (r < 0n) {
    q -= 1n;
    r += b;
  }
  return [q, r];
}

/** 10^n for n >= 0, exact bigint (no `**`: the engine lint bans it). */
function pow10Big(n: bigint): bigint {
  let x = 1n;
  for (let i = 0n; i < n; i++) x *= 10n;
  return x;
}

/** 10^a for an integer exponent, exact (Lean `pow10Int`). */
function pow10Int(a: bigint): Q {
  return a >= 0n ? Q.of(pow10Big(a), 1n) : Q.of(1n, pow10Big(-a));
}

function tableAt(k: bigint): bigint {
  return POW10_LO_TABLE[Number(k)] ?? 0n;
}

/** Lower bound of 10^(m/100) (Lean `p10Lo`). */
export function p10Lo(m: bigint): Q {
  const [d, r] = ediv(m, 100n);
  return Q.mul(pow10Int(d), Q.of(tableAt(r), SCALE));
}
/** Upper bound of 10^(m/100) (Lean `p10Hi`). */
export function p10Hi(m: bigint): Q {
  const [d, r] = ediv(m, 100n);
  return Q.mul(pow10Int(d), Q.of(tableAt(r) + 1n, SCALE));
}

/** How much of the unit the assessment position can see past a barrier. */
export type View = 'hidden' | 'partly' | 'full';
/** Barrier between unit and position: type 1 is masonry or a solid fence of at least 18 mm. */
export type Barrier = { type: 'none' } | { type: 1 | 2; view: View };

/** Barrier attenuation A_B in deci-decibels: type 1 is 10 / 5 / 0 dB, type 2 is 5 / 2.5 / 0. */
export function attenuationDdB(b: Barrier): bigint {
  if (b.type === 'none') return 0n;
  const t = b.type === 1 ? [100n, 50n, 0n] : [50n, 25n, 0n];
  return t[b.view === 'hidden' ? 0 : b.view === 'partly' ? 1 : 2] as bigint;
}

/** Directivity Q from the count of reflecting surfaces within 1 m; more than 3 fails (undefined). */
export function directivity(surfaces: number): bigint | undefined {
  return surfaces === 1 ? 2n : surfaces === 2 ? 4n : surfaces === 3 ? 8n : undefined;
}

/** One unit seen from one assessment position (Lean `UnitAt`). */
export interface UnitAt {
  /** Sound power LwA in deci-decibels (60.0 dB is 600). */
  lwaDdB: number;
  /** Reflecting surfaces within 1 m of the unit. */
  surfaces: number;
  /** Distance in decimetres, rounded to 0.1 m (8.0 m is 80); must be positive. */
  rDm: number;
  barrier: Barrier;
}

function expo(u: UnitAt): bigint {
  return BigInt(u.lwaDdB) - attenuationDdB(u.barrier);
}
function geom(u: UnitAt, q: bigint): Q {
  const r = BigInt(u.rDm);
  return Q.of(25n * q, r * r);
}
/** Inputs the rule can judge: known directivity and a positive integer distance. */
export function inDomain(u: UnitAt): boolean {
  return (
    directivity(u.surfaces) !== undefined &&
    Number.isSafeInteger(u.rDm) &&
    u.rDm > 0 &&
    Number.isSafeInteger(u.lwaDdB)
  );
}
/** Lower energy bound of one unit (Lean `UnitAt.eLo`). */
export function eLo(u: UnitAt): Q {
  const q = directivity(u.surfaces);
  return q === undefined ? Q.ZERO : Q.mul(Q.mul(p10Lo(expo(u)), PI_INV_LO), geom(u, q));
}
/** Upper energy bound of one unit (Lean `UnitAt.eHi`). */
export function eHi(u: UnitAt): Q {
  const q = directivity(u.surfaces);
  return q === undefined ? Q.ZERO : Q.mul(Q.mul(p10Hi(expo(u)), PI_INV_HI), geom(u, q));
}

/** Rational enclosure of the total energy at one position. */
export function energyBounds(us: readonly UnitAt[]): { lo: Q; hi: Q } {
  return { lo: Q.sum(us.map(eLo)), hi: Q.sum(us.map(eHi)) };
}

/** Three-valued test "Lp,total <= 37.0 dB(A) after rounding" at one position (Lean `decidePosition`). */
export function decidePosition(us: readonly UnitAt[]): Tri {
  if (!us.every(inDomain)) return false;
  const { lo, hi } = energyBounds(us);
  if (Q.lt(hi, THR_LO)) return true;
  if (Q.le(THR_HI, lo)) return false;
  return 'unknown';
}

/** The named function `mcs020a_Lp_le`: every assessment position passes (Lean `mcs020aLpLe`). */
export function mcs020aLpLe(positions: readonly (readonly UnitAt[])[]): Tri {
  return triAnd(...positions.map(decidePosition));
}

/**
 * Display enclosure of Lp,total in dB(A): 10 log10 of the rational energy bounds, in floats.
 * For the UI only (noise rings, the 36.8 / 37.1 glow); never used to decide.
 */
export function lpDisplay(us: readonly UnitAt[]): { lo: number; hi: number } {
  if (us.length === 0 || !us.every(inDomain))
    return { lo: Number.NEGATIVE_INFINITY, hi: Number.POSITIVE_INFINITY };
  const { lo, hi } = energyBounds(us);
  return { lo: 10 * log10(Q.toNumber(lo)), hi: 10 * log10(Q.toNumber(hi)) };
}

// ---------------------------------------------------------------------------------------------
// Fact encoding. Rule arguments are facts, so the noise inputs of one heat pump option travel as
// one string fact (`m.ashp.noise`): positions joined by `|`, units of a position by `;`, the
// fields of a unit by `,` as `lwaDdB,surfaces,rDm,barrier` with barrier `n`, `1h`, `1p`, `1f`,
// `2h`, `2p` or `2f`. The empty string is "no assessment position" (passes, as in Lean).

const VIEW_CODE: Record<View, string> = { hidden: 'h', partly: 'p', full: 'f' };
const CODE_VIEW: Record<string, View> = { h: 'hidden', p: 'partly', f: 'full' };

function barrierCode(b: Barrier): string {
  return b.type === 'none' ? 'n' : `${b.type}${VIEW_CODE[b.view]}`;
}
function parseBarrier(s: string): Barrier | undefined {
  if (s === 'n') return { type: 'none' };
  const t = s[0];
  const v = CODE_VIEW[s.slice(1)];
  if (s.length !== 2 || v === undefined || (t !== '1' && t !== '2')) return undefined;
  return { type: t === '1' ? 1 : 2, view: v };
}

/** Encode noise inputs as the `m.ashp.noise` fact string. */
export function encodeNoiseSites(positions: readonly (readonly UnitAt[])[]): string {
  return positions
    .map((us) => us.map((u) => `${u.lwaDdB},${u.surfaces},${u.rDm},${barrierCode(u.barrier)}`).join(';'))
    .join('|');
}

const INT = /^-?\d+$/;

/** Decode the fact string; `undefined` when malformed (the rule then reads unknown). */
export function decodeNoiseSites(s: string): UnitAt[][] | undefined {
  if (s === '') return [];
  const out: UnitAt[][] = [];
  for (const pos of s.split('|')) {
    const us: UnitAt[] = [];
    if (pos !== '')
      for (const unit of pos.split(';')) {
        const f = unit.split(',');
        if (f.length !== 4 || !INT.test(f[0]!) || !INT.test(f[1]!) || !INT.test(f[2]!)) return undefined;
        const barrier = parseBarrier(f[3]!);
        if (barrier === undefined) return undefined;
        us.push({ lwaDdB: Number(f[0]), surfaces: Number(f[1]), rDm: Number(f[2]), barrier });
      }
    out.push(us);
  }
  return out;
}

/** Named-function form: one string argument, the encoded sites. Malformed input is unknown. */
export function mcs020aLpLeFn(args: readonly (number | string)[]): Tri {
  const s = args[0];
  if (args.length !== 1 || typeof s !== 'string') return 'unknown';
  const sites = decodeNoiseSites(s);
  return sites === undefined ? 'unknown' : mcs020aLpLe(sites);
}
