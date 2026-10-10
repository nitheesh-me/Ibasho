/**
 * Onboarding steps as typed modules (SPEC 5.2, UX 5.1). Owner: WP-08.
 *
 * Each step states the time it asks of a person. The whole flow must fit in two minutes
 * (AC-G1); `checkBudget` is the guard a unit test runs on the configuration. There is no budget
 * question anywhere in onboarding (R24): the futures screen asks for it after the futures appear.
 */

export type StepId = 'where' | 'shape' | 'tune' | 'people' | 'reveal';

export interface OnboardingStep {
  id: StepId;
  /** Short name in the step rail. */
  title: string;
  /** The one question the step asks, in plain words. */
  prompt: string;
  /** Target seconds a person spends here (SPEC 5.2 table). */
  timeCostS: number;
}

/** The onboarding budget in seconds (SPEC 5.2, AC-G1). */
export const ONBOARDING_BUDGET_S = 120;

/** From this step on, a person may jump straight to Reveal (SPEC 5.2). */
export const SKIP_FROM: StepId = 'tune';

export const STEPS: readonly OnboardingStep[] = [
  { id: 'where', title: 'Where', prompt: 'Where is your home?', timeCostS: 15 },
  { id: 'shape', title: 'Shape', prompt: 'Which looks most like your home?', timeCostS: 15 },
  { id: 'tune', title: 'Tune', prompt: 'A few quick pictures', timeCostS: 45 },
  { id: 'people', title: 'People', prompt: 'Who lives here?', timeCostS: 20 },
  { id: 'reveal', title: 'Reveal', prompt: 'Your home, drawn', timeCostS: 15 },
];

export function totalTimeCostS(steps: readonly OnboardingStep[]): number {
  return steps.reduce((s, x) => s + x.timeCostS, 0);
}

/** Throws when a step configuration breaks the onboarding contract. */
export function checkBudget(steps: readonly OnboardingStep[], budgetS = ONBOARDING_BUDGET_S): void {
  const total = totalTimeCostS(steps);
  if (total > budgetS) throw new Error(`onboarding asks ${total} s, over the ${budgetS} s budget`);
  if (steps.length !== 5) throw new Error(`onboarding has ${steps.length} steps, not 5`);
  if (steps[steps.length - 1]?.id !== 'reveal') throw new Error('onboarding must end with Reveal');
  for (const s of steps) {
    if (!(s.timeCostS > 0)) throw new Error(`step ${s.id} has no time cost`);
    if (/budget|afford|spend/i.test(`${s.title} ${s.prompt}`))
      throw new Error(`step ${s.id} asks about money; the budget waits for the futures (R24)`);
  }
}

checkBudget(STEPS);

export function stepIndex(id: StepId): number {
  return STEPS.findIndex((s) => s.id === id);
}
