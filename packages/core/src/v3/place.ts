/**
 * Places, city context and city packs (ARCH 15.4 and 15.7, SPEC R28, R29). Owner: WP-00 (contract);
 * WP-17 builds city packs, WP-08 stores places, WP-07 draws context, WP-16 analyses it.
 */
import type { IsoDate, SourceRef } from '../common.ts';
import type { PluginBase } from '../plugin/types.ts';
import type { Mm, PointMm } from './building.ts';

export interface Place {
  id: string;
  name: string;
  /** WGS84 degrees. */
  lat: number;
  lon: number;
  elevationM: number;
  /** Rotation of the local plan frame from true north, millidegrees. */
  trueNorthMdeg: number;
  climatePackId: string;
  /** Ordered: the first pack wins on a tie (R28). */
  codePackIds: string[];
  moneyPackIds: string[];
  cityPackId?: string;
  buildingIds: string[];
  /** Restart > Branch (SPEC 18.3): the place this one was copied from. */
  lineage?: { from: string; at: IsoDate };
  /** Sample places shipped with the app (IIIT campus, London terrace, HITEC City office). */
  sample?: true;
  /**
   * Buildings of interest kept out of the default view: list or show the place only when someone
   * searches for it or picks it, and load its city area lazily then.
   */
  onDemand?: true;
}

export type HeightSource = 'user' | 'osm-height' | 'osm-levels' | 'open-buildings' | 'overture' | 'unknown';

/** A neighbour. Unknown heights are a range, drawn hatched, analysed low to high (R29). */
export interface ContextBuilding {
  id: string;
  /** Pack local frame, integer mm. */
  footprint: PointMm[];
  /** Courtyards and light wells (clockwise), when the source has inner rings. */
  holes?: PointMm[][];
  height: { lo: Mm; likely: Mm; hi: Mm; source: HeightSource };
  levels?: number;
  roof?: string;
  /** Every source the record was fused from (Y1). */
  sources?: string[];
  name?: string;
  /** OSM `alt_name`, `short_name`, `official_name`, `name:en`, `old_name` (for search). */
  aliases?: string[];
  /** Address line from OSM `addr:*` tags. */
  addr?: string;
}

export interface ContextTree {
  id: string;
  at: PointMm;
  crownRadius: Mm;
  height: { lo: Mm; likely: Mm; hi: Mm };
  /** Months (0 to 11) with leaves. */
  leafOn: number[];
  source: 'osm' | 'canopy-raster' | 'user' | 'unknown';
}

/** One 250 m tile of a city pack (`ibasho.city/1`), as stored gzip JSON. */
export interface CityTile {
  schema: 'ibasho.city/1';
  packId: string;
  /** Tile index from the pack origin, east and north. */
  tx: number;
  ty: number;
  buildings: ContextBuilding[];
  trees: ContextTree[];
  /** 10 m heightfield in mm, row-major from the south-west corner; absent means flat. */
  terrain?: { cell: Mm; cols: number; rows: number; heights: readonly number[] };
}

/** City pack plugin (data only). Tiles load lazily by URL; the store caches them (`cityTiles`). */
export interface CityPackPlugin extends PluginBase<'city-pack'> {
  packId: string;
  name: string;
  origin: { lat: number; lon: number };
  tileSize: Mm;
  /** Bounding box of tiles. */
  extent: { minTx: number; minTy: number; maxTx: number; maxTy: number };
  tiles: { tx: number; ty: number; url: string; bytes: number; sha256: string }[];
  sources: SourceRef[];
}

/** Tile key used by the store (`[packId+tile]`). */
export function tileKey(tx: number, ty: number): string {
  return `${tx},${ty}`;
}
