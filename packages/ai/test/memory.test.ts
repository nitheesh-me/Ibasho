/**
 * Memory domain (AM 7, SPEC 5.12): E2.
 * - AC-M1: replaying 500 random sessions never puts a rejected measure in an offered package or a
 *   recommendation. The repo is checked against an independent list-based oracle at every step.
 * - AC-M2: LLM-originated memory appears only as a seed until the owner confirms it.
 * - AC-M3: forget is a real deletion after 30 days, or at once on "empty now".
 */
import { type MemoryEvent, type Preferences, xoshiro128ss } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import { MEASURE_CATALOGUE, measureOf } from '../src/measures.ts';
import { InMemoryMemoryRepo } from '../src/memory/repo.ts';
import {
  digestOf,
  emptyPreferences,
  MemoryPolicyError,
  offerable,
  searchMemory,
} from '../src/memory/views.ts';
import { defaultCatalogue, validateOps } from '../src/ops/validator.ts';

const H = 'h1';
const DAY = 86_400_000;
const T0 = Date.parse('2026-01-01T00:00:00.000Z');

/** A repo on a hand-driven clock. */
function clocked(start = T0) {
  let t = start;
  const repo = new InMemoryMemoryRepo({ clock: () => new Date(t).toISOString() });
  return {
    repo,
    now: () => new Date(t).toISOString(),
    advance: (ms: number) => {
      t += ms;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// AC-M1: random sessions against an oracle.

type Action =
  | { kind: 'reject'; id: string; m: string; scope: 'never' | 'snooze'; until?: string }
  | { kind: 'restore'; id: string; m: string }
  | { kind: 'complete'; id: string; m: string }
  | { kind: 'seed'; id: string; seedId: string; m: string }
  | { kind: 'accept'; id: string; seedId: string }
  | { kind: 'dismiss'; id: string; seedId: string };

/** Independent model: fold the list of actions in effect. Undo removes one; forget removes a measure's. */
function oracle(actions: readonly Action[], now: string): { rejected: Set<string>; completed: Set<string> } {
  const rej = new Map<string, { scope: 'never' | 'snooze'; until?: string }>();
  const completed = new Set<string>();
  const seeds = new Map<string, string>();
  for (const a of actions) {
    if (a.kind === 'reject') rej.set(a.m, a.until ? { scope: a.scope, until: a.until } : { scope: a.scope });
    else if (a.kind === 'restore') rej.delete(a.m);
    else if (a.kind === 'complete') completed.add(a.m);
    else if (a.kind === 'seed') seeds.set(a.seedId, a.m);
    else if (a.kind === 'accept') {
      const m = seeds.get(a.seedId);
      if (m) rej.set(m, { scope: 'never' });
    }
  }
  const rejected = new Set<string>();
  for (const [m, r] of rej)
    if (r.scope === 'never' || (r.until !== undefined && now < r.until)) rejected.add(m);
  return { rejected, completed };
}

const MEASURES = MEASURE_CATALOGUE.map((m) => m.id);
const OPTIONS = MEASURE_CATALOGUE.flatMap((m) => [m.id, ...Object.keys(m.options)]);

async function session(
  seed: number,
  steps: number,
): Promise<{ offered: number; blocked: number; llmRefused: number }> {
  const rng = xoshiro128ss(seed);
  const pick = <T>(xs: readonly T[]): T => xs[rng.int(xs.length)]!;
  const { repo, now, advance } = clocked();
  let actions: Action[] = [];
  const undecided: { seedId: string; m: string }[] = [];
  let seedSeq = 0;
  let offered = 0;
  let blocked = 0;
  let llmRefused = 0;
  const id = (e: MemoryEvent) => e.id;

  for (let step = 0; step < steps; step++) {
    // Minutes to weeks between actions, so snoozes expire inside a session.
    advance(rng.int(4) === 0 ? (1 + rng.int(20)) * DAY : (1 + rng.int(600)) * 60_000);
    const m = pick(MEASURES);
    switch (rng.int(11)) {
      case 0:
      case 1: {
        const e = await repo.append({
          homeId: H,
          actor: 'owner',
          type: 'measureRejected',
          payload: { measureId: m, scope: 'never' },
        });
        actions.push({ kind: 'reject', id: id(e), m, scope: 'never' });
        break;
      }
      case 2: {
        const until = new Date(Date.parse(now()) + (1 + rng.int(30)) * DAY).toISOString();
        const e = await repo.append({
          homeId: H,
          actor: 'owner',
          type: 'measureRejected',
          payload: { measureId: m, scope: 'snooze', until },
        });
        actions.push({ kind: 'reject', id: id(e), m, scope: 'snooze', until });
        break;
      }
      case 3: {
        const e = await repo.append({
          homeId: H,
          actor: 'owner',
          type: 'measureRestored',
          payload: { measureId: m },
        });
        actions.push({ kind: 'restore', id: id(e), m });
        break;
      }
      case 4: {
        const e = await repo.append({
          homeId: H,
          actor: 'owner',
          type: 'measureCompleted',
          payload: { measureId: m },
        });
        actions.push({ kind: 'complete', id: id(e), m });
        break;
      }
      case 5: {
        // An LLM proposes a rejection as a seed; it may also try to write it directly (refused).
        const seedId = `s${++seedSeq}`;
        const e = await repo.append({
          homeId: H,
          actor: 'llm-proposal',
          type: 'seedProposed',
          payload: {
            seedId,
            text: 'Rule it out?',
            proposes: { type: 'measureRejected', payload: { measureId: m, scope: 'never' } },
          },
        });
        actions.push({ kind: 'seed', id: id(e), seedId, m });
        undecided.push({ seedId, m });
        try {
          await repo.append({
            homeId: H,
            actor: 'llm-proposal',
            type: 'measureRejected',
            payload: { measureId: m, scope: 'never' },
          });
        } catch (err) {
          expect(err).toBeInstanceOf(MemoryPolicyError);
          llmRefused++;
        }
        break;
      }
      case 6: {
        if (undecided.length === 0) break;
        const s = undecided.splice(rng.int(undecided.length), 1)[0]!;
        const accept = rng.int(2) === 0;
        const e = await repo.append({
          homeId: H,
          actor: 'owner',
          type: accept ? 'seedAccepted' : 'seedDismissed',
          payload: { seedId: s.seedId },
        });
        actions.push(
          accept
            ? { kind: 'accept', id: id(e), seedId: s.seedId }
            : { kind: 'dismiss', id: id(e), seedId: s.seedId },
        );
        break;
      }
      case 7: {
        // Undo one owner action still in effect (not a seed: undoing a proposal is not an owner action).
        const undoable = actions.filter((a) => a.kind !== 'seed');
        if (undoable.length === 0) break;
        const target = pick(undoable);
        await repo.undo(target.id);
        actions = actions.filter((a) => a !== target);
        break;
      }
      case 8: {
        await repo.forget(H, { kind: 'measure', measureId: m });
        actions = actions.filter((a) => !('m' in a) || a.m !== m);
        for (let i = undecided.length - 1; i >= 0; i--) if (undecided[i]!.m === m) undecided.splice(i, 1);
        break;
      }
      case 9: {
        // Purging the compost never changes what is in effect.
        const before = await repo.preferences(H);
        await repo.purge(H, rng.int(2) === 0);
        expect(await repo.preferences(H)).toEqual(before);
        break;
      }
      default: {
        // Owner applies a reject through the ops channel.
        const e = await repo.append({
          homeId: H,
          actor: 'owner',
          type: 'opApplied',
          payload: { op: { op: 'rejectMeasure', measureId: m, scope: 'never' } },
        });
        actions.push({ kind: 'reject', id: id(e), m, scope: 'never' });
      }
    }

    const want = oracle(actions, now());
    const prefs: Preferences = await repo.preferences(H);
    const mem = searchMemory(prefs, now());
    expect(new Set(mem.rejected), `seed ${seed} step ${step}`).toEqual(want.rejected);
    expect(new Set(mem.completed), `seed ${seed} step ${step}`).toEqual(want.completed);

    // The feasibility filter: offered packages never hold a ruled-out or completed measure.
    for (let k = 0; k < 4; k++) {
      const pkg = [...new Set(Array.from({ length: 1 + rng.int(4) }, () => pick(OPTIONS)))];
      const owners = pkg.map((o) => measureOf(o)?.id ?? o);
      const clash = owners.some((o) => want.rejected.has(o) || want.completed.has(o));
      if (offerable(pkg, mem)) {
        offered++;
        expect(clash, `seed ${seed} step ${step} offered ${pkg.join(',')}`).toBe(false);
      } else {
        blocked++;
        expect(clash).toBe(true);
      }
    }
  }

  // Recommendations: the op channel refuses to add any measure that is ruled out now.
  const prefs = await repo.preferences(H);
  const cat = defaultCatalogue();
  const known = new Set(cat.measures.map((x) => x.id));
  for (const m of searchMemory(prefs, now()).rejected) {
    if (!known.has(m)) continue;
    const v = validateOps([{ op: 'addMeasure', measureId: m }], {
      catalogue: cat,
      preferences: prefs,
      now: now(),
    });
    expect(v.accepted).toEqual([]);
    expect(v.rejected[0]?.code).toBe('memory-conflict');
  }
  return { offered, blocked, llmRefused };
}

describe('AC-M1: 500 replayed sessions', () => {
  it('never offers a rejected or completed measure, and the repo matches the oracle at every step', async () => {
    let offered = 0;
    let blocked = 0;
    let llmRefused = 0;
    for (let s = 1; s <= 500; s++) {
      const r = await session(s, 24);
      offered += r.offered;
      blocked += r.blocked;
      llmRefused += r.llmRefused;
    }
    // The replay exercised both sides of the filter and the write policy.
    expect(offered).toBeGreaterThan(1000);
    expect(blocked).toBeGreaterThan(1000);
    expect(llmRefused).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------------------------
// AC-M2

describe('AC-M2: LLM memory is a seed until confirmed', () => {
  it('refuses every non-seed write from an LLM, and a seed accepted by anyone but the owner', async () => {
    const { repo } = clocked();
    await expect(
      repo.append({ homeId: H, actor: 'llm-proposal', type: 'budgetSet', payload: { capGBP: 1 } }),
    ).rejects.toThrow(MemoryPolicyError);
    await expect(
      repo.append({ homeId: H, actor: 'llm-proposal', type: 'tenureSet', payload: { tenure: 'owner' } }),
    ).rejects.toThrow(MemoryPolicyError);
    await expect(
      repo.append({
        homeId: H,
        actor: 'llm-proposal',
        type: 'opApplied',
        payload: { op: { op: 'setBudget', capGBP: 5 } },
      }),
    ).rejects.toThrow(MemoryPolicyError);
    await expect(
      repo.append({ homeId: H, actor: 'llm-proposal', type: 'seedAccepted', payload: { seedId: 'x' } }),
    ).rejects.toThrow(MemoryPolicyError);
    await expect(
      repo.append({ homeId: H, actor: 'engine', type: 'seedAccepted', payload: { seedId: 'x' } }),
    ).rejects.toThrow(MemoryPolicyError);
    expect(await repo.history(H)).toEqual([]);
  });

  it('a proposed seed changes nothing, is not in the narrator digest, and applies once the owner accepts', async () => {
    const { repo, advance, now } = clocked();
    await repo.append({
      homeId: H,
      actor: 'llm-proposal',
      type: 'seedProposed',
      payload: {
        seedId: 's1',
        text: 'You said no to a heat pump. Rule it out?',
        proposes: { type: 'measureRejected', payload: { measureId: 'ashp', scope: 'never' } },
      },
      source: { kind: 'chat' },
    });
    await repo.append({
      homeId: H,
      actor: 'llm-proposal',
      type: 'seedProposed',
      payload: { seedId: 's2', text: 'Budget?', proposes: { type: 'budgetSet', payload: { capGBP: 9000 } } },
    });
    expect(await repo.preferences(H)).toEqual(emptyPreferences());
    expect((await repo.seeds(H)).map((s) => s.status)).toEqual(['proposed', 'proposed']);
    expect((await repo.digest(H)).recent).toEqual([]);

    advance(60_000);
    await repo.append({ homeId: H, actor: 'owner', type: 'seedAccepted', payload: { seedId: 's1' } });
    await repo.append({ homeId: H, actor: 'owner', type: 'seedDismissed', payload: { seedId: 's2' } });
    const p = await repo.preferences(H);
    expect(Object.keys(p.rejected)).toEqual(['ashp']);
    expect(p.rejected['ashp']).toMatchObject({ scope: 'never', at: now() });
    expect(p.budgetCapGBP).toBeUndefined();
    expect((await repo.seeds(H)).map((s) => s.status)).toEqual(['accepted', 'dismissed']);
    // The digest shows the owner's acceptance, never the proposal itself.
    const d = await repo.digest(H);
    expect(d.recent.map((e) => [e.actor, e.type])).toEqual([
      ['owner', 'seedDismissed'],
      ['owner', 'seedAccepted'],
    ]);
  });

  it('digestOf drops llm proposals even when handed a raw log', () => {
    const log: MemoryEvent[] = [
      {
        id: 'a',
        homeId: H,
        at: '2026-01-01T00:00:00.000Z',
        actor: 'llm-proposal',
        type: 'seedProposed',
        payload: { seedId: 's', text: 'x', proposes: null },
      },
    ];
    expect(digestOf(log, '2026-01-02T00:00:00.000Z').recent).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// AC-M3

describe('AC-M3: forget is real deletion after 30 days, or at once on "empty now"', () => {
  async function seeded() {
    const c = clocked();
    const a = await c.repo.append({
      homeId: H,
      actor: 'owner',
      type: 'measureRejected',
      payload: { measureId: 'ashp', scope: 'never', reason: 'too noisy for the neighbours' },
    });
    const b = await c.repo.append({
      homeId: H,
      actor: 'owner',
      type: 'budgetSet',
      payload: { capGBP: 12000 },
    });
    c.advance(1000);
    await c.repo.forget(H, { kind: 'measure', measureId: 'ashp' });
    return { ...c, a, b };
  }

  it('forget hides at once and keeps a recoverable compost; undo of the forget restores', async () => {
    const { repo, a } = await seeded();
    expect((await repo.preferences(H)).rejected).toEqual({});
    expect(repo.raw(H).some((e) => e.id === a.id)).toBe(true);
    const forget = (await repo.history(H, { type: 'memoryForgotten' }))[0]!;
    await repo.undo(forget.id);
    expect(Object.keys((await repo.preferences(H)).rejected)).toEqual(['ashp']);
  });

  it('purge keeps the compost before 30 days and deletes it for real at 30 days', async () => {
    const { repo, advance, a, b } = await seeded();
    advance(29 * DAY);
    expect(await repo.purge(H)).toBe(0);
    expect(repo.raw(H).some((e) => e.id === a.id)).toBe(true);
    advance(DAY);
    const removed = await repo.purge(H);
    expect(removed).toBe(2); // the rejection and the forget that named it
    expect(repo.raw(H).map((e) => e.id)).toEqual([b.id]);
    const exported = await repo.exportJSON(H);
    expect(exported).not.toContain('too noisy');
    expect(exported).not.toContain('ashp');
    expect((await repo.preferences(H)).budgetCapGBP).toBe(12000);
  });

  it('"empty now" deletes the compost at once, including forget all', async () => {
    const { repo } = await seeded();
    expect(await repo.purge(H, true)).toBe(2);
    expect(JSON.stringify(repo.raw(H))).not.toContain('too noisy');
    await repo.forget(H, { kind: 'all' });
    await repo.purge(H, true);
    expect(repo.raw(H)).toEqual([]);
    expect(await repo.preferences(H)).toEqual(emptyPreferences());
  });

  it('export and import round trip; an imported log cannot smuggle another home', async () => {
    const { repo } = await seeded();
    const json = await repo.exportJSON(H);
    const other = new InMemoryMemoryRepo();
    await other.importJSON(json);
    expect(await other.preferences(H)).toEqual(await repo.preferences(H));
    const bad = JSON.parse(json) as { events: { homeId: string }[] };
    bad.events[0]!.homeId = 'h2';
    await expect(new InMemoryMemoryRepo().importJSON(JSON.stringify(bad))).rejects.toThrow(/belongs to h2/);
  });
});
