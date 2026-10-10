/** `pnpm verify` on the committed certificate set. Owner: WP-04. */
import { describe, expect, it } from 'vitest';
import { runCommitted } from '../src/run.ts';

describe('pnpm verify', () => {
  it('golden and scored pass, mutants fail their named checks, Lean and mirror agree', () => {
    const outs = runCommitted();
    expect(outs).toHaveLength(8);
    for (const o of outs) {
      expect(o.agree).toBe(true);
      expect(o.expected).toBe(true);
    }
  });
});
