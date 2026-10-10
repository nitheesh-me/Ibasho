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

export const MIGRATIONS: readonly Migration[] = [V1];

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
