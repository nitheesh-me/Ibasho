/** SPEC 5.1 (AC-L3) and WP-09 I4: the chapter list comes from content and hides on missing plugins. */
import { createRegistry, PLUGIN_KINDS, type PluginKind, STUDIO_STAGES } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import { rulesUk } from '../../../packs/rules-uk/src/engine/rule-pack.ts';
import {
  LANDING_AUDIENCES,
  LANDING_CHAPTERS,
  LANDING_INVITATION,
  missingRequirements,
  needsPreview,
  type PluginPresence,
  parseRequirement,
  presenceFromList,
  presenceOf,
  visibleChapters,
} from '../src/index.ts';

const everything: PluginPresence = { has: () => true, hasKind: () => true, stage: () => 'real' };
const nothing: PluginPresence = { has: () => false, hasKind: () => false };
const ids = LANDING_CHAPTERS.map((c) => c.id);

/** Presence that has everything except one requirement string. */
function allBut(req: string): PluginPresence {
  const r = parseRequirement(req);
  return {
    has: (id) => !(r.t === 'id' && r.id === id),
    hasKind: (k) => !(r.t === 'kind' && r.kind === k),
    stage: (s) => (r.t === 'stage' && r.stage === s ? undefined : 'real'),
  };
}

describe('landing chapters', () => {
  it('are the v3 chapters in order, hero first and trust last', () => {
    expect(ids).toEqual(['hero', 'city', 'sun', 'daylight', 'energy', 'codes', 'compare', 'design', 'trust']);
    expect(LANDING_CHAPTERS.map((c) => c.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('every requirement parses (no typo can silently hide a chapter)', () => {
    for (const c of LANDING_CHAPTERS)
      for (const r of c.requires) expect(() => parseRequirement(r)).not.toThrow();
  });

  it('render all of them when every stage is present', () => {
    expect(visibleChapters(everything)).toHaveLength(LANDING_CHAPTERS.length);
  });

  it('the hero and the promises need nothing, so the page is never empty', () => {
    expect(visibleChapters(nothing).map((c) => c.id)).toEqual(['hero', 'trust']);
  });

  it('a chapter on Preview stages shows, marked Preview', () => {
    const preview: PluginPresence = { ...everything, stage: (s) => (s === 'daylight' ? 'preview' : 'real') };
    const daylight = LANDING_CHAPTERS.find((c) => c.id === 'daylight')!;
    expect(visibleChapters(preview).map((c) => c.id)).toContain('daylight');
    expect(needsPreview(daylight.requires, preview)).toBe(true);
    expect(needsPreview(daylight.requires, everything)).toBe(false);
  });

  it('hide a chapter when any one of its required plugins is absent (I4)', () => {
    for (const c of LANDING_CHAPTERS) {
      for (const r of c.requires) {
        const shown = visibleChapters(allBut(r)).map((x) => x.id);
        expect(shown, `${c.id} without ${r}`).not.toContain(c.id);
        expect(shown, 'others unaffected').toEqual(expect.arrayContaining(['hero', 'trust']));
      }
    }
  });

  it('sort by order even when given out of order', () => {
    const shuffled = [...LANDING_CHAPTERS].reverse();
    expect(visibleChapters(everything, shuffled).map((c) => c.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('the CTA leads into the studio, and every link stays inside the app', () => {
    expect(LANDING_INVITATION.cta).toEqual({ label: 'Open the studio', href: '/app/' });
    const hrefs = [
      LANDING_INVITATION.sample.href,
      ...LANDING_AUDIENCES.map((a) => a.link.href),
      ...LANDING_CHAPTERS.flatMap((c) => (c.link ? [c.link.href] : [])),
    ];
    for (const h of hrefs) expect(h).toMatch(/^\/app\//);
  });

  it('stay short: one line and at most one short paragraph, with detail behind a disclosure', () => {
    for (const c of LANDING_CHAPTERS) {
      expect(c.body.length, c.id).toBeLessThanOrEqual(1);
      for (const p of c.body) expect(p.split(/\s+/).length, c.id).toBeLessThanOrEqual(32);
    }
  });

  it('speaks to five kinds of customer', () => {
    expect(LANDING_AUDIENCES.map((a) => a.id)).toEqual([
      'homeowner',
      'architect',
      'campus',
      'developer',
      'business',
    ]);
  });
});

describe('requirements', () => {
  it('parse ids and kinds, and reject unknown kinds', () => {
    expect(parseRequirement('rules-uk')).toEqual({ t: 'id', id: 'rules-uk' });
    expect(parseRequirement('kind:checker-rung')).toEqual({ t: 'kind', kind: 'checker-rung' });
    expect(() => parseRequirement('kind:time-machine')).toThrow(/unknown plugin kind/);
    expect(() => parseRequirement('')).toThrow();
    expect(parseRequirement('stage:sun')).toEqual({ t: 'stage', stage: 'sun' });
    expect(() => parseRequirement('stage:wind')).toThrow(/unknown stage/);
  });

  it('every studio stage is accepted', () => {
    for (const s of STUDIO_STAGES) expect(parseRequirement(`stage:${s}`)).toEqual({ t: 'stage', stage: s });
  });

  it('presenceFromList reads stage providers, Preview or real', () => {
    const p = presenceFromList([], { sun: 'preview.sun', energy: 'engine.energy' });
    expect(p.stage?.('sun')).toBe('preview');
    expect(p.stage?.('energy')).toBe('real');
    expect(p.stage?.('daylight')).toBeUndefined();
    expect(missingRequirements(['stage:sun', 'stage:daylight'], p)).toEqual(['stage:daylight']);
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
