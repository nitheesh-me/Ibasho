/**
 * Place search contract: find a building, storey or room by name in the loaded areas (city packs
 * and building documents). Owner: WP-00 (contract); WP-14 implements `buildPlaceIndex` and
 * `searchPlaces` in `@ibasho/plan` (pure, offline). WP-08 draws the search box, WP-07 focuses
 * and highlights the hit in the city.
 */
import type { Mm } from './building.ts';

export type PlaceHitKind = 'place' | 'building' | 'storey' | 'room';

export interface PlaceHit {
  kind: PlaceHitKind;
  /** Place id, context building id (`osm_w…`), building document id, storey id or room id. A place hit's `buildingId` is its first building. */
  id: string;
  name: string;
  /** Other names it answers to (OSM alt, short, official names, curated campus names). */
  aliases: string[];
  /** The building the hit belongs to (itself for a building). */
  buildingId: string;
  buildingName: string;
  storeyId?: string;
  /** Storey name for storey and room hits (rows with the same room name on several floors). */
  storeyName?: string;
  /** City pack id (`city-hyderabad`, `city-london`), or the place id for a document off the packs. */
  city: string;
  /** City tile `[tx, ty]` holding the building, when it comes from a pack. */
  tile?: [number, number];
  /** Place frame (pack frame for the samples), integer mm. */
  centre: [Mm, Mm];
  bbox: { minX: Mm; minY: Mm; maxX: Mm; maxY: Mm };
  /** Vertical extent in mm: the building's height range, or the storey's floor to ceiling. */
  heightRange?: { lo: Mm; hi: Mm };
  /** `osm` for pack buildings, `document` for a building document, `merged` when both. */
  source: 'osm' | 'document' | 'merged' | 'place';
  /** OSM ids of the context building a document stands in for (hide them when focusing). */
  contextIds?: string[];
  /** Relevance, higher is better (0 to 100). */
  score: number;
  /** The names that matched, for highlighting. */
  matched: string[];
}

export interface PlaceSearchOptions {
  /** Default 10. */
  limit?: number;
  kinds?: PlaceHitKind[];
  city?: string;
  buildingId?: string;
  /** Minimum score (default 30). */
  minScore?: number;
}
