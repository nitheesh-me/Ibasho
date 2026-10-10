/**
 * @ibasho/verify (ARCH 8.4). Owner: WP-04. Layer L1.
 *
 * Certificate emitter, the TS mirror of the Lean checker (worker safe) and the wire codec.
 * SKELETON until M-C: the seal and claim resolver, the checker-rung plugins and `POST /verify`.
 */
export { type EmitExtras, emit } from './emit.ts';
export { checkDecoded, exitCode, mirrorCheck, type Verdict, type VerdictReport } from './mirror/check.ts';
export { type Decoded, decodeCert, MalformedError } from './mirror/decode.ts';
export { derive, deriveRow, type RowD } from './mirror/derive.ts';
export {
  decodeB64,
  decodeI64,
  decodeU8,
  decodeU32,
  encodeB64,
  encodeI64,
  encodeU8,
  encodeU32,
  WireError,
} from './wire.ts';
