/**
 * City pack areas: the boxes fetched from Overpass and the pack origin. Owner: WP-17.
 * ARCH 15.7: `city-hyderabad` v1 covers a 2 km box around the IIIT campus and Gachibowli.
 */
export interface CityArea {
  packId: string;
  name: string;
  /** Pack origin (local frame 0,0), WGS84 degrees. */
  origin: { lat: number; lon: number };
  /** South, west, north, east in degrees. */
  bbox: [number, number, number, number];
  /** Tile edge in mm (250 m). */
  tileSize: number;
  /** Assumed storey height in mm when only `building:levels` is known, by use. */
  levelHeight: { residential: number; academic: number; office: number; other: number };
  /** The output directory of the pack, relative to the repo root. */
  outDir: string;
  /** Cache file, relative to tools/city. */
  cache: string;
}

export const HYDERABAD: CityArea = {
  packId: 'city-hyderabad',
  name: 'Hyderabad: IIIT campus and Gachibowli',
  origin: { lat: 17.4453, lon: 78.349 },
  // 2 km box centred on the campus centroid (about 1 km each way).
  bbox: [17.4363, 78.3396, 17.4543, 78.3584],
  tileSize: 250_000,
  levelHeight: { residential: 3_000, academic: 3_900, office: 3_900, other: 3_500 },
  outDir: 'packs/city-hyderabad/src/engine/tiles',
  cache: 'cache/hyderabad-overpass.json',
};

export const LONDON: CityArea = {
  packId: 'city-london',
  name: 'London: GH1 terrace street (stub)',
  // Around the GH1 fixture's stated location (district level, no street address).
  origin: { lat: 51.548, lon: -0.105 },
  bbox: [51.5462, -0.1079, 51.5498, -0.1021],
  tileSize: 250_000,
  levelHeight: { residential: 2_800, academic: 3_600, office: 3_600, other: 3_000 },
  outDir: 'packs/city-london/src/engine/tiles',
  cache: 'cache/london-overpass.json',
};

/**
 * On-demand area (owner: loaded only when someone searches for or picks it): Raidurg and
 * Knowledge City, HITEC City, about 3.5 km south east of IIIT. Holds KRC Commerzone Raidurg
 * (Qualcomm) and Sattva Knowledge Park (Vanguard). A 1 km box keeps it light.
 */
export const RAIDURG: CityArea = {
  packId: 'city-hyderabad-raidurg',
  name: 'Hyderabad: Raidurg and Knowledge City (on demand)',
  origin: { lat: 17.43, lon: 78.3795 },
  bbox: [17.4255, 78.3748, 17.4345, 78.3842],
  tileSize: 250_000,
  levelHeight: { residential: 3_000, academic: 3_900, office: 4_200, other: 3_500 },
  outDir: 'packs/city-hyderabad/src/engine/raidurg/tiles',
  cache: 'cache/raidurg-overpass.json',
};

/**
 * On-demand London area for designing new buildings on real plots (SPEC 27): King's Cross, a 1 km
 * box with many tagged heights and levels. Loaded only when the person picks it.
 */
export const KINGS_CROSS: CityArea = {
  packId: 'city-london-kings-cross',
  name: "London: King's Cross (on demand)",
  origin: { lat: 51.5352, lon: -0.125 },
  bbox: [51.5307, -0.1322, 51.5397, -0.1178],
  tileSize: 250_000,
  levelHeight: { residential: 3_000, academic: 3_600, office: 3_800, other: 3_200 },
  outDir: 'packs/city-london/src/engine/kings-cross/tiles',
  cache: 'cache/kings-cross-overpass.json',
};

export const AREAS: Record<string, CityArea> = {
  hyderabad: HYDERABAD,
  london: LONDON,
  raidurg: RAIDURG,
  'kings-cross': KINGS_CROSS,
};
