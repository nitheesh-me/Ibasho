/**
 * Generates the golden building documents (SPEC 16) into `packages/fixtures/src/buildings/`.
 * Owner: WP-14. Run: `pnpm --filter @ibasho/plan gen:buildings`. Deterministic.
 *
 * Sources: RB (docs/research/v3/reference-buildings.md) tables for Vindhya (GB1) and Himalaya
 * (GB2), the Vindhya and Himalaya OSM outlines in the `city-hyderabad` pack for placement, RB 6 for
 * the HITEC City office (GB3), and the GH1 survey twin for the London terrace. Wing layouts are
 * simplified to rectangles on a grid (status `measured` within about 10%); glazing, shading and
 * build-ups are `unknown` and listed in each `<id>.notes.json`.
 */
import { readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type {
  BuildingDoc,
  CityTile,
  Mm,
  Place,
  PointMm,
  Room2D,
  ShadeRule,
  Storey,
  WindowRule,
} from '@ibasho/core';
import { toWireJson } from '@ibasho/core/schemas';
import { autoZone, centroid, type RoomSpec, rectRing, weldRooms } from '../src/index.ts';

const root = join(import.meta.dirname, '..', '..', '..');
const out = join(root, 'packages/fixtures/src/buildings');
const write = (name: string, value: unknown) => {
  const p = join(out, name);
  writeFileSync(`${p}.tmp`, `${toWireJson(value, 2)}\n`);
  renameSync(`${p}.tmp`, p);
};

const tilesDir = join(root, 'packs/city-hyderabad/src/engine/tiles');
const tiles: CityTile[] = readdirSync(tilesDir)
  .filter((f) => f.endsWith('.json.gz'))
  .sort()
  .map((f) => JSON.parse(gunzipSync(readFileSync(join(tilesDir, f))).toString()) as CityTile);
const ctx = (id: string) => {
  const b = tiles.flatMap((t) => t.buildings).find((x) => x.id === id);
  if (!b) throw new Error(`context building ${id} missing`);
  return b;
};
const m = (metres: number): Mm => Math.round(metres * 1000);

/** Rectangular room spec from metre coordinates. */
const R = (
  id: string,
  name: string,
  spaceTypeId: string | undefined,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): RoomSpec => ({
  id,
  name,
  outer: rectRing(m(x0), m(y0), m(x1), m(y1)),
  ...(spaceTypeId ? { spaceTypeId } : {}),
});

const exteriorRules =
  (window: WindowRule, shading: ShadeRule[] = []) =>
  () => ({ window, shading });

function storey(
  id: string,
  name: string,
  elevation: Mm,
  floorToFloor: Mm,
  rooms: Room2D[],
  extra: Partial<Storey> = {},
): Storey {
  return {
    id,
    name,
    elevation,
    floorToFloor,
    multiplier: 1,
    belowGrade: false,
    rooms,
    rooms3d: [],
    cores: [],
    ...extra,
  };
}

// ---------------------------------------------------------------------------------------------
// GB1 Vindhya Bhavan (RB 3), fitted to its OSM outline (relation 2829427). Building frame: x
// along the long axis, y towards the C row; origin at the OSM outer ring centroid. Rotation
// 41.7 degrees squares the OSM rings to the frame (long axis bearing 131.7): the A row faces
// 221.7 (SW), the C row 41.7 (NE). In this frame the OSM courts are 41 x 10 m on the A side
// (y -24 to -13.5) and 47 x 14 m on the C side (y 2.5 to 16.5); the C side spine between them
// is a 3 m corridor. The A row is 17 m deep, the C row about 21.5 m (rooms plus corridor).

const F2F_GB1 = m(3.9); // assumed (RB 3.1)

/** One wing room per floor: [name, space type, aliases] for L1, L2, L3 (RB 3.2; functions only). */
type Use = [string, string, string[]];
interface Wing {
  id: string;
  rect: [number, number, number, number];
  floors: [Use, Use, Use];
}
const same = (u: Use): [Use, Use, Use] => [u, u, u];
const STAIR = (w: string): Use => [`${w} stair and lift`, 'stair', ['Stair', 'Lift', 'Staircase']];
const CORR = (name: string): Use => [name, 'circulation', ['Corridor']];

const GB1_WINGS: Wing[] = [
  // A row (SW facing), rooms y -41 to -29, corridor y -29 to -24.
  {
    id: 'a1dc',
    rect: [-76.5, -41, -64.5, -33],
    floors: [
      ['Data Centre', 'data-centre', ['Server room', 'Server racks', 'Precision AC', 'DC']],
      ['LSI Lab', 'lab', ['VLSI lab']],
      ['CCNSB Science Lab', 'lab', ['CCNSB', 'Fume hood lab', 'Wet lab']],
    ],
  },
  {
    id: 'a1ups',
    rect: [-76.5, -33, -64.5, -25.5],
    floors: [
      ['UPS and MUX Room', 'plant', ['UPS room', 'UPS', 'MUX room', 'Battery bank']],
      ['LSI Lab annex', 'lab', ['LSI']],
      ['CCNSB Dry Lab', 'lab', ['Dry lab', 'CCNSB']],
    ],
  },
  { id: 'a2', rect: [-64.5, -41, -48, -29], floors: same(STAIR('A2')) },
  {
    id: 'a3',
    rect: [-48, -41, -6.5, -29],
    floors: [
      [
        'C-STAR Incubator',
        'office-open',
        ['C-STAR', 'CSTAR', 'Incubator', 'Conference room', 'Pantry', 'Lunch area'],
      ],
      [
        'SPCRC Signal Processing Centre',
        'lab',
        ['SPCRC', 'Signal processing', 'Meeting room', 'Record room'],
      ],
      ['CCNSB Labs', 'lab', ['CCNSB', 'Computational natural sciences', 'Bioinformatics']],
    ],
  },
  {
    id: 'a4',
    rect: [-6.5, -41, 8.5, -29],
    floors: same(['A4 core', 'toilet-core', ['Lift', 'Toilets', 'AHU room']]),
  },
  {
    id: 'a5',
    rect: [8.5, -41, 49, -29],
    floors: [
      ['IIIT Library', 'library', ['Library', 'Reading hall', 'IIIT library', 'Main library']],
      ['IIIT Library upper level', 'library', ['Library', 'IIIT library', 'Reading room']],
      ['CVEST and CSG Labs', 'lab', ['CVEST', 'VLSI', 'Embedded systems', 'CSG']],
    ],
  },
  { id: 'a6', rect: [49, -41, 64, -29], floors: same(STAIR('A6')) },
  {
    id: 'a7',
    rect: [64, -41, 78, -28],
    floors: [
      ["Students' Work Space A7", 'office-open', ['Student work space', 'Study area']],
      ['Classroom CR-1', 'classroom', ['CR-1', 'CR1', 'Classroom']],
      ['CEH Exact Humanities', 'office', ['CEH', 'Exact humanities']],
    ],
  },
  { id: 'acorr', rect: [-64.5, -29, 64, -24], floors: same(CORR('A row corridor')) },
  // West and east links (y -24 to 16.5).
  {
    id: 'b2',
    rect: [-64.5, -24, -48, -4],
    floors: [
      [
        'Structural Engineering Research Lab',
        'lab',
        ['Structural lab', 'M.Tech CASE lab', 'Server staff room'],
      ],
      [
        'Power Research Centre and Building Science Lab',
        'lab',
        ['Power research', 'Building science lab', 'PRC'],
      ],
      ['CCNSB Faculty Labs', 'lab', ['CCNSB']],
    ],
  },
  {
    id: 'bw',
    rect: [-64.5, -4, -48, 16.5],
    floors: same(['West stair and AHU', 'plant', ['AHU room', 'Stair']]),
  },
  {
    id: 'b6',
    rect: [49, -24, 64, 5],
    floors: [
      ["Students' Work Space B6", 'office-open', ['Student work space', 'Discussion area']],
      [
        'Teaching Labs 1 and 2',
        'classroom',
        ['Teaching lab 1', 'Teaching lab 2', 'Teaching lab', 'Computer lab'],
      ],
      ['Robotics Lab B6', 'lab', ['Robotics lab', 'Robotics']],
    ],
  },
  { id: 'be', rect: [49, 5, 64, 16.5], floors: same(['East stair and AHU', 'plant', ['AHU room', 'Stair']]) },
  // A side spine between the A courts.
  { id: 'aspine', rect: [-6.5, -24, 8.5, -13.5], floors: same(CORR('A spine link')) },
  // Middle band: pavilions on the cross corridors (y -13.5 to -2) and the central spine corridor.
  {
    id: 'b3',
    rect: [-48, -13.5, -18, -2],
    floors: [
      [
        'TTO and Makers Lab',
        'lab',
        ['Makers lab', 'Prayas Shala', 'Technology Transfer Office', 'TTO', 'Outreach'],
      ],
      ['I-HUB', 'office', ['iHub', 'IHub']],
      ['Robotics Lab B3', 'lab', ['Robotics lab', 'Robotics']],
    ],
  },
  { id: 'mw', rect: [-18, -13.5, -6.5, -2], floors: same(CORR('West cross corridor')) },
  {
    id: 'b4',
    rect: [-6.5, -13.5, 3.5, -2],
    floors: [
      ['Anusaaraka Lab', 'lab', ['Anasaraka lab', 'Language lab']],
      ['Applied Lab', 'lab', ['Applied lab']],
      ['B4 Lab', 'lab', []],
    ],
  },
  { id: 'me', rect: [3.5, -13.5, 13, -2], floors: same(CORR('East cross corridor')) },
  {
    id: 'b5',
    rect: [13, -13.5, 49, -2],
    floors: [
      ['Cognitive Science Lab', 'lab', ['Cog Sci lab', 'Biometrics lab', 'Security and identity lab']],
      ['Virtual Labs', 'lab', ['Virtual lab', 'Conference room']],
      ['Robotics Lab B5', 'lab', ['Robotics lab', 'Robotics']],
    ],
  },
  { id: 'spine', rect: [-48, -2, 49, 2.5], floors: same(CORR('Central spine corridor')) },
  { id: 'cspine', rect: [-0.5, 2.5, 2.5, 16.5], floors: same(CORR('C spine corridor')) },
  // C row (NE facing): corridor y 16.5 to 21, rooms y 21 to 38; end wings full depth.
  {
    id: 'c1a',
    rect: [-82, 16.5, -64.5, 30],
    floors: [
      [
        'EERC Earthquake Engineering Lab',
        'lab-heavy',
        ['EERC', 'Shake table', 'Material testing lab', 'UTM'],
      ],
      ['Seminar Hall II', 'assembly', ['Seminar hall 2', 'Seminar hall', 'Seminar hall II']],
      ['Auditorium', 'assembly', ['Auditorium', 'Stepped seating']],
    ],
  },
  {
    id: 'c1b',
    rect: [-82, 30, -64.5, 38],
    floors: [
      ['EERC Testing Bay', 'lab-heavy', ['EERC', 'Compression testing']],
      ['Seminar Hall II foyer', 'lobby', ['Foyer']],
      ['ISWOC Lab', 'lab', ['ISWOC']],
    ],
  },
  { id: 'c2', rect: [-64.5, 21, -48, 38], floors: same(STAIR('C2')) },
  {
    id: 'c3',
    rect: [-48, 21, -6.5, 38],
    floors: [
      [
        'CIE Startup Cabins',
        'office-open',
        ['CIE', 'Centre for Innovation and Entrepreneurship', 'Startup cabins'],
      ],
      [
        'Centre for IT in Building Science',
        'lab',
        ['CBS', 'CBS lab', 'Building science', 'Advanced Lighting Lab', 'Lighting lab'],
      ],
      ['CEH Labs and Audio Recording Studio', 'lab', ['Audio recording studio', 'Recording studio', 'CEH']],
    ],
  },
  {
    id: 'c4',
    rect: [-6.5, 21, 8.5, 38],
    floors: [
      [
        'Main Entrance and Stair Hall',
        'lobby',
        ['Main entrance', 'Entrance', 'Security', 'Grand staircase', 'Reception'],
      ],
      ['C4 Offices', 'office', ['Office']],
      ['CIE Classrooms', 'classroom', ['CIE', 'Classroom']],
    ],
  },
  {
    id: 'c5',
    rect: [8.5, 21, 49, 38],
    floors: [
      ['CIE Open Studio', 'office-open', ['CIE', 'Video conference', 'Pantry', 'Open studio']],
      ['CVIT Applied Lab and PhD Labs', 'lab', ['CVIT', 'PhD lab', 'MS lab', 'CIE']],
      ['CIE Classrooms and Conference Rooms', 'classroom', ['Conference room', 'Plotter room', 'CIE']],
    ],
  },
  { id: 'c6', rect: [49, 21, 64, 38], floors: same(STAIR('C6')) },
  {
    id: 'c7',
    rect: [64, 16.5, 83, 38],
    floors: [
      ['SBI Bank and ATM', 'bank', ['SBI', 'SBI bank', 'Bank', 'ATM', 'State Bank of India']],
      ['Teaching Lab C7', 'classroom', ['Teaching lab', '90 seat lab']],
      ['Seminar Hall I', 'assembly', ['Seminar hall 1', 'Seminar hall', 'Seminar hall I']],
    ],
  },
  { id: 'ccorr', rect: [-64.5, 16.5, 64, 21], floors: same(CORR('C row corridor')) },
];

const gb1Window: WindowRule = { kind: 'ratio', wwrPm: 140, sill: 900 };
const NO_WINDOWS = new Set(['data-centre', 'plant', 'stair', 'toilet-core', 'circulation']);

function gb1(): { doc: BuildingDoc; notes: unknown } {
  const vindhya = ctx('osm_r2829427');
  const [ox, oy] = centroid(vindhya.footprint);
  const storeys: Storey[] = [];
  // Cellar (partial, under C4 and C5; sloping site: the NE face is above ground with windows).
  const cellar = weldRooms(
    [
      {
        ...R('rm_b1_c4', 'Estate Office (cellar)', 'office', -6.5, 21, 8.5, 38),
        aliases: ['Estate office', 'Engineers office', 'Electrical store'],
      },
      {
        ...R('rm_b1_c5w', 'Civil Engineering Labs (cellar)', 'lab-heavy', 8.5, 21, 28, 38),
        aliases: ['Transportation lab', 'Soil mechanics lab', 'Survey lab', 'Building materials lab'],
      },
      {
        ...R('rm_b1_c5e', 'Workshop and Hydraulics Lab (cellar)', 'lab-heavy', 28, 21, 49, 38),
        aliases: ['Workshop', 'Hydraulics lab', 'Civil and mechanical workshop'],
      },
    ],
    {
      ceiling: m(3.5),
      floorBoundary: 'ground',
      ceilingBoundary: 'adjacent',
      exterior: { kind: 'ground' },
      exteriorRules: () => ({ window: { kind: 'none' }, shading: [] }),
    },
  ).map((r) => {
    r.floor.outer.forEach((a, i) => {
      const b = r.floor.outer[(i + 1) % r.floor.outer.length] as PointMm;
      const seg = r.segments[i];
      // The NE edge (y = 38 m) is the exposed face of the sloping site.
      if (seg && a[1] === m(38) && b[1] === m(38) && seg.boundary.kind === 'ground') {
        seg.boundary = { kind: 'outdoors' };
        seg.window = { kind: 'ratio', wwrPm: 100, sill: 1500 };
      }
    });
    return r;
  });
  storeys.push(
    storey('st_b1', 'Cellar', -F2F_GB1, F2F_GB1, cellar, {
      belowGrade: true,
      aliases: ['Basement', 'Lower ground'],
    }),
  );
  const floorNames = ['First floor', 'Second floor', 'Third floor'];
  for (let f = 0; f < 3; f++) {
    const specs: RoomSpec[] = GB1_WINGS.map((w) => {
      const [name, use, aliases] = w.floors[f] as Use;
      const s: RoomSpec = {
        ...R(`rm_${f + 1}_${w.id}`, name, use, ...w.rect),
        ...(aliases.length ? { aliases } : {}),
      };
      if (f === 0 && (w.id === 'c4' || w.id === 'c5')) s.floorBoundary = 'adjacent';
      return s;
    });
    const rooms = weldRooms(specs, {
      ceiling: m(3.45),
      floorBoundary: f === 0 ? 'ground' : 'adjacent',
      ceilingBoundary: f === 2 ? 'roof' : 'adjacent',
      exterior: { kind: 'outdoors' },
      exteriorRules: (room) => ({
        window: NO_WINDOWS.has(room.spaceTypeId ?? '') ? { kind: 'none' } : gb1Window,
        shading: [],
      }),
    });
    storeys.push(
      storey(
        `st_${f + 1}`,
        floorNames[f] as string,
        f * F2F_GB1,
        F2F_GB1,
        rooms,
        f === 0 ? { aliases: ['Ground floor', 'Entry level', 'Entrance floor', 'Floor 1', 'Level 1'] } : {},
      ),
    );
  }
  const doc: BuildingDoc = {
    schema: 'ibasho.building/1',
    id: 'gb1',
    version: 2,
    placeId: 'pl_iiit',
    name: 'Vindhya Bhavan',
    typeId: 'education',
    origin: { x: ox, y: oy },
    rotationMdeg: 41_700,
    storeys,
    roofs: [{ id: 'rf_gb1', storeyId: 'st_3', shape: 'flat', pvZones: [], skylights: [] }],
    shades: [],
    zones: [],
    systems: [
      { systemId: 'chiller-water-cooled', fuel: 'electricity' },
      { systemId: 'precision-ac-data-centre', fuel: 'electricity' },
    ],
  };
  const notes = {
    id: 'gb1',
    title: 'Vindhya Bhavan, IIIT Hyderabad',
    sources: [
      {
        id: 'iiit-vindhya-2022',
        title: 'IIIT Hyderabad estate office, Vindhya Bhavan floor plans (Dec 2022)',
        url: 'https://intranet.iiit.ac.in/offices/static/files/Vindhya_bhavan.pdf',
      },
      {
        id: 'osm-r2829427',
        title: 'OpenStreetMap relation 2829427 (ODbL)',
        url: 'https://www.openstreetmap.org/relation/2829427',
      },
      { id: 'rb', title: 'Ibasho brief RB 3', url: 'docs/research/v3/reference-buildings.md' },
    ],
    status: {
      layout:
        'measured: rectangles fitted to the OSM outline and its four courts (footprint IoU tested at 0.8 or more); wing rooms per RB 3.2',
      names: 'read: room functions from the plan sheets (RB 3.2), functions only, no personal names',
      floorToFloor: 'assumed 3.9 m',
      origin: 'OSM outer ring centroid in the city-hyderabad frame; rotation 41.7 degrees',
      cellar: 'partial under C4 and C5; the NE face is exposed (sloping site) with ventilators',
    },
    unknowns: [
      'window sizes and glazing (WWR 14% assumed from tag counts W1, W2, V2)',
      'wall and roof build-ups (RCC frame, masonry infill likely)',
      'external shading (not drawn)',
      'permit date (built before 2014 TSECBC; edition unknown)',
      'roof PV',
      'lift and stair cores are modelled as rooms, not cores',
    ],
    specialLoads: { dataCentreUpsKva: 120, precisionAcUnits: 3 },
  };
  return { doc, notes };
}

// ---------------------------------------------------------------------------------------------
// GB2 Himalaya (RB 4), coarse. Frame and rotation as GB1; origin at the OSM Himalaya Academic
// Block centroid. Bodh (lecture halls, 3 storeys) and Block D (6 storeys) sit on their OSM ways
// (Academic Block 187896823 and D Block 211078709). Shodh and Vrithi are not mapped in OSM: they
// are placed south of the row on open ground (assumed positions, tested clear of every mapped
// building, including Kohli Research Block to the east).

function gb2(): { doc: BuildingDoc; notes: unknown } {
  const ab = ctx('osm_w187896823');
  const [ox, oy] = centroid(ab.footprint);
  const F = m(3.85);
  const blocks: {
    id: string;
    name: string;
    rect: [number, number, number, number];
    storeys: number;
    basement: boolean;
    use: string;
    coreUse?: string;
    court?: [number, number];
    aliases: string[];
  }[] = [
    {
      id: 'bd',
      name: 'Block D',
      rect: [-61, -21, -30, 21],
      storeys: 6,
      basement: false,
      use: 'office-open',
      aliases: ['D Block', 'Himalaya D Block', 'Incubator block'],
    },
    {
      id: 'bo',
      name: 'Bodh',
      rect: [-23, -21, 23, 21],
      storeys: 3,
      basement: false,
      use: 'classroom',
      coreUse: 'assembly',
      aliases: ['Bodh block', 'Lecture halls', 'Lecture hall', 'LH'],
    },
    {
      id: 'sh',
      name: 'Shodh',
      rect: [-22, -76, 22, -32],
      storeys: 4,
      basement: true,
      use: 'office',
      court: [13.6, 13.3],
      aliases: ['Shodh block', 'Research block', 'Faculty block'],
    },
    {
      id: 'vr',
      name: 'Vrithi',
      rect: [-55, -55, -36, -32],
      storeys: 3,
      basement: true,
      use: 'office',
      aliases: ['Vrithi block', 'Administration', 'Admin block', 'Registrar'],
    },
  ];
  const storeys: Storey[] = [];
  for (let level = -1; level < 6; level++) {
    const specs: RoomSpec[] = [];
    for (const b of blocks) {
      if (level === -1 ? !b.basement : level >= b.storeys) continue;
      const tag = level === -1 ? 'b1' : `${level + 1}`;
      const use = level === -1 ? (b.id === 'sh' ? 'office' : 'office') : b.use;
      const [x0, y0, x1, y1] = b.rect;
      if (b.court) {
        const [cw, cd] = b.court;
        const xb = x0 + (x1 - x0 - cw) / 2;
        const xc = xb + cw;
        const yb = y0 + (y1 - y0 - cd) / 2;
        const yc = yb + cd;
        const wing = (k: string, label: string, r: [number, number, number, number]) => ({
          ...R(`rm_${tag}_${b.id}_${k}`, `${b.name} ${label}`, use, ...r),
          aliases: [b.name, ...b.aliases],
        });
        specs.push(
          wing('s', 'south wing', [x0, y0, x1, yb]),
          wing('n', 'north wing', [x0, yc, x1, y1]),
          wing('w', 'west wing', [x0, yb, xb, yc]),
          wing('e', 'east wing', [xc, yb, x1, yc]),
        );
      } else {
        for (const z of autoZone(rectRing(m(x0), m(y0), m(x1), m(y1)))) {
          specs.push({
            id: `rm_${tag}_${b.id}_${z.id.replace(/^z_/, '')}`,
            name: `${b.name} ${z.kind === 'core' ? (b.coreUse === 'assembly' ? 'tiered halls' : 'core zone') : `perimeter ${z.edge ?? 0}`}`,
            outer: z.polygon.outer,
            spaceTypeId: z.kind === 'core' && b.coreUse && level >= 0 ? b.coreUse : use,
            aliases: [b.name, ...b.aliases],
          });
        }
      }
    }
    const top = new Set(blocks.filter((b) => b.storeys === level + 1).map((b) => b.id));
    const rooms = weldRooms(specs, {
      ceiling: m(3.3),
      floorBoundary: level <= 0 ? 'ground' : 'adjacent',
      ceilingBoundary: 'adjacent',
      exterior: level === -1 ? { kind: 'ground' } : { kind: 'outdoors' },
      exteriorRules: exteriorRules(
        level === -1 ? { kind: 'none' } : { kind: 'ratio', wwrPm: 200, sill: 900 },
      ),
    }).map((r) => {
      const block = r.id.split('_')[2] as string;
      if (top.has(block)) r.ceilingBoundary = 'roof';
      if (level === 0 && blocks.find((b) => b.id === block)?.basement) r.floorBoundary = 'adjacent';
      return r;
    });
    storeys.push(
      storey(
        level === -1 ? 'st_b1' : `st_${level + 1}`,
        level === -1 ? 'Basement' : `Floor ${level + 1}`,
        level * F,
        F,
        rooms,
        level === -1
          ? { belowGrade: true, aliases: ['Cellar'] }
          : level === 0
            ? { aliases: ['Ground floor', 'Entry level'] }
            : {},
      ),
    );
  }
  const doc: BuildingDoc = {
    schema: 'ibasho.building/1',
    id: 'gb2',
    version: 2,
    placeId: 'pl_iiit',
    name: 'Himalaya',
    typeId: 'education',
    origin: { x: ox, y: oy },
    rotationMdeg: 41_700,
    storeys,
    roofs: [],
    shades: [],
    zones: [],
    systems: [
      {
        systemId: 'chiller-water-cooled',
        fuel: 'electricity',
        sizeKW: {
          state: 'known',
          value: 1407,
          source: { kind: 'document', doc: 'survey', ref: 'himalaya-plant-400TR' },
        },
      },
    ],
  };
  const notes = {
    id: 'gb2',
    title: 'Himalaya Building, IIIT Hyderabad',
    sources: [
      {
        id: 'iiit-himalaya-2022',
        title: 'IIIT Hyderabad estate office, Himalaya Building floor plans (Dec 2022)',
        url: 'https://intranet.iiit.ac.in/offices/static/files/Himalaya_Building.pdf',
      },
      {
        id: 'osm-w187896823',
        title: 'OpenStreetMap ways 187896823 (Academic Block) and 211078709 (D Block), ODbL',
        url: 'https://www.openstreetmap.org/way/187896823',
      },
    ],
    status: {
      layout:
        'coarse: Bodh and Block D on their OSM ways; Shodh and Vrithi at assumed positions (not mapped); bridges omitted',
      uses: 'coarse: Bodh perimeter classrooms with tiered halls in the core; Shodh office (holds labs, an auditorium and dining in reality); basements office',
      plant: 'read: 400 TR chillers (1 x 100 + 2 x 150), a plausibility gate, not an input',
    },
    unknowns: [
      'positions of Shodh and Vrithi',
      'window sizes (WWR 20% assumed)',
      'wall and roof build-ups',
      'external shading',
      'the +118.50 level label (ignored)',
    ],
  };
  return { doc, notes };
}

// ---------------------------------------------------------------------------------------------
// GB3 HITEC City office (RB 6, modelled on a public listing): 59 x 37 m plate, 15 storeys,
// long facades ESE (113) and WNW (293), glass curtain wall, 3 parking basements.

function gb3(): { doc: BuildingDoc; notes: unknown } {
  const zone = (tag: string, use: string) =>
    autoZone(rectRing(m(-29.5), m(-18.5), m(29.5), m(18.5))).map((z) => ({
      id: `rm_${tag}_${z.id.replace(/^z_/, '')}`,
      name: z.kind === 'core' ? 'Core zone' : `Perimeter ${z.edge ?? 0}`,
      outer: z.polygon.outer,
      spaceTypeId: z.kind === 'core' && use === 'office-open' ? 'office-open' : use,
    }));
  const cw: WindowRule = { kind: 'ratio', wwrPm: 650, sill: 0 };
  const F = m(4);
  const weld = (
    specs: RoomSpec[],
    fb: Room2D['floorBoundary'],
    cb: Room2D['ceilingBoundary'],
    ext: 'outdoors' | 'ground',
    win: WindowRule,
  ) =>
    weldRooms(specs, {
      ceiling: m(2.9),
      floorBoundary: fb,
      ceilingBoundary: cb,
      exterior: { kind: ext },
      exteriorRules: exteriorRules(win),
    });
  const storeys: Storey[] = [
    storey(
      'st_b',
      'Basements (3)',
      -3 * m(3.3),
      m(3.3),
      weld(zone('b', 'parking'), 'ground', 'adjacent', 'ground', { kind: 'none' }),
      { belowGrade: true, multiplier: 3 },
    ),
    storey('st_g', 'Ground', 0, m(5), weld(zone('g', 'lobby'), 'adjacent', 'adjacent', 'outdoors', cw)),
    storey(
      'st_typ',
      'Floors 1 to 13',
      m(5),
      F,
      weld(zone('typ', 'office-open'), 'adjacent', 'adjacent', 'outdoors', cw),
      { multiplier: 13 },
    ),
    storey(
      'st_top',
      'Floor 14',
      m(5) + 13 * F,
      F,
      weld(zone('top', 'office-open'), 'adjacent', 'roof', 'outdoors', cw),
    ),
  ];
  const doc: BuildingDoc = {
    schema: 'ibasho.building/1',
    id: 'gb3',
    version: 1,
    placeId: 'pl_hitec',
    name: 'HITEC City office',
    typeId: 'office',
    tenure: {
      owner: 'landlord',
      pays: { electricity: 'tenant', water: 'landlord', diesel: 'landlord' },
      decides: { envelope: 'landlord', systems: 'landlord', roof: 'landlord', interior: 'tenant' },
    },
    origin: { x: 0, y: 0 },
    rotationMdeg: 113_000,
    storeys,
    roofs: [{ id: 'rf_gb3', storeyId: 'st_top', shape: 'flat', pvZones: [], skylights: [] }],
    shades: [],
    zones: [],
    systems: [
      { systemId: 'chiller-water-cooled', fuel: 'electricity' },
      { systemId: 'diesel-genset', fuel: 'electricity' },
    ],
  };
  const notes = {
    id: 'gb3',
    title: 'HITEC City office (modelled on a public listing)',
    sources: [
      {
        id: 'osm-w776432080',
        title: 'OpenStreetMap way 776432080 (ODbL)',
        url: 'https://www.openstreetmap.org/way/776432080',
      },
      { id: 'rb', title: 'Ibasho brief RB 6', url: 'docs/research/v3/reference-buildings.md' },
    ],
    status: {
      plate: 'measured: 59 x 37 m oriented box',
      storeys: 'read: 15 (OSM, listing)',
      wwr: 'assumed 65% curtain wall',
    },
    unknowns: [
      'glass U, SHGC, VLT',
      'floor to floor (4.0 m assumed)',
      'exact location (the sample place stands apart from the city pack)',
    ],
  };
  return { doc, notes };
}

// ---------------------------------------------------------------------------------------------
// GB4 Gachibowli apartment block (SPEC 16): ground plus four floors, four flats a floor on a
// central stair, GH2 is flat 4C (top floor). Rental tenure on an association-owned block.

function gb4(): { doc: BuildingDoc; notes: unknown } {
  const flat = (tag: string, k: number, x0: number): RoomSpec[] => [
    R(`rm_${tag}_f${k}_living`, `Flat ${k} living and kitchen`, 'living', x0, -6, x0 + 7, 0),
    R(`rm_${tag}_f${k}_bed1`, `Flat ${k} bedroom 1`, 'bedroom', x0, 0, x0 + 3.5, 6),
    R(`rm_${tag}_f${k}_bed2`, `Flat ${k} bedroom 2`, 'bedroom', x0 + 3.5, 0, x0 + 7, 6),
  ];
  const floor = (tag: string) => [
    ...flat(tag, 1, -17),
    ...flat(tag, 2, -10),
    R(`rm_${tag}_stair`, 'Stair and landing', 'stair', -3, -6, 3, 6),
    ...flat(tag, 3, 3),
    ...flat(tag, 4, 10),
  ];
  const F = m(3);
  const win: WindowRule = { kind: 'ratio', wwrPm: 180, sill: 900 };
  const shade: ShadeRule[] = [{ kind: 'overhang', depth: 600, aboveHead: 150, extension: 0 }]; // chajja, typical
  const mk = (tag: string, fb: Room2D['floorBoundary'], cb: Room2D['ceilingBoundary']) =>
    weldRooms(floor(tag), {
      ceiling: m(2.75),
      floorBoundary: fb,
      ceilingBoundary: cb,
      exterior: { kind: 'outdoors' },
      exteriorRules: exteriorRules(win, shade),
    });
  const storeys = [
    storey('st_g', 'Ground', 0, F, mk('g', 'ground', 'adjacent')),
    storey('st_mid', 'Floors 1 to 3', F, F, mk('mid', 'adjacent', 'adjacent'), { multiplier: 3 }),
    storey('st_top', 'Floor 4 (GH2 is flat 4C)', 4 * F, F, mk('top', 'adjacent', 'roof')),
  ];
  // A spot in the pack frame clear of mapped buildings (checked against the tiles below).
  const origin = { x: -520_000, y: -760_000 };
  const doc: BuildingDoc = {
    schema: 'ibasho.building/1',
    id: 'gb4',
    version: 1,
    placeId: 'pl_gachibowli',
    name: 'Gachibowli apartment block',
    typeId: 'apartments',
    tenure: {
      owner: 'association',
      pays: { electricity: 'tenant', water: 'association' },
      decides: { envelope: 'association', systems: 'owner', roof: 'association', interior: 'owner' },
    },
    origin,
    rotationMdeg: 0,
    storeys,
    roofs: [{ id: 'rf_gb4', storeyId: 'st_top', shape: 'flat', pvZones: [], skylights: [] }],
    shades: [],
    zones: [],
    systems: [{ systemId: 'split-ac-3star', fuel: 'electricity' }],
  };
  const notes = {
    id: 'gb4',
    title: 'Gachibowli apartment block (typical, not a real address)',
    sources: [{ id: 'spec16', title: 'SPEC 16 golden buildings', url: 'docs/SPEC.md' }],
    status: { layout: 'assumed: typical G+4 block, 4 two-bedroom flats a floor' },
    gh2: { storeyId: 'st_top', roomIds: ['rm_top_f3_living', 'rm_top_f3_bed1', 'rm_top_f3_bed2'] },
    unknowns: ['construction', 'glazing', 'AC count per flat'],
  };
  return { doc, notes };
}

// ---------------------------------------------------------------------------------------------
// GH1 (SPEC 2): 1905 London mid-terrace, 2 storeys, 42 m² footprint (5.0 x 8.4 m), party walls
// adiabatic, front facing south-west (assumed).

function gh1(): { doc: BuildingDoc; notes: unknown } {
  const F = m(2.9);
  const win: WindowRule = { kind: 'ratio', wwrPm: 250, sill: 800 };
  const mk = (
    tag: string,
    names: [string, string],
    uses: [string, string],
    fb: Room2D['floorBoundary'],
    cb: Room2D['ceilingBoundary'],
  ) => {
    const rooms = weldRooms(
      [
        R(`rm_${tag}_front`, names[0], uses[0], 0, 0, 5, 4.4),
        R(`rm_${tag}_rear`, names[1], uses[1], 0, 4.4, 5, 8.4),
      ],
      {
        ceiling: m(2.6),
        floorBoundary: fb,
        ceilingBoundary: cb,
        exterior: { kind: 'outdoors' },
        exteriorRules: exteriorRules(win),
      },
    );
    // Party walls on the east and west edges.
    for (const r of rooms) {
      r.floor.outer.forEach((a, i) => {
        const b = r.floor.outer[(i + 1) % r.floor.outer.length] as PointMm;
        const seg = r.segments[i];
        if (seg && a[0] === b[0] && seg.boundary.kind === 'outdoors') {
          seg.boundary = { kind: 'adiabatic' };
          seg.window = { kind: 'none' };
        }
      });
    }
    return rooms;
  };
  const doc: BuildingDoc = {
    schema: 'ibasho.building/1',
    id: 'gh1',
    version: 1,
    placeId: 'pl_london',
    name: '1905 London terrace',
    typeId: 'single-family',
    permitDate: '1905-01-01',
    origin: { x: 0, y: 0 },
    rotationMdeg: 45_000,
    storeys: [
      storey(
        'st_g',
        'Ground',
        0,
        F,
        mk('g', ['Front room', 'Kitchen'], ['living', 'kitchen'], 'ground', 'adjacent'),
      ),
      storey(
        'st_1',
        'First',
        F,
        F,
        mk('1', ['Front bedroom', 'Rear bedroom'], ['bedroom', 'bedroom'], 'adjacent', 'roof'),
      ),
    ],
    roofs: [{ id: 'rf_gh1', storeyId: 'st_1', shape: 'gable', pvZones: [], skylights: [] }],
    shades: [],
    zones: [],
    systems: [{ systemId: 'gas-combi-condensing', fuel: 'gas' }],
  };
  const notes = {
    id: 'gh1',
    title: 'GH1 1905 London terrace',
    sources: [{ id: 'gh1-twin', title: 'GH1 survey twin', url: 'packages/fixtures/src/homes/gh1.twin.json' }],
    status: { footprint: 'estimated 42 m² (twin)', orientation: 'assumed: front faces south-west' },
    unknowns: ['exact orientation', 'roof pitch'],
  };
  return { doc, notes };
}

// ---------------------------------------------------------------------------------------------

const places: Place[] = [
  {
    id: 'pl_iiit',
    name: 'IIIT Hyderabad campus',
    lat: 17.4453,
    lon: 78.349,
    elevationM: 545,
    trueNorthMdeg: 0,
    climatePackId: 'climate.hyderabad',
    codePackIds: ['codes-in'],
    moneyPackIds: ['money-in'],
    cityPackId: 'city-hyderabad',
    buildingIds: ['gb1', 'gb2'],
    sample: true,
  },
  {
    id: 'pl_hitec',
    name: 'HITEC City office',
    lat: 17.458,
    lon: 78.3683,
    elevationM: 560,
    trueNorthMdeg: 0,
    climatePackId: 'climate.hyderabad',
    codePackIds: ['codes-in'],
    moneyPackIds: ['money-in'],
    buildingIds: ['gb3'],
    sample: true,
  },
  {
    id: 'pl_gachibowli',
    name: 'Gachibowli apartments',
    lat: 17.4453,
    lon: 78.349,
    elevationM: 545,
    trueNorthMdeg: 0,
    climatePackId: 'climate.hyderabad',
    codePackIds: ['codes-in'],
    moneyPackIds: ['money-in'],
    cityPackId: 'city-hyderabad',
    buildingIds: ['gb4'],
    sample: true,
  },
  {
    id: 'pl_london',
    name: 'London terrace',
    lat: 51.548,
    lon: -0.105,
    elevationM: 30,
    trueNorthMdeg: 0,
    climatePackId: 'climate.london',
    codePackIds: [],
    moneyPackIds: ['money-uk'],
    cityPackId: 'city-london',
    buildingIds: ['gh1'],
    sample: true,
  },
];

for (const make of [gb1, gb2, gb3, gb4, gh1]) {
  const { doc, notes } = make();
  write(`${doc.id}.building.json`, doc);
  write(`${doc.id}.notes.json`, notes);
}
write('places.json', places);
console.log('wrote gb1, gb2, gb3, gb4, gh1 and places.json');
