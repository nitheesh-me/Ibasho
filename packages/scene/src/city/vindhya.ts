/**
 * PLACEHOLDER hero building: a Vindhya Bhavan like courtyard ring as a `BuildingDoc`, used by the
 * city stage until WP-17 ships the traced fixture in `packages/fixtures/src/buildings`.
 * Owner: WP-07. Source: RB 3 (massing, wings, storeys, functions by wing); dimensions rounded.
 *
 * Plan frame: x along the long axis (to bearing 310), y across it (to bearing 220, so the A row
 * faces south west and the C row north east). Rows: C (y 0 to 13), a 10 m court, the B row of
 * pavilions (y 23 to 36), a 14 m court, A (y 50 to 63). The B2 and B6 links and the B4 spine
 * cross the courts. Room functions only, never names from the drawings.
 */
import type { BuildingDoc, PointMm, Room2D, Segment, Storey } from '@ibasho/core';
import { type EN, latLonToEN } from './frame.ts';

export const IIIT_ORIGIN = { lat: 17.4453, lon: 78.349 } as const;
/** Vindhya centre (RB 3, OSM relation 2829427). */
export const VINDHYA_CENTRE = { lat: 17.4458, lon: 78.3498 } as const;
/** Plan +y points to this bearing, so plan +x points to 310 (RB 3.3 `north_rotation_deg: 310`). */
export const VINDHYA_ROTATION_MDEG = 220_000;
export const VINDHYA_ID = 'bld_vindhya_standin';

const FLOOR_TO_FLOOR = 3900;
const LENGTH = 143_000;
const DEPTH = 63_000;

type Use = 'lab' | 'office' | 'classroom' | 'library' | 'data-centre' | 'circulation' | 'assembly' | 'retail';

interface WingDef {
  id: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Use on L1, L2, L3. */
  uses: [Use, Use, Use];
  /** Split along x (rows) or y (links and spine). */
  along: 'x' | 'y';
  chamfer?: 'x0y0' | 'x1y0' | 'x0y1' | 'x1y1';
}

const M = 1000;
const ROW_C: [number, number] = [0, 13 * M];
const ROW_B: [number, number] = [23 * M, 36 * M];
const ROW_A: [number, number] = [50 * M, 63 * M];
const COLS: [number, number][] = [
  [0, 14 * M],
  [14 * M, 20 * M],
  [20 * M, 62 * M],
  [62 * M, 76 * M],
  [76 * M, 122 * M],
  [122 * M, 128 * M],
  [128 * M, LENGTH],
];

const A_USES: [Use, Use, Use][] = [
  ['data-centre', 'lab', 'lab'],
  ['circulation', 'circulation', 'circulation'],
  ['office', 'lab', 'lab'],
  ['circulation', 'circulation', 'circulation'],
  ['library', 'library', 'lab'],
  ['circulation', 'circulation', 'circulation'],
  ['office', 'classroom', 'office'],
];
const C_USES: [Use, Use, Use][] = [
  ['lab', 'assembly', 'assembly'],
  ['circulation', 'circulation', 'circulation'],
  ['office', 'lab', 'office'],
  ['circulation', 'circulation', 'classroom'],
  ['office', 'lab', 'classroom'],
  ['circulation', 'circulation', 'circulation'],
  ['retail', 'classroom', 'assembly'],
];

function wings(): WingDef[] {
  const out: WingDef[] = [];
  COLS.forEach(([x0, x1], i) => {
    const n = i + 1;
    const chA = n === 1 ? 'x0y1' : n === 7 ? 'x1y1' : undefined;
    const chC = n === 1 ? 'x0y0' : n === 7 ? 'x1y0' : undefined;
    out.push({
      id: `A${n}`,
      x0,
      x1,
      y0: ROW_A[0],
      y1: ROW_A[1],
      uses: A_USES[i]!,
      along: 'x',
      ...(chA ? { chamfer: chA } : {}),
    });
    out.push({
      id: `C${n}`,
      x0,
      x1,
      y0: ROW_C[0],
      y1: ROW_C[1],
      uses: C_USES[i]!,
      along: 'x',
      ...(chC ? { chamfer: chC } : {}),
    });
  });
  // Links and spine cross both courts; pavilions fill the B row between them.
  const across = (id: string, x0: number, x1: number, uses: [Use, Use, Use]): WingDef => ({
    id,
    x0,
    x1,
    y0: ROW_C[1],
    y1: ROW_A[0],
    uses,
    along: 'y',
  });
  out.push(across('B2', 14 * M, 27 * M, ['lab', 'lab', 'lab']));
  out.push(across('B4', 62 * M, 76 * M, ['lab', 'lab', 'lab']));
  out.push(across('B6', 115 * M, 128 * M, ['office', 'classroom', 'lab']));
  out.push({
    id: 'B3',
    x0: 27 * M,
    x1: 62 * M,
    y0: ROW_B[0],
    y1: ROW_B[1],
    uses: ['office', 'office', 'lab'],
    along: 'x',
  });
  out.push({
    id: 'B5',
    x0: 76 * M,
    x1: 115 * M,
    y0: ROW_B[0],
    y1: ROW_B[1],
    uses: ['lab', 'office', 'lab'],
    along: 'x',
  });
  return out;
}

const CHAMFER = 3 * M;

function rectRing(x0: number, y0: number, x1: number, y1: number, chamfer?: WingDef['chamfer']): PointMm[] {
  const pts: PointMm[] = [];
  const corner = (key: WingDef['chamfer'], x: number, y: number, a: PointMm, b: PointMm): void => {
    if (chamfer === key) pts.push(a, b);
    else pts.push([x, y]);
  };
  corner('x0y0', x0, y0, [x0, y0 + CHAMFER], [x0 + CHAMFER, y0]);
  corner('x1y0', x1, y0, [x1 - CHAMFER, y0], [x1, y0 + CHAMFER]);
  corner('x1y1', x1, y1, [x1, y1 - CHAMFER], [x1 - CHAMFER, y1]);
  corner('x0y1', x0, y1, [x0 + CHAMFER, y1], [x0, y1 - CHAMFER]);
  return pts;
}

/** Split a wing into rooms about 9 m long along its axis. */
function wingRooms(w: WingDef): { ring: PointMm[]; k: number }[] {
  const span = w.along === 'x' ? w.x1 - w.x0 : w.y1 - w.y0;
  const n = Math.max(1, Math.round(span / (9 * M)));
  const out: { ring: PointMm[]; k: number }[] = [];
  for (let k = 0; k < n; k++) {
    const a = Math.round((span * k) / n);
    const b = Math.round((span * (k + 1)) / n);
    const [x0, x1, y0, y1] =
      w.along === 'x' ? [w.x0 + a, w.x0 + b, w.y0, w.y1] : [w.x0, w.x1, w.y0 + a, w.y0 + b];
    const ch =
      w.chamfer && ((w.chamfer.startsWith('x0') && k === 0) || (w.chamfer.startsWith('x1') && k === n - 1))
        ? w.chamfer
        : undefined;
    out.push({ ring: rectRing(x0, y0, x1, y1, ch), k });
  }
  return out;
}

interface Draft {
  id: string;
  ring: PointMm[];
  use: Use;
}

function inside(p: [number, number], ring: PointMm[]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function segmentsOf(d: Draft, all: Draft[], outerWwrPm: (dx: number, dy: number) => number): Segment[] {
  return d.ring.map((p, i) => {
    const q = d.ring[(i + 1) % d.ring.length]!;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    // Outward normal of a counter-clockwise ring is (dy, -dx).
    const nx = (q[1] - p[1]) / len;
    const ny = -(q[0] - p[0]) / len;
    const probe: [number, number] = [(p[0] + q[0]) / 2 + nx * 500, (p[1] + q[1]) / 2 + ny * 500];
    const other = all.find((o) => o.id !== d.id && inside(probe, o.ring));
    const id = `${d.id}_s${i}`;
    if (other) {
      // The other room's edge facing back at us: opposite normal, nearest midpoint.
      let j = 0;
      let best = Infinity;
      other.ring.forEach((a, k) => {
        const b = other.ring[(k + 1) % other.ring.length]!;
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const facing = ((b[1] - a[1]) / l) * nx + (-(b[0] - a[0]) / l) * ny;
        if (facing > -0.9) return;
        const dist = Math.abs((a[0] + b[0]) / 2 - probe[0]) + Math.abs((a[1] + b[1]) / 2 - probe[1]);
        if (dist < best) {
          best = dist;
          j = k;
        }
      });
      return {
        id,
        boundary: { kind: 'adjacent', roomId: other.id, segId: `${other.id}_s${j}` },
        window: { kind: 'none' },
        shading: [],
      } satisfies Segment;
    }
    const wwr = d.use === 'circulation' ? 150 : outerWwrPm(nx, ny);
    return {
      id,
      boundary: { kind: 'outdoors' },
      window: len < 2500 ? { kind: 'none' } : { kind: 'ratio', wwrPm: wwr, sill: 900, head: 2400 },
      shading: [],
    } satisfies Segment;
  });
}

function storey(
  id: string,
  name: string,
  level: number,
  uses: (w: WingDef) => Use | null,
  top: boolean,
): Storey {
  const drafts: Draft[] = [];
  for (const w of wings()) {
    const use = uses(w);
    if (!use) continue;
    for (const { ring, k } of wingRooms(w)) drafts.push({ id: `rm_${id}_${w.id}_${k}`, ring, use });
  }
  const rooms: Room2D[] = drafts.map((d) => ({
    id: d.id,
    floor: { outer: d.ring, holes: [] },
    ceiling: FLOOR_TO_FLOOR - 600,
    spaceTypeId: d.use,
    segments: segmentsOf(d, drafts, (_nx, ny) => (ny > 0.5 ? 300 : 350)),
    floorBoundary: level <= 0 ? 'ground' : 'adjacent',
    ceilingBoundary: top ? 'roof' : 'adjacent',
  }));
  return {
    id: `st_${id}`,
    name,
    elevation: level * FLOOR_TO_FLOOR,
    floorToFloor: FLOOR_TO_FLOOR,
    multiplier: 1,
    belowGrade: level < 0,
    rooms,
    rooms3d: [],
    cores: [],
  };
}

/** Pack frame position (m east, north of `IIIT_ORIGIN`) of the plan centre. */
export const VINDHYA_EN: EN = latLonToEN(IIIT_ORIGIN, VINDHYA_CENTRE.lat, VINDHYA_CENTRE.lon);

/** The stand in Vindhya: cellar under C4 and C5, three storeys, flat roof. */
export function vindhyaStandIn(): BuildingDoc {
  const r = (VINDHYA_ROTATION_MDEG / 1000) * (Math.PI / 180);
  const cx = LENGTH / 2;
  const cy = DEPTH / 2;
  // origin so that the plan centre lands on VINDHYA_EN (frame.ts planToEN convention).
  const ox = VINDHYA_EN[0] * 1000 - (cx * Math.cos(r) + cy * Math.sin(r));
  const oy = VINDHYA_EN[1] * 1000 - (-cx * Math.sin(r) + cy * Math.cos(r));
  const cellar = storey(
    'cellar',
    'Cellar',
    -1,
    (w) => (w.id === 'C4' || w.id === 'C5' ? 'lab' : null),
    false,
  );
  const levels = [1, 2, 3].map((n) =>
    storey(
      `l${n}`,
      n === 1 ? 'First floor (entry)' : n === 2 ? 'Second floor' : 'Third floor',
      n - 1,
      (w) => w.uses[n - 1]!,
      n === 3,
    ),
  );
  return {
    schema: 'ibasho.building/1',
    id: VINDHYA_ID,
    version: 1,
    placeId: 'place_iiit_campus',
    name: 'Vindhya Bhavan',
    typeId: 'education',
    origin: { x: Math.round(ox), y: Math.round(oy) },
    rotationMdeg: VINDHYA_ROTATION_MDEG,
    storeys: [cellar, ...levels],
    roofs: [{ id: 'rf_main', storeyId: 'st_l3', shape: 'flat', pvZones: [], skylights: [] }],
    shades: [],
    zones: [],
    systems: [],
  };
}
