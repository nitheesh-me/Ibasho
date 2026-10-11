/**
 * Studio persistence through `@ibasho/store` v2 (ARCH 15.8). Owner: WP-08.
 *
 * Reads the session at boot in one query (Revisit must open under 100 ms) and writes back after
 * changes settle. Places, buildings and variants go to their v2 tables; document versions are
 * appended to `docs`; the full session (with editor history) also goes to one key so a reload
 * restores undo. Results are not stored in V-P: they are Preview and recompute on load.
 */
import { createStudioStore, type Store } from '@ibasho/store';
import { getStore } from '../../shell/services.ts';
import { type StudioState, useStudio } from './studio.ts';

const KEY = 'studio.v2.session';
type Snapshot = Pick<StudioState, 'places' | 'buildings' | 'settings' | 'userSet'>;

let started = false;

export async function bootStudio(storeOverride?: Store | null): Promise<void> {
  if (started) return;
  started = true;
  const store = storeOverride === undefined ? getStore() : storeOverride;
  let snap: Snapshot | undefined;
  if (store) {
    try {
      snap = await store.settings.get<Snapshot>(KEY);
    } catch {
      snap = undefined;
    }
  }
  useStudio.getState().hydrate(snap);
  if (!store) return;
  const studio = createStudioStore(store.db);
  const docsWritten = new Map<string, number>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  useStudio.subscribe((s, prev) => {
    if (s.places === prev.places && s.buildings === prev.buildings && s.settings === prev.settings) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      const now = new Date().toISOString();
      try {
        await store.settings.set(KEY, {
          places: s.places,
          buildings: s.buildings,
          settings: s.settings,
          userSet: s.userSet,
        } satisfies Snapshot);
        for (const p of Object.values(s.places)) {
          await studio.places.put({
            ...p.place,
            updatedAt: new Date(p.updatedAt).toISOString(),
            ...(p.visitedAt ? { visitedAt: new Date(p.visitedAt).toISOString() } : {}),
          });
        }
        for (const b of Object.values(s.buildings)) {
          const n = b.versions.length;
          if (docsWritten.get(b.id) !== n) {
            docsWritten.set(b.id, n);
            await studio.docs.append(b.doc, b.versions[n - 1]?.label);
          }
          for (const v of b.variants) {
            await studio.variants.put({
              id: `${b.id}~${v.id}`,
              buildingId: b.id,
              name: v.name,
              baseVersion: n,
              levers: v.changes,
              at: now,
            });
          }
        }
      } catch {
        // Storage can be blocked (private window): the session still works in memory.
      }
    }, 1200);
  });
}

/** Tests: allow a fresh boot. */
export function resetBoot(): void {
  started = false;
}
