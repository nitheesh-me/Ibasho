/** Wire codec: the same vectors as the Lean `#guard`s in `Ibasho.Check.Wire`. Owner: WP-04. */
import { describe, expect, it } from 'vitest';
import { decodeB64, decodeI64, decodeU8, decodeU32, encodeI64, encodeU8, encodeU32 } from '../src/wire.ts';

describe('wire', () => {
  it('decodes the Lean guard vectors', () => {
    expect(decodeU8('AwABAQAAAQE=')).toEqual([3, 0, 1, 1, 0, 0, 1, 1]);
    expect(decodeU32('AQAAAAQAAAAFAAAA')).toEqual([1, 4, 5]);
    expect(decodeI64('//////////8=')).toEqual([-1n]);
    expect(decodeI64('AAAAAAAAAIA=')).toEqual([-(2n ** 63n)]);
  });
  it('round trips', () => {
    const xs = [0n, 1n, -1n, 2n ** 63n - 1n, -(2n ** 63n), 123456789012345n];
    expect(decodeI64(encodeI64(xs))).toEqual(xs);
    expect(decodeU32(encodeU32([0, 1, 0xffffffff]))).toEqual([0, 1, 0xffffffff]);
    expect(decodeU8(encodeU8([0, 255, 7]))).toEqual([0, 255, 7]);
  });
  it('rejects what Lean rejects', () => {
    expect(() => decodeB64('AAA')).toThrow(/multiple of 4/);
    expect(() => decodeB64('A=AA')).toThrow(/padding inside/);
    expect(() => decodeB64('AA*A')).toThrow(/bad base64/);
    expect(() => decodeI64('AAAA')).toThrow(/multiple of 8/);
  });
});
