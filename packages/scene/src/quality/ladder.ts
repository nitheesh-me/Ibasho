/**
 * Quality ladder (ARCH 10, DESIGN_SYSTEM 10 budgets). Owner: WP-07.
 * The `PerformanceMonitor` steps down: DPR first, then N8AO, then shadows. While an LLM is
 * generating, the effective tier drops one more step (DEC TE-8). Pure reducer, unit tested.
 */
import type { QualityTier } from '@ibasho/core';

export interface TierSettings {
  /** Device pixel ratio cap. */
  dpr: number;
  ao: boolean;
  /** Accumulated soft shadows in the bake, plus the sun shadow map. */
  shadows: boolean;
  bloom: boolean;
  /** Bake accumulation frames for soft shadows. */
  bakeFrames: number;
  furniture: boolean;
}

export const TIERS: Record<QualityTier, TierSettings> = {
  3: { dpr: 2, ao: true, shadows: true, bloom: true, bakeFrames: 48, furniture: true },
  2: { dpr: 1.25, ao: true, shadows: true, bloom: true, bakeFrames: 32, furniture: true },
  1: { dpr: 1, ao: false, shadows: true, bloom: true, bakeFrames: 16, furniture: true },
  0: { dpr: 1, ao: false, shadows: false, bloom: false, bakeFrames: 1, furniture: false },
};

export interface LadderState {
  /** Tier the monitor has settled on. */
  base: QualityTier;
  llmGenerating: boolean;
  /** Steps taken; the monitor gives up flipping after a few (drei `flipflops`). */
  flips: number;
}

export type LadderEvent = 'decline' | 'incline' | 'llm-start' | 'llm-end' | 'context-lost';

export const MAX_FLIPS = 4;

export function initialLadder(base: QualityTier = 3): LadderState {
  return { base, llmGenerating: false, flips: 0 };
}

export function stepLadder(s: LadderState, e: LadderEvent): LadderState {
  switch (e) {
    case 'decline':
      if (s.flips >= MAX_FLIPS) return s;
      return { ...s, base: Math.max(0, s.base - 1) as QualityTier, flips: s.flips + 1 };
    case 'incline':
      if (s.flips >= MAX_FLIPS) return s;
      return { ...s, base: Math.min(3, s.base + 1) as QualityTier, flips: s.flips + 1 };
    case 'llm-start':
      return { ...s, llmGenerating: true };
    case 'llm-end':
      return { ...s, llmGenerating: false };
    case 'context-lost':
      // After a context loss, come back one step lower: the GPU just told us something.
      return { ...s, base: Math.max(0, s.base - 1) as QualityTier };
  }
}

export function effectiveTier(s: LadderState): QualityTier {
  return (s.llmGenerating ? Math.max(0, s.base - 1) : s.base) as QualityTier;
}

export function tierSettings(s: LadderState): TierSettings {
  return TIERS[effectiveTier(s)];
}
