/**
 * @ibasho/store (ARCH 9). Owner: WP-08. Layer L1 (imports L0 only).
 *
 * Dexie database `ibasho`, typed migrations and repositories. M-0 scope; the `.ibasho` codec, the
 * full `MemoryRepo`, storage persistence status and the snapshot codec are PLACEHOLDER (M-D, T2).
 */
export { applyMigrations, DB_VERSION, MIGRATIONS, type Migration, V1 } from './migrations.ts';
export { type Clock, createStore, RESULTS_PER_HOME, type Store } from './repos.ts';
export {
  type BlobRow,
  type CertRow,
  createDb,
  DB_NAME,
  type HomeRow,
  type IbashoDb,
  type MemoryRow,
  type NarrationRow,
  type OpenOptions,
  type ResultRow,
  type ScenarioRow,
  type SettingRow,
  type StoredVerdict,
  type TwinRow,
} from './schema.ts';
