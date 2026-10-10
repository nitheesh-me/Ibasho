/**
 * Finding a home by id (SPEC 4). Owner: WP-08.
 *
 * Samples come from `sample.ts`. A person's own home is the active twin in the store. Homes made
 * in this visit are also held in memory, so onboarding still reaches its Reveal in a browser with
 * no IndexedDB (the page then says the home is not kept).
 */
import type { Store } from '@ibasho/store';
import { type HomeEntry, homeFromTwin, isSampleId, sampleHome } from './sample.ts';

const visit = new Map<string, HomeEntry>();

/** Hold a home made in this visit (onboarding), whether or not the store kept it. */
export function holdHome(home: HomeEntry): void {
  visit.set(home.id, home);
}

export async function findHome(id: string, store: Store | null): Promise<HomeEntry | undefined> {
  const sample = sampleHome(id);
  if (sample) return sample;
  const held = visit.get(id);
  if (held) return held;
  if (!store) return undefined;
  try {
    const [row, home] = await Promise.all([store.twins.active(id), store.homes.get(id)]);
    return row ? homeFromTwin(row.twin, home?.name ?? 'Your home') : undefined;
  } catch {
    return undefined;
  }
}

export interface HomeLink {
  id: string;
  name: string;
  sample: boolean;
}

/** The person's own homes, most recent first, then the samples. */
export async function listHomes(store: Store | null): Promise<HomeLink[]> {
  const own: HomeLink[] = [];
  const seen = new Set<string>();
  // Newest first: the visit map keeps insertion order, so walk it backwards.
  for (const h of [...visit.values()].reverse()) {
    own.push({ id: h.id, name: h.name, sample: false });
    seen.add(h.id);
  }
  if (store) {
    try {
      for (const h of await store.homes.list()) {
        if (isSampleId(h.id) || seen.has(h.id)) continue;
        own.push({ id: h.id, name: h.name, sample: false });
      }
    } catch {
      // Storage unavailable: only this visit's homes.
    }
  }
  return [...own, { id: 'gh1', name: 'Sample home', sample: true }];
}

/** Where `/app/` goes: the last own home, else onboarding (SPEC 4). */
export async function landingPath(store: Store | null): Promise<string> {
  const first = (await listHomes(store)).find((h) => !h.sample);
  return first ? `/home/${first.id}` : '/start';
}
