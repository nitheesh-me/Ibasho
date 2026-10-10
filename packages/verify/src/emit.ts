/**
 * Certificate emitter (ARCH 8.4). Owner: WP-04.
 *
 * `emit(result, extras)` returns the `ibasho.cert/2` certificate of a search result, completed with
 * the fields the checkers need that the M-0 engine certificate does not carry yet:
 * - `groups[].optionMeta` (measure id and kind per option, for memory and rule filters);
 * - `context.home` (region, `h.*` facts and recorded checks the rules read);
 * - `claimed.saving` and `claimed.carbonAnnual` (`acct.saving`, `acct.carbon`).
 *
 * PLACEHOLDER until WP-02 emits them (INTERFACES request): the two claimed accounting columns are
 * filled here from the certificate's own physics with the spec formulas (before minus after per
 * fuel; carbon rounded once from micrograms). A field the engine already emits is kept as is, so
 * once the engine claims its own figures the checks test the engine, not this function.
 */
import type { CertGroup, CertHome, Certificate, CertOptionMeta } from '@ibasho/spec-gen';
import { decodeCert } from './mirror/decode.ts';
import { delivered, rows, savingOf } from './mirror/derive.ts';
import { encodeI64 } from './wire.ts';

export interface EmitExtras {
  /** Option id to measure id and measure kind (home pack `MEASURES`). */
  optionMeta: Readonly<Record<string, CertOptionMeta>>;
  /** The twin facts the rules read; omit only when no rule reads `h.*`. */
  home?: CertHome;
}

/** The certificate of a search result, completed for the checkers. Pure; does not mutate. */
export function emit(result: { certificate: Certificate }, extras: EmitExtras): Certificate {
  const src = result.certificate;
  const groups: CertGroup[] = src.groups.map((g) => {
    if (g.optionMeta) return { ...g, optionMeta: { ...g.optionMeta } };
    const optionMeta: Record<string, CertOptionMeta> = {};
    for (const o of g.options) {
      if (o === 'none') continue;
      const m = extras.optionMeta[o];
      if (!m) throw new Error(`emit: no option meta for ${o}`);
      optionMeta[o] = { measure: m.measure, kind: m.kind };
    }
    return { ...g, optionMeta };
  });
  const context = { ...src.context };
  if (!context.home && extras.home) context.home = extras.home;
  const claimed = { ...src.claimed };
  if (claimed.saving === undefined || claimed.carbonAnnual === undefined) {
    const c = decodeCert(src);
    const saving: bigint[] = [];
    const carbon: bigint[] = [];
    for (let r = 0; r < rows(c); r++) {
      const s = savingOf(c, c.baseline, delivered(c, r));
      saving.push(...s.saving);
      carbon.push(s.carbonAnnual);
    }
    if (claimed.saving === undefined) claimed.saving = encodeI64(saving);
    if (claimed.carbonAnnual === undefined) claimed.carbonAnnual = encodeI64(carbon);
  }
  return { ...src, groups, context, claimed };
}
