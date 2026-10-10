/**
 * Certificate wire codec (ARCH 8.3): base64 of little-endian int64, u32 and u8 arrays. Owner: WP-04.
 *
 * The decoder is strict in the same way as Lean `Ibasho.Check.Wire` (length a multiple of 4,
 * padding only at the end, no stray characters), so the mirror rejects exactly what the Lean
 * checker rejects. Pure and identical in every engine: no `atob`, no platform byte order.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export class WireError extends Error {
  override name = 'WireError';
}

/** Standard padded base64. */
export function encodeB64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out +=
      ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]! + ALPHABET[(n >> 6) & 63]! + ALPHABET[n & 63]!;
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i]! << 16;
    out += `${ALPHABET[(n >> 18) & 63]!}${ALPHABET[(n >> 12) & 63]!}==`;
  } else if (rest === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out += `${ALPHABET[(n >> 18) & 63]!}${ALPHABET[(n >> 12) & 63]!}${ALPHABET[(n >> 6) & 63]!}=`;
  }
  return out;
}

/** Lean `decodeB64`. */
export function decodeB64(s: string): Uint8Array {
  if (s.length % 4 !== 0) throw new WireError('base64 length must be a multiple of 4');
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  const full = new Uint8Array((s.length / 4) * 3);
  for (let q = 0; q < s.length / 4; q++) {
    let n = 0;
    for (let k = 0; k < 4; k++) {
      const i = 4 * q + k;
      const ch = s[i]!;
      let v: number;
      if (ch === '=') {
        if (i + pad < s.length) throw new WireError('base64 padding inside the payload');
        v = 0;
      } else {
        v = ALPHABET.indexOf(ch);
        if (v < 0) throw new WireError(`bad base64 character ${ch}`);
      }
      n = (n << 6) | v;
    }
    full[3 * q] = (n >> 16) & 255;
    full[3 * q + 1] = (n >> 8) & 255;
    full[3 * q + 2] = n & 255;
  }
  return full.subarray(0, full.length - pad);
}

export function decodeI64(s: string): bigint[] {
  const b = decodeB64(s);
  if (b.length % 8 !== 0) throw new WireError('int64 payload length must be a multiple of 8');
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: bigint[] = [];
  for (let k = 0; k < b.length / 8; k++) out.push(dv.getBigInt64(8 * k, true));
  return out;
}

export function decodeU32(s: string): number[] {
  const b = decodeB64(s);
  if (b.length % 4 !== 0) throw new WireError('u32 payload length must be a multiple of 4');
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: number[] = [];
  for (let k = 0; k < b.length / 4; k++) out.push(dv.getUint32(4 * k, true));
  return out;
}

export function decodeU8(s: string): number[] {
  return [...decodeB64(s)];
}

export function encodeI64(xs: ArrayLike<bigint>): string {
  const bytes = new Uint8Array(xs.length * 8);
  const dv = new DataView(bytes.buffer);
  for (let i = 0; i < xs.length; i++) dv.setBigInt64(i * 8, xs[i]!, true);
  return encodeB64(bytes);
}

export function encodeU32(xs: ArrayLike<number>): string {
  const bytes = new Uint8Array(xs.length * 4);
  const dv = new DataView(bytes.buffer);
  for (let i = 0; i < xs.length; i++) dv.setUint32(i * 4, xs[i]!, true);
  return encodeB64(bytes);
}

export function encodeU8(xs: ArrayLike<number>): string {
  return encodeB64(Uint8Array.from(xs as ArrayLike<number>));
}
