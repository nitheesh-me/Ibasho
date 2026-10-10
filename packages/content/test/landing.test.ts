/** SPEC 5.1 (AC-L3) and WP-09 I4: the chapter list comes from content and hides on missing plugins. */
import { createRegistry, PLUGIN_KINDS, type PluginKind } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import { rulesUk } from '../../../packs/rules-uk/src/engine/rule-pack.ts';
import {
  LANDING_CHAPTERS,
  LANDING_INVITATION,
  missingRequirements,
  type PluginPresence,
  parseRequirement,
  presenceFromList,
  presenceOf,
  visibleChapters,
} from '../src/index.ts';

const everything: PluginPresence = { has: () => true, hasKind: () => true };
const nothing: PluginPresence = { has: () => false, hasKind: () => false };

/** Presence that has everything except one requirement string. */
function allBut(req: string): PluginPresence {
  const r = parseRequirement(req);
  return {
    has: (id) => !(r.t === 'id' && r.id === id),
    hasKind: (k) => !(r.t === 'kind' && r.kind === k),
  };
}

describe('landing chapters', () => {
  it('are the five T1 chapters in order (SPEC 5.1)', () => {
    expect(LANDING_CHAPTERS.map((c) => c.id)).toEqual(['hero', 'drawn', 'what-if', 'futures', 'proof']);
    expect(LANDING_CHAPTERS.map((c) => c.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it('every requirement parses (no typo can silently hide a chapter)', () => {
    for (const c of LANDING_CHAPTERS)
      for (const r of c.requires) expect(() => parseRequirement(r)).not.toThrow();
  });

  it('render all five when every plugin is present', () => {
    expect(visibleChapters(everything)).toHaveLength(5);
  });

  it('the hero needs nothing, so the page is never empty', () => {
    expect(visibleChapters(nothing).map((c) => c.id)).toEqual(['hero']);
  });

  it('hide a chapter when any one of its required plugins is absent (I4)', () => {
    for (const c of LANDING_CHAPTERS) {
      for (const r of c.requires) {
        const shown = visibleChapters(allBut(r)).map((x) => x.id);
        expect(shown, `${c.id} without ${r}`).not.toContain(c.id);
        expect(shown, 'others unaffected').toContain('hero');
      }
    }
  });

  it('sort by order even when given out of order', () => {
    const shuffled = [...LANDING_CHAPTERS].reverse();
    expect(visibleChapters(everything, shuffled).map((c) => c.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it('the CTA leads to onboarding (SPEC 5.1)', () => {
    expect(LANDING_INVITATION.cta).toEqual({ label: 'Step into your home', href: '/app/start' });
  });
});

describe('requirements', () => {
  it('parse ids and kinds, and reject unknown kinds', () => {
    expect(parseRequirement('rules-uk')).toEqual({ t: 'id', id: 'rules-uk' });
    expect(parseRequirement('kind:checker-rung')).toEqual({ t: 'kind', kind: 'checker-rung' });
    expect(() => parseRequirement('kind:time-machine')).toThrow(/unknown plugin kind/);
    expect(() => parseRequirement('')).toThrow();
  });

  it('every core plugin kind is accepted', () => {
    for (const k of PLUGIN_KINDS) expect(parseRequirement(`kind:${k}`)).toEqual({ t: 'kind', kind: k });
  });

  it('presenceFromList answers ids and kinds', () => {
    const p = presenceFromList([{ kind: 'rule-pack' as PluginKind, id: 'rules-uk' }]);
    expect(missingRequirements(['rules-uk', 'kind:rule-pack', 'kind:tariff', 'loft'], p)).toEqual([
      'kind:tariff',
      'loft',
    ]);
  });

  it('presenceOf reads a live registry', () => {
    const reg = createRegistry();
    const p = presenceOf(reg);
    expect(p.has('rules-uk')).toBe(false);
    expect(p.hasKind('rule-pack')).toBe(false);
    reg.register(rulesUk);
    expect(p.has('rules-uk')).toBe(true);
    expect(p.hasKind('rule-pack')).toBe(true);
    expect(p.hasKind('checker-rung')).toBe(false);
  });
});
