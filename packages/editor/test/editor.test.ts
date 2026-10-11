import type { BuildingDoc, PointMm } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import {
  addRoom,
  addStoreyAbove,
  areaMm2,
  edgeBin,
  edit,
  emptyHistory,
  facadeMeters,
  mergeRooms,
  overlapArea,
  parseLength,
  parseSize,
  record,
  rect,
  redo,
  setFacade,
  setShading,
  snapPoint,
  splitRing,
  splitRoom,
  storeyChecks,
  undo,
} from '../src/index.ts';

const empty = (): BuildingDoc => ({
  schema: 'ibasho.building/1',
  id: 'bd_t',
  version: 1,
  placeId: 'pl',
  name: 'T',
  typeId: 'office',
  origin: { x: 0, y: 0 },
  rotationMdeg: 0,
  storeys: [
    {
      id: 'st_0',
      name: 'Ground floor',
      elevation: 0,
      floorToFloor: 3600,
      multiplier: 1,
      belowGrade: false,
      rooms: [],
      rooms3d: [],
      cores: [],
    },
  ],
  roofs: [],
  shades: [],
  zones: [],
  systems: [],
});

describe('geometry', () => {
  it('areas are exact mm² and splits conserve area', () => {
    const r = rect([0, 0], [12_000, 8_000]);
    expect(areaMm2({ outer: r, holes: [] })).toBe(96_000_000n);
    const parts = splitRing(r, 'x', 5_000);
    expect(parts).not.toBeNull();
    const [a, b] = parts as [PointMm[], PointMm[]];
    expect(areaMm2({ outer: a, holes: [] }) + areaMm2({ outer: b, holes: [] })).toBe(96_000_000n);
    expect(overlapArea(a, b)).toBe(0);
    expect(overlapArea(r, rect([6_000, 4_000], [20_000, 20_000]))).toBe(6_000 * 4_000);
  });

  it('names facade bins from the outward normal and the rotation', () => {
    const r = rect([0, 0], [10, 10]);
    expect(edgeBin(r, 0)).toBe('S');
    expect(edgeBin(r, 1)).toBe('E');
    expect(edgeBin(r, 2)).toBe('N');
    expect(edgeBin(r, 3)).toBe('W');
    expect(edgeBin(r, 0, 90_000)).toBe('W');
  });

  it('snaps to vertices first, then the grid, and parses typed lengths', () => {
    const ctx = { grid: 100, tol: 300, vertices: [[1_000, 1_000] as PointMm], edges: [] };
    expect(snapPoint([1_120, 980], ctx)).toEqual({ pt: [1_000, 1_000], kind: 'edge' });
    expect(snapPoint([5_049, 3_951], ctx).pt).toEqual([5_000, 4_000]);
    expect(parseLength('4.2')).toBe(4_200);
    expect(parseLength('4200 mm')).toBe(4_200);
    expect(parseLength(`23'6"`)).toBe(7_163);
    expect(parseSize('12 x 8')).toEqual([12_000, 8_000]);
  });
});

describe('commands', () => {
  it('draw, split, merge with undo and redo as patches', () => {
    let doc = empty();
    let h = emptyHistory();
    const step = (label: string, r: Parameters<typeof edit>[2]) => {
      const out = edit(doc, label, r);
      doc = out.doc;
      if (out.cmd) h = record(h, out.cmd);
    };
    step('Draw', addRoom('st_0', rect([0, 0], [12_000, 8_000]), { id: 'rm_a', spaceTypeId: 'office-open' }));
    step('Split', splitRoom('st_0', 'rm_a', 'x', 6_000));
    const rooms = doc.storeys[0]?.rooms ?? [];
    expect(rooms).toHaveLength(2);
    // The new partition is shared and symmetric (adjacent both ways, no window).
    const shared = rooms.flatMap((r) => r.segments.filter((s) => s.boundary.kind === 'adjacent'));
    expect(shared).toHaveLength(2);
    expect(shared.every((s) => s.window.kind === 'none')).toBe(true);
    expect(storeyChecks(doc.storeys[0] as never).filter((c) => c.kind === 'overlap')).toHaveLength(0);
    step('Merge', mergeRooms('st_0', rooms[0]?.id ?? '', rooms[1]?.id ?? ''));
    expect(doc.storeys[0]?.rooms).toHaveLength(1);
    const u = undo(h, doc);
    expect(u?.doc.storeys[0]?.rooms).toHaveLength(2);
    const r = redo(u?.history ?? h, u?.doc ?? doc);
    expect(r?.doc.storeys[0]?.rooms).toHaveLength(1);
  });

  it('facade levers set WWR on every floor and meters read them', () => {
    let doc = edit(empty(), 'Draw', addRoom('st_0', rect([0, 0], [20_000, 10_000]))).doc;
    doc = edit(doc, 'Up', addStoreyAbove('st_0', 'rooms', 'st_1')).doc;
    doc = edit(doc, 'WWR', setFacade('all', 'S', { wwrPm: 400 })).doc;
    const s = facadeMeters(doc).find((m) => m.bin === 'S');
    expect(s?.wwrPm).toBe(400);
    expect(doc.storeys.map((x) => x.elevation)).toEqual([0, 3_600]);
    const seg = doc.storeys[0]?.rooms[0]?.segments[0];
    doc = edit(
      doc,
      'Shade',
      setShading('st_0', doc.storeys[0]?.rooms[0]?.id ?? '', seg?.id ?? '', [
        { kind: 'overhang', depth: 600, aboveHead: 150, extension: 300 },
      ]),
    ).doc;
    // PF = 600 / (2400 + 150 - 900)
    expect(facadeMeters(doc).find((m) => m.bin === 'S')?.pf).toBeCloseTo(600 / 1650, 6);
  });
});
