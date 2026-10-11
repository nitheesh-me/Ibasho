/**
 * Room functions for the painter (BE 2.6, DESIGN_SYSTEM 13.4). Owner: WP-15.
 *
 * Function is shown by a hatch pattern and a short name, never by fill colour, so colour stays free
 * for analysis. Ids match the Preview space loads (`@ibasho/preview` SPACE_LOADS) and the golden
 * fixtures; the type packs (WP-18) will register them as `space-type` plugins.
 */
import type { BuildingTypeId } from '@ibasho/core';

export type Hatch =
  | 'diag'
  | 'cross'
  | 'horiz'
  | 'vert'
  | 'grid'
  | 'dots'
  | 'steps'
  | 'none'
  | 'wave'
  | 'diag-back'
  | 'sparse';

export interface SpaceFunction {
  id: string;
  label: string;
  short: string;
  hatch: Hatch;
  conditioned: boolean;
}

export const SPACE_FUNCTIONS: readonly SpaceFunction[] = [
  { id: 'classroom', label: 'Classroom', short: 'Class', hatch: 'diag', conditioned: true },
  { id: 'lab', label: 'Lab', short: 'Lab', hatch: 'cross', conditioned: true },
  { id: 'lab-heavy', label: 'Heavy lab (fume hoods)', short: 'Heavy lab', hatch: 'grid', conditioned: true },
  { id: 'library', label: 'Library', short: 'Library', hatch: 'vert', conditioned: true },
  { id: 'office', label: 'Office', short: 'Office', hatch: 'horiz', conditioned: true },
  { id: 'office-open', label: 'Open office', short: 'Open', hatch: 'wave', conditioned: true },
  { id: 'assembly', label: 'Hall or auditorium', short: 'Hall', hatch: 'diag-back', conditioned: true },
  { id: 'data-centre', label: 'Data centre', short: 'Data', hatch: 'grid', conditioned: true },
  { id: 'bank', label: 'Bank or shop', short: 'Shop', hatch: 'diag-back', conditioned: true },
  { id: 'lobby', label: 'Lobby', short: 'Lobby', hatch: 'sparse', conditioned: true },
  { id: 'circulation', label: 'Corridor', short: 'Corridor', hatch: 'sparse', conditioned: false },
  { id: 'stair', label: 'Stair', short: 'Stair', hatch: 'steps', conditioned: false },
  { id: 'toilet-core', label: 'Toilets and core', short: 'WC', hatch: 'dots', conditioned: false },
  { id: 'plant', label: 'Plant room', short: 'Plant', hatch: 'none', conditioned: false },
  { id: 'parking', label: 'Parking', short: 'Park', hatch: 'none', conditioned: false },
  { id: 'living', label: 'Living room', short: 'Living', hatch: 'horiz', conditioned: true },
  { id: 'bedroom', label: 'Bedroom', short: 'Bed', hatch: 'diag', conditioned: true },
  { id: 'kitchen', label: 'Kitchen', short: 'Kitchen', hatch: 'cross', conditioned: true },
];

const BY_ID = new Map(SPACE_FUNCTIONS.map((s) => [s.id, s]));
export const spaceFunction = (id: string | undefined): SpaceFunction | undefined =>
  id ? BY_ID.get(id) : undefined;

/** Functions offered first for each building type (the rest stay available). */
export const TYPE_FUNCTIONS: Record<BuildingTypeId, string[]> = {
  education: [
    'classroom',
    'lab',
    'library',
    'office',
    'assembly',
    'data-centre',
    'circulation',
    'toilet-core',
    'stair',
    'plant',
  ],
  office: ['office-open', 'office', 'lobby', 'data-centre', 'circulation', 'toilet-core', 'stair', 'plant'],
  lab: ['lab', 'lab-heavy', 'office', 'circulation', 'toilet-core', 'stair', 'plant'],
  hospital: ['office', 'lab', 'lobby', 'circulation', 'toilet-core', 'stair', 'plant'],
  hotel: ['bedroom', 'lobby', 'kitchen', 'assembly', 'circulation', 'toilet-core', 'stair', 'plant'],
  apartments: ['living', 'bedroom', 'kitchen', 'circulation', 'toilet-core', 'stair', 'parking'],
  rental: ['living', 'bedroom', 'kitchen', 'toilet-core'],
  'single-family': ['living', 'bedroom', 'kitchen', 'toilet-core', 'stair'],
};
