/**
 * Row shapes for the v2 studio tables (ARCH 15.8). Owner: WP-08. Layer L1.
 *
 * Contracts come from `@ibasho/core`; rows add only what storage needs (timestamps, the active
 * version, lineage and the link back to a v1 home).
 */
import type {
  BuildingDoc,
  BuildingResult,
  BuildingTypeId,
  CityTile,
  Place,
  Setting,
  SiteResult,
} from '@ibasho/core';

export interface PlaceRow extends Partial<Omit<Place, 'id' | 'name' | 'buildingIds'>> {
  id: string;
  name: string;
  buildingIds: string[];
  updatedAt: string;
  /** Last time someone opened this place (Revisit). */
  visitedAt?: string;
  /** Headline numbers and pack versions as last seen, for "what changed" (SPEC 18.2). */
  seen?: Record<string, string>;
  /** Set by the v1 to v2 migration. */
  legacyHomeId?: string;
  region?: string;
}

export interface BuildingRow {
  id: string;
  placeId: string;
  name: string;
  typeId: BuildingTypeId;
  /** Version of the document the building shows now (`docs` key `[buildingId+version]`). 0 = none yet. */
  activeVersion: number;
  updatedAt: string;
  /** Restart > Branch: the building this one was copied from. */
  lineage?: { from: string; at: string };
  legacyHomeId?: string;
}

/** Append-only document versions. */
export interface DocRow {
  buildingId: string;
  version: number;
  doc: BuildingDoc;
  at: string;
  /** Short name for named versions and the film strip. */
  label?: string;
}

export type CommandOrigin = 'person' | 'agent' | 'partner' | 'import';

/** One editor command. `patches` and `inverse` are opaque here (Immer patches, or snapshots for now). */
export interface CommandRow {
  id: string;
  buildingId: string;
  variantId?: string;
  seq: number;
  label: string;
  origin: CommandOrigin;
  at: string;
  patches: unknown;
  inverse: unknown;
}

/** A named list of changes over a baseline version (SPEC 18.4). */
export interface VariantRow {
  id: string;
  buildingId: string;
  name: string;
  baseVersion: number;
  /** Lever values, by lever id (prototype levers; typed design ops at V-6). */
  levers: Record<string, number | string>;
  at: string;
}

export interface BuildingResultRow {
  inputsHash: string;
  buildingId: string;
  variantId?: string;
  createdAt: string;
  result: BuildingResult;
}

export interface SiteResultRow {
  inputsHash: string;
  buildingId: string;
  result: SiteResult;
}

export type ScopedSettingRow = Setting & { scopeId: string };

export interface RecSetRow {
  id: string;
  buildingId: string;
  at: string;
  recset: unknown;
}

export interface CityTileRow {
  packId: string;
  tile: string;
  data: CityTile;
}
