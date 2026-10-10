/**
 * Props from the archetype (BUILD_PLAN WP-07): furniture placed per room so the miniature reads
 * as a home. Pure placement; the WebGL side loads the Kenney and Quaternius models by manifest
 * id and falls back to soft paper blocks of the same size. Props are decoration, never data.
 * Owner: WP-07.
 */
import type { Vec3 } from '@ibasho/core';
import type { HouseModel, Room } from './house.ts';

export interface PropItem {
  key: string;
  /** Manifest id (`kenney-*`, `quaternius-*`). */
  assetId: string;
  roomId: string;
  /** Floor position (base centre), house coordinates. */
  position: Vec3;
  /** Rotation about y, radians. Model fronts face +z. */
  rotY: number;
  /** Fallback block size when the model is absent (x, y, z before rotation). */
  size: Vec3;
}

const S: Record<string, Vec3> = {
  'kenney-lounge-sofa': [1.81, 0.85, 0.76],
  'quaternius-couch-medium': [2.09, 0.85, 0.98],
  'kenney-table-coffee': [1.29, 0.45, 0.78],
  'kenney-rug-rectangle': [2, 0.013, 1.17],
  'quaternius-rug': [1.38, 0.024, 2],
  'kenney-bookcase-open': [0.82, 1.8, 0.51],
  'kenney-lamp-round-floor': [0.28, 1.6, 0.33],
  'quaternius-fireplace': [1.52, 1.2, 0.54],
  'quaternius-curtains-double': [1.76, 2.2, 0.24],
  'kenney-potted-plant': [0.26, 0.8, 0.3],
  'quaternius-houseplant': [0.65, 1, 0.65],
  'kenney-kitchen-cabinet': [0.86, 0.9, 0.9],
  'kenney-kitchen-sink': [0.79, 0.9, 0.83],
  'kenney-kitchen-stove': [0.86, 0.9, 0.9],
  'kenney-kitchen-fridge-small': [0.61, 0.85, 0.41],
  'kenney-kitchen-cabinet-upper': [0.77, 0.7, 0.39],
  'quaternius-table-round-large': [2.48, 0.75, 1.3],
  'kenney-table': [1.93, 0.75, 1.03],
  'quaternius-chair-ladder-back': [0.41, 0.95, 0.44],
  'kenney-chair': [0.38, 0.9, 0.38],
  'kenney-bed-double': [1.61, 0.63, 1.9],
  'kenney-bed-single': [0.96, 0.63, 1.9],
  'quaternius-night-stand': [0.55, 0.55, 0.55],
  'kenney-cabinet-bed-drawer': [0.56, 0.55, 0.45],
  'kenney-lamp-round-table': [0.22, 0.45, 0.25],
  'kenney-bathtub': [1.7, 0.6, 0.8],
  'kenney-toilet': [0.55, 0.8, 0.85],
  'kenney-bathroom-sink': [0.52, 0.85, 0.44],
  'quaternius-towel-rack': [1.63, 0.9, 0.22],
  'kenney-coat-rack-standing': [0.64, 1.8, 0.64],
  'kenney-rug-doormat': [0.8, 0.02, 0.44],
};

/** Rotation that turns a model's +z front to face `d` (a unit axis vector). */
export function facing(d: Vec3): number {
  return Math.atan2(d[0], d[2]);
}

type Frame = {
  /** Point from (along the room width from the stair wall, depth from the room's front). */
  at(w: number, d: number): Vec3;
  /** Unit vectors in house space. */
  intoRoomFromRight: Vec3;
  towardsFront: Vec3;
  towardsRear: Vec3;
  intoRoomFromLeft: Vec3;
  width: number;
  depth: number;
};

function frameOf(house: HouseModel, r: Room): Frame {
  const n = house.frontNormal;
  const alongZ = Math.abs(n[2]) >= Math.abs(n[0]);
  const y = r.min[1];
  if (alongZ) {
    const front = n[2] < 0;
    const width = r.max[0] - r.min[0];
    const depth = r.max[2] - r.min[2];
    return {
      at: (w, d) => (front ? [r.min[0] + w, y, r.min[2] + d] : [r.max[0] - w, y, r.max[2] - d]),
      intoRoomFromRight: front ? [-1, 0, 0] : [1, 0, 0],
      intoRoomFromLeft: front ? [1, 0, 0] : [-1, 0, 0],
      towardsFront: front ? [0, 0, -1] : [0, 0, 1],
      towardsRear: front ? [0, 0, 1] : [0, 0, -1],
      width,
      depth,
    };
  }
  const front = n[0] < 0;
  const width = r.max[2] - r.min[2];
  const depth = r.max[0] - r.min[0];
  return {
    at: (w, d) => (front ? [r.min[0] + d, y, r.max[2] - w] : [r.max[0] - d, y, r.min[2] + w]),
    intoRoomFromRight: front ? [0, 0, 1] : [0, 0, -1],
    intoRoomFromLeft: front ? [0, 0, -1] : [0, 0, 1],
    towardsFront: front ? [-1, 0, 0] : [1, 0, 0],
    towardsRear: front ? [1, 0, 0] : [-1, 0, 0],
    width,
    depth,
  };
}

export function layoutProps(house: HouseModel): PropItem[] {
  const out: PropItem[] = [];
  const put = (r: Room, assetId: string, w: number, d: number, face: Vec3, tag = ''): void => {
    const f = frameOf(house, r);
    out.push({
      key: `${r.id}:${assetId}${tag}`,
      assetId,
      roomId: r.id,
      position: f.at(Math.min(Math.max(w, 0.2), f.width - 0.2), Math.min(Math.max(d, 0.2), f.depth - 0.2)),
      rotY: facing(face),
      size: S[assetId] ?? [0.5, 0.5, 0.5],
    });
  };
  for (const r of house.rooms) {
    const f = frameOf(house, r);
    const W = f.width;
    const D = f.depth;
    switch (r.use) {
      case 'living': {
        const midD = D * 0.52;
        put(r, 'quaternius-fireplace', W - 0.28, midD, f.intoRoomFromRight);
        put(r, 'kenney-rug-rectangle', W * 0.62, midD, f.intoRoomFromRight);
        put(r, 'kenney-table-coffee', W * 0.62, midD, f.intoRoomFromRight);
        put(r, 'quaternius-couch-medium', W * 0.36, midD, f.intoRoomFromLeft);
        put(r, 'kenney-lamp-round-floor', W * 0.3, D - 0.35, f.towardsFront);
        put(r, 'kenney-bookcase-open', W - 0.27, 0.6, f.intoRoomFromRight);
        put(r, 'quaternius-curtains-double', W * 0.72, 0.15, f.towardsRear);
        put(r, 'kenney-potted-plant', W * 0.45, 0.35, f.towardsRear);
        put(r, 'kenney-rug-doormat', 0.6, 0.45, f.towardsRear);
        break;
      }
      case 'kitchen': {
        put(r, 'kenney-kitchen-fridge-small', W - 0.24, 0.55, f.intoRoomFromRight);
        put(r, 'kenney-kitchen-stove', W - 0.45, D * 0.45, f.intoRoomFromRight);
        put(r, 'kenney-kitchen-cabinet', W - 0.45, D * 0.45 + 0.86, f.intoRoomFromRight);
        put(r, 'kenney-kitchen-cabinet', W - 0.45, D - 0.45, f.towardsFront, ':corner');
        put(r, 'kenney-kitchen-sink', W * 0.73, D - 0.42, f.towardsFront);
        put(r, 'kenney-kitchen-cabinet', W * 0.73 - 0.85, D - 0.45, f.towardsFront, ':2');
        put(r, 'quaternius-table-round-large', W * 0.4, D * 0.42, f.towardsFront);
        put(r, 'quaternius-chair-ladder-back', W * 0.4, D * 0.42 - 0.62, f.towardsRear, ':a');
        put(r, 'quaternius-chair-ladder-back', W * 0.4, D * 0.42 + 0.62, f.towardsFront, ':b');
        put(r, 'quaternius-chair-ladder-back', W * 0.4 - 0.85, D * 0.42, f.intoRoomFromLeft, ':c');
        put(r, 'quaternius-houseplant', 0.45, D - 0.45, f.towardsFront);
        break;
      }
      case 'bedroom': {
        const dbl = D > 3;
        put(r, dbl ? 'kenney-bed-double' : 'kenney-bed-single', W - 1.0, D * 0.5, f.intoRoomFromRight);
        put(r, 'quaternius-night-stand', W - 0.3, D * 0.5 - (dbl ? 1.15 : 0.8), f.intoRoomFromRight);
        put(r, 'kenney-lamp-round-table', W - 0.3, D * 0.5 - (dbl ? 1.15 : 0.8), f.intoRoomFromRight, ':lamp');
        if (dbl) put(r, 'quaternius-curtains-double', W * 0.7, 0.15, f.towardsRear);
        break;
      }
      case 'bathroom': {
        put(r, 'kenney-bathtub', W * 0.55, D - 0.42, f.towardsFront);
        put(r, 'kenney-toilet', W - 0.45, D * 0.3, f.intoRoomFromRight);
        put(r, 'kenney-bathroom-sink', 0.35 + 0.95, 0.3, f.towardsRear);
        put(r, 'quaternius-towel-rack', W - 0.15, D * 0.62, f.intoRoomFromRight);
        break;
      }
      case 'hall':
        break;
    }
  }
  // Lamps on night stands sit on top of them.
  for (const p of out) {
    if (p.assetId === 'kenney-lamp-round-table') p.position = [p.position[0], p.position[1] + 0.55, p.position[2]];
  }
  return out;
}
