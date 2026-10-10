import { createHash } from 'node:crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CanonicalJsonError,
  canonicalHash,
  canonicalJson,
  sha256Bytes,
  sha256Hex,
  toHex,
  utf8,
} from '../src/hash.ts';

const nodeSha = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');

describe('sha256', () => {
  it('matches FIPS 180-4 vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
    expect(sha256Hex('a'.repeat(1_000_000))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    );
  });

  it('matches node:crypto on random bytes around block boundaries', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 300 }), (b) => {
        expect(sha256Hex(b)).toBe(nodeSha(b));
      }),
    );
  });

  it('utf8 matches TextEncoder, including lone surrogates', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (s) => {
        expect(utf8(s)).toEqual(new TextEncoder().encode(s));
      }),
    );
    for (const s of ['\ud800', '\udc00x', 'a😀b', 'é中']) {
      expect(utf8(s)).toEqual(new TextEncoder().encode(s));
    }
  });

  it('hex helpers', () => {
    expect(toHex(Uint8Array.from([0, 15, 255]))).toBe('000fff');
    expect(sha256Bytes(utf8('abc')).length).toBe(32);
  });
});

describe('canonicalJson', () => {
  it('sorts keys, drops undefined properties, writes no whitespace', () => {
    expect(canonicalJson({ b: 1, a: [true, null, 'x'], c: undefined })).toBe('{"a":[true,null,"x"],"b":1}');
    expect(canonicalJson({ z: { y: 1, x: 2 } })).toBe('{"z":{"x":2,"y":1}}');
  });

  it('is independent of insertion order', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.jsonValue()), (o) => {
        const reversed = Object.fromEntries(Object.entries(o).reverse());
        expect(canonicalJson(reversed)).toBe(canonicalJson(o));
        expect(canonicalHash(reversed)).toBe(canonicalHash(o));
      }),
    );
  });

  it('round-trips JSON values through JSON.parse', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (v) => {
        expect(canonicalJson(JSON.parse(canonicalJson(v)))).toBe(canonicalJson(v));
      }),
    );
  });

  it('writes numbers, -0, bigint and typed arrays deterministically', () => {
    expect(canonicalJson(-0)).toBe('0');
    expect(canonicalJson(0.1 + 0.2)).toBe('0.30000000000000004');
    expect(canonicalJson(1e21)).toBe('1e+21');
    expect(canonicalJson(12345678901234567890n)).toBe('"12345678901234567890"');
    expect(canonicalJson(BigInt64Array.from([-1n, 2n]))).toBe('["-1","2"]');
    expect(canonicalJson(BigUint64Array.from([3n]))).toBe('["3"]');
    expect(canonicalJson(Uint32Array.from([1, 2]))).toBe('[1,2]');
    expect(canonicalJson(Float64Array.from([0.5, -0]))).toBe('[0.5,0]');
    expect(canonicalJson(Object.create(null))).toBe('{}');
    expect(canonicalJson('é"\n')).toBe(JSON.stringify('é"\n'));
  });

  it('rejects values with no canonical form', () => {
    const cyc: Record<string, unknown> = {};
    cyc.self = cyc;
    const bad: unknown[] = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      [undefined],
      () => 1,
      Symbol('s'),
      undefined,
      new Map(),
      new Set(),
      new Date(0),
      cyc,
      new DataView(new ArrayBuffer(1)),
      Float64Array.from([Number.NaN]),
    ];
    for (const v of bad) expect(() => canonicalJson(v)).toThrow(CanonicalJsonError);
  });

  it('allows shared (non-cyclic) references', () => {
    const shared = { a: 1 };
    expect(canonicalJson({ x: shared, y: shared })).toBe('{"x":{"a":1},"y":{"a":1}}');
  });

  it('hashes the canonical text', () => {
    expect(canonicalHash({ b: 2, a: 1 })).toBe(nodeSha('{"a":1,"b":2}'));
  });
});
