/**
 * Rule lint (BUILD_PLAN C7). Owner: WP-03.
 *
 * `lintRules(rules)` lists every problem; an empty list passes. Checks:
 * - `grade`: every rule has a source grade from `GRADES`;
 * - `source-url`: the source URL is `https://` (built-ins may cite `urn:ibasho:spec:*`), and the
 *   clause is not empty;
 * - `explain`: an explanation message key is set;
 * - `duplicate-id`: ids are unique;
 * - `dates`: ISO dates, `effectiveFrom` not after `effectiveTo`;
 * - `fn-status`: named functions appear only in `consent`, `oblige`, `warn` and `info` rules, so
 *   the package status never rests on a function the Lean checker reads as unknown;
 * - `secondary-dec`: a `secondary` rule that rests on reviewer memory says so and cites its DEC row
 *   (clause mentions "reviewer memory" only together with "DEC").
 */
import type { Rule } from '@ibasho/core';
import { exprFns, GRADES } from '@ibasho/core';

export interface RuleLintIssue {
  ruleId: string;
  check: 'grade' | 'source-url' | 'explain' | 'duplicate-id' | 'dates' | 'fn-status' | 'secondary-dec';
  message: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function lintRules(rules: readonly Rule[]): RuleLintIssue[] {
  const out: RuleLintIssue[] = [];
  const seen = new Set<string>();
  const add = (ruleId: string, check: RuleLintIssue['check'], message: string): void => {
    out.push({ ruleId, check, message });
  };
  for (const r of rules) {
    if (seen.has(r.id)) add(r.id, 'duplicate-id', 'duplicate rule id');
    seen.add(r.id);
    if (!GRADES.includes(r.source.grade)) add(r.id, 'grade', `bad grade ${String(r.source.grade)}`);
    const builtin = r.id.startsWith('BUILTIN.') && r.source.url.startsWith('urn:ibasho:spec:');
    if (!builtin && !/^https:\/\/[^\s]+$/.test(r.source.url))
      add(r.id, 'source-url', `bad source URL ${r.source.url}`);
    if (r.source.clause.trim() === '') add(r.id, 'source-url', 'empty source clause');
    if (r.explain.trim() === '') add(r.id, 'explain', 'no explanation key');
    if (!ISO.test(r.effectiveFrom) || (r.effectiveTo !== undefined && !ISO.test(r.effectiveTo)))
      add(r.id, 'dates', 'dates must be ISO yyyy-mm-dd');
    else if (r.effectiveTo !== undefined && r.effectiveFrom > r.effectiveTo)
      add(r.id, 'dates', 'effectiveFrom is after effectiveTo');
    if ((r.effect.kind === 'block' || r.effect.kind === 'check') && exprFns(r.when).length > 0)
      add(r.id, 'fn-status', `named function in a ${r.effect.kind} rule`);
    if (/reviewer memory/i.test(r.source.clause) && !/\bDEC\b/.test(r.source.clause))
      add(r.id, 'secondary-dec', 'a rule from reviewer memory must cite its DEC row');
  }
  return out;
}
