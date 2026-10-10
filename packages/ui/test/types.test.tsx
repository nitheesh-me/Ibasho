/**
 * F6: `Num` cannot take `seal="proved"`, and a Proved `Seal` needs a claim. These are compile
 * time checks: `pnpm --filter @ibasho/ui typecheck` fails if any `@ts-expect-error` stops being
 * an error.
 */
import { describe, expect, it } from 'vitest';
import { Num } from '../src/num/Num.tsx';
import { Seal } from '../src/seal/Seal.tsx';

export const typeChecks = [
  // @ts-expect-error numbers are never Proved (SPEC R11)
  <Num key="a" ev="ev_x" seal="proved" />,
  // @ts-expect-error a Proved seal sits on a claim only
  <Seal key="b" level="proved" />,
  // @ts-expect-error a Proved seal must say what it does not prove
  <Seal key="c" level="proved" claim={{ id: 'c', sentence: 'S' }} />,
  // @ts-expect-error evidence ids are `ev_` prefixed
  <Num key="d" ev="x" />,
  <Num key="e" ev="ev_x" seal="checked" />,
  <Seal key="f" level="proved" claim={{ id: 'c', sentence: 'S' }} notProved="N" />,
];

describe('F6 type contract', () => {
  it('compiles (see typecheck)', () => {
    expect(typeChecks).toHaveLength(6);
  });
});
