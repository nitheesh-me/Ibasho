/**
 * Shared test helpers: the synthetic GH1 story and its full narration (E4). `renderGh1` is pure and
 * DOM free, so the determinism matrix (WP-10, Node, Chromium, Firefox) can import and run it.
 */
import { canonicalJson, sha256Hex } from '@ibasho/core';
import spec from '../../fixtures/src/narration/gh1.story.json' with { type: 'json' };
import { buildStory } from '../src/evidence/spec.ts';
import { renderTemplate } from '../src/grounding/ground.ts';
import { nodesToString } from '../src/grounding/render.ts';
import { CHAPTERS, narrateSection, type SectionRequest, type Story } from '../src/narrator/template.ts';

export const gh1Spec = spec;

export function gh1Story(): Story {
  return buildStory(spec);
}

/** Every section the template narrator writes for GH1, one request each. */
export const GH1_REQUESTS: readonly SectionRequest[] = [
  { section: 'overview' },
  ...CHAPTERS.map((chapter) => ({ section: 'chapter' as const, chapter })),
  { section: 'package', packageId: 'p-loft300-draught' },
  { section: 'package', packageId: 'p-loft300-draught-controls-pv3' },
  { section: 'package', packageId: 'p-ashp-loft300-draught-pv3' },
  { section: 'tradeoff', a: 'leastUpfront', b: 'bestReturn' },
  { section: 'tradeoff', a: 'leastUpfront', b: 'lowestRunningCarbon' },
  { section: 'answer', question: 'How much gas do we use a year?' },
  { section: 'answer', question: 'What is the weather like on Mars?' },
  { section: 'welcome-back' },
  { section: 'why-not' },
];

export interface Gh1Narration {
  sections: { request: SectionRequest; slotted: string; rendered: string; nodes: unknown }[];
  sha256: string;
}

export function renderGh1(story: Story = gh1Story()): Gh1Narration {
  const sections = GH1_REQUESTS.map((request) => {
    const s = narrateSection(story, request);
    const r = renderTemplate({ sections: [s] }, story.bundle);
    const nodes = r.sections[0]?.nodes ?? [];
    return { request, slotted: s.text, rendered: nodesToString(nodes), nodes };
  });
  return { sections, sha256: sha256Hex(canonicalJson(sections)) };
}

/** Replace `{role}` placeholders in fixture text with bundle-local ids. */
export function withRoles(text: string, story: Story): string {
  return text.replace(/\{([a-zA-Z0-9.$-]+)\}/g, (_m, role: string) => {
    const id = story.roles[role];
    if (!id) throw new Error(`fixture role ${role} is not in the story`);
    return id;
  });
}
