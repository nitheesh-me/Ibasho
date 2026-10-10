/**
 * Dexie database `ibasho` (ARCH 9). Owner: WP-08. Layer L1 (imports L0 only).
 *
 * Row shapes and the database handle. The schema itself lives in `migrations.ts` as a list of
 * typed migrations, so every version change is a reviewed module with its own test.
 */
import type { Certificate, HomeTwin, SearchResult } from '@ibasho/core';
import { Dexie, type EntityTable, type Table } from 'dexie';
import { applyMigrations, MIGRATIONS, type Migration } from './migrations.ts';

export const DB_NAME = 'ibasho';

export interface HomeRow {
  id: string;
  name: string;
  region: string;
  archetypeId: string;
  /** Version of the twin the home shows now (`twins` key `[homeId+version]`). */
  activeVersion: number;
  /** ISO date time. */
  updatedAt: string;
}

/** Append-only twin versions. */
export interface TwinRow {
  homeId: string;
  version: number;
  twin: HomeTwin;
  at: string;
}

export interface ScenarioRow {
  id: string;
  homeId: string;
  name: string;
  /** Option id per group (`PackageSpec.options`). */
  options: Record<string, string>;
  at: string;
}

/** Columnar `SearchResult` (typed arrays and bigints survive the structured clone). */
export interface ResultRow {
  hash: string;
  homeId: string;
  createdAt: string;
  result: SearchResult;
}

/** A checker verdict as stored: `ok` per rung with its coverage (ARCH 8.4). */
export interface StoredVerdict {
  rung: 'mirror' | 'lean-native' | 'lean-wasm';
  coverage: 'all' | 'sample';
  ok: boolean;
  /** The checker report (`ibasho.verdicts/1`), kept as data. */
  report: unknown;
  at: string;
}

export interface CertRow {
  resultHash: string;
  certificate: Certificate;
  verdicts: StoredVerdict[];
}

/** One memory event as stored (AM 7.1). The domain logic lives in `@ibasho/ai`. */
export interface MemoryRow {
  id: string;
  homeId: string;
  at: string;
  type: string;
  event: unknown;
}

export interface NarrationRow {
  bundleHash: string;
  section: string;
  provider: string;
  text: unknown;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface BlobRow {
  id: string;
  type: string;
  data: Blob | ArrayBuffer;
}

export type IbashoDb = Dexie & {
  homes: EntityTable<HomeRow, 'id'>;
  twins: Table<TwinRow, [string, number]>;
  scenarios: EntityTable<ScenarioRow, 'id'>;
  results: EntityTable<ResultRow, 'hash'>;
  certs: EntityTable<CertRow, 'resultHash'>;
  memory: EntityTable<MemoryRow, 'id'>;
  narration: Table<NarrationRow, [string, string, string]>;
  settings: EntityTable<SettingRow, 'key'>;
  blobs: EntityTable<BlobRow, 'id'>;
};

export interface OpenOptions {
  name?: string;
  /** Inject an IndexedDB (tests use `fake-indexeddb`). */
  indexedDB?: IDBFactory;
  IDBKeyRange?: typeof IDBKeyRange;
  /** Defaults to `MIGRATIONS`; tests pass a longer list to exercise an upgrade. */
  migrations?: readonly Migration[];
}

/** Declare every version and return the handle. Dexie opens lazily on first use. */
export function createDb(opts: OpenOptions = {}): IbashoDb {
  const deps =
    opts.indexedDB && opts.IDBKeyRange ? { indexedDB: opts.indexedDB, IDBKeyRange: opts.IDBKeyRange } : {};
  const db = new Dexie(opts.name ?? DB_NAME, deps) as IbashoDb;
  applyMigrations(db, opts.migrations ?? MIGRATIONS);
  return db;
}
