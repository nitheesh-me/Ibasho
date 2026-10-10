/**
 * @ibasho/ui: Andon in code (DESIGN_SYSTEM). Owner: WP-06. Layer L2 (imports L0 only).
 *
 * Styles are plain CSS: import `@ibasho/ui/andon.css` once at the app root (tokens, fonts, base
 * and component styles), or `@ibasho/ui/tokens.css` alone for tokens.
 */
export {
  EvidenceProvider,
  type EvidenceSource,
  staticEvidence,
  useEvidenceSource,
  useStaticEvidence,
} from './evidence/context.tsx';
export { BAKE_LIST, type BakedChar, Glyph, type GlyphProps } from './glyphs/index.ts';
export { type Dec, decFromString, decToString, roundSig, roundStep } from './num/decimal.ts';
export {
  DISPLAY,
  DISPLAY_AS,
  type DisplayAs,
  type FormatOptions,
  type Formatted,
  formatEvidence,
  MINUS,
  type NumPart,
} from './num/format.ts';
export { Num, type NumProps } from './num/Num.tsx';
export { ClaimSeal, type ClaimSealProps } from './seal/ClaimSeal.tsx';
export {
  type CheckInfo,
  checkDetail,
  NOT_PROVED,
  type NumberSeal,
  RUNG_LABEL,
  SEAL_LABEL,
  type SealKind,
} from './seal/copy.ts';
export {
  type ClaimRef,
  type NumberSealProps,
  type ProvedSealProps,
  Seal,
  type SealProps,
  sealName,
} from './seal/Seal.tsx';
export type { SealSize } from './seal/SealMark.tsx';
