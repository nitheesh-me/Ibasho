// PLACEHOLDER: replaced by ibasho-gen.
// The real file carries the sha256 of the Lean spec and the historical spec hashes the
// checker still accepts (DEC TE-2). The placeholder value is not a hash, so no real
// certificate can claim it.

export const SPEC_VERSION = 'placeholder' as const;
export const SPEC_HASH = 'placeholder-spec-hash' as const;
export const HISTORICAL_SPEC_HASHES: readonly string[] = [];
/** True only for generated (non placeholder) spec-gen output. */
export const SPEC_GEN_IS_PLACEHOLDER = true as boolean;
