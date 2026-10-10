/**
 * Repositories over the `ibasho` database (ARCH 9). Owner: WP-08.
 *
 * M-0 scope: homes, append-only twins, results (LRU 10 per home), certificates with verdicts,
 * settings and the raw memory event log. PLACEHOLDER until M-P: the `MemoryRepo` from
 * `@ibasho/core` (preferences, seeds, digest, undo, forget) is folded from these rows by the
 * memory domain; only append, history and forget are here.
 */
import type { Certificate, HomeTwin, SearchResult } from '@ibasho/core';
import type { CertRow, HomeRow, IbashoDb, MemoryRow, StoredVerdict, TwinRow } from './schema.ts';

/** Results kept per home (ARCH 9). */
export const RESULTS_PER_HOME = 10;

export type Clock = () => string;
const isoNow: Clock = () => new Date().toISOString();

export interface Store {
  db: IbashoDb;
  homes: {
    get(id: string): Promise<HomeRow | undefined>;
    list(): Promise<HomeRow[]>;
    /** The most recently updated home, for `/app/` routing. */
    last(): Promise<HomeRow | undefined>;
  };
  twins: {
    /** Append `twin` as the next version of its home and make it active. Returns the version. */
    append(twin: HomeTwin, name?: string): Promise<number>;
    active(homeId: string): Promise<TwinRow | undefined>;
    versions(homeId: string): Promise<number[]>;
  };
  results: {
    put(homeId: string, result: SearchResult): Promise<void>;
    get(hash: string): Promise<SearchResult | undefined>;
    hashes(homeId: string): Promise<string[]>;
  };
  certs: {
    put(resultHash: string, certificate: Certificate): Promise<void>;
    addVerdict(resultHash: string, v: Omit<StoredVerdict, 'at'>): Promise<void>;
    get(resultHash: string): Promise<CertRow | undefined>;
  };
  settings: {
    get<T>(key: string): Promise<T | undefined>;
    set(key: string, value: unknown): Promise<void>;
  };
  memoryLog: {
    append(row: MemoryRow): Promise<void>;
    history(homeId: string): Promise<MemoryRow[]>;
    /** Real deletion of every event of a home. */
    forgetHome(homeId: string): Promise<void>;
  };
}

export function createStore(db: IbashoDb, now: Clock = isoNow): Store {
  return {
    db,
    homes: {
      get: (id) => db.homes.get(id),
      list: () => db.homes.orderBy('updatedAt').reverse().toArray(),
      last: () => db.homes.orderBy('updatedAt').last(),
    },
    twins: {
      append: (twin, name) =>
        db.transaction('rw', db.homes, db.twins, async () => {
          const prev = await db.twins.where('homeId').equals(twin.id).primaryKeys();
          const version = prev.length === 0 ? 1 : Math.max(...prev.map((k) => k[1])) + 1;
          const at = now();
          await db.twins.add({ homeId: twin.id, version, twin, at });
          const old = await db.homes.get(twin.id);
          await db.homes.put({
            id: twin.id,
            name: name ?? old?.name ?? twin.id,
            region: twin.region,
            archetypeId: twin.archetypeId,
            activeVersion: version,
            updatedAt: at,
          });
          return version;
        }),
      active: async (homeId) => {
        const home = await db.homes.get(homeId);
        return home ? db.twins.get([homeId, home.activeVersion]) : undefined;
      },
      versions: async (homeId) =>
        (await db.twins.where('homeId').equals(homeId).primaryKeys()).map((k) => k[1]).sort((a, b) => a - b),
    },
    results: {
      put: (homeId, result) =>
        db.transaction('rw', db.results, async () => {
          await db.results.put({ hash: result.hash, homeId, createdAt: now(), result });
          const rows = await db.results.where('homeId').equals(homeId).sortBy('createdAt');
          const drop = rows.slice(0, Math.max(0, rows.length - RESULTS_PER_HOME)).map((r) => r.hash);
          if (drop.length) await db.results.bulkDelete(drop);
        }),
      get: async (hash) => (await db.results.get(hash))?.result,
      hashes: async (homeId) =>
        (await db.results.where('homeId').equals(homeId).sortBy('createdAt')).map((r) => r.hash),
    },
    certs: {
      put: async (resultHash, certificate) => {
        const old = await db.certs.get(resultHash);
        await db.certs.put({ resultHash, certificate, verdicts: old?.verdicts ?? [] });
      },
      addVerdict: (resultHash, v) =>
        db.transaction('rw', db.certs, async () => {
          const row = await db.certs.get(resultHash);
          if (!row) throw new Error(`no certificate stored for result ${resultHash}`);
          const verdicts = row.verdicts.filter((x) => x.rung !== v.rung);
          verdicts.push({ ...v, at: now() });
          await db.certs.put({ ...row, verdicts });
        }),
      get: (resultHash) => db.certs.get(resultHash),
    },
    settings: {
      get: async <T>(key: string) => (await db.settings.get(key))?.value as T | undefined,
      set: async (key, value) => {
        await db.settings.put({ key, value });
      },
    },
    memoryLog: {
      append: async (row) => {
        await db.memory.add(row);
      },
      history: (homeId) => db.memory.where('[homeId+at]').between([homeId, ''], [homeId, '￿']).toArray(),
      forgetHome: async (homeId) => {
        await db.memory.where('[homeId+at]').between([homeId, ''], [homeId, '￿']).delete();
      },
    },
  };
}
