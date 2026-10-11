/**
 * Studio hooks: breakpoints, evidence for a building's jobs, the focused job. Owner: WP-08.
 */
import type { EvidenceId, EvidenceNode } from '@ibasho/core';
import type { EvidenceSource } from '@ibasho/ui';
import { useEffect, useMemo, useState } from 'react';
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
  const jobs = useStudio((s) => s.jobs);
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

export function useJob(buildingId: string | undefined, variantId: string = BASE_VARIANT): Job | undefined {
  return useStudio((s) => (buildingId ? s.jobs[jobKey(buildingId, variantId)] : undefined));
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
