import type { Certificate, HomeTwin, SearchResult } from '@ibasho/core';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import gh1Json from '../../fixtures/src/homes/gh1.twin.json' with { type: 'json' };
import {
  createDb,
  createStore,
  DB_VERSION,
  MIGRATIONS,
  type Migration,
  RESULTS_PER_HOME,
  V1,
} from '../src/index.ts';

const twin = gh1Json as unknown as HomeTwin;

function fresh(migrations?: readonly Migration[], indexedDB = new IDBFactory()) {
  const db = createDb({ indexedDB, IDBKeyRange, ...(migrations ? { migrations } : {}) });
  let t = 0;
  const clock = () => new Date(Date.UTC(2026, 9, 11, 0, 0, t++)).toISOString();
  return { db, store: createStore(db, clock), indexedDB };
}

function fakeResult(hash: string): SearchResult {
  return {
    hash,
    specHash: 'spec',
    packages: { ids: ['baseline'], n0: new BigInt64Array([12n]), front: new Uint32Array([0]) },
  } as unknown as SearchResult;
}

describe('schema', () => {
  it('opens v1 with the ARCH 9 tables', async () => {
    const { db } = fresh();
    await db.open();
    expect(DB_VERSION).toBe(1);
    expect(MIGRATIONS).toEqual([V1]);
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      ['blobs', 'certs', 'homes', 'memory', 'narration', 'results', 'scenarios', 'settings', 'twins'].sort(),
    );
    db.close();
  });

  it('rejects migrations whose versions do not increase', () => {
    expect(() => createDb({ migrations: [V1, { ...V1 }] })).toThrow(/strictly increasing/);
  });
});

describe('repositories', () => {
  it('appends twin versions and tracks the active one', async () => {
    const { store } = fresh();
    expect(await store.twins.append(twin, 'Sample home')).toBe(1);
    expect(await store.twins.append({ ...twin, version: twin.version + 1 })).toBe(2);
    expect(await store.twins.versions('gh1')).toEqual([1, 2]);
    expect((await store.twins.active('gh1'))?.version).toBe(2);
    const home = await store.homes.get('gh1');
    expect(home?.name).toBe('Sample home');
    expect(home?.region).toBe('GB-ENG');
    expect((await store.homes.last())?.id).toBe('gh1');
  });

  it('keeps typed arrays and bigints, and only the last results per home', async () => {
    const { store } = fresh();
    for (let i = 0; i < RESULTS_PER_HOME + 2; i++) await store.results.put('gh1', fakeResult(`h${i}`));
    const hashes = await store.results.hashes('gh1');
    expect(hashes).toHaveLength(RESULTS_PER_HOME);
    expect(hashes[0]).toBe('h2');
    const r = await store.results.get(`h${RESULTS_PER_HOME + 1}`);
    expect(r?.packages.n0).toBeInstanceOf(BigInt64Array);
    expect(r?.packages.n0[0]).toBe(12n);
    expect(await store.results.get('h0')).toBeUndefined();
  });

  it('stores a certificate and one verdict per rung', async () => {
    const { store } = fresh();
    const cert = { schema: 'ibasho.cert/2' } as unknown as Certificate;
    await expect(
      store.certs.addVerdict('x', { rung: 'mirror', coverage: 'all', ok: true, report: {} }),
    ).rejects.toThrow();
    await store.certs.put('x', cert);
    await store.certs.addVerdict('x', { rung: 'mirror', coverage: 'all', ok: false, report: {} });
    await store.certs.addVerdict('x', { rung: 'mirror', coverage: 'all', ok: true, report: { ok: true } });
    const row = await store.certs.get('x');
    expect(row?.verdicts).toHaveLength(1);
    expect(row?.verdicts[0]?.ok).toBe(true);
    await store.certs.put('x', cert);
    expect((await store.certs.get('x'))?.verdicts).toHaveLength(1);
  });

  it('settings and the memory log, with real deletion', async () => {
    const { store } = fresh();
    await store.settings.set('motion', 'reduced');
    expect(await store.settings.get<string>('motion')).toBe('reduced');
    await store.memoryLog.append({
      id: 'e1',
      homeId: 'gh1',
      at: '2026-10-11T00:00:01Z',
      type: 'reject',
      event: {},
    });
    await store.memoryLog.append({
      id: 'e2',
      homeId: 'gh1',
      at: '2026-10-11T00:00:00Z',
      type: 'fact',
      event: {},
    });
    await store.memoryLog.append({
      id: 'e3',
      homeId: 'gh2',
      at: '2026-10-11T00:00:00Z',
      type: 'fact',
      event: {},
    });
    expect((await store.memoryLog.history('gh1')).map((e) => e.id)).toEqual(['e2', 'e1']);
    await store.memoryLog.forgetHome('gh1');
    expect(await store.memoryLog.history('gh1')).toEqual([]);
    expect(await store.memoryLog.history('gh2')).toHaveLength(1);
  });
});

describe('migrations (H3 scaffold)', () => {
  it('upgrades rows written by v1 when a v2 migration is appended', async () => {
    const indexedDB = new IDBFactory();
    const v1 = fresh(undefined, indexedDB);
    await v1.store.twins.append(twin, 'Sample home');
    v1.db.close();

    const V2: Migration = {
      version: 2,
      note: 'test only: index homes by region and upper-case names',
      stores: { homes: 'id, updatedAt, region' },
      upgrade: async (tx) => {
        await tx
          .table('homes')
          .toCollection()
          .modify((h: { name: string }) => {
            h.name = h.name.toUpperCase();
          });
      },
    };
    const v2 = fresh([V1, V2], indexedDB);
    await v2.db.open();
    expect(v2.db.verno).toBe(2);
    expect((await v2.store.homes.get('gh1'))?.name).toBe('SAMPLE HOME');
    expect(await v2.db.homes.where('region').equals('GB-ENG').count()).toBe(1);
    expect((await v2.store.twins.active('gh1'))?.twin.id).toBe('gh1');
    v2.db.close();
  });
});
