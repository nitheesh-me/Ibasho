/**
 * Grounding pipeline (AM 3.3): validate a draft, ask for at most one structured repair, then fall
 * back per section to the template narrator. The result is what the narrator strip shows.
 */
import type {
  EvidenceBundle,
  NarrationDraft,
  RenderedNarration,
  SectionKey,
  ValidationIssue,
} from '@ibasho/core';
import { type RenderOptions, renderText } from './render.ts';
import { type ValidateOptions, validateSection } from './validate.ts';

/** Structured repair request: the issues, never prose. */
export interface RepairRequest {
  sections: { key: SectionKey; text: string; issues: Omit<ValidationIssue, 'section'>[] }[];
}
export type Repairer = (req: RepairRequest) => Promise<NarrationDraft>;

export interface GroundOptions extends ValidateOptions, RenderOptions {
  provider: string;
  model?: string;
  /** Called at most once, with every repairable section. */
  repair?: Repairer;
  /** Clock for `latencyMs` (injected; no wall clock in the pure core). */
  clock?: () => number;
}

const isHard = (issues: readonly ValidationIssue[]) => issues.some((i) => i.severity === 'hard');

/**
 * Ground an LLM draft. `template` is the template narrator's draft for the same sections (it always
 * validates; if it did not, that is a bug and this throws).
 */
export async function groundDraft(
  draft: NarrationDraft,
  template: NarrationDraft,
  bundle: EvidenceBundle,
  opts: GroundOptions,
): Promise<RenderedNarration> {
  const clock = opts.clock ?? (() => 0);
  const t0 = clock();
  const templateText = new Map(template.sections.map((s) => [s.key, s.text]));
  const allIssues: ValidationIssue[] = [];

  const current = new Map<SectionKey, { text: string; issues: ValidationIssue[] }>();
  if (new Set(draft.sections.map((s) => s.key)).size !== draft.sections.length) {
    throw new Error('draft has duplicate section keys; ground one chapter at a time');
  }
  for (const s of draft.sections) current.set(s.key, { text: s.text, issues: validateSection(s.key, s.text, bundle, opts) });
  for (const key of templateText.keys()) {
    if (!current.has(key)) {
      const issue: ValidationIssue = { rule: 'G1', section: key, span: [0, 0], detail: 'section missing from draft', severity: 'repair' };
      current.set(key, { text: '', issues: [issue] });
    }
  }
  for (const v of current.values()) allIssues.push(...v.issues);

  const repairable = [...current.entries()].filter(([, v]) => v.issues.length > 0 && !isHard(v.issues));
  if (opts.repair && repairable.length > 0) {
    let repaired: NarrationDraft | undefined;
    try {
      repaired = await opts.repair({
        sections: repairable.map(([key, v]) => ({
          key,
          text: v.text,
          issues: v.issues.map(({ section: _s, ...rest }) => rest),
        })),
      });
    } catch {
      repaired = undefined;
    }
    for (const s of repaired?.sections ?? []) {
      const prev = current.get(s.key);
      if (!prev || prev.issues.length === 0 || isHard(prev.issues)) continue;
      const issues = validateSection(s.key, s.text, bundle, opts);
      allIssues.push(...issues);
      current.set(s.key, { text: s.text, issues });
    }
  }

  const sections: RenderedNarration['sections'] = [];
  for (const [key, v] of current) {
    const tmpl = templateText.get(key);
    if (v.issues.length === 0) {
      sections.push({ key, nodes: renderText(v.text, bundle, opts), origin: 'llm' });
    } else if (tmpl !== undefined) {
      const check = validateSection(key, tmpl, bundle, opts);
      if (check.length > 0) throw new Error(`template section ${key} fails ${check.map((c) => c.rule).join(', ')}`);
      sections.push({ key, nodes: renderText(tmpl, bundle, opts), origin: 'template' });
    }
  }
  const out: RenderedNarration = { sections, issues: allIssues, provider: opts.provider, latencyMs: clock() - t0 };
  if (opts.model !== undefined) out.model = opts.model;
  return out;
}

/** Render a template draft directly (it must validate). */
export function renderTemplate(
  template: NarrationDraft,
  bundle: EvidenceBundle,
  opts: ValidateOptions & RenderOptions = {},
): RenderedNarration {
  const issues: ValidationIssue[] = [];
  const sections: RenderedNarration['sections'] = template.sections.map((s) => {
    const found = validateSection(s.key, s.text, bundle, opts);
    issues.push(...found);
    if (found.length > 0) throw new Error(`template section ${s.key} fails ${found.map((f) => `${f.rule} ${f.detail}`).join('; ')}`);
    return { key: s.key, nodes: renderText(s.text, bundle, opts), origin: 'template' as const };
  });
  return { sections, issues, provider: 'template', latencyMs: 0 };
}
