/**
 * The asset sets WP-11 ships. Owner: WP-11.
 *
 * Hero tier (gate M-A, BUILD_PLAN WP-11): four Poly Haven HDRIs, four Poly Haven texture sets,
 * and the GH1 subset of Kenney Furniture Kit and Quaternius Ultimate House Interior.
 * Lazy sets (SV 6, gate M-D) are not listed yet; add them here with `tier: 'lazy'`.
 *
 * GH1 is a 1905 London mid terrace (SPEC R1): front room, back room, rear kitchen, hall and
 * stairs, two bedrooms and a bathroom upstairs. The furniture subset dresses those rooms.
 */

export type Tier = 'hero' | 'lazy';

export interface HdriSpec {
  readonly kind: 'hdri';
  /** Poly Haven asset id, for example `qwantani_noon`. */
  readonly phId: string;
  readonly tier: Tier;
  /** Why the scene uses it (DS 10, SV 6.1). */
  readonly use: string;
}

export interface TextureSpec {
  readonly kind: 'texture';
  readonly phId: string;
  readonly tier: Tier;
  readonly use: string;
  /** Source and output resolution. DS 10: 1k, or 2k for the hero facade. */
  readonly res: '1k' | '2k';
}

export interface KenneyModelSpec {
  readonly kind: 'model';
  readonly provider: 'kenney';
  /** File stem inside `Models/GLTF format/` of the Kenney Furniture Kit zip. */
  readonly name: string;
  readonly tier: Tier;
  readonly room: Room;
  readonly fit: Fit;
}

export interface QuaterniusModelSpec {
  readonly kind: 'model';
  readonly provider: 'quaternius';
  /** Poly Pizza public id inside the Ultimate House Interior bundle. */
  readonly publicId: string;
  /** Our kebab-case slug (Poly Pizza titles repeat, for example eight models called Door). */
  readonly slug: string;
  readonly title: string;
  readonly tier: Tier;
  readonly room: Room;
  readonly fit: Fit;
}

/**
 * Real-world size used to rescale a model to metres: `height` is the vertical extent, `length`
 * the longer horizontal extent. Values are typical UK furniture sizes (a UK double bed is
 * 1.35 m by 1.9 m; an internal door is 1.981 m, 6 ft 6 in).
 */
export interface Fit {
  readonly dim: 'height' | 'length';
  readonly metres: number;
}

export type Room = 'living' | 'dining' | 'kitchen' | 'bedroom' | 'bathroom' | 'hall' | 'any';

export type ModelSpec = KenneyModelSpec | QuaterniusModelSpec;
export type AssetSpec = HdriSpec | TextureSpec | ModelSpec;

/** Hero tier budget in bytes (K2: "the hero tier is at most 8 MB"; decimal MB, the stricter reading). */
export const HERO_BUDGET_BYTES = 8_000_000;

export const HDRIS: readonly HdriSpec[] = [
  {
    kind: 'hdri',
    phId: 'kloofendal_overcast_puresky',
    tier: 'hero',
    use: 'UK-like overcast default sky (Hiru)',
  },
  { kind: 'hdri', phId: 'qwantani_noon', tier: 'hero', use: 'Time of day scrubber: midday' },
  {
    kind: 'hdri',
    phId: 'qwantani_late_afternoon',
    tier: 'hero',
    use: 'Time of day scrubber: late afternoon',
  },
  { kind: 'hdri', phId: 'qwantani_dusk_2', tier: 'hero', use: 'Yoru: dusk sky behind emissive windows' },
];

export const TEXTURES: readonly TextureSpec[] = [
  { kind: 'texture', phId: 'red_brick_03', tier: 'hero', use: 'Hero facade, solid brick walls', res: '2k' },
  { kind: 'texture', phId: 'roof_slates_02', tier: 'hero', use: 'Welsh slate roof', res: '1k' },
  { kind: 'texture', phId: 'white_stucco', tier: 'hero', use: 'Render and plaster', res: '1k' },
  { kind: 'texture', phId: 'pavement_02', tier: 'hero', use: 'Street and front path', res: '1k' },
];

const h = (metres: number): Fit => ({ dim: 'height', metres });
const len = (metres: number): Fit => ({ dim: 'length', metres });

const k = (name: string, room: Room, fit: Fit): KenneyModelSpec => ({
  kind: 'model',
  provider: 'kenney',
  name,
  tier: 'hero',
  room,
  fit,
});

/** GH1 subset of Kenney Furniture Kit 2.0 (CC0). */
export const KENNEY_MODELS: readonly KenneyModelSpec[] = [
  k('loungeSofa', 'living', h(0.85)),
  k('loungeChair', 'living', h(0.85)),
  k('tableCoffee', 'living', h(0.45)),
  k('rugRectangle', 'living', len(2.0)),
  k('bookcaseOpen', 'living', h(1.8)),
  k('lampRoundFloor', 'living', h(1.6)),
  k('televisionModern', 'living', len(1.0)),
  k('cabinetTelevision', 'living', h(0.5)),
  k('table', 'dining', h(0.75)),
  k('chair', 'dining', h(0.9)),
  k('sideTable', 'dining', h(0.6)),
  k('kitchenCabinet', 'kitchen', h(0.9)),
  k('kitchenCabinetUpper', 'kitchen', h(0.7)),
  k('kitchenSink', 'kitchen', h(0.9)),
  k('kitchenStove', 'kitchen', h(0.9)),
  k('kitchenFridgeSmall', 'kitchen', h(0.85)),
  k('washer', 'kitchen', h(0.85)),
  k('bedDouble', 'bedroom', len(1.9)),
  k('bedSingle', 'bedroom', len(1.9)),
  k('cabinetBedDrawer', 'bedroom', h(0.55)),
  k('lampRoundTable', 'bedroom', h(0.45)),
  k('bathtub', 'bathroom', len(1.7)),
  k('toilet', 'bathroom', h(0.8)),
  k('bathroomSink', 'bathroom', h(0.85)),
  k('coatRackStanding', 'hall', h(1.8)),
  k('rugDoormat', 'hall', len(0.8)),
  k('pottedPlant', 'any', h(0.8)),
];

const q = (publicId: string, slug: string, title: string, room: Room, fit: Fit): QuaterniusModelSpec => ({
  kind: 'model',
  provider: 'quaternius',
  publicId,
  slug,
  title,
  tier: 'hero',
  room,
  fit,
});

/** GH1 subset of Quaternius Ultimate House Interior (CC0), pinned by Poly Pizza public id. */
export const QUATERNIUS_MODELS: readonly QuaterniusModelSpec[] = [
  q('nzxZYIOCIr', 'fireplace', 'Fireplace', 'living', h(1.2)),
  q('mWgQ94zhDZ', 'couch-medium', 'Couch Medium', 'living', h(0.85)),
  q('kkeII96j9N', 'curtains-double', 'Curtains Double', 'any', h(2.2)),
  q('7H5qKjuxVY', 'rug', 'Rug', 'living', len(2.0)),
  q('eCnblJPsW8', 'table-round-large', 'Table Round Large', 'dining', h(0.75)),
  q('iMNqRzPwwe', 'chair-ladder-back', 'Chair', 'dining', h(0.95)),
  q('9LI73c5uFA', 'night-stand', 'Night Stand', 'bedroom', h(0.55)),
  q('8R9fXwL11r', 'towel-rack', 'Towel Rack', 'bathroom', h(0.9)),
  q('JT44JUXU2d', 'light-ceiling-single', 'Light Ceiling Single', 'any', h(0.4)),
  q('Kr4kr7OCCQ', 'houseplant', 'Houseplant', 'any', h(1.0)),
  q('LI93WgnjyS', 'door-panel', 'Door', 'hall', h(1.981)),
];

export const ALL_SPECS: readonly AssetSpec[] = [
  ...HDRIS,
  ...TEXTURES,
  ...KENNEY_MODELS,
  ...QUATERNIUS_MODELS,
];

/** Provider facts recorded in the manifest and on the attribution page. */
export const PROVIDERS = {
  polyhaven: {
    name: 'Poly Haven',
    url: 'https://polyhaven.com',
    licence: 'CC0-1.0',
    licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  kenney: {
    name: 'Kenney',
    url: 'https://kenney.nl/assets/furniture-kit',
    licence: 'CC0-1.0',
    licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  quaternius: {
    name: 'Quaternius',
    url: 'https://quaternius.com/packs/ultimatehomeinterior.html',
    licence: 'CC0-1.0',
    licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
} as const;

export type ProviderId = keyof typeof PROVIDERS;

/** Kenney Furniture Kit 2.0 zip, as linked from the kit page on 2026-10-11. */
export const KENNEY_FURNITURE_PAGE = 'https://kenney.nl/assets/furniture-kit';
/** Quaternius hosts the pack on Google Drive (OBJ and FBX only, often over quota); Poly Pizza mirrors it as GLB. */
export const QUATERNIUS_BUNDLE_PAGE = 'https://poly.pizza/bundle/Ultimate-House-Interior-Pack-2SXnFbwFzm';

/** kebab-case from camelCase or snake_case. */
export function kebab(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

/** Stable asset id used in the manifest and in scene code. */
export function assetId(spec: AssetSpec): string {
  switch (spec.kind) {
    case 'hdri':
      return `hdri-${kebab(spec.phId)}`;
    case 'texture':
      return `tex-${kebab(spec.phId)}`;
    case 'model':
      return spec.provider === 'kenney' ? `kenney-${kebab(spec.name)}` : `quaternius-${spec.slug}`;
  }
}
