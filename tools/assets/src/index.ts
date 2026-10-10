/**
 * `@ibasho/tools-assets` public API. Owner: WP-11.
 *
 * CLI entry points are `src/fetch.ts` (`pnpm --filter @ibasho/tools-assets fetch`) and
 * `src/process.ts` (`pnpm assets`). Consumers of the served files (WP-07 scene, WP-08 shell)
 * import only the manifest types from here; the files themselves are read at runtime from
 * `/app/assets/manifest.json`.
 */
export { renderAttribution } from './attribution.ts';
export { type CheckReport, checkAssetsDir } from './check.ts';
export { ALL_SPECS, type AssetSpec, assetId, HERO_BUDGET_BYTES, type Room, type Tier } from './config.ts';
export type { GainMapMetadata } from './gainmap.ts';
export {
  type AssetKind,
  type AssetStatus,
  checkManifest,
  type Manifest,
  type ManifestAsset,
  type ManifestFile,
  type ManifestSourceFile,
  tierBytes,
} from './manifest.ts';
