/**
 * Canonical JSON and content hashing (ARCH 4.3). Owner: WP-00.
 *
 * Canonical form (deterministic across Node, Chromium and Firefox):
 * - object keys sorted by UTF-16 code units; properties whose value is `undefined` are omitted
 *   (matches `exactOptionalPropertyTypes`: absent and undefined mean the same thing);
 * - numbers must be finite; `-0` is written `0`; other numbers use ECMAScript `Number::toString`,
 *   which the language spec defines exactly (shortest round-trip form);
 * - `bigint` is written as a JSON string of its decimal digits (the wire format, never a JSON float);
 * - typed arrays become JSON arrays (BigInt64Array and BigUint64Array as decimal strings);
 * - `undefined` inside arrays, functions, symbols, Map, Set, Date, class instances and cycles throw.
 * No whitespace is emitted.
 */
import { sha256Hex } from './sha256.ts';

export class CanonicalJsonError extends Error {
  override name = 'CanonicalJsonError';
}

function isPlainObject(v: object): boolean {
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function numberToJson(n: number, path: string): string {
  if (!Number.isFinite(n)) throw new CanonicalJsonError(`non-finite number at ${path}`);
  if (Object.is(n, -0)) return '0';
  return String(n);
}

function write(v: unknown, path: string, seen: Set<object>, out: string[]): void {
  switch (typeof v) {
    case 'string':
      out.push(JSON.stringify(v));
      return;
    case 'number':
      out.push(numberToJson(v, path));
      return;
    case 'boolean':
      out.push(v ? 'true' : 'false');
      return;
    case 'bigint':
      out.push(`"${v.toString()}"`);
      return;
    case 'object':
      break;
    default:
      throw new CanonicalJsonError(`unsupported ${typeof v} at ${path}`);
  }
  if (v === null) {
    out.push('null');
    return;
  }
  if (seen.has(v)) throw new CanonicalJsonError(`cycle at ${path}`);
  if (ArrayBuffer.isView(v)) {
    if (v instanceof BigInt64Array || v instanceof BigUint64Array) {
      out.push('[');
      v.forEach((x, i) => {
        if (i) out.push(',');
        out.push(`"${x.toString()}"`);
      });
      out.push(']');
      return;
    }
    if (v instanceof DataView) throw new CanonicalJsonError(`DataView at ${path}`);
    const arr = v as unknown as ArrayLike<number>;
    out.push('[');
    for (let i = 0; i < arr.length; i++) {
      if (i) out.push(',');
      out.push(numberToJson(arr[i]!, `${path}[${i}]`));
    }
    out.push(']');
    return;
  }
  seen.add(v);
  if (Array.isArray(v)) {
    out.push('[');
    for (let i = 0; i < v.length; i++) {
      if (i) out.push(',');
      const item: unknown = v[i];
      if (item === undefined) throw new CanonicalJsonError(`undefined array item at ${path}[${i}]`);
      write(item, `${path}[${i}]`, seen, out);
    }
    out.push(']');
  } else {
    if (!isPlainObject(v)) {
      throw new CanonicalJsonError(`non-plain object (${v.constructor?.name ?? 'unknown'}) at ${path}`);
    }
    const rec = v as Record<string, unknown>;
    const keys = Object.keys(rec)
      .filter((k) => rec[k] !== undefined)
      .sort();
    out.push('{');
    keys.forEach((k, i) => {
      if (i) out.push(',');
      out.push(JSON.stringify(k), ':');
      write(rec[k], `${path}.${k}`, seen, out);
    });
    out.push('}');
  }
  seen.delete(v);
}

/** Serialise a value to canonical JSON (see module doc). */
export function canonicalJson(value: unknown): string {
  const out: string[] = [];
  write(value, '$', new Set(), out);
  return out.join('');
}

/** Lowercase hex SHA-256 of `canonicalJson(value)`. */
export function canonicalHash(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

export { sha256Bytes, sha256Hex, toHex, utf8 } from './sha256.ts';
