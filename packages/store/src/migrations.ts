/**
 * Migrations (ARCH 9: typed modules, tested against fixture DB snapshots). Owner: WP-08.
 *
 * Each entry is one database version. `stores` is the Dexie schema delta for that version (`null`
 * drops a table) and `upgrade` rewrites rows written by older versions. Versions only ever grow;
 * never edit a released entry, append a new one.
 */
import type { Dexie, Transaction } from 'dexie';

export interface Migration {
  version: number;
  /** One line on what changed and why. */
  note: string;
  stores: Record<string, string | null>;
  upgrade?: (tx: Transaction) => Promise<void> | void;
}

/** v1, ARCH 9 table list. Keys first, then indexes. */
export const V1: Migration = {
  version: 1,
  note: 'ARCH 9 v1: homes, twins, scenarios, results, certs, memory, narration, settings, blobs.',
  stores: {
    homes: 'id, updatedAt',
    twins: '[homeId+version], homeId',
    scenarios: 'id, homeId',
    results: 'hash, homeId, createdAt',
    certs: 'resultHash',
    memory: 'id, [homeId+at], type',
    narration: '[bundleHash+section+provider]',
    settings: 'key',
    blobs: 'id',
  },
};

/**
 * v2, ARCH 15.8 (v3 studio). Additive: v1 tables stay. Two v3 tables take new names because Dexie
 * cannot change a primary key in place: `buildingResults` (key `inputsHash`, v1 `results` is keyed
 * by search hash) and `scopedSettings` (key `[scope+scopeId+id]`, v1 `settings` is a key value
 * store the app still uses for per device state). The upgrade copies each v1 home into a place with
 * one `single-family` building that points back at the home (`legacyHomeId`).
 */
export const V2: Migration = {
  version: 2,
  note: 'ARCH 15.8 v2: places, buildings, docs, commands, variants, buildingResults, siteResults, scopedSettings, recsets, cityTiles.',
  stores: {
    places: 'id, updatedAt',
    buildings: 'id, placeId, updatedAt',
    docs: '[buildingId+version], buildingId',
    commands: 'id, [buildingId+seq], variantId',
    variants: 'id, buildingId',
    buildingResults: 'inputsHash, buildingId, createdAt',
    siteResults: 'inputsHash, buildingId',
    scopedSettings: '[scope+scopeId+id], id',
    recsets: 'id, buildingId',
    cityTiles: '[packId+tile]',
  },
  upgrade: async (tx) => {
    const homes = (await tx.table('homes').toArray()) as {
      id: string;
      name: string;
      region: string;
      updatedAt: string;
    }[];
    for (const h of homes) {
      const placeId = `pl_${h.id}`;
      const buildingId = `bd_${h.id}`;
      await tx.table('places').put({
        id: placeId,
        name: h.name,
        region: h.region,
        buildingIds: [buildingId],
        updatedAt: h.updatedAt,
        legacyHomeId: h.id,
      });
      await tx.table('buildings').put({
        id: buildingId,
        placeId,
        name: h.name,
        typeId: 'single-family',
        activeVersion: 0,
        updatedAt: h.updatedAt,
        legacyHomeId: h.id,
      });
    }
  },
};

export const MIGRATIONS: readonly Migration[] = [V1, V2];

/** The version the app opens (the last migration). */
export const DB_VERSION: number = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

export function applyMigrations(db: Dexie, list: readonly Migration[]): void {
  let last = 0;
  for (const m of list) {
    if (!Number.isInteger(m.version) || m.version <= last)
      throw new Error(`migrations must have strictly increasing integer versions (at ${m.version})`);
    last = m.version;
    const v = db.version(m.version).stores(m.stores);
    if (m.upgrade) v.upgrade(m.upgrade);
  }
}
