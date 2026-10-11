/**
 * Studio hooks: breakpoints, evidence for a building's jobs, the focused job. Owner: WP-08.
 */
import type { EvidenceId, EvidenceNode } from '@ibasho/core';
import type { EvidenceSource } from '@ibasho/ui';
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BASE_VARIANT, type BuildingEntry, type Job, jobKey, useStudio } from './state/studio.ts';

export type Breakpoint = 'phone' | 'tablet' | 'desktop' | 'wide';

function bp(w: number): Breakpoint {
  return w < 768 ? 'phone' : w < 1280 ? 'tablet' : w < 1600 ? 'desktop' : 'wide';
}

export function useBreakpoint(): Breakpoint {
  const [b, setB] = useState<Breakpoint>(() =>
    typeof window === 'undefined' ? 'desktop' : bp(window.innerWidth),
  );
  useEffect(() => {
    const on = () => setB(bp(window.innerWidth));
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return b;
}

export function useReducedMotion(): boolean {
  const [r, setR] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return r;
}

/** Evidence over every job of a building (variants share one provider; ids carry the variant). */
export function useBuildingEvidence(
  buildingId: string | undefined,
  open?: (id: EvidenceId, from: HTMLElement) => void,
): EvidenceSource {
  const jobs = useJobs();
  return useMemo(() => {
    const map = new Map<EvidenceId, EvidenceNode>();
    if (buildingId) {
      for (const j of Object.values(jobs)) {
        if (!j.key.startsWith(`${buildingId}~`)) continue;
        for (const list of Object.values(j.nodes)) for (const n of list ?? []) map.set(n.id, n);
      }
    }
    const src: EvidenceSource = { node: (id) => map.get(id), locale: 'en-IN' };
    if (open) src.open = open;
    return src;
  }, [jobs, buildingId, open]);
}

const NO_BAR: Job['bar'] = { generation: 0, stages: [] };
const stripCache = new Map<string, { deps: unknown[]; out: Job }>();

/**
 * A job without its progress bar and message: what panels and the scene render from. Progress
 * events arrive every tick and change only the bar, so views that read this stay still while a
 * stage runs (the round 5 lantern stall: every tick re-rendered the whole studio and the scene).
 */
export function stripJob(j: Job): Job {
  const deps = [j.views, j.nodes, j.tiers, j.stale, j.outputs, j.latest, j.resolution, j.generation];
  const hit = stripCache.get(j.key);
  if (hit && hit.deps.length === deps.length && hit.deps.every((d, i) => d === deps[i])) return hit.out;
  const out: Job = { ...j, bar: NO_BAR, message: undefined };
  stripCache.set(j.key, { deps, out });
  return out;
}

/** Every job, render-stable (changes only when results change, never on progress ticks). */
export function useJobs(): Record<string, Job> {
  return useStudio(
    useShallow((s) => {
      const out: Record<string, Job> = {};
      for (const [k, j] of Object.entries(s.jobs)) out[k] = stripJob(j);
      return out;
    }),
  );
}

export function useJob(buildingId: string | undefined, variantId: string = BASE_VARIANT): Job | undefined {
  return useStudio((s) => {
    const j = buildingId ? s.jobs[jobKey(buildingId, variantId)] : undefined;
    return j ? stripJob(j) : undefined;
  });
}

/** The live progress bar and message of one job (only the engawa reads this). */
export function useJobBar(key: string | undefined): { bar: Job['bar']; message: string | undefined } {
  return useStudio(
    useShallow((s) => {
      const j = key ? s.jobs[key] : undefined;
      return { bar: j?.bar ?? NO_BAR, message: j?.message };
    }),
  );
}

export function useBuilding(buildingId: string | undefined): BuildingEntry | undefined {
  return useStudio((s) => (buildingId ? s.buildings[buildingId] : undefined));
}

/** Days in words for revisit and film strip captions (no digits outside Num). */
export function agoWords(ms: number): string {
  const min = Math.floor((Date.now() - ms) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return min < 2 ? 'a minute ago' : min < 15 ? 'minutes ago' : 'within the hour';
  const h = Math.floor(min / 60);
  if (h < 24) return h < 2 ? 'an hour ago' : 'today';
  const d = Math.floor(h / 24);
  if (d < 2) return 'yesterday';
  if (d < 7) return 'this week';
  if (d < 14) return 'last week';
  if (d < 45) return 'weeks ago';
  return 'months ago';
}
