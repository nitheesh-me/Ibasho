/**
 * SVG renderer, data half (ARCH 10: fallback without WebGL, and the Pencil stage while the
 * engine is still running). Projects the same house model with the same camera model as WebGL,
 * so the handover from pencil to ink does not jump (G4). Painter's order by depth.
 * Owner: WP-07.
 */
import type { Vec3 } from '@ibasho/core';
import type { ComposedSurface } from '../camera/compose.ts';
import { type CameraModel, cameraBasis, eyeDirection, projectOrtho } from '../camera/model.ts';
import type { ScenePalette } from '../colour/palette.ts';
import { add, centroid, dot } from '../twin/frame.ts';
import type { HouseModel } from '../twin/house.ts';

export interface SvgItem {
  key: string;
  d: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  depth: number;
  elementId?: string;
  junctionId?: string;
  dashed?: boolean;
  /** Section cut drawn as an outline. */
  cut?: boolean;
}

export interface Plinth {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  depth: number;
}

/** The washi plinth the house stands on: a little street at the front, a yard at the back. */
export function plinthOf(house: HouseModel): Plinth {
  const f = house.footprint;
  const front = house.frontNormal;
  const street = 2.4;
  const yard = 1.6;
  const side = 0.6;
  if (Math.abs(front[2]) >= Math.abs(front[0])) {
    const z0 = front[2] < 0 ? f.z0 - street : f.z0 - yard;
    const z1 = front[2] < 0 ? f.z1 + yard : f.z1 + street;
    return { x0: f.x0 - side, x1: f.x1 + side, z0, z1, depth: 0.35 };
  }
  const x0 = front[0] < 0 ? f.x0 - street : f.x0 - yard;
  const x1 = front[0] < 0 ? f.x1 + yard : f.x1 + street;
  return { x0, x1, z0: f.z0 - side, z1: f.z1 + side, depth: 0.35 };
}

const fmt = (n: number): string => (Math.round(n * 100) / 100).toString();

function ring(
  m: CameraModel,
  pts: readonly Vec3[],
  offset: Vec3,
  basis: ReturnType<typeof cameraBasis>,
): string {
  return `${pts
    .map((p, i) => {
      const q = projectOrtho(m, add(p, offset), basis);
      return `${i === 0 ? 'M' : 'L'}${fmt(q.x)} ${fmt(q.y)}`;
    })
    .join(' ')} Z`;
}

export function svgItems(
  house: HouseModel,
  composed: readonly ComposedSurface[],
  camera: CameraModel,
  pal: ScenePalette,
): SvgItem[] {
  const basis = cameraBasis(camera);
  const eye = eyeDirection(camera.azimuthDeg, camera.elevationDeg);
  const out: SvgItem[] = [];

  // Plinth: top face plus the two visible sides.
  const p = plinthOf(house);
  const top: Vec3[] = [
    [p.x0, 0, p.z0],
    [p.x1, 0, p.z0],
    [p.x1, 0, p.z1],
    [p.x0, 0, p.z1],
  ];
  out.push({
    key: 'plinth:top',
    d: ring(camera, top, [0, 0, 0], basis),
    fill: pal.plinth,
    stroke: pal.plinthEdge,
    strokeWidth: 1,
    opacity: 1,
    depth: Number.POSITIVE_INFINITY,
  });
  const sides: [string, Vec3[], Vec3][] = [
    [
      'n',
      [
        [p.x1, 0, p.z0],
        [p.x0, 0, p.z0],
        [p.x0, -p.depth, p.z0],
        [p.x1, -p.depth, p.z0],
      ],
      [0, 0, -1],
    ],
    [
      's',
      [
        [p.x0, 0, p.z1],
        [p.x1, 0, p.z1],
        [p.x1, -p.depth, p.z1],
        [p.x0, -p.depth, p.z1],
      ],
      [0, 0, 1],
    ],
    [
      'w',
      [
        [p.x0, 0, p.z0],
        [p.x0, 0, p.z1],
        [p.x0, -p.depth, p.z1],
        [p.x0, -p.depth, p.z0],
      ],
      [-1, 0, 0],
    ],
    [
      'e',
      [
        [p.x1, 0, p.z1],
        [p.x1, 0, p.z0],
        [p.x1, -p.depth, p.z0],
        [p.x1, -p.depth, p.z1],
      ],
      [1, 0, 0],
    ],
  ];
  for (const [k, pts, n] of sides) {
    if (dot(n, eye) <= 0) continue;
    out.push({
      key: `plinth:${k}`,
      d: ring(camera, pts, [0, 0, 0], basis),
      fill: pal.ground,
      stroke: pal.plinthEdge,
      strokeWidth: 1,
      opacity: 1,
      depth: Number.POSITIVE_INFINITY,
    });
  }

  for (const c of composed) {
    if (c.mode === 'hidden') continue;
    const s = c.surface;
    const facing = dot(s.frame.n, eye) > 0;
    const depth = projectOrtho(camera, add(centroid(s.polygon), c.offset), basis).depth;
    const d = [s.polygon, ...s.holes].map((r) => ring(camera, r, c.offset, basis)).join(' ');
    let fill: string;
    switch (s.role) {
      case 'wall':
        fill = facing ? pal.brick : pal.interiorWall;
        break;
      case 'party-wall':
      case 'gable':
      case 'partition':
        fill = pal.interiorWall;
        break;
      case 'roof-slope':
        fill = facing ? pal.slate : pal.timber;
        break;
      case 'loft-floor':
        fill = pal.quilt;
        break;
      case 'ground-floor':
      case 'intermediate-floor':
        fill = facing ? pal.floorBoards : pal.ceiling;
        break;
      default:
        fill = pal.interiorWall;
    }
    out.push({
      key: s.key,
      d,
      fill: c.mode === 'cut' ? 'none' : fill,
      stroke: c.mode === 'cut' ? pal.sectionCut : pal.ink,
      strokeWidth: c.mode === 'cut' ? 2 : 0.8,
      opacity: c.opacity,
      depth,
      ...(s.elementId ? { elementId: s.elementId } : {}),
      ...(c.mode === 'cut' ? { cut: true, dashed: true } : {}),
    });
  }

  for (const o of house.openings) {
    const depth = projectOrtho(camera, centroid(o.polygon), basis).depth - 0.02;
    out.push({
      key: `opening:${o.elementId}`,
      d: ring(camera, o.polygon, [0, 0, 0], basis),
      fill: o.kind === 'door' ? pal.timber : pal.glass,
      stroke: pal.frame,
      strokeWidth: 1.4,
      opacity: 1,
      depth,
      elementId: o.elementId,
    });
  }

  out.sort((a, b) => b.depth - a.depth);
  return out;
}

/** Junction polylines projected to the SVG (for the lens and seams). */
export function svgJunctions(house: HouseModel, camera: CameraModel): { junctionId: string; d: string }[] {
  const basis = cameraBasis(camera);
  return house.junctions
    .filter((j) => j.path.length >= 2)
    .map((j) => ({
      junctionId: j.junctionId,
      d: j.path
        .map((p, i) => {
          const q = projectOrtho(camera, p, basis);
          return `${i === 0 ? 'M' : 'L'}${fmt(q.x)} ${fmt(q.y)}`;
        })
        .join(' '),
    }));
}
