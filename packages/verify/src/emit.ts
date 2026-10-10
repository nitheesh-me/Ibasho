/**
 * Certificate emitter (ARCH 8.4). Owner: WP-04.
 *
 * `emit(result, extras)` returns the `ibasho.cert/2` certificate of a search result, completed with
 * the fields the checkers need that the M-0 engine certificate does not carry yet:
 * - `groups[].optionMeta` (measure id and kind per option, for memory and rule filters);
 * - `context.home` (region, `h.*` facts and recorded checks the rules read);
 * - `claimed.saving`, `claimed.carbonAnnual` and `claimed.bills` (`acct.saving`, `acct.carbon`,
 *   `money.bills`);
 * - `claimed.score` (`score.recompute`), only when the caller passes indicators.
 *
 * PLACEHOLDER until WP-02 emits them (INTERFACES request): the claimed accounting columns are
 * filled here from the certificate's own physics with the spec formulas (before minus after per
 * fuel; carbon rounded once from micrograms; slab-exact bills), and the score figures from the
 * given indicators with the spec score. A field the engine already emits is kept as is, so once
 * the engine claims its own figures the checks test the engine, not this function.
 */
import { Q } from '@ibasho/core';
import type {
  AnchorMode,
  AnchorZone,
  CertGroup,
  CertHome,
  Certificate,
  CertOptionMeta,
  CertScore,
} from '@ibasho/spec-gen';
import { decodeCert } from './mirror/decode.ts';
import { billOf, delivered, rows, savingOf } from './mirror/derive.ts';
import { qWire, scoreOf } from './mirror/score.ts';
import { encodeI64 } from './wire.ts';

export interface EmitExtras {
  /** Option id to measure id and measure kind (home pack `MEASURES`). */
  optionMeta: Readonly<Record<string, CertOptionMeta>>;
  /** The twin facts the rules read; omit only when no rule reads `h.*`. */
  home?: CertHome;
  /**
   * Score indicators per row (seven `Q` wire values in `SCORE_DIMS` order, standard mode). When
   * given, `claimed.score` covers these rows; the checker needs at least the front and the picks.
   */
  score?: { zone: AnchorZone; mode: AnchorMode; indicators: Readonly<Record<number, readonly string[]>> };
}

const FUELS = 6;

/** `claimed.score` from indicators, with sub-scores, groups and total by the spec score. */
export function scoreClaim(s: NonNullable<EmitExtras['score']>): CertScore {
  const rowsOut = Object.keys(s.indicators)
    .map(Number)
    .sort((a, b) => a - b)
    .map((row) => {
      const indicators = s.indicators[row]!.map((x) => Q.toWire(qWire(x)));
      const out = scoreOf(s.zone, s.mode, indicators.map(qWire));
      return {
        row,
        indicators,
        sub: out.sub.map(Q.toWire),
        groups: out.groups.map(Q.toWire),
        total: Q.toWire(out.total),
      };
    });
  return { zone: s.zone, mode: s.mode, rows: rowsOut };
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
  if (claimed.saving === undefined || claimed.carbonAnnual === undefined || claimed.bills === undefined) {
    const c = decodeCert(src);
    const saving: bigint[] = [];
    const carbon: bigint[] = [];
    const bills: bigint[] = [];
    for (let r = 0; r < rows(c); r++) {
      const d = delivered(c, r);
      const s = savingOf(c, c.baseline, d);
      saving.push(...s.saving);
      carbon.push(s.carbonAnnual);
      for (let f = 0; f < FUELS; f++) bills.push(billOf(c, d, f));
    }
    if (claimed.saving === undefined) claimed.saving = encodeI64(saving);
    if (claimed.carbonAnnual === undefined) claimed.carbonAnnual = encodeI64(carbon);
    if (claimed.bills === undefined) claimed.bills = encodeI64(bills);
  }
  if (claimed.score === undefined && extras.score) claimed.score = scoreClaim(extras.score);
  return { ...src, groups, context, claimed };
}
