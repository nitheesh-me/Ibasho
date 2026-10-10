/**
 * Certificate wire encoding (ARCH 8.3): base64 of little-endian int64, u32 or u8 arrays.
 * Owner: WP-02. Pure and identical in every engine (no `btoa`, no platform byte order).
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64(bytes: Uint8Array): string {
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

export function fromBase64(s: string): Uint8Array {
  if (s.length % 4 !== 0) throw new Error('base64 length must be a multiple of 4');
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((s.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    let n = 0;
    for (let k = 0; k < 4; k++) {
      const ch = s[i + k]!;
      const v = ch === '=' ? 0 : ALPHABET.indexOf(ch);
      if (v < 0) throw new Error(`bad base64 character ${ch}`);
      n = (n << 6) | v;
    }
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

export function i64b64(xs: ArrayLike<bigint>): string {
  const bytes = new Uint8Array(xs.length * 8);
  const dv = new DataView(bytes.buffer);
  for (let i = 0; i < xs.length; i++) dv.setBigInt64(i * 8, xs[i]!, true);
  return base64(bytes);
}

export function u32b64(xs: ArrayLike<number>): string {
  const bytes = new Uint8Array(xs.length * 4);
  const dv = new DataView(bytes.buffer);
  for (let i = 0; i < xs.length; i++) dv.setUint32(i * 4, xs[i]!, true);
  return base64(bytes);
}

export function u8b64(xs: ArrayLike<number>): string {
  return base64(Uint8Array.from(xs as ArrayLike<number>));
}

export function decodeI64(s: string): bigint[] {
  const bytes = fromBase64(s);
  if (bytes.length % 8 !== 0) throw new Error('int64 payload length must be a multiple of 8');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: bigint[] = [];
  for (let i = 0; i < bytes.length; i += 8) out.push(dv.getBigInt64(i, true));
  return out;
}

export function decodeU32(s: string): number[] {
  const bytes = fromBase64(s);
  if (bytes.length % 4 !== 0) throw new Error('u32 payload length must be a multiple of 4');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i += 4) out.push(dv.getUint32(i, true));
  return out;
}

export function decodeU8(s: string): number[] {
  return [...fromBase64(s)];
}
